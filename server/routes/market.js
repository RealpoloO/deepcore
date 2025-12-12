import express from 'express';
import marketService from '../services/market.js';

const router = express.Router();

/**
 * GET /api/market/prices/:station
 * Récupère tous les prix d'une station
 * @param {string} station - 'jita' ou 'c-j'
 */
router.get('/prices/:station', async (req, res) => {
  try {
    const { station } = req.params;
    const prices = await marketService.getStationPrices(station);
    
    res.json({
      station: station.toLowerCase(),
      itemsCount: Object.keys(prices).length,
      prices: prices
    });
  } catch (error) {
    console.error('Error fetching market prices:', error);
    res.status(500).json({ 
      error: 'Failed to fetch market prices',
      message: error.message 
    });
  }
});

/**
 * GET /api/market/item/:typeId
 * Récupère le prix d'un item dans une station (ou les deux)
 * @param {number} typeId - L'ID du type d'item
 * @query {string} station - 'jita', 'c-j', ou 'both' (default: 'jita')
 */
router.get('/item/:typeId', async (req, res) => {
  try {
    const typeId = parseInt(req.params.typeId);
    const station = req.query.station || 'jita';

    if (station === 'both') {
      const prices = await marketService.getItemPricesBothStations(typeId);
      res.json(prices);
    } else {
      const price = await marketService.getItemPrice(typeId, station);
      res.json(price);
    }
  } catch (error) {
    console.error('Error fetching item price:', error);
    res.status(500).json({ 
      error: 'Failed to fetch item price',
      message: error.message 
    });
  }
});

/**
 * POST /api/market/items
 * Récupère les prix de plusieurs items dans une station
 * @body {number[]} typeIds - Array d'IDs de types
 * @body {string} station - 'jita' ou 'c-j' (default: 'jita')
 */
router.post('/items', async (req, res) => {
  try {
    const { typeIds, station = 'jita' } = req.body;

    if (!Array.isArray(typeIds) || typeIds.length === 0) {
      return res.status(400).json({ 
        error: 'typeIds must be a non-empty array' 
      });
    }

    const prices = await marketService.getMultipleItemPrices(typeIds, station);
    
    res.json({
      station: station.toLowerCase(),
      itemsCount: typeIds.length,
      prices: prices
    });
  } catch (error) {
    console.error('Error fetching multiple item prices:', error);
    res.status(500).json({ 
      error: 'Failed to fetch item prices',
      message: error.message 
    });
  }
});

/**
 * POST /api/market/sync
 * Force la synchronisation de toutes les stations
 */
router.post('/sync', async (req, res) => {
  try {
    await marketService.syncAllPrices();
    const stats = await marketService.getSyncStats();
    
    res.json({
      success: true,
      message: 'Market prices synchronized successfully',
      stats: stats
    });
  } catch (error) {
    console.error('Error syncing market prices:', error);
    res.status(500).json({ 
      error: 'Failed to sync market prices',
      message: error.message 
    });
  }
});

/**
 * POST /api/market/sync/:station
 * Force la synchronisation d'une station spécifique
 * @param {string} station - 'jita' ou 'c-j'
 */
router.post('/sync/:station', async (req, res) => {
  try {
    const { station } = req.params;
    
    if (station.toLowerCase() === 'jita') {
      await marketService.syncJitaPrices();
    } else if (station.toLowerCase() === 'c-j') {
      await marketService.syncCJPrices();
    } else {
      return res.status(400).json({ error: 'Invalid station. Must be jita or c-j' });
    }
    
    const stats = await marketService.getSyncStats();
    
    res.json({
      success: true,
      station: station.toLowerCase(),
      message: `${station.toUpperCase()} prices synchronized successfully`,
      stats: stats[station.toLowerCase()]
    });
  } catch (error) {
    console.error('Error syncing market prices:', error);
    res.status(500).json({ 
      error: 'Failed to sync market prices',
      message: error.message 
    });
  }
});

/**
 * GET /api/market/stats
 * Récupère les statistiques de synchronisation
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await marketService.getSyncStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching sync stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch sync stats',
      message: error.message 
    });
  }
});

/**
 * GET /api/market/jita/:typeId
 * Raccourci pour récupérer le prix d'un item à Jita
 */
router.get('/jita/:typeId', async (req, res) => {
  try {
    const typeId = parseInt(req.params.typeId);
    const price = await marketService.getItemPrice(typeId, 'jita');
    res.json(price);
  } catch (error) {
    console.error('Error fetching Jita price:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Jita price',
      message: error.message 
    });
  }
});

/**
 * GET /api/market/c-j/:typeId
 * Raccourci pour récupérer le prix d'un item à C-J6MT
 */
router.get('/c-j/:typeId', async (req, res) => {
  try {
    const typeId = parseInt(req.params.typeId);
    const price = await marketService.getItemPrice(typeId, 'c-j');
    res.json(price);
  } catch (error) {
    console.error('Error fetching C-J price:', error);
    res.status(500).json({ 
      error: 'Failed to fetch C-J price',
      message: error.message 
    });
  }
});

/**
 * POST /api/market/batch
 * Récupère les prix pour plusieurs items en une seule requête
 * Body: { items: [{ name: "Tritanium", quantity: 1000 }] }
 */
router.post('/batch', async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'items array is required' });
    }

    const sdeService = (await import('../services/sde.js')).default;
    const results = [];

    // Récupérer tous les prix en une seule requête SQL
    const jitaPrices = await marketService.getStationPrices('jita');
    const cjPrices = await marketService.getStationPrices('c-j');

    for (const item of items) {
      const typeData = sdeService.findTypeByName(item.name);
      
      if (!typeData) {
        results.push({
          name: item.name,
          quantity: item.quantity,
          error: 'Item non trouvé',
          typeId: null,
          volume: 0,
          jitaSell: 0,
          cjSell: 0
        });
        continue;
      }

      const jitaPrice = jitaPrices[typeData.typeId] || { sell: 0 };
      const cjPrice = cjPrices[typeData.typeId] || { sell: 0 };

      results.push({
        name: item.name,
        quantity: item.quantity,
        typeId: typeData.typeId,
        volume: typeData.volume || 0,
        iconID: typeData.iconID || null,
        jitaSell: jitaPrice.sell || 0,
        cjSell: cjPrice.sell || 0
      });
    }

    res.json({ items: results });
  } catch (error) {
    console.error('Error in batch price lookup:', error);
    res.status(500).json({ 
      error: 'Failed to fetch batch prices',
      message: error.message 
    });
  }
});

/**
 * GET /api/market/search
 * Recherche un type_id par nom dans le SDE
 * @query {string} name - Le nom de l'item à rechercher
 */
router.get('/search', async (req, res) => {
  try {
    const { name } = req.query;
    
    if (!name) {
      return res.status(400).json({ error: 'Name parameter is required' });
    }

    const sdeService = (await import('../services/sde.js')).default;
    const result = sdeService.findTypeByName(name);

    if (!result) {
      return res.status(404).json({ error: 'Item not found', name });
    }

    res.json({
      typeId: result.typeId,
      name: result.name,
      volume: result.volume
    });
  } catch (error) {
    console.error('Error searching item:', error);
    res.status(500).json({ 
      error: 'Failed to search item',
      message: error.message 
    });
  }
});

/**
 * GET /api/market/type/:typeId
 * Récupère les informations d'un type (nom, volume) depuis le SDE
 */
router.get('/type/:typeId', async (req, res) => {
  try {
    const typeId = parseInt(req.params.typeId);
    const sdeService = (await import('../services/sde.js')).default;
    
    const result = sdeService.getTypeById(typeId);

    if (!result) {
      return res.status(404).json({ error: 'Type not found', typeId });
    }

    res.json({
      typeId: result.typeId,
      name: result.name,
      volume: result.volume
    });
  } catch (error) {
    console.error('Error fetching type info:', error);
    res.status(500).json({ 
      error: 'Failed to fetch type info',
      message: error.message 
    });
  }
});

export default router;
