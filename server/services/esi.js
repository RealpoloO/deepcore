import axios from 'axios';
import dbHelpers from '../database/helpers.js';
import { retryWithBackoff } from '../utils/retry.js';

const ESI_BASE_URL = 'https://esi.evetech.net/latest';
const CACHE_DURATION_DAYS = 30; // Les noms de minerais changent rarement

/**
 * Service pour interagir avec l'API ESI d'Eve Online
 * Gère le cache des noms de minerais dans la base de données
 */
class ESIService {
  /**
   * Récupère le nom d'un type de minerai depuis la base de données (SDE)
   * @param {number} typeId - L'ID du type de minerai
   * @returns {Promise<string>} Le nom du minerai
   */
  async getOreTypeName(typeId) {
    try {
      // Chercher dans la base de données (SDE importé)
      const ore = await dbHelpers.get(
        'SELECT name FROM ore_types WHERE type_id = ?',
        [typeId]
      );

      if (ore) {
        return ore.name;
      }

      // Si pas trouvé dans le SDE, fallback sur l'API ESI
      console.warn(`⚠️  Type ${typeId} not found in SDE, fetching from ESI...`);
      const response = await retryWithBackoff(() => 
        axios.get(`${ESI_BASE_URL}/universe/types/${typeId}/`, { timeout: 5000 })
      );
      const name = response.data.name;
      const volume = response.data.volume || 1;

      // Ajouter au cache pour la prochaine fois
      await dbHelpers.run(
        'INSERT INTO ore_types (type_id, name, volume) VALUES (?, ?, ?)',
        [typeId, name, volume]
      );

      return name;
    } catch (error) {
      console.error(`❌ Error fetching type ${typeId}:`, error.message);
      return `Type ${typeId}`;
    }
  }

  /**
   * Récupère les noms de plusieurs minerais en parallèle (avec cache)
   * @param {number[]} typeIds - Array d'IDs de minerais
   * @returns {Promise<Object>} Object avec typeId -> nom
   */
  async getOreTypeNames(typeIds) {
    const uniqueIds = [...new Set(typeIds)];
    
    // Paralléliser tous les appels
    const promises = uniqueIds.map(typeId => 
      this.getOreTypeName(typeId)
        .then(name => ({ typeId, name }))
    );

    const results = await Promise.all(promises);

    // Convertir en objet { typeId: name }
    const typeNames = {};
    results.forEach(({ typeId, name }) => {
      typeNames[typeId] = name;
    });

    return typeNames;
  }

  /**
   * Récupère les informations complètes (nom + volume) de plusieurs minerais depuis le SDE
   * @param {number[]} typeIds - Array d'IDs de minerais
   * @returns {Promise<Object>} Object avec typeId -> { name, volume }
   */
  async getOreTypesInfo(typeIds) {
    const uniqueIds = [...new Set(typeIds)];
    
    // Requête unique pour tous les IDs (bien plus rapide)
    const placeholders = uniqueIds.map(() => '?').join(',');
    const ores = await dbHelpers.all(
      `SELECT type_id, name, volume FROM ore_types WHERE type_id IN (${placeholders})`,
      uniqueIds
    );

    // Convertir en objet { typeId: { name, volume } }
    const oreInfo = {};
    for (const ore of ores) {
      oreInfo[ore.type_id] = { 
        name: ore.name, 
        volume: ore.volume 
      };
    }

    // Pour les IDs manquants, fallback sur l'API ESI
    for (const typeId of uniqueIds) {
      if (!oreInfo[typeId]) {
        try {
          console.warn(`⚠️  Type ${typeId} not found in SDE, fetching from ESI...`);
          const response = await retryWithBackoff(() => 
            axios.get(`${ESI_BASE_URL}/universe/types/${typeId}/`, { timeout: 5000 })
          );
          const name = response.data.name;
          const volume = response.data.volume || 1;

          // Ajouter au cache
          await dbHelpers.run(
            'INSERT INTO ore_types (type_id, name, volume) VALUES (?, ?, ?)',
            [typeId, name, volume]
          );

          oreInfo[typeId] = { name, volume };
        } catch (error) {
          console.error(`❌ Error fetching type ${typeId}:`, error.message);
          oreInfo[typeId] = { name: `Type ${typeId}`, volume: 1 };
        }
      }
    }

    return oreInfo;
  }

  /**
   * Récupère les informations d'un système solaire
   * @param {number} solarSystemId - L'ID du système solaire
   * @returns {Promise<Object>} Informations du système
   */
  async getSolarSystemInfo(solarSystemId) {
    try {
      const response = await retryWithBackoff(() => 
        axios.get(`${ESI_BASE_URL}/universe/systems/${solarSystemId}/`, { timeout: 5000 })
      );
      return response.data;
    } catch (error) {
      console.error(`Error fetching solar system ${solarSystemId}:`, error.message);
      return null;
    }
  }
}

// Export singleton
export default new ESIService();
