import express from 'express';
import axios from 'axios';
import dbHelpers from '../database/helpers.js';
import logger from '../utils/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { getValidAccessToken } from '../services/tokenService.js';

const router = express.Router();

// Get all characters for current user
router.get('/', requireAuth, async (req, res) => {
  const characters = await dbHelpers.all(`
    SELECT 
      character_id, character_name, corporation_id, corporation_name,
      alliance_id, alliance_name, is_primary, created_at, updated_at
    FROM characters 
    WHERE user_id = ?
    ORDER BY is_primary DESC, character_name ASC
  `, [req.session.userId]);

  res.json({ characters });
});

// Set primary character
router.post('/:characterId/set-primary', requireAuth, async (req, res) => {
  const { characterId } = req.params;
  const userId = req.session.userId;

  // Verify character belongs to user
  const character = await dbHelpers.get(
    'SELECT character_id FROM characters WHERE character_id = ? AND user_id = ?',
    [characterId, userId]
  );

  if (!character) {
    return res.status(404).json({ error: 'Character not found' });
  }

  // Update primary status
  await dbHelpers.run('UPDATE characters SET is_primary = 0 WHERE user_id = ?', [userId]);
  await dbHelpers.run('UPDATE characters SET is_primary = 1 WHERE character_id = ?', [characterId]);

  res.json({ success: true });
});

// Remove character
router.delete('/:characterId', requireAuth, async (req, res) => {
  const { characterId } = req.params;
  const userId = req.session.userId;

  const result = await dbHelpers.run(
    'DELETE FROM characters WHERE character_id = ? AND user_id = ?',
    [characterId, userId]
  );

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Character not found' });
  }

  // If we deleted the primary, set another as primary
  const remainingChars = await dbHelpers.get(
    'SELECT character_id FROM characters WHERE user_id = ? ORDER BY created_at ASC LIMIT 1',
    [userId]
  );

  if (remainingChars) {
    await dbHelpers.run('UPDATE characters SET is_primary = 1 WHERE character_id = ?',
      [remainingChars.character_id]);
  }

  res.json({ success: true });
});

// Sync character data (refresh corporation info, etc.)
router.post('/:characterId/sync', requireAuth, async (req, res) => {
  const { characterId } = req.params;
  const userId = req.session.userId;

  try {
    const accessToken = await getValidAccessToken(characterId);

    // Get character info
    const charResponse = await axios.get(
      `https://esi.evetech.net/latest/characters/${characterId}/`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    const { corporation_id } = charResponse.data;

    // Get corporation name
    const corpResponse = await axios.get(
      `https://esi.evetech.net/latest/corporations/${corporation_id}/`
    );

    await dbHelpers.run(`
      UPDATE characters 
      SET corporation_id = ?, corporation_name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE character_id = ? AND user_id = ?
    `, [corporation_id, corpResponse.data.name, characterId, userId]);

    res.json({ success: true });
  } catch (error) {
    logger.error('Character sync error', {
      characterId,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Failed to sync character' });
  }
});

export default router;
