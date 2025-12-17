import sdeService from './sde.js';

/**
 * Service pour récupérer les informations de types depuis le SDE
 * Remplace les anciens appels API ESI par des recherches dans le SDE local
 */
class ESIService {
  /**
   * Récupère le nom d'un type depuis le SDE
   * @param {number} typeId - L'ID du type
   * @returns {Promise<string>} Le nom du type
   */
  async getOreTypeName(typeId) {
    try {
      const type = sdeService.getTypeById(typeId);

      if (type) {
        return type.name;
      }

      console.warn(`⚠️  Type ${typeId} not found in SDE`);
      return `Type ${typeId}`;
    } catch (error) {
      console.error(`❌ Error fetching type ${typeId}:`, error.message);
      return `Type ${typeId}`;
    }
  }

  /**
   * Récupère les noms de plusieurs types en parallèle depuis le SDE
   * @param {number[]} typeIds - Array d'IDs de types
   * @returns {Promise<Object>} Object avec typeId -> nom
   */
  async getOreTypeNames(typeIds) {
    const uniqueIds = [...new Set(typeIds)];

    const typeNames = {};
    for (const typeId of uniqueIds) {
      const type = sdeService.getTypeById(typeId);
      typeNames[typeId] = type ? type.name : `Type ${typeId}`;
    }

    return typeNames;
  }

  /**
   * Récupère les informations complètes (nom + volume) de plusieurs types depuis le SDE
   * @param {number[]} typeIds - Array d'IDs de types
   * @returns {Promise<Object>} Object avec typeId -> { name, volume }
   */
  async getOreTypesInfo(typeIds) {
    const uniqueIds = [...new Set(typeIds)];

    const oreInfo = {};
    for (const typeId of uniqueIds) {
      const type = sdeService.getTypeById(typeId);

      if (type) {
        oreInfo[typeId] = {
          name: type.name,
          volume: type.volume
        };
      } else {
        console.warn(`⚠️  Type ${typeId} not found in SDE`);
        oreInfo[typeId] = {
          name: `Type ${typeId}`,
          volume: 1
        };
      }
    }

    return oreInfo;
  }
}

// Export singleton
export default new ESIService();
