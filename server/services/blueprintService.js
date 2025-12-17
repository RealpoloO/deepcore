import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';
import sde from './sde.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const blueprintsPath = path.join(__dirname, '../../eve-online-static-data-3133773-jsonl/blueprints.jsonl');

// Cache en mémoire pour les blueprints
let blueprintCache = null;
let blueprintByProductCache = null;

/**
 * Charge tous les blueprints en mémoire au démarrage
 */
async function loadBlueprints() {
  if (blueprintCache) return;

  logger.info('📖 Loading blueprints from SDE...');

  blueprintCache = new Map();
  blueprintByProductCache = new Map();

  const rl = readline.createInterface({
    input: fs.createReadStream(blueprintsPath),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    try {
      const blueprint = JSON.parse(line);

      if (blueprint._key) {
        // Stocker par blueprintTypeID
        blueprintCache.set(blueprint.blueprintTypeID, blueprint);

        // Indexer par typeID du produit (pour trouver le blueprint d'un item)
        if (blueprint.activities?.manufacturing?.products) {
          for (const product of blueprint.activities.manufacturing.products) {
            blueprintByProductCache.set(product.typeID, blueprint);
          }
        }

        // Indexer les réactions aussi
        if (blueprint.activities?.reaction?.products) {
          for (const product of blueprint.activities.reaction.products) {
            blueprintByProductCache.set(product.typeID, blueprint);
          }
        }
      }
    } catch (err) {
      // Ignore les lignes malformées
    }
  }

  logger.info(`✅ Loaded ${blueprintCache.size} blueprints into memory`);
}

/**
 * Récupère un blueprint par son blueprintTypeID
 * @param {number} blueprintTypeID - L'ID du blueprint
 * @returns {Object|null} Le blueprint ou null
 */
function getBlueprintById(blueprintTypeID) {
  if (!blueprintCache) {
    throw new Error('Blueprints not loaded yet');
  }

  return blueprintCache.get(blueprintTypeID) || null;
}

/**
 * Récupère un blueprint par le typeID du produit qu'il fabrique
 * @param {number} productTypeID - L'ID du produit
 * @returns {Object|null} Le blueprint ou null
 */
function getBlueprintByProduct(productTypeID) {
  if (!blueprintByProductCache) {
    throw new Error('Blueprints not loaded yet');
  }

  return blueprintByProductCache.get(productTypeID) || null;
}

/**
 * Calcule les matériaux requis avec le bonus ME du blueprint
 * @param {Object} blueprint - Le blueprint
 * @param {number} runs - Nombre de runs
 * @param {number} me - Material Efficiency du BPO (0-10) - N'AFFECTE PAS LES REACTIONS
 * @returns {Array} Liste des matériaux avec quantités ajustées
 */
function calculateMaterials(blueprint, runs = 1, me = 0) {
  const activity = blueprint.activities?.manufacturing || blueprint.activities?.reaction;
  const activityType = getActivityType(blueprint);

  if (!activity || !activity.materials) {
    return [];
  }

  const materials = [];
  // ME bonus NE S'APPLIQUE PAS aux réactions dans EVE Online
  const meBonus = activityType === 'reaction' ? 0 : (me / 100);

  for (const material of activity.materials) {
    const baseQuantity = material.quantity;
    const adjustedQuantity = Math.ceil(baseQuantity * (1 - meBonus) * runs);

    // Ajouter le nom du matériau pour les logs/debug
    const type = sde.getTypeById(material.typeID);

    materials.push({
      typeID: material.typeID,
      name: type?.name || `Unknown (${material.typeID})`,
      quantity: adjustedQuantity
    });
  }

  return materials;
}

/**
 * Calcule le temps de production avec le bonus TE du blueprint
 * @param {Object} blueprint - Le blueprint
 * @param {number} runs - Nombre de runs
 * @param {number} te - Time Efficiency du BPO (0-20) - N'AFFECTE PAS LES REACTIONS
 * @returns {number} Temps en secondes
 */
function calculateProductionTime(blueprint, runs = 1, te = 0) {
  const activity = blueprint.activities?.manufacturing || blueprint.activities?.reaction;
  const activityType = getActivityType(blueprint);

  if (!activity || !activity.time) {
    return 0;
  }

  const baseTime = activity.time;
  // TE bonus NE S'APPLIQUE PAS aux réactions dans EVE Online
  const teBonus = activityType === 'reaction' ? 0 : (te / 100);
  const adjustedTime = Math.ceil(baseTime * (1 - teBonus) * runs);

  return adjustedTime;
}

/**
 * Détermine le type d'activité du blueprint (manufacturing ou reaction)
 * IMPORTANT: Manufacturing a priorité sur reaction (même logique que activity selection)
 * @param {Object} blueprint - Le blueprint
 * @returns {string} 'manufacturing' ou 'reaction'
 */
function getActivityType(blueprint) {
  if (blueprint.activities?.manufacturing) {
    return 'manufacturing';
  }
  if (blueprint.activities?.reaction) {
    return 'reaction';
  }
  return 'unknown';
}

/**
 * Get all loaded blueprints
 */
function getAllBlueprints() {
  if (!blueprintCache) {
    throw new Error('Blueprints not loaded yet');
  }
  return Array.from(blueprintCache.values());
}


export default {
  loadBlueprints,
  getBlueprintById,
  getBlueprintByProduct,
  calculateMaterials,
  calculateProductionTime,
  getActivityType,
  getAllBlueprints
};
