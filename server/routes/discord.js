import express from 'express';
import axios from 'axios';
import dbHelpers from '../database/helpers.js';
import logger from '../utils/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { discordLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

const DISCORD_API = 'https://discord.com/api/v10';
const DISCORD_OAUTH_URL = 'https://discord.com/api/oauth2/authorize';
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';

// Initiate Discord OAuth flow
router.get('/login', requireAuth, discordLimiter, (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_CALLBACK_URL,
    response_type: 'code',
    scope: 'identify',
    state: req.session.userId.toString()
  });

  const authUrl = `${DISCORD_OAUTH_URL}?${params.toString()}`;
  res.json({ authUrl });
});

// Discord OAuth callback
router.get('/callback', discordLimiter, async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.redirect(`${process.env.CLIENT_URL}/dashboard?discord_error=invalid_request`);
  }

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post(
      DISCORD_TOKEN_URL,
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.DISCORD_CALLBACK_URL
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Get user info
    const userResponse = await axios.get(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const { id: discordId, username } = userResponse.data;
    const userId = parseInt(state);

    // Calculate token expiration
    const expiresAt = Date.now() + (expires_in * 1000);

    // Update user with Discord info
    await dbHelpers.run(
      `UPDATE users 
       SET discord_id = ?, discord_username = ?, discord_access_token = ?, 
           discord_refresh_token = ?, discord_token_expires_at = ?
       WHERE id = ?`,
      [discordId, username, access_token, refresh_token, expiresAt, userId]
    );

    logger.info('Discord OAuth successful', { userId, discordId, username });
    res.redirect(`${process.env.CLIENT_URL}/dashboard?discord_success=1`);
  } catch (error) {
    logger.error('Discord OAuth error', {
      error: error.response?.data || error.message,
      stack: error.stack
    });
    res.redirect(`${process.env.CLIENT_URL}/dashboard?discord_error=auth_failed`);
  }
});

// Disconnect Discord
router.post('/disconnect', requireAuth, discordLimiter, async (req, res) => {
  try {
    await dbHelpers.run(
      `UPDATE users 
       SET discord_id = NULL, discord_username = NULL, discord_access_token = NULL,
           discord_refresh_token = NULL, discord_token_expires_at = NULL
       WHERE id = ?`,
      [req.session.userId]
    );

    logger.info('Discord disconnected', { userId: req.session.userId });
    res.json({ message: 'Discord disconnected successfully' });
  } catch (error) {
    logger.error('Discord disconnect error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to disconnect Discord' });
  }
});

// Get Discord status
router.get('/status', requireAuth, async (req, res) => {
  try {
    const user = await dbHelpers.get(
      'SELECT discord_id, discord_username FROM users WHERE id = ?',
      [req.session.userId]
    );

    res.json({
      connected: !!user.discord_id,
      username: user.discord_username
    });
  } catch (error) {
    logger.error('Discord status error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to get Discord status' });
  }
});

export default router;
