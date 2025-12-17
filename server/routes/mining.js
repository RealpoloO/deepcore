import express from 'express';
import axios from 'axios';
import dbHelpers from '../database/helpers.js';
import esiService from '../services/esi.js';
import sdeService from '../services/sde.js';
import logger from '../utils/logger.js';
import { syncLimiter } from '../middleware/rateLimiter.js';
import { validate, characterIdSchema } from '../middleware/validation.js';
import { requireAuth } from '../middleware/auth.js';
import { getValidAccessToken } from '../services/tokenService.js';

const router = express.Router();

const ESI_BASE = 'https://esi.evetech.net/latest';

// Sync mining data for a character
router.post('/sync/:characterId', requireAuth, syncLimiter, validate(characterIdSchema, 'params'), async (req, res) => {
  const { characterId } = req.params;
  const userId = req.session.userId;

  try {
    // Verify character belongs to user
    const character = await dbHelpers.get(
      'SELECT character_id FROM characters WHERE character_id = ? AND user_id = ?',
      [characterId, userId]
    );

    if (!character) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const accessToken = await getValidAccessToken(characterId);

    // Fetch mining ledger from ESI
    const response = await axios.get(
      `${ESI_BASE}/characters/${characterId}/mining/`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    const miningData = response.data;
    let inserted = 0;
    let updated = 0;

    // Utiliser une transaction pour améliorer les performances
    await dbHelpers.run('BEGIN TRANSACTION');

    try {
      // Récupérer tous les records existants pour ce personnage en une seule requête
      const existingRecords = await dbHelpers.all(
        'SELECT date, solar_system_id, type_id, id, quantity FROM mining_records WHERE character_id = ?',
        [characterId]
      );

      // Créer un Map pour lookup rapide
      const existingMap = new Map();
      existingRecords.forEach(record => {
        const key = `${record.date}|${record.solar_system_id}|${record.type_id}`;
        existingMap.set(key, record);
      });

      // Préparer les opérations
      const insertPromises = [];
      const updatePromises = [];

      for (const record of miningData) {
        const key = `${record.date}|${record.solar_system_id}|${record.type_id}`;
        const existing = existingMap.get(key);

        if (existing) {
          // Mettre à jour seulement si la quantité a changé
          if (existing.quantity !== record.quantity) {
            updatePromises.push(
              dbHelpers.run(
                'UPDATE mining_records SET quantity = ?, synced_at = CURRENT_TIMESTAMP WHERE id = ?',
                [record.quantity, existing.id]
              )
            );
            updated++;
          }
        } else {
          // Nouveau record
          insertPromises.push(
            dbHelpers.run(
              'INSERT INTO mining_records (character_id, date, solar_system_id, type_id, quantity) VALUES (?, ?, ?, ?, ?)',
              [characterId, record.date, record.solar_system_id, record.type_id, record.quantity]
            )
          );
          inserted++;
        }
      }

      // Exécuter toutes les opérations
      await Promise.all([...insertPromises, ...updatePromises]);

      await dbHelpers.run('COMMIT');

      logger.info(`Mining sync completed`, {
        characterId,
        totalRecords: miningData.length,
        inserted,
        updated
      });

      res.json({
        success: true,
        records: miningData.length,
        inserted: inserted,
        updated: updated
      });
    } catch (error) {
      // Rollback en cas d'erreur
      await dbHelpers.run('ROLLBACK');
      throw error;
    }

  } catch (error) {
    logger.error('Mining sync error', {
      characterId,
      error: error.response?.data || error.message,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Failed to sync mining data',
      details: error.response?.data?.error || error.message
    });
  }
});

// Get mining data for a character
router.get('/:characterId', requireAuth, validate(characterIdSchema, 'params'), async (req, res) => {
  const { characterId } = req.params;
  const userId = req.session.userId;
  const { startDate, endDate } = req.query;

  // Verify character belongs to user
  const character = await dbHelpers.get(
    'SELECT character_id FROM characters WHERE character_id = ? AND user_id = ?',
    [characterId, userId]
  );

  if (!character) {
    return res.status(403).json({ error: 'Access denied' });
  }

  let query = `
    SELECT date, solar_system_id, type_id, quantity, synced_at
    FROM mining_records
    WHERE character_id = ?
  `;
  const params = [characterId];

  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY date DESC';

  const records = await dbHelpers.all(query, params);

  res.json({ records });
});

// Get aggregated mining stats for all characters
router.get('/stats/all', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { startDate, endDate } = req.query;

  let query = `
    SELECT
      c.character_id,
      c.character_name,
      m.type_id,
      SUM(m.quantity) as total_quantity,
      COUNT(DISTINCT m.date) as mining_days
    FROM mining_records m
    JOIN characters c ON m.character_id = c.character_id
    WHERE c.user_id = ?
  `;
  const params = [userId];

  if (startDate) {
    query += ' AND m.date >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND m.date <= ?';
    params.push(endDate);
  }

  query += ' GROUP BY c.character_id, c.character_name, m.type_id';

  const stats = await dbHelpers.all(query, params);

  // Enrichir avec les volumes depuis le SDE
  const enrichedStats = stats.map(stat => {
    const type = sdeService.getTypeById(stat.type_id);
    const volume = type ? type.volume : 1;
    return {
      ...stat,
      total_quantity: stat.total_quantity * volume
    };
  });

  // Trier par quantité totale
  enrichedStats.sort((a, b) => b.total_quantity - a.total_quantity);

  res.json({ stats: enrichedStats });
});

// Get mining summary by ore type
router.get('/stats/by-ore', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { startDate, endDate } = req.query;

  let query = `
    SELECT
      m.type_id,
      SUM(m.quantity) as total_quantity,
      COUNT(DISTINCT m.character_id) as characters_mined,
      COUNT(DISTINCT m.date) as days_mined
    FROM mining_records m
    JOIN characters c ON m.character_id = c.character_id
    WHERE c.user_id = ?
  `;
  const params = [userId];

  if (startDate) {
    query += ' AND m.date >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND m.date <= ?';
    params.push(endDate);
  }

  query += ' GROUP BY m.type_id';

  const oreStats = await dbHelpers.all(query, params);

  // Enrichir avec les volumes depuis le SDE
  const enrichedOreStats = oreStats.map(stat => {
    const type = sdeService.getTypeById(stat.type_id);
    const volume = type ? type.volume : 1;
    return {
      ...stat,
      total_quantity: stat.total_quantity * volume
    };
  });

  // Trier par quantité totale
  enrichedOreStats.sort((a, b) => b.total_quantity - a.total_quantity);

  // Calculer les stats globales
  let globalQuery = `
    SELECT
      COUNT(DISTINCT m.date) as total_days,
      COUNT(DISTINCT m.character_id) as active_characters,
      COUNT(DISTINCT m.type_id) as unique_ores
    FROM mining_records m
    JOIN characters c ON m.character_id = c.character_id
    WHERE c.user_id = ?
  `;
  const globalParams = [userId];

  if (startDate) {
    globalQuery += ' AND m.date >= ?';
    globalParams.push(startDate);
  }

  if (endDate) {
    globalQuery += ' AND m.date <= ?';
    globalParams.push(endDate);
  }

  const globalStats = await dbHelpers.get(globalQuery, globalParams);

  res.json({ oreStats: enrichedOreStats, globalStats });
});

// Get ore type names (with cache)
router.post('/ore-names', requireAuth, async (req, res) => {
  try {
    const { typeIds } = req.body;
    
    if (!Array.isArray(typeIds)) {
      return res.status(400).json({ error: 'typeIds must be an array' });
    }

    const oreNames = await esiService.getOreTypeNames(typeIds);
    
    res.json({ oreNames });
  } catch (error) {
    logger.error('Error fetching ore names', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch ore names' });
  }
});

// Get ore type info (name + volume) with cache
router.post('/ore-info', requireAuth, async (req, res) => {
  try {
    const { typeIds } = req.body;
    
    if (!Array.isArray(typeIds)) {
      return res.status(400).json({ error: 'typeIds must be an array' });
    }

    const oreInfo = await esiService.getOreTypesInfo(typeIds);
    
    res.json({ oreInfo });
  } catch (error) {
    logger.error('Error fetching ore info', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch ore info' });
  }
});

// Get calendar data - m³ mined per day for a specific month
router.get('/calendar/:year/:month', requireAuth, async (req, res) => {
  try {
    const { year, month } = req.params;
    const userId = req.session.userId;
    
    // Validate year and month
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ error: 'Invalid year or month' });
    }

    // Get all characters for this user
    const characters = await dbHelpers.all(
      'SELECT character_id FROM characters WHERE user_id = ?',
      [userId]
    );

    if (characters.length === 0) {
      return res.json({ days: {} });
    }

    const characterIds = characters.map(c => c.character_id);
    const placeholders = characterIds.map(() => '?').join(',');

    // Get mining data for the month with volumes
    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(yearNum, monthNum, 0).getDate();
    const lastDayStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const query = `
      SELECT
        DATE(m.date) as mining_date,
        m.type_id,
        SUM(m.quantity) as total_quantity
      FROM mining_records m
      WHERE m.character_id IN (${placeholders})
        AND DATE(m.date) >= DATE(?)
        AND DATE(m.date) <= DATE(?)
      GROUP BY DATE(m.date), m.type_id
      ORDER BY mining_date
    `;

    const records = await dbHelpers.all(query, [...characterIds, firstDay, lastDayStr]);

    // Organize by day with volumes from SDE
    const days = {};
    for (const record of records) {
      const day = record.mining_date;
      const type = sdeService.getTypeById(record.type_id);
      const volume = type ? type.volume : 1;
      const total_volume = record.total_quantity * volume;

      if (!days[day]) {
        days[day] = {
          total_volume: 0,
          ores: []
        };
      }
      days[day].total_volume += total_volume;
      days[day].ores.push({
        type_id: record.type_id,
        quantity: record.total_quantity,
        volume: total_volume
      });
    }

    res.json({ days });
  } catch (error) {
    logger.error('Error fetching calendar data', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch calendar data' });
  }
});

export default router;
