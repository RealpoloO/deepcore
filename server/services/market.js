import axios from 'axios';
import dbHelpers from '../database/helpers.js';
import { retryWithBackoff } from '../utils/retry.js';

const JITA_PRICES_URL = 'https://appraise.gnf.lt/market/jita/prices.json';
const CJ_PRICES_URL = 'https://appraise.gnf.lt/market/C-J6MT/prices.json';
const SYNC_INTERVAL_MINUTES = 30; // Sync every 30 minutes

let syncInterval = null;

/**
 * Service pour gérer les prix du marché
 */
class MarketService {
  /**
   * Démarre la synchronisation automatique toutes les 15 minutes
   */
  start() {
    // Sync immédiatement au démarrage
    this.syncAllPrices().catch(err => 
      console.error('❌ Initial market sync failed:', err.message)
    );

    // Puis toutes les 15 minutes
    syncInterval = setInterval(() => {
      this.syncAllPrices().catch(err => 
        console.error('❌ Market sync failed:', err.message)
      );
    }, SYNC_INTERVAL_MINUTES * 60 * 1000);

    console.log(`📊 Market price sync started - updating every ${SYNC_INTERVAL_MINUTES} minutes`);
  }

  /**
   * Arrête la synchronisation automatique
   */
  stop() {
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
      console.log('🛑 Market price sync stopped');
    }
  }

  /**
   * Synchronise les prix des deux stations
   */
  async syncAllPrices() {
    console.log('🔄 Syncing market prices...');
    const startTime = Date.now();

    try {
      await Promise.all([
        this.syncJitaPrices(),
        this.syncCJPrices()
      ]);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Market prices synced successfully in ${duration}s`);
    } catch (error) {
      console.error('❌ Failed to sync market prices:', error.message);
      throw error;
    }
  }

  /**
   * Synchronise les prix de Jita
   */
  async syncJitaPrices() {
    try {
      const prices = await this._fetchPricesFromAPI('jita');
      await this._savePricesToDB('jita', prices);
      console.log(`✅ Jita: ${Object.keys(prices).length} prices updated`);
    } catch (error) {
      console.error('❌ Failed to sync Jita prices:', error.message);
      throw error;
    }
  }

  /**
   * Synchronise les prix de C-J
   */
  async syncCJPrices() {
    try {
      const prices = await this._fetchPricesFromAPI('c-j');
      await this._savePricesToDB('c-j', prices);
      console.log(`✅ C-J: ${Object.keys(prices).length} prices updated`);
    } catch (error) {
      console.error('❌ Failed to sync C-J prices:', error.message);
      throw error;
    }
  }

  /**
   * Récupère les prix depuis une station spécifique
   * @param {string} station - 'jita' ou 'c-j'
   * @returns {Promise<Object>} Object avec typeId -> { buy, sell }
   */
  async getStationPrices(station) {
    const stationName = station.toLowerCase();
    
    if (stationName !== 'jita' && stationName !== 'c-j') {
      throw new Error(`Invalid station: ${station}. Must be 'jita' or 'c-j'`);
    }

    try {
      const prices = await this._getPricesFromDB(stationName);
      if (Object.keys(prices).length === 0) {
        console.log(`⚠️  No prices in DB for ${stationName.toUpperCase()}, fetching...`);
        await this.syncAllPrices();
        return await this._getPricesFromDB(stationName);
      }
      return prices;
    } catch (error) {
      console.error(`❌ Error fetching ${stationName} prices:`, error.message);
      throw error;
    }
  }

  /**
   * Récupère les prix de Jita
   * @returns {Promise<Object>}
   */
  async getJitaPrices() {
    return this.getStationPrices('jita');
  }

  /**
   * Récupère les prix de C-J6MT
   * @returns {Promise<Object>}
   */
  async getCJPrices() {
    return this.getStationPrices('c-j');
  }

  /**
   * Récupère le prix d'un item spécifique dans une station
   * @param {number} typeId - L'ID du type d'item
   * @param {string} station - 'jita' ou 'c-j'
   * @returns {Promise<Object>} { buy, sell, typeId, station }
   */
  async getItemPrice(typeId, station = 'jita') {
    const prices = await this.getStationPrices(station);
    const price = prices[typeId];

    if (!price) {
      return {
        typeId,
        station,
        buy: 0,
        sell: 0,
        available: false
      };
    }

    return {
      typeId,
      station,
      buy: price.buy || 0,
      sell: price.sell || 0,
      available: true
    };
  }

  /**
   * Récupère les prix d'un item dans les deux stations
   * @param {number} typeId - L'ID du type d'item
   * @returns {Promise<Object>} { jita: {...}, cj: {...} }
   */
  async getItemPricesBothStations(typeId) {
    const [jita, cj] = await Promise.all([
      this.getItemPrice(typeId, 'jita'),
      this.getItemPrice(typeId, 'c-j')
    ]);

    return { jita, cj };
  }

  /**
   * Récupère les prix de plusieurs items dans une station
   * @param {number[]} typeIds - Array d'IDs de types
   * @param {string} station - 'jita' ou 'c-j'
   * @returns {Promise<Object>} Object avec typeId -> { buy, sell }
   */
  async getMultipleItemPrices(typeIds, station = 'jita') {
    const allPrices = await this.getStationPrices(station);
    const result = {};

    for (const typeId of typeIds) {
      result[typeId] = allPrices[typeId] || { buy: 0, sell: 0, available: false };
      result[typeId].available = !!allPrices[typeId];
    }

    return result;
  }

  /**
   * Fetch prices from API
   * @private
   */
  async _fetchPricesFromAPI(station) {
    const url = station === 'jita' ? JITA_PRICES_URL : CJ_PRICES_URL;
    
    const response = await retryWithBackoff(() => 
      axios.get(url, { timeout: 10000 })
    );

    // L'API retourne maintenant un tableau d'objets
    // Format: [{ typeID: 123, prices: { buy: {...}, sell: {...} } }]
    const rawData = response.data || [];
    
    // Transformer en objet { typeId: { buy, sell } }
    const prices = {};
    for (const item of rawData) {
      if (item.typeID && item.prices) {
        const buyPrice = item.prices.buy?.percentile || item.prices.buy?.median || 0;
        const sellPrice = item.prices.sell?.percentile || item.prices.sell?.median || 0;
        
        prices[item.typeID] = {
          buy: buyPrice,
          sell: sellPrice
        };
      }
    }
    
    return prices;
  }

  /**
   * Get prices from database
   * @private
   */
  async _getPricesFromDB(station) {
    const tableName = station === 'jita' ? 'market_jita' : 'market_cj';
    const rows = await dbHelpers.all(
      `SELECT type_id, buy_price, sell_price FROM ${tableName}`
    );

    const prices = {};
    for (const row of rows) {
      prices[row.type_id] = {
        buy: row.buy_price,
        sell: row.sell_price
      };
    }

    return prices;
  }

  /**
   * Save prices to database
   * @private
   */
  async _savePricesToDB(station, prices) {
    const tableName = station === 'jita' ? 'market_jita' : 'market_cj';
    
    try {
      const entries = Object.entries(prices);
      
      // Delete all old prices
      await dbHelpers.run(`DELETE FROM ${tableName}`);

      // Use a single transaction with bulk inserts for much better performance
      const placeholders = entries.map(() => '(?, ?, ?)').join(', ');
      const values = [];
      
      for (const [typeId, priceData] of entries) {
        values.push(parseInt(typeId), priceData.buy || 0, priceData.sell || 0);
      }

      if (values.length > 0) {
        // SQLite has a limit of ~999 parameters, so we batch if needed
        const maxParams = 999;
        const itemsPerBatch = Math.floor(maxParams / 3); // 3 params per item
        
        for (let i = 0; i < entries.length; i += itemsPerBatch) {
          const batchEntries = entries.slice(i, i + itemsPerBatch);
          const batchPlaceholders = batchEntries.map(() => '(?, ?, ?)').join(', ');
          const batchValues = [];
          
          for (const [typeId, priceData] of batchEntries) {
            batchValues.push(parseInt(typeId), priceData.buy || 0, priceData.sell || 0);
          }
          
          await dbHelpers.run(
            `INSERT INTO ${tableName} (type_id, buy_price, sell_price) VALUES ${batchPlaceholders}`,
            batchValues
          );
        }
      }
    } catch (error) {
      console.error(`Error saving prices to ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Get sync statistics
   */
  async getSyncStats() {
    const jitaCount = await dbHelpers.get('SELECT COUNT(*) as count FROM market_jita');
    const cjCount = await dbHelpers.get('SELECT COUNT(*) as count FROM market_cj');
    
    const jitaLastUpdate = await dbHelpers.get(
      'SELECT MAX(updated_at) as last_update FROM market_jita'
    );
    const cjLastUpdate = await dbHelpers.get(
      'SELECT MAX(updated_at) as last_update FROM market_cj'
    );

    return {
      jita: {
        itemsCount: jitaCount.count,
        lastUpdate: jitaLastUpdate.last_update,
        ageMinutes: jitaLastUpdate.last_update 
          ? Math.round((Date.now() - new Date(jitaLastUpdate.last_update).getTime()) / 60000)
          : null
      },
      cj: {
        itemsCount: cjCount.count,
        lastUpdate: cjLastUpdate.last_update,
        ageMinutes: cjLastUpdate.last_update
          ? Math.round((Date.now() - new Date(cjLastUpdate.last_update).getTime()) / 60000)
          : null
      },
      syncIntervalMinutes: SYNC_INTERVAL_MINUTES
    };
  }
}

// Export singleton
export default new MarketService();
