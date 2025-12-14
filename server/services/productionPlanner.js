/**
 * ============================================================================
 * PRODUCTION PLANNER - ARCHITECTURE SIMPLIFIÉE by popey
 * ============================================================================
 * 
 * LOGIQUE SIMPLE EN 4 PHASES:
 * 
 * 1. BOM CALCULATION
 *    Pour chaque ligne end product (ex: Archon ME 8 TE 16)
 *    → Calculer récursivement les matériaux nécessaires
 *    → Résultat: Pool de matériaux à produire (ex: 5000 Carbon Fiber)
 * 
 * 2. JOB PLANNING
 *    Pour chaque matériau du pool:
 *    - Vérifier blacklist (si blacklist → acheter)
 *    - Calculer runs nécessaires (ex: 5000 ÷ 10 = 500 runs)
 *    - Splitter selon config (500 runs → 20 jobs de 25 runs)
 * 
 * 3. MATERIAL CALCULATION
 *    Pour chaque job créé
 *    → Calculer les matériaux de base nécessaires
 * 
 * 4. FORMATTING & DISPLAY
 *    → Organiser par catégories
 *    → Calculer timelines
 *    → Retourner le plan complet
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

/**
 * Parse le stock de l'utilisateur depuis le format texte
 */
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

/**
 * Vérifie si un item est dans la blacklist
 */
function isBlacklisted(typeID, blacklist) {
  const type = sde.getTypeById(typeID);
  if (!type) return false;

  // Vérifier blacklist par catégories
  if (productionCategories.isBlacklistedByCategory(type.groupId, blacklist)) {
    return true;
  }

  // Vérifier blacklist custom items
  if (blacklist.customItems) {
    const customItems = blacklist.customItems.split('\n').map(item => item.trim()).filter(Boolean);
    if (customItems.some(custom => type.name.toLowerCase().includes(custom.toLowerCase()))) {
      return true;
    }
  }

  // Vérifier Fuel Blocks spécifiquement
  if (blacklist.fuelBlocks && type.name.includes('Fuel Block')) {
    return true;
  }

  return false;
}

// ============================================
// PHASE 1: BOM CALCULATION
// ============================================

/**
 * Calcule récursivement la BOM (Bill of Materials) pour un produit
 * Accumule les matériaux à produire dans un pool global
 * 
 * @param {number} productTypeID - ID du produit
 * @param {number} requiredQuantity - Quantité requise
 * @param {Map} materialPool - Pool global de matériaux à produire
 * @param {Map} rawMaterialPool - Pool de matériaux de base (pas de blueprint)
 * @param {Map} stock - Stock disponible
 * @param {Object} blacklist - Configuration blacklist
 * @param {number} depth - Profondeur actuelle
 * @param {number} me - Material Efficiency (depth=0: user input, depth>0: 10)
 * @param {number} te - Time Efficiency (depth=0: user input, depth>0: 20)
 */
function calculateBOM(
  productTypeID,
  requiredQuantity,
  materialPool,
  rawMaterialPool,
  stock,
  blacklist,
  depth = 0,
  me = 10,
  te = 20
) {
  // Protection contre récursion infinie
  if (depth > MAX_DEPTH) {
    logger.warn(`Max depth ${MAX_DEPTH} atteint pour typeID ${productTypeID}`);
    return;
  }

  // Validation
  try {
    requiredQuantity = validateQuantity(requiredQuantity, 'required quantity');
  } catch (err) {
    logger.error(`Quantité invalide pour typeID ${productTypeID}: ${err.message}`);
    return;
  }

  // Vérifier le stock disponible
  const availableStock = stock.get(productTypeID) || 0;
  let quantityToProduce = requiredQuantity - availableStock;

  if (quantityToProduce <= 0) {
    // Assez en stock, consommer
    stock.set(productTypeID, availableStock - requiredQuantity);
    return;
  }

  // Consommer le stock disponible
  if (availableStock > 0) {
    stock.set(productTypeID, 0);
  }

  // Vérifier blacklist
  if (isBlacklisted(productTypeID, blacklist)) {
    // Acheter directement
    rawMaterialPool.set(productTypeID, (rawMaterialPool.get(productTypeID) || 0) + quantityToProduce);
    return;
  }

  // Chercher le blueprint
  const blueprint = blueprintService.getBlueprintByProduct(productTypeID);

  if (!blueprint) {
    // Pas de blueprint = matériau de base (Tritanium, etc.)
    rawMaterialPool.set(productTypeID, (rawMaterialPool.get(productTypeID) || 0) + quantityToProduce);
    return;
  }

  // Calculer les runs nécessaires
  const activity = blueprint.activities?.manufacturing || blueprint.activities?.reaction;
  if (!activity || !activity.products || activity.products.length === 0) {
    logger.warn(`Blueprint invalide pour typeID ${productTypeID}`);
    rawMaterialPool.set(productTypeID, (rawMaterialPool.get(productTypeID) || 0) + quantityToProduce);
    return;
  }

  const productsPerRun = activity.products[0]?.quantity || 1;
  const runsNeeded = Math.ceil(quantityToProduce / productsPerRun);

  // Ajouter au pool de matériaux à produire (sauf si depth=0, c'est l'end product)
  if (depth > 0) {
    const key = `${productTypeID}_${me}_${te}`;
    
    if (!materialPool.has(key)) {
      materialPool.set(key, {
        typeID: productTypeID,
        me: me,
        te: te,
        totalRuns: 0,
        productsPerRun: productsPerRun
      });
    }
    
    const entry = materialPool.get(key);
    entry.totalRuns += runsNeeded;
  }

  // Calculer récursivement les matériaux nécessaires
  // Pour les composants (depth > 0), utiliser toujours ME=10 et TE=20
  const componentME = depth === 0 ? me : 10;
  const componentTE = depth === 0 ? te : 20;

  for (const material of activity.materials) {
    // Calculer quantité avec ME bonus
    const activityType = blueprintService.getActivityType(blueprint);
    const meBonus = activityType === 'reaction' ? 0 : (componentME / 100);
    const baseQuantity = material.quantity * runsNeeded;
    const quantityWithME = Math.ceil(baseQuantity * (1 - meBonus));

    calculateBOM(
      material.typeID,
      quantityWithME,
      materialPool,
      rawMaterialPool,
      stock,
      blacklist,
      depth + 1,
      10,  // Composants toujours ME 10
      20   // Composants toujours TE 20
    );
  }
}

// ============================================
// PHASE 2: JOB PLANNING
// ============================================

/**
 * Split les runs en jobs selon la configuration
 * 
 * @param {number} totalRuns - Total de runs à produire
 * @param {number} productionTimePerRun - Temps par run (secondes)
 * @param {number} slotsAvailable - Nombre de slots disponibles
 * @param {number} dontSplitShorterThan - Ne pas splitter si job < X jours
 * @returns {Array} Liste de runs par job
 */
function splitRuns(totalRuns, productionTimePerRun, slotsAvailable, dontSplitShorterThan) {
  const totalTimeDays = (totalRuns * productionTimePerRun) / 86400;

  // Si un seul slot ou job trop court, ne pas splitter
  if (slotsAvailable <= 1 || totalTimeDays <= dontSplitShorterThan) {
    return [totalRuns];
  }

  // Calculer le nombre optimal de jobs
  let numJobs = 1;
  
  for (let jobs = 2; jobs <= Math.min(slotsAvailable, totalRuns); jobs++) {
    const timePerJob = totalTimeDays / jobs;
    
    if (timePerJob > dontSplitShorterThan) {
      numJobs = jobs;
    } else {
      break;
    }
  }

  // Répartir les runs
  const runsPerJob = Math.floor(totalRuns / numJobs);
  const remainder = totalRuns % numJobs;

  const runsList = [];
  for (let i = 0; i < numJobs; i++) {
    const runs = runsPerJob + (i < remainder ? 1 : 0);
    runsList.push(runs);
  }

  return runsList;
}

/**
 * Crée les jobs à partir du pool de matériaux
 */
function createJobsFromPool(materialPool, config) {
  const jobs = [];

  for (const [key, entry] of materialPool) {
    const { typeID, me, te, totalRuns, productsPerRun } = entry;

    const type = sde.getTypeById(typeID);
    const blueprint = blueprintService.getBlueprintByProduct(typeID);

    if (!blueprint) {
      logger.warn(`Blueprint introuvable pour typeID ${typeID}`);
      continue;
    }

    const activityType = blueprintService.getActivityType(blueprint);
    const productionTimePerRun = blueprintService.calculateProductionTime(blueprint, 1, te);

    // Déterminer les slots disponibles
    const slotsAvailable = activityType === 'reaction' 
      ? config.reactionSlots 
      : config.manufacturingSlots;

    // Splitter les runs
    const runsList = splitRuns(
      totalRuns,
      productionTimePerRun,
      slotsAvailable,
      config.dontSplitShorterThan
    );

    // Créer un job pour chaque split
    for (let i = 0; i < runsList.length; i++) {
      const runs = runsList[i];
      const totalTime = runs * productionTimePerRun;

      jobs.push({
        blueprintTypeID: blueprint.blueprintTypeID,
        productTypeID: typeID,
        productName: type?.name || `Unknown (${typeID})`,
        runs: runs,
        me: me,
        te: te,
        activityType: activityType,
        productionTimePerRun: productionTimePerRun,
        productionTime: totalTime,
        productionTimeDays: totalTime / 86400,
        quantityProduced: runs * productsPerRun,
        splitIndex: runsList.length > 1 ? i + 1 : undefined,
        splitCount: runsList.length > 1 ? runsList.length : undefined,
        materials: []  // Sera rempli en Phase 3
      });
    }
  }

  return jobs;
}

// ============================================
// PHASE 3: MATERIAL CALCULATION
// ============================================

/**
 * Calcule les matériaux nécessaires pour chaque job
 */
function calculateJobMaterials(jobs) {
  for (const job of jobs) {
    const blueprint = blueprintService.getBlueprintById(job.blueprintTypeID);

    if (!blueprint) {
      logger.error(`Blueprint introuvable: ${job.blueprintTypeID}`);
      continue;
    }

    // Calculer les matériaux avec ME
    job.materials = blueprintService.calculateMaterials(blueprint, job.runs, job.me);
  }

  return jobs;
}

// ============================================
// PHASE 4: FORMATTING & DISPLAY
// ============================================

/**
 * Organise les jobs par catégories
 */
function organizeJobsByCategory(jobs) {
  const organized = {
    fuel_blocks: [],
    intermediate_composite_reactions: [],
    composite_reactions: [],
    biochemical_reactions: [],
    hybrid_reactions: [],
    construction_components: [],
    advanced_components: [],
    capital_components: [],
    others: []
  };

  for (const job of jobs) {
    const type = sde.getTypeById(job.productTypeID);
    if (!type) {
      organized.others.push(job);
      continue;
    }

    const category = productionCategories.getCategoryByGroupID(type.groupId);

    if (organized[category]) {
      organized[category].push(job);
    } else {
      organized.others.push(job);
    }
  }

  // Trier chaque catégorie par nom de produit
  for (const category in organized) {
    organized[category].sort((a, b) => a.productName.localeCompare(b.productName));
  }

  return organized;
}

/**
 * Calcule les timelines pour chaque catégorie
 */
function calculateTimelines(organizedJobs, config) {
  const categoryTimings = {};

  for (const category in organizedJobs) {
    const categoryJobs = organizedJobs[category];
    if (categoryJobs.length === 0) continue;

    // Séparer reactions et manufacturing
    const reactionJobs = categoryJobs.filter(j => j.activityType === 'reaction');
    const mfgJobs = categoryJobs.filter(j => j.activityType === 'manufacturing');

    // Simuler l'exécution parallèle
    const reactionTime = simulateParallelExecution(reactionJobs, config.reactionSlots);
    const mfgTime = simulateParallelExecution(mfgJobs, config.manufacturingSlots);

    categoryTimings[category] = {
      totalTimeDays: Math.max(reactionTime, mfgTime),
      reactionTimeDays: reactionTime,
      manufacturingTimeDays: mfgTime,
      reactionJobs: reactionJobs.length,
      manufacturingJobs: mfgJobs.length,
      totalJobs: categoryJobs.length
    };
  }

  return categoryTimings;
}

/**
 * Simule l'exécution parallèle des jobs avec N slots
 */
function simulateParallelExecution(jobs, slotsAvailable) {
  if (jobs.length === 0 || slotsAvailable === 0) return 0;

  // Trier par temps décroissant
  const sortedJobs = [...jobs].sort((a, b) => b.productionTimeDays - a.productionTimeDays);

  // Créer les timelines des slots
  const slotTimelines = Array(slotsAvailable).fill(0);

  for (const job of sortedJobs) {
    // Trouver le slot qui se libère le plus tôt
    const earliestSlotIndex = slotTimelines.indexOf(Math.min(...slotTimelines));
    const startTime = slotTimelines[earliestSlotIndex];

    // Assigner le job à ce slot
    slotTimelines[earliestSlotIndex] = startTime + job.productionTimeDays;

    // Mettre à jour les timings du job
    job.startTime = startTime;
    job.endTime = startTime + job.productionTimeDays;
    job.slotUsed = earliestSlotIndex + 1;
  }

  // Le temps total est le max des timelines
  return Math.max(...slotTimelines);
}

/**
 * Agrège les matériaux de base de tous les jobs
 */
function aggregateRawMaterials(jobs, rawMaterialPool) {
  const materialsMap = new Map(rawMaterialPool);

  for (const job of jobs) {
    for (const material of job.materials) {
      materialsMap.set(
        material.typeID,
        (materialsMap.get(material.typeID) || 0) + material.quantity
      );
    }
  }

  // Convertir en array
  const materials = [];
  for (const [typeID, quantity] of materialsMap) {
    const type = sde.getTypeById(typeID);
    materials.push({
      typeID: typeID,
      name: type?.name || `Unknown (${typeID})`,
      quantity: quantity
    });
  }

  // Trier par nom
  materials.sort((a, b) => a.name.localeCompare(b.name));

  return materials;
}

// ============================================
// FONCTION PRINCIPALE
// ============================================

/**
 * Calcule le plan de production complet
 * 
 * @param {Array} jobsInput - Jobs demandés [{product, runs, me, te}]
 * @param {string} stockText - Stock existant (format texte)
 * @param {Object} config - Configuration {slots, blacklist, dontSplitShorterThan}
 * @returns {Object} Plan de production complet
 */
async function calculateProductionPlan(jobsInput, stockText, config) {
  logger.info(`🚀 Calcul du plan de production pour ${jobsInput.length} end products`);

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
  const errors = [];

  // ============================================
  // PHASE 1: BOM CALCULATION
  // ============================================
  logger.info('📊 PHASE 1: Calcul des BOM pour chaque end product');

  const materialPool = new Map();      // Matériaux à produire (avec blueprint)
  const rawMaterialPool = new Map();   // Matériaux de base (pas de blueprint ou blacklist)

  for (const jobInput of jobsInput) {
    const type = sde.findTypeByName(jobInput.product);
    
    if (!type) {
      errors.push({
        product: jobInput.product,
        error: `❌ Produit introuvable: "${jobInput.product}"`,
        critical: true
      });
      continue;
    }

    const blueprint = blueprintService.getBlueprintByProduct(type.typeId);
    
    if (!blueprint) {
      errors.push({
        product: jobInput.product,
        error: `❌ Aucun blueprint pour: "${jobInput.product}"`,
        critical: true
      });
      continue;
    }

    const activity = blueprint.activities?.manufacturing || blueprint.activities?.reaction;
    if (!activity || !activity.products || activity.products.length === 0) {
      errors.push({
        product: jobInput.product,
        error: `❌ Blueprint invalide pour: "${jobInput.product}"`,
        critical: true
      });
      continue;
    }

    const productsPerRun = activity.products[0]?.quantity || 1;
    const quantityNeeded = jobInput.runs * productsPerRun;

    logger.info(`  → ${jobInput.product}: ${quantityNeeded} unités (ME ${jobInput.me ?? 10}, TE ${jobInput.te ?? 20})`);

    // Calculer la BOM pour cet end product
    calculateBOM(
      type.typeId,
      quantityNeeded,
      materialPool,
      rawMaterialPool,
      stock,
      config.blacklist || {},
      0,  // depth = 0 pour end product
      jobInput.me ?? 10,
      jobInput.te ?? 20
    );
  }

  // Vérifier les erreurs critiques
  const criticalErrors = errors.filter(err => err.critical);
  if (criticalErrors.length > 0) {
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

  logger.info(`  ✅ Pool de matériaux: ${materialPool.size} types à produire`);
  logger.info(`  ✅ Matériaux de base: ${rawMaterialPool.size} types à acheter`);

  // ============================================
  // PHASE 2: JOB PLANNING
  // ============================================
  logger.info('🏭 PHASE 2: Création et splitting des jobs');

  const jobs = createJobsFromPool(materialPool, config);

  logger.info(`  ✅ ${jobs.length} jobs créés`);

  // ============================================
  // PHASE 3: MATERIAL CALCULATION
  // ============================================
  logger.info('📦 PHASE 3: Calcul des matériaux pour chaque job');

  calculateJobMaterials(jobs);

  // ============================================
  // PHASE 4: FORMATTING & DISPLAY
  // ============================================
  logger.info('📋 PHASE 4: Organisation et calcul des timelines');

  const organizedJobs = organizeJobsByCategory(jobs);
  const categoryTimings = calculateTimelines(organizedJobs, config);
  const materials = aggregateRawMaterials(jobs, rawMaterialPool);

  // Calculer le temps total
  const totalProductionTimeDays = Math.max(
    ...Object.values(categoryTimings).map(ct => ct.totalTimeDays),
    0
  );

  logger.info(`✅ Plan de production terminé: ${jobs.length} jobs, ${materials.length} matériaux`);

  return {
    materials: materials,
    jobs: organizedJobs,
    categoryTimings: categoryTimings,
    totalProductionTimeDays: totalProductionTimeDays,
    totalJobs: jobs.length,
    totalMaterials: materials.length,
    errors: errors.length > 0 ? errors : undefined
  };
}

// ============================================
// EXPORTS
// ============================================

export default {
  calculateProductionPlan,
  parseStock,
  isBlacklisted
};
