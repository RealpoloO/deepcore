import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import dbHelpers from '../database/helpers.js';
import logger from '../utils/logger.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

const EVE_SSO_BASE = 'https://login.eveonline.com';
const EVE_SSO_AUTH_URL = `${EVE_SSO_BASE}/v2/oauth/authorize`;
const EVE_SSO_TOKEN_URL = `${EVE_SSO_BASE}/v2/oauth/token`;
const EVE_SSO_VERIFY_URL = `${EVE_SSO_BASE}/oauth/verify`;

/**
 * Rafraîchit le token d'accès d'un personnage
 * @param {number} characterId - L'ID du personnage
 * @returns {Promise<string>} Le nouveau token d'accès
 */
async function refreshAccessToken(characterId) {
  try {
    const character = await dbHelpers.get(
      'SELECT refresh_token FROM characters WHERE character_id = ?',
      [characterId]
    );

    if (!character || !character.refresh_token) {
      throw new Error('No refresh token found');
    }

    const authHeader = Buffer.from(
      `${process.env.EVE_CLIENT_ID}:${process.env.EVE_CLIENT_SECRET}`
    ).toString('base64');

    const response = await axios.post(
      EVE_SSO_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: character.refresh_token
      }),
      {
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, refresh_token, expires_in } = response.data;
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Mettre à jour le token dans la base de données
    await dbHelpers.run(
      `UPDATE characters SET 
        access_token = ?, 
        refresh_token = ?, 
        token_expires_at = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE character_id = ?`,
      [access_token, refresh_token, tokenExpiresAt, characterId]
    );

    logger.info(`Token refreshed for character ${characterId}`);
    return access_token;
  } catch (error) {
    logger.error(`Failed to refresh token for character ${characterId}`, { error: error.message });
    throw error;
  }
}

/**
 * Récupère un token d'accès valide pour un personnage (refresh si nécessaire)
 * @param {number} characterId - L'ID du personnage
 * @returns {Promise<string>} Le token d'accès valide
 */
async function getValidAccessToken(characterId) {
  const character = await dbHelpers.get(
    'SELECT access_token, token_expires_at FROM characters WHERE character_id = ?',
    [characterId]
  );

  if (!character) {
    throw new Error('Character not found');
  }

  // Vérifier si le token expire dans moins de 5 minutes
  const expiresAt = new Date(character.token_expires_at);
  const now = new Date();
  const fiveMinutes = 5 * 60 * 1000;

  if (expiresAt.getTime() - now.getTime() < fiveMinutes) {
    // Token expiré ou va expirer, le rafraîchir
    return await refreshAccessToken(characterId);
  }

  return character.access_token;
}

// Generate authorization URL
router.get('/login', authLimiter, (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;

  const params = new URLSearchParams({
    response_type: 'code',
    redirect_uri: process.env.EVE_CALLBACK_URL,
    client_id: process.env.EVE_CLIENT_ID,
    scope: 'esi-industry.read_character_mining.v1 esi-industry.read_character_jobs.v1',
    state: state
  });

  const authUrl = `${EVE_SSO_AUTH_URL}?${params.toString()}`;
  res.json({ authUrl });
});

// OAuth callback
router.get('/callback', authLimiter, async (req, res) => {
  const { code, state } = req.query;

  // Verify state to prevent CSRF
  if (!state || state !== req.session.oauthState) {
    return res.redirect(`${process.env.CLIENT_URL}?error=invalid_state`);
  }

  try {
    // Exchange code for tokens
    const authHeader = Buffer.from(
      `${process.env.EVE_CLIENT_ID}:${process.env.EVE_CLIENT_SECRET}`
    ).toString('base64');

    const tokenResponse = await axios.post(
      EVE_SSO_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code
      }),
      {
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Verify token and get character info
    const verifyResponse = await axios.get(EVE_SSO_VERIFY_URL, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });

    const characterData = verifyResponse.data;
    const characterId = characterData.CharacterID;
    const characterName = characterData.CharacterName;

    // Get additional character info from ESI
    const esiResponse = await axios.get(
      `https://esi.evetech.net/latest/characters/${characterId}/`,
      { headers: { 'Authorization': `Bearer ${access_token}` } }
    );

    const { corporation_id } = esiResponse.data;

    // Get corporation name
    let corporationName = null;
    try {
      const corpResponse = await axios.get(
        `https://esi.evetech.net/latest/corporations/${corporation_id}/`
      );
      corporationName = corpResponse.data.name;
    } catch (error) {
      logger.warn('Error fetching corporation', { error: error.message });
    }

    // Get or create user
    let userId = req.session.userId;
    
    // Check if character already exists and get its user_id
    const existingCharacter = await dbHelpers.get('SELECT user_id FROM characters WHERE character_id = ?', [characterId]);
    
    if (existingCharacter) {
      // Character exists, use its user_id
      userId = existingCharacter.user_id;
      req.session.userId = userId;
      // Update session_id for this user
      await dbHelpers.run('UPDATE users SET session_id = ? WHERE id = ?', [req.sessionID, userId]);
    } else if (!userId) {
      // New character and no session user - create a new user
      const sessionId = req.sessionID;
      const result = await dbHelpers.run('INSERT INTO users (session_id) VALUES (?)', [sessionId]);
      userId = result.lastID;
      req.session.userId = userId;
    }

    // Calculate token expiration
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Check if this is the first character for this user
    const existingChars = await dbHelpers.get('SELECT COUNT(*) as count FROM characters WHERE user_id = ?', [userId]);
    const isPrimary = existingChars.count === 0 ? 1 : 0;

    // Save or update character
    // Check if character exists
    const existingChar = await dbHelpers.get('SELECT character_id FROM characters WHERE character_id = ?', [characterId]);
    
    if (existingChar) {
      await dbHelpers.run(`
        UPDATE characters SET
          character_name = ?,
          corporation_id = ?,
          corporation_name = ?,
          access_token = ?,
          refresh_token = ?,
          token_expires_at = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE character_id = ?
      `, [characterName, corporation_id, corporationName, access_token, refresh_token, tokenExpiresAt, characterId]);
    } else {
      await dbHelpers.run(`
        INSERT INTO characters (
          character_id, user_id, character_name, corporation_id, corporation_name,
          access_token, refresh_token, token_expires_at, is_primary
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [characterId, userId, characterName, corporation_id, corporationName, access_token, refresh_token, tokenExpiresAt, isPrimary]);
    }

    logger.info(`Character authenticated`, {
      characterName,
      characterId,
      userId
    });

    // Redirect to frontend dashboard
    res.redirect(`${process.env.CLIENT_URL}/dashboard`);

  } catch (error) {
    logger.error('Auth error', {
      error: error.response?.data || error.message,
      stack: error.stack
    });
    res.redirect(`${process.env.CLIENT_URL}?error=auth_failed`);
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.json({ success: true });
  });
});

// Check auth status
router.get('/status', async (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.json({ authenticated: false, characters: [] });
  }

  const characters = await dbHelpers.all(
    'SELECT character_id, character_name, corporation_name, is_primary FROM characters WHERE user_id = ?',
    [userId]
  );

  res.json({
    authenticated: characters.length > 0,
    characters: characters
  });
});

// Export router and utility functions
export default router;
export { getValidAccessToken, refreshAccessToken };
