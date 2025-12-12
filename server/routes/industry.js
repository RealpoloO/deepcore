import express from 'express';
import axios from 'axios';
import dbHelpers from '../database/helpers.js';
import logger from '../utils/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { getValidAccessToken } from '../services/tokenService.js';

const router = express.Router();

const ESI_BASE = 'https://esi.evetech.net/latest';

// Sync industry jobs from ESI to database
router.post('/sync/:characterId', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const characterId = parseInt(req.params.characterId);

    // Verify character belongs to user
    const character = await dbHelpers.get(
      'SELECT character_id, character_name FROM characters WHERE character_id = ? AND user_id = ?',
      [characterId, userId]
    );

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const token = await getValidAccessToken(characterId);
    
    // Fetch jobs from ESI
    const response = await axios.get(
      `${ESI_BASE}/characters/${characterId}/industry/jobs/`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    // Get unique product type IDs
    const productTypeIds = [...new Set(response.data.map(job => job.product_type_id).filter(Boolean))];
    
    // Fetch product names from ESI
    const productNames = {};
    if (productTypeIds.length > 0) {
      try {
        const namesResponse = await axios.post(
          `${ESI_BASE}/universe/names/`,
          productTypeIds,
          {
            headers: { 'Content-Type': 'application/json' }
          }
        );
        namesResponse.data.forEach(item => {
          productNames[item.id] = item.name;
        });
      } catch (error) {
        logger.error('Error fetching product names', {
          characterId,
          error: error.message
        });
      }
    }

    // Delete old jobs for this character
    await dbHelpers.run(
      'DELETE FROM industry_jobs WHERE character_id = ?',
      [characterId]
    );

    // Insert new jobs
    for (const job of response.data) {
      await dbHelpers.run(
        `INSERT OR REPLACE INTO industry_jobs 
        (job_id, character_id, activity_id, product_type_id, product_name, runs, start_date, end_date, status, synced_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          job.job_id,
          characterId,
          job.activity_id,
          job.product_type_id,
          productNames[job.product_type_id] || 'Unknown',
          job.runs,
          job.start_date,
          job.end_date,
          job.status
        ]
      );
    }

    res.json({ 
      message: 'Jobs synced successfully',
      count: response.data.length
    });
  } catch (error) {
    logger.error('Error syncing industry jobs', {
      characterId,
      userId,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Failed to sync industry jobs' });
  }
});

// Get industry jobs from database
router.get('/jobs', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    
    // Get all jobs for user's characters
    const jobs = await dbHelpers.all(
      `SELECT 
        j.job_id, j.character_id, j.activity_id, j.product_type_id, 
        j.product_name, j.runs, j.start_date, j.end_date, j.status,
        j.alert_enabled, j.alert_sent,
        c.character_name
      FROM industry_jobs j
      JOIN characters c ON j.character_id = c.character_id
      WHERE c.user_id = ?
      ORDER BY j.end_date ASC`,
      [userId]
    );

    res.json({ jobs });
  } catch (error) {
    logger.error('Error fetching industry jobs', {
      userId,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Failed to fetch industry jobs' });
  }
});

// Toggle alert for a job
router.post('/jobs/:jobId/alert', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const jobId = parseInt(req.params.jobId);
    const { enabled } = req.body;

    // Verify job belongs to user
    const job = await dbHelpers.get(
      `SELECT j.job_id 
       FROM industry_jobs j
       JOIN characters c ON j.character_id = c.character_id
       WHERE j.job_id = ? AND c.user_id = ?`,
      [jobId, userId]
    );

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Update alert status
    await dbHelpers.run(
      'UPDATE industry_jobs SET alert_enabled = ?, alert_sent = 0 WHERE job_id = ?',
      [enabled ? 1 : 0, jobId]
    );

    res.json({ message: 'Alert status updated', enabled });
  } catch (error) {
    logger.error('Error toggling alert', {
      userId,
      jobId,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Failed to toggle alert' });
  }
});

export default router;
