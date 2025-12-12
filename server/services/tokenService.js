/**
 * @fileoverview Service centralisé pour la gestion des tokens EVE SSO OAuth
 * @module services/tokenService
 */

import axios from 'axios';
import dbHelpers from '../database/helpers.js';
import logger from '../utils/logger.js';

const EVE_SSO_TOKEN_URL = 'https://login.eveonline.com/v2/oauth/token';

/**
 * Rafraîchit le token d'accès d'un personnage
 * Récupère le refresh_token depuis la base de données et l'échange contre un nouveau access_token
 *
 * @param {number} characterId - L'ID du personnage Eve Online
 * @returns {Promise<string>} Le nouveau token d'accès
 * @throws {Error} Si le refresh échoue ou si le personnage n'existe pas
 *
 * @example
 * const newToken = await refreshAccessToken(123456);
 */
export async function refreshAccessToken(characterId) {
  try {
    // Récupérer le refresh token depuis la DB
    const character = await dbHelpers.get(
      'SELECT refresh_token FROM characters WHERE character_id = ?',
      [characterId]
    );

    if (!character || !character.refresh_token) {
      throw new Error('No refresh token found for character');
    }

    // Créer l'en-tête d'authentification Basic
    const authHeader = Buffer.from(
      `${process.env.EVE_CLIENT_ID}:${process.env.EVE_CLIENT_SECRET}`
    ).toString('base64');

    // Échanger le refresh token contre un nouveau access token
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

    // Mettre à jour les tokens dans la base de données
    await dbHelpers.run(
      `UPDATE characters
       SET access_token = ?,
           refresh_token = ?,
           token_expires_at = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE character_id = ?`,
      [access_token, refresh_token, tokenExpiresAt, characterId]
    );

    logger.info('Token refreshed successfully', { characterId });
    return access_token;

  } catch (error) {
    logger.error('Failed to refresh access token', {
      characterId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Récupère un token d'accès valide pour un personnage
 * Si le token expire dans moins de 5 minutes, il est automatiquement rafraîchi
 *
 * @param {number} characterId - L'ID du personnage Eve Online
 * @returns {Promise<string>} Un token d'accès valide
 * @throws {Error} Si le personnage n'existe pas ou si le refresh échoue
 *
 * @example
 * const token = await getValidAccessToken(123456);
 * const response = await axios.get('https://esi.evetech.net/...', {
 *   headers: { Authorization: `Bearer ${token}` }
 * });
 */
export async function getValidAccessToken(characterId) {
  try {
    // Récupérer le token actuel et sa date d'expiration
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
      // Token expiré ou va expirer bientôt, le rafraîchir
      logger.debug('Token expiring soon, refreshing', {
        characterId,
        expiresAt: expiresAt.toISOString()
      });
      return await refreshAccessToken(characterId);
    }

    // Token valide, le retourner
    return character.access_token;

  } catch (error) {
    logger.error('Failed to get valid access token', {
      characterId,
      error: error.message
    });
    throw error;
  }
}

export default {
  refreshAccessToken,
  getValidAccessToken
};
