/**
 * ============================================================================
 * PRODUCTION PLANNER V2 - ARCHITECTURE DÉTERMINISTE
 * ============================================================================
 *
 * PROBLÈME RÉSOLU:
 * L'ancienne architecture créait des sous-arbres de production pour chaque job
 * puis essayait de les consolider, ce qui créait du non-déterminisme selon l'ordre.
 *
 * NOUVELLE APPROCHE:
 * 1. Phase 1: Collecter TOUTES les demandes de production de manière globale
 * 2. Phase 2: Créer les jobs à partir des demandes consolidées
 * 3. Phase 3: Optimiser et splitter
 *
 * Cette approche garantit que l'ordre des jobs d'entrée n'affecte PAS le résultat.
 */

import blueprintService from './blueprintService.js';
import sde from './sde.js';
import productionCategories from './productionCategories.js';
import logger from '../utils/logger.js';

// ============================================
// CONSTANTES
// ============================================
const MAX_QUANTITY = 1_000_000_000;
const MAX_DEPTH = 20;
const MAX_STOCK_LINES = 10000;
const MAX_ITEM_NAME_LENGTH = 200;

// ============================================
// VALIDATION
// ============================================
function validateQuantity(quantity, fieldName = 'quantity') {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) {
    throw new Error(`${fieldName} must be a valid number`);
  }
  if (quantity < 1 || quantity > MAX_QUANTITY) {
    throw new Error(`${fieldName} must be between 1 and ${MAX_QUANTITY.toLocaleString()}`);
  }
  return Math.floor(quantity);
}

function sanitizeItemName(name) {
  if (typeof name !== 'string') {
    throw new Error('Item name must be a string');
  }
  const sanitized = name.trim().substring(0, MAX_ITEM_NAME_LENGTH);
  if (sanitized.length === 0) {
    throw new Error('Item name cannot be empty');
  }
  return sanitized;
}

async function parseStock(stockText) {
  const stock = new Map();
  const errors = [];

  if (!stockText || !stockText.trim()) {
    return { stock, errors };
  }

  const lines = stockText.split('\n').slice(0, MAX_STOCK_LINES);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^(.+?)\s+(\d+)$/);
    if (!match) {
      errors.push({
        line: i + 1,
        text: line,
        error: `Format invalide. Format attendu: "Item Name  Quantity"`
      });
      continue;
    }

    try {
      const itemName = sanitizeItemName(match[1]);
      const quantity = validateQuantity(parseInt(match[2], 10), 'stock quantity');

      const type = sde.findTypeByName(itemName);
      if (type) {
        stock.set(type.typeId, (stock.get(type.typeId) || 0) + quantity);
      } else {
        errors.push({
          line: i + 1,
          text: line,
          error: `Item "${itemName}" introuvable dans la base de données EVE`
        });
      }
    } catch (err) {
      errors.push({
        line: i + 1,
        text: line,
        error: err.message
      });
    }
  }

  return { stock, errors };
}

function isBlacklisted(typeID, blacklist) {
  const type = sde.getTypeById(typeID);
  if (!type) return false;

  if (productionCategories.isBlacklistedByCategory(type.groupId, blacklist)) {
    return true;
  }

  if (blacklist.customItems) {
    const customItems = blacklist.customItems.split('\n').map(item => item.trim()).filter(Boolean);
    if (customItems.some(custom => type.name.toLowerCase().includes(custom.toLowerCase()))) {
      return true;
    }
  }

  if (blacklist.fuelBlocks && type.name.includes('Fuel Block')) {
    return true;
  }

  return false;
}

// ============================================
// PHASE 1: COLLECTION DES DEMANDES
// ============================================

/**
 * Collecte récursivement TOUTES les demandes de production de manière globale
 * Clé d'unicité: productTypeID + ME + TE + depth
 * Cela garantit que deux jobs identiques avec mêmes paramètres seront fusionnés
 */
function collectProductionDemands(
  productTypeID,
  requiredQuantity,
  stock,
  blacklist,
  demands,  // Map<demandKey, DemandInfo>
  rawMaterials,  // Map<typeID, quantity> - matériaux à acheter
  errors,
  depth = 0,
  me = 10,
  te = 20,
  isEndProduct = false
) {
  if (depth > MAX_DEPTH) {
    logger.warn(`Max depth (${MAX_DEPTH}) reached for typeID ${productTypeID}`);
    return;
  }

  try {
    validateQuantity(requiredQuantity, 'required quantity');
  } catch (err) {
    logger.error(`Invalid quantity for typeID ${productTypeID}: ${err.message}`);
    return;
  }

  // Vérifier le stock disponible
  const availableStock = stock.get(productTypeID) || 0;
  let quantityToProduce = requiredQuantity - availableStock;

  if (quantityToProduce <= 0) {
    return;  // Stock suffisant
  }

  // Items blacklistés = raw materials à acheter
  if (isBlacklisted(productTypeID, blacklist)) {
    rawMaterials.set(productTypeID, (rawMaterials.get(productTypeID) || 0) + quantityToProduce);
    return;
  }

  // Trouver le blueprint
  const blueprint = blueprintService.getBlueprintByProduct(productTypeID);

  if (!blueprint) {
    const type = sde.getTypeById(productTypeID);
    const productName = type?.name || `Unknown (${productTypeID})`;

    if (depth === 0) {
      errors.push({
        type: 'NO_BLUEPRINT',
        productTypeID: productTypeID,
        productName: productName,
        error: `❌ "${productName}" ne peut pas être produit (aucun blueprint disponible).`,
        critical: true
      });
      return;
    }

    // Raw material
    rawMaterials.set(productTypeID, (rawMaterials.get(productTypeID) || 0) + quantityToProduce);
    return;
  }

  // Calculer les runs nécessaires
  const activity = blueprint.activities?.manufacturing || blueprint.activities?.reaction;
  const productsPerRun = activity.products[0]?.quantity || 1;
  const runsNeeded = Math.ceil(quantityToProduce / productsPerRun);

  // ✅ DÉTERMINISME: Utiliser ME/TE cohérents
  const effectiveME = depth === 0 ? me : 10;
  const effectiveTE = depth === 0 ? te : 20;

  // ✅ CLÉ UNIQUE DÉTERMINISTE: productTypeID + ME + TE + depth
  // Cela garantit que deux demandes identiques seront fusionnées
  const demandKey = `${productTypeID}_${effectiveME}_${effectiveTE}_${depth}`;

  // Ajouter ou fusionner la demande
  if (!demands.has(demandKey)) {
    demands.set(demandKey, {
      productTypeID,
      blueprintTypeID: blueprint.blueprintTypeID,
      me: effectiveME,
      te: effectiveTE,
      depth,
      isEndProduct,
      totalRuns: 0,
      blueprint: blueprint
    });
  }

  const demand = demands.get(demandKey);
  demand.totalRuns += runsNeeded;

  // Calculer récursivement les matériaux nécessaires
  for (const material of activity.materials) {
    const quantityNeeded = material.quantity * runsNeeded;

    collectProductionDemands(
      material.typeID,
      quantityNeeded,
      stock,
      blacklist,
      demands,
      rawMaterials,
      errors,
      depth + 1,
      10,  // Composants toujours ME=10
      20,  // Composants toujours TE=20
      false
    );
  }
}

// ============================================
// PHASE 2: CRÉATION DES JOBS
// ============================================

/**
 * Convertit les demandes consolidées en JobDescriptors
 * Maintenant les demandes sont déjà fusionnées de manière déterministe
 */
function createJobDescriptorsFromDemands(demands) {
  const jobDescriptors = [];

  // ✅ DÉTERMINISME: Trier les demandes par clé pour garantir un ordre stable
  const sortedDemands = Array.from(demands.entries()).sort((a, b) => {
    const [keyA, demandA] = a;
    const [keyB, demandB] = b;

    // Tri primaire par productTypeID
    if (demandA.productTypeID !== demandB.productTypeID) {
      return demandA.productTypeID - demandB.productTypeID;
    }

    // Tri secondaire par depth
    if (demandA.depth !== demandB.depth) {
      return demandA.depth - demandB.depth;
    }

    // Tri tertiaire par ME
    if (demandA.me !== demandB.me) {
      return demandA.me - demandB.me;
    }

    // Tri quaternaire par TE
    return demandA.te - demandB.te;
  });

  for (const [demandKey, demand] of sortedDemands) {
    const type = sde.getTypeById(demand.productTypeID);
    const activityType = blueprintService.getActivityType(demand.blueprint);
    const productionTimePerRun = blueprintService.calculateProductionTime(demand.blueprint, 1, demand.te);

    jobDescriptors.push({
      blueprintTypeID: demand.blueprintTypeID,
      productTypeID: demand.productTypeID,
      productName: type?.name || `Unknown (${demand.productTypeID})`,
      runs: demand.totalRuns,
      productionTimePerRun: productionTimePerRun,
      activityType: activityType,
      depth: demand.depth,
      isEndProduct: demand.isEndProduct,
      me: demand.me,
      te: demand.te
    });
  }

  return jobDescriptors;
}

/**
 * Calcule les raw materials à partir des demands et des matériaux accumulés
 */
function calculateRawMaterials(demands, rawMaterials) {
  const materials = [];

  // Calculer les matériaux des jobs
  for (const [demandKey, demand] of demands) {
    const blueprint = demand.blueprint;
    const activity = blueprint.activities?.manufacturing || blueprint.activities?.reaction;

    const materialsForJob = blueprintService.calculateMaterials(
      blueprint,
      demand.totalRuns,
      demand.me
    );

    // Accumuler dans rawMaterials
    for (const mat of materialsForJob) {
      rawMaterials.set(mat.typeID, (rawMaterials.get(mat.typeID) || 0) + mat.quantity);
    }
  }

  // Convertir en liste triée
  for (const [typeID, quantity] of rawMaterials) {
    const type = sde.getTypeById(typeID);
    materials.push({
      typeID: typeID,
      name: type?.name || `Unknown (${typeID})`,
      quantity: quantity
    });
  }

  materials.sort((a, b) => a.name.localeCompare(b.name));

  return materials;
}

// ============================================
// HELPER: Organiser par catégories
// ============================================

function organizeJobs(jobs) {
  const organized = {
    fuel_blocks: [],
    intermediate_composite_reactions: [],
    composite_reactions: [],
    biochemical_reactions: [],
    hybrid_reactions: [],
    construction_components: [],
    advanced_components: [],
    capital_components: [],
    others: [],
    end_product_jobs: []
  };

  for (const job of jobs) {
    if (job.isEndProduct) {
      organized.end_product_jobs.push(job);
      continue;
    }

    const type = sde.getTypeById(job.productTypeID);
    if (!type) {
      organized.end_product_jobs.push(job);
      continue;
    }

    const category = productionCategories.getCategoryByGroupID(type.groupId);

    if (organized[category]) {
      organized[category].push(job);
    } else {
      organized.end_product_jobs.push(job);
    }
  }

  return organized;
}

// ============================================
// NOTE: Pour la phase 3, on réutilise optimizeJobsForCategory et resolveMaterialsForJobs
// de l'ancien code (ils fonctionnent bien, c'est juste la phase 1-2 qui était problématique)
// ============================================

// Import des fonctions de l'ancien code qu'on garde
import { optimizeJobsForCategory, resolveMaterialsForJobs } from './productionPlanner.js';

/**
 * Point d'entrée principal - VERSION DÉTERMINISTE
 */
async function calculateProductionPlan(jobsInput, stockText, config) {
  logger.info(`🔄 [V2] Calculating production plan for ${jobsInput.length} jobs`);

  // Parser le stock
  const stockResult = await parseStock(stockText);

  if (stockResult.errors && stockResult.errors.length > 0) {
    return {
      materials: [],
      jobs: {},
      categoryTimings: {},
      totalProductionTimeDays: 0,
      totalJobs: 0,
      totalMaterials: 0,
      errors: stockResult.errors.map(err => ({
        type: 'STOCK_PARSING_ERROR',
        product: `Ligne ${err.line}`,
        error: `❌ Erreur dans le stock ligne ${err.line}: ${err.error}\n   "${err.text}"`,
        critical: true
      }))
    };
  }

  const stock = new Map(stockResult.stock);

  // ✅ PHASE 1: Collecter TOUTES les demandes de production (GLOBALEMENT)
  logger.info('📊 PHASE 1: Collecting production demands globally...');

  const demands = new Map();  // Map<demandKey, DemandInfo>
  const rawMaterials = new Map();  // Map<typeID, quantity>
  const errors = [];

  for (const jobInput of jobsInput) {
    const type = sde.findTypeByName(jobInput.product);
    if (!type) {
      const errorMsg = `❌ Produit introuvable : "${jobInput.product}"`;
      logger.warn(`Product not found: ${jobInput.product}`);
      errors.push({ product: jobInput.product, error: errorMsg, critical: true });
      continue;
    }

    const blueprint = blueprintService.getBlueprintByProduct(type.typeId);
    if (!blueprint) {
      const errorMsg = `❌ Aucun blueprint trouvé pour : "${jobInput.product}"`;
      logger.warn(`No blueprint found for: ${jobInput.product}`);
      errors.push({ product: jobInput.product, error: errorMsg, critical: true });
      continue;
    }

    const activity = blueprint.activities?.manufacturing || blueprint.activities?.reaction;
    if (!activity || !activity.products || activity.products.length === 0) {
      const errorMsg = `❌ Blueprint invalide pour : "${jobInput.product}"`;
      logger.warn(`Invalid blueprint for: ${jobInput.product}`);
      errors.push({ product: jobInput.product, error: errorMsg, critical: true });
      continue;
    }

    const productsPerRun = activity.products[0]?.quantity || 1;
    const quantityNeeded = jobInput.runs * productsPerRun;

    // Collecter les demandes de manière globale
    collectProductionDemands(
      type.typeId,
      quantityNeeded,
      stock,
      config.blacklist || {},
      demands,
      rawMaterials,
      errors,
      0,
      jobInput.me || 10,
      jobInput.te || 20,
      true  // isEndProduct
    );
  }

  // Vérifier les erreurs critiques
  const criticalErrors = errors.filter(err => err.critical);
  if (criticalErrors.length > 0) {
    logger.error(`Critical errors detected: ${criticalErrors.length} errors`);
    return {
      materials: [],
      jobs: {},
      categoryTimings: {},
      totalProductionTimeDays: 0,
      totalJobs: 0,
      totalMaterials: 0,
      errors: criticalErrors
    };
  }

  logger.info(`✅ Collected ${demands.size} unique production demands`);

  // ✅ PHASE 2: Créer les JobDescriptors à partir des demandes consolidées
  logger.info('🏗️  PHASE 2: Creating job descriptors from demands...');

  const jobDescriptors = createJobDescriptorsFromDemands(demands);
  const materials = calculateRawMaterials(demands, rawMaterials);

  logger.info(`✅ Created ${jobDescriptors.length} job descriptors and ${materials.length} raw materials`);

  // ✅ PHASE 3: Organiser et optimiser (réutilise l'ancien code)
  logger.info('⚙️  PHASE 3: Organizing and optimizing...');

  const organizedDescriptors = organizeJobs(jobDescriptors);

  const organizedJobs = {};
  const categoryTimings = {};
  let totalProductionTime = 0;

  for (const category in organizedDescriptors) {
    if (organizedDescriptors[category].length === 0) continue;

    const reactionDescs = organizedDescriptors[category].filter(j => j.activityType === 'reaction');
    const mfgDescs = organizedDescriptors[category].filter(j => j.activityType === 'manufacturing');

    let allOptimizedDescriptors = [];
    let maxTimeDays = 0;

    // Optimiser reactions
    if (reactionDescs.length > 0) {
      const optimized = optimizeJobsForCategory(reactionDescs, config, 'reaction', `${category}_reactions`);
      allOptimizedDescriptors.push(...optimized.jobDescriptors);
      maxTimeDays = Math.max(maxTimeDays, optimized.totalTimeDays);
    }

    // Optimiser manufacturing
    if (mfgDescs.length > 0) {
      const optimized = optimizeJobsForCategory(mfgDescs, config, 'manufacturing', `${category}_manufacturing`);
      allOptimizedDescriptors.push(...optimized.jobDescriptors);
      maxTimeDays = Math.max(maxTimeDays, optimized.totalTimeDays);
    }

    // Résoudre materials pour jobs optimisés
    const completeJobs = resolveMaterialsForJobs(allOptimizedDescriptors);

    organizedJobs[category] = completeJobs;
    categoryTimings[category] = {
      totalTimeDays: maxTimeDays,
      slotsUsed: completeJobs.length,
      jobCount: completeJobs.length
    };

    totalProductionTime = Math.max(totalProductionTime, maxTimeDays);
  }

  logger.info(`✅ Production plan complete: ${jobDescriptors.length} jobs, ${materials.length} materials`);

  return {
    materials: materials,
    jobs: organizedJobs,
    categoryTimings: categoryTimings,
    totalProductionTimeDays: totalProductionTime,
    totalJobs: jobDescriptors.length,
    totalMaterials: materials.length,
    errors: errors.length > 0 ? errors : undefined
  };
}

export default {
  calculateProductionPlan,
  parseStock,
  isBlacklisted
};
