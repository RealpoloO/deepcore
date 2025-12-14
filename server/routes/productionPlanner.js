import express from 'express';
import productionPlanner from '../services/productionPlanner.js';
import blueprintService from '../services/blueprintService.js';
import sde from '../services/sde.js';
import { requireAuth } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Cache pour les items producibles
let producibleItemsCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 3600000; // 1 heure

/**
 * GET /api/production-planner/producible-items
 * Retourne la liste des items pour lesquels un blueprint existe
 */
router.get('/producible-items', async (req, res) => {
  try {
    const now = Date.now();
    
    // Utiliser le cache si valide
    if (producibleItemsCache && (now - cacheTimestamp) < CACHE_DURATION) {
      return res.json(producibleItemsCache);
    }

    // Obtenir tous les types avec blueprints
    const allBlueprints = blueprintService.getAllBlueprints();
    const producibleItems = new Set();

    // Ajouter les PRODUITS des blueprints (pas les noms des blueprints)
    for (const blueprint of allBlueprints) {
      // Chercher dans manufacturing
      if (blueprint.activities?.manufacturing?.products) {
        for (const product of blueprint.activities.manufacturing.products) {
          const productType = sde.getTypeById(product.typeID);
          if (productType && productType.name) {
            producibleItems.add(productType.name);
          }
        }
      }
      
      // Chercher dans reactions
      if (blueprint.activities?.reaction?.products) {
        for (const product of blueprint.activities.reaction.products) {
          const productType = sde.getTypeById(product.typeID);
          if (productType && productType.name) {
            producibleItems.add(productType.name);
          }
        }
      }
    }

    const items = Array.from(producibleItems).sort();
    producibleItemsCache = items;
    cacheTimestamp = now;

    res.json(items);
  } catch (error) {
    logger.error('Error fetching producible items:', error);
    res.status(500).json({ error: 'Failed to fetch producible items' });
  }
});

/**
 * POST /api/production-planner/calculate
 * Calcule un plan de production
 */
router.post('/calculate', requireAuth, async (req, res) => {
  try {
    const { jobs, stock, config } = req.body;

    if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
      return res.status(400).json({ error: 'Jobs array is required' });
    }

    // Valider les jobs
    for (const job of jobs) {
      if (!job.product || typeof job.runs !== 'number') {
        return res.status(400).json({ error: 'Invalid job format' });
      }
    }

    // Configuration par défaut si non fournie
    const configuration = {
      reactionSlots: config?.reactionSlots || 20,
      manufacturingSlots: config?.manufacturingSlots || 30,
      dontSplitShorterThan: config?.dontSplitShorterThan || 1.2,
      blacklist: config?.blacklist || {}
    };

    // Calculer le plan de production
    const plan = await productionPlanner.calculateProductionPlan(
      jobs,
      stock || '',
      configuration
    );

    res.json(plan);
  } catch (error) {
    logger.error('Error calculating production plan:', error);
    res.status(500).json({ error: 'Failed to calculate production plan' });
  }
});

/**
 * GET /api/production-planner/blueprint/:typeId
 * Récupère un blueprint par le typeID du produit
 */
router.get('/blueprint/:typeId', requireAuth, async (req, res) => {
  try {
    const typeId = parseInt(req.params.typeId, 10);

    if (isNaN(typeId)) {
      return res.status(400).json({ error: 'Invalid typeId' });
    }

    const blueprint = blueprintService.getBlueprintByProduct(typeId);

    if (!blueprint) {
      return res.status(404).json({ error: 'Blueprint not found' });
    }

    // Récupérer aussi le nom du produit
    const type = sde.getTypeById(typeId);

    res.json({
      blueprint: blueprint,
      product: type
    });
  } catch (error) {
    logger.error('Error fetching blueprint:', error);
    res.status(500).json({ error: 'Failed to fetch blueprint' });
  }
});

/**
 * POST /api/production-planner/search-product
 * Recherche un produit par nom
 */
router.post('/search-product', requireAuth, async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query string is required' });
    }

    const type = sde.findTypeByName(query);

    if (!type) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Vérifier si ce produit a un blueprint
    const blueprint = blueprintService.getBlueprintByProduct(type.typeId);

    res.json({
      type: type,
      hasBlueprint: !!blueprint
    });
  } catch (error) {
    logger.error('Error searching product:', error);
    res.status(500).json({ error: 'Failed to search product' });
  }
});

/**
 * GET /api/production-planner/health
 * Vérifie que les services sont chargés
 */
router.get('/health', async (req, res) => {
  try {
    // Vérifier que les services sont initialisés
    const testType = sde.getTypeById(34); // Tritanium
    const testBlueprint = blueprintService.getBlueprintById(681);

    res.json({
      status: 'ok',
      sdeLoaded: !!testType,
      blueprintsLoaded: !!testBlueprint
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      error: error.message
    });
  }
});

export default router;
