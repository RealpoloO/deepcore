import blueprintService from './blueprintService.js';
import sde from './sde.js';
import productionCategories from './productionCategories.js';
import logger from '../utils/logger.js';

// ============================================
// MEMOIZATION CACHE
// ============================================
class ProductionCache {
  constructor(ttlMs = 300000) { // 5 minutes TTL par défaut
    this.cache = new Map();
    this.ttl = ttlMs;
    this.maxSize = 1000; // Limite de 1000 entrées
  }

  generateKey(typeID, quantity, stockValue, blacklistHash) {
    return `${typeID}:${quantity}:${stockValue}:${blacklistHash}`;
  }

  hashBlacklist(blacklist) {
    return JSON.stringify(blacklist);
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key, data) {
    // LRU: si trop d'entrées, supprimer les plus anciennes
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  }

  clear() {
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl
    };
  }
}

const productionCache = new ProductionCache();

// ============================================
// INPUT VALIDATION
// ============================================
const MAX_QUANTITY = 1_000_000_000; // 1 milliard max
const MAX_DEPTH = 20;
const MAX_STOCK_LINES = 10000;
const MAX_ITEM_NAME_LENGTH = 200;

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
 * @param {string} stockText - Texte du stock (format: "Item: Quantity")
 * @returns {Object} { stock: Map<number, number>, errors: Array }
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

    // Format: "Item Name\tQuantity" (tabulation) ou "Item Name  Quantity" (espaces)
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

      // Trouver le typeID de l'item
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
 * @param {number} typeID - L'ID du type
 * @param {Object} blacklist - Configuration de la blacklist
 * @returns {boolean}
 */
function isBlacklisted(typeID, blacklist) {
  const type = sde.getTypeById(typeID);
  if (!type) return false;

  // Vérifier blacklist par catégories (via groupID)
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


/**
 * NOUVELLE APPROCHE: Calcule UNIQUEMENT les demandes en matériaux de manière récursive
 * Ne crée PAS de JobDescriptors - cela sera fait dans une seconde passe
 *
 * @param {number} productTypeID - L'ID du produit à fabriquer
 * @param {number} requiredQuantity - Quantité requise
 * @param {Map<number, number>} stock - Stock disponible (lecture seule)
 * @param {Object} blacklist - Configuration de blacklist
 * @param {Map<string, Object>} productionDemands - Accumulation GLOBALE des demandes de production
 * @param {Array} errors - Accumulation des erreurs
 * @param {number} depth - Profondeur actuelle
 * @param {number} me - Material Efficiency (uniquement pour depth=0, sinon toujours 10)
 * @param {number} te - Time Efficiency (uniquement pour depth=0, sinon toujours 20)
 * @param {boolean} isEndProduct - Est-ce un produit final demandé par l'utilisateur ?
 * @returns {void}
 */
function collectProductionDemands(
  productTypeID,
  requiredQuantity,
  stock,
  blacklist,
  productionDemands,
  errors,
  depth = 0,
  me = 10,
  te = 20,
  isEndProduct = false
) {
  // Validation
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

  // TODO: Cache sera réactivé dans Phase 2 avec nouvelle stratégie (sans stock dans clé)

  // Vérifier le stock disponible (lecture seule pour l'instant)
  const availableStock = stock.get(productTypeID) || 0;
  let quantityToProduce = requiredQuantity - availableStock;

  if (quantityToProduce <= 0) {
    // On a assez en stock - pas besoin de produire
    // Note: La consommation de stock sera gérée APRÈS le splitting
    return;
  }

  // Note: On NE consomme PAS le stock ici
  // Le stock sera consommé APRÈS le splitting pour refléter les jobs finaux

  // Vérifier si l'item est blacklisté (on préfère l'acheter)
  if (isBlacklisted(productTypeID, blacklist)) {
    // Ajouter aux MaterialRequests pour pooling
    const key = `${productTypeID}_${depth}`;

    if (!materialRequests.has(key)) {
      materialRequests.set(key, {
        typeID: productTypeID,
        baseQuantityPerRun: 1,  // Pour items blacklistés, quantité = quantité
        depth: depth,
        totalRuns: 0,
        me: 0  // Pas de ME bonus pour items blacklistés
      });
    }

    const request = materialRequests.get(key);
    request.totalRuns += quantityToProduce;  // Accumuler la quantité

    return;
  }

  // Trouver le blueprint pour cet item
  const blueprint = blueprintService.getBlueprintByProduct(productTypeID);

  if (!blueprint) {
    // AUCUN BLUEPRINT = ERREUR CRITIQUE
    // Les items sans blueprint (raw materials comme Tritanium) ne doivent JAMAIS
    // être dans la chaîne de production. Ils doivent être achetés, pas produits.

    const type = sde.getTypeById(productTypeID);
    const productName = type?.name || `Unknown (${productTypeID})`;

    // Si c'est un item de profondeur 0 (demandé directement par l'utilisateur)
    if (depth === 0) {
      errors.push({
        type: 'NO_BLUEPRINT',
        productTypeID: productTypeID,
        productName: productName,
        error: `❌ "${productName}" ne peut pas être produit (aucun blueprint disponible). Seuls les items avec blueprint peuvent être ajoutés aux jobs de production.`,
        critical: true
      });
      return;
    }

    // Si c'est un composant intermédiaire (depth > 0), c'est un matériau de base
    // On l'ajoute aux MaterialRequests pour pooling
    const key = `${productTypeID}_${depth}`;

    if (!materialRequests.has(key)) {
      materialRequests.set(key, {
        typeID: productTypeID,
        baseQuantityPerRun: 1,  // Pour raw materials, quantité = quantité
        depth: depth,
        totalRuns: 0,
        me: 0  // Pas de ME bonus pour raw materials
      });
    }

    const request = materialRequests.get(key);
    request.totalRuns += quantityToProduce;  // Accumuler la quantité

    return;
  }

  // Calculer combien de runs sont nécessaires
  const activity = blueprint.activities?.manufacturing || blueprint.activities?.reaction;
  const productsPerRun = activity.products[0]?.quantity || 1;
  const runsNeeded = Math.ceil(quantityToProduce / productsPerRun);

  // Utiliser ME/TE spécifiques pour le end product (depth=0)
  // Pour les composants (depth>0), toujours utiliser ME=10 et TE=20 (BPO optimaux)
  const effectiveME = depth === 0 ? me : 10;
  const effectiveTE = depth === 0 ? te : 20;

  // Calculer le temps PAR RUN (pas le temps total - ça sera fait après splitting)
  const productionTimePerRun = blueprintService.calculateProductionTime(blueprint, 1, effectiveTE);

  // Créer JobDescriptor SANS materials (seront calculés APRÈS splitting)
  const activityType = blueprintService.getActivityType(blueprint);
  const type = sde.getTypeById(productTypeID);

  const jobDescriptor = {
    blueprintTypeID: blueprint.blueprintTypeID,
    productTypeID: productTypeID,
    productName: type?.name || `Unknown (${productTypeID})`,
    runs: runsNeeded,
    productionTimePerRun: productionTimePerRun,
    activityType: activityType,
    depth: depth,
    isEndProduct: depth === 0,
    me: effectiveME,  // Stocké pour calcul ultérieur
    te: effectiveTE   // Stocké pour calcul ultérieur
  };

  jobDescriptors.push(jobDescriptor);

  // Enregistrer les MaterialRequests pour pooling (au lieu de calculer materials maintenant)
  for (const material of activity.materials) {
    // Clé unique: typeID + depth (pour grouper par profondeur)
    const key = `${material.typeID}_${depth + 1}`;

    if (!materialRequests.has(key)) {
      materialRequests.set(key, {
        typeID: material.typeID,
        baseQuantityPerRun: material.quantity,
        depth: depth + 1,
        totalRuns: 0,
        me: effectiveME
      });
    }

    // Accumuler les runs
    const request = materialRequests.get(key);
    request.totalRuns += runsNeeded;
  }

  // Calculer récursivement les matériaux nécessaires
  // Les composants utilisent TOUJOURS ME=10 et TE=20 (BPO optimaux)
  for (const material of activity.materials) {
    const quantityNeeded = material.quantity * runsNeeded;

    calculateProductionTree(
      material.typeID,
      quantityNeeded,
      stock,
      blacklist,
      materialRequests,  // Passe materialRequests
      jobDescriptors,    // Passe jobDescriptors
      errors,
      depth + 1,
      10,  // ME toujours 10 pour les composants
      20   // TE toujours 20 pour les composants
    );
  }

  // Note: Stock sera consommé APRÈS splitting (pas ici)
  // Note: Cache sera réactivé dans Phase 2
}

/**
 * Résout les matériaux pour les jobs APRÈS splitting
 * C'est ici que Math.ceil() est appliqué, sur les runs FINAUX
 *
 * @param {Array} jobDescriptors - Jobs avec runs mais sans materials
 * @returns {Array} Jobs complets avec materials calculés
 */
function resolveMaterialsForJobs(jobDescriptors) {
  const completeJobs = [];

  for (const jobDesc of jobDescriptors) {
    const blueprint = blueprintService.getBlueprintById(jobDesc.blueprintTypeID);

    if (!blueprint) {
      logger.error(`Blueprint not found for blueprintTypeID ${jobDesc.blueprintTypeID}`);
      continue;
    }

    // ✅ CALCUL DES MATERIALS ICI - APRÈS splitting!
    const materials = blueprintService.calculateMaterials(
      blueprint,
      jobDesc.runs,  // ✅ Runs FINAUX (27 ou 28, pas 55!)
      jobDesc.me
    );

    // Calculer temps total basé sur productionTimePerRun
    const totalProductionTime = jobDesc.productionTimePerRun * jobDesc.runs;

    // Calculer quantité produite
    const activity = blueprint.activities?.manufacturing || blueprint.activities?.reaction;
    const productsPerRun = activity.products[0]?.quantity || 1;
    const quantityProduced = jobDesc.runs * productsPerRun;

    const completeJob = {
      ...jobDesc,
      materials: materials,  // ✅ Materials calculés pour runs finaux!
      productionTime: totalProductionTime,
      productionTimeDays: totalProductionTime / 86400,
      quantityProduced: quantityProduced,
      singleRunDurationDays: jobDesc.productionTimePerRun / 86400
    };

    completeJobs.push(completeJob);
  }

  return completeJobs;
}

/**
 * Pool les MaterialRequests pour minimiser excess stock
 *
 * Job A needs 10.3 units → pool avec Job B (10.3) = 20.6 → ceil(20.6) = 21
 * Au lieu de: ceil(10.3) + ceil(10.3) = 11 + 11 = 22
 *
 * @param {Map} materialRequests - Map<key, MaterialRequest>
 * @returns {Map} Materials poolés avec rounding minimisé
 */
function poolMaterialRequests(materialRequests) {
  const pooled = new Map();

  // ✅ DÉTERMINISME: Convertir en array et trier par clé pour ordre stable
  const sortedRequests = Array.from(materialRequests.entries()).sort((a, b) => {
    const [keyA, requestA] = a;
    const [keyB, requestB] = b;

    // Tri primaire par typeID
    if (requestA.typeID !== requestB.typeID) {
      return requestA.typeID - requestB.typeID;
    }

    // Tri secondaire par depth
    if (requestA.depth !== requestB.depth) {
      return requestA.depth - requestB.depth;
    }

    // Tri tertiaire par clé (pour garantir l'ordre)
    return keyA.localeCompare(keyB);
  });

  for (const [key, request] of sortedRequests) {
    const meBonus = request.me / 100;

    // ✅ Appliquer ME bonus UNE FOIS sur le total poolé
    const totalBeforeRounding = request.baseQuantityPerRun *
                                (1 - meBonus) *
                                request.totalRuns;

    // ✅ Arrondir UNE FOIS pour tout le pool
    const totalAfterRounding = Math.ceil(totalBeforeRounding);

    if (!pooled.has(request.typeID)) {
      pooled.set(request.typeID, 0);
    }

    const current = pooled.get(request.typeID);
    pooled.set(request.typeID, current + totalAfterRounding);
  }

  return pooled;
}

/**
 * Organise les jobs par catégories et étapes
 * @param {Array} jobs - Liste des jobs
 * @returns {Object} Jobs organisés par catégories
 */
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
    // Les end products vont toujours dans end_product_jobs
    if (job.isEndProduct) {
      organized.end_product_jobs.push(job);
      continue;
    }

    const type = sde.getTypeById(job.productTypeID);
    if (!type) {
      organized.end_product_jobs.push(job);
      continue;
    }

    // Déterminer la catégorie basée sur le groupID
    const category = productionCategories.getCategoryByGroupID(type.groupId);

    if (organized[category]) {
      organized[category].push(job);
    } else {
      organized.end_product_jobs.push(job);
    }
  }

  // ✅ DÉTERMINISME: Trier chaque catégorie par productTypeID pour garantir un ordre stable
  for (const category in organized) {
    organized[category].sort((a, b) => {
      // Tri primaire par productTypeID
      if (a.productTypeID !== b.productTypeID) {
        return a.productTypeID - b.productTypeID;
      }
      // Tri secondaire par depth (end products en premier si égalité)
      if (a.depth !== b.depth) {
        return a.depth - b.depth;
      }
      // Tri tertiaire par ME
      if ((a.me || 0) !== (b.me || 0)) {
        return (a.me || 0) - (b.me || 0);
      }
      // Tri quaternaire par TE
      return (a.te || 0) - (b.te || 0);
    });
  }

  return organized;
}

/**
 * Optimise les JobDescriptors selon les slots disponibles et la règle de split
 * Regroupe les JobDescriptors identiques et les split UNIQUEMENT si un job unique monopolise trop de temps
 *
 * IMPORTANT: Cette fonction travaille avec JobDescriptors (SANS materials)
 * Les materials seront calculés APRÈS par resolveMaterialsForJobs()
 *
 * @param {Array} jobDescriptors - Liste des JobDescriptors (SANS materials)
 * @param {Object} config - Configuration (slots, dontSplitShorterThan)
 * @param {string} activityType - 'reaction' ou 'manufacturing'
 * @returns {Object} { jobDescriptors: Array, totalTimeDays: number, slotsUsed: number }
 */
function optimizeJobsForCategory(jobDescriptors, config, activityType, categoryName = '') {
  const slotsAvailable = activityType === 'reaction'
    ? config.reactionSlots
    : config.manufacturingSlots;

  // ✅ SKIP CONSOLIDATION: Les jobDescriptors ont déjà été consolidés globalement
  // On passe directement à l'étape de calcul des durées
  const consolidatedDescriptors = [];

  for (const jobDesc of jobDescriptors) {
    // Calculer temps total basé sur productionTimePerRun
    const totalTime = jobDesc.productionTimePerRun * jobDesc.runs;
    const totalDurationDays = totalTime / 86400;

    consolidatedDescriptors.push({
      ...jobDesc,
      productionTimeDays: totalDurationDays,  // Pour tri et allocation
      // PAS de materials[] ici - sera calculé après splitting
    });
  }

  // ✅ DÉTERMINISME: Trier de manière stable pour garantir un ordre déterministe
  consolidatedDescriptors.sort((a, b) => {
    // Tri primaire par productTypeID
    if (a.productTypeID !== b.productTypeID) {
      return a.productTypeID - b.productTypeID;
    }
    // Tri secondaire par ME (si différent)
    if ((a.me || 0) !== (b.me || 0)) {
      return (a.me || 0) - (b.me || 0);
    }
    // Tri tertiaire par TE (si différent)
    return (a.te || 0) - (b.te || 0);
  });

  // VÉRIFICATION : Si plus de produits différents que de slots disponibles → ERREUR
  const uniqueProductCount = consolidatedDescriptors.length;
  if (uniqueProductCount > slotsAvailable) {
    const categoryName = activityType === 'reaction' ? 'REACTIONS' : 'MANUFACTURING';
    throw new Error(
      `❌ Impossible : ${uniqueProductCount} produits différents mais seulement ${slotsAvailable} slots disponibles en ${categoryName}.\n` +
      `Il faut au minimum ${uniqueProductCount} slots pour produire tous ces produits en parallèle.`
    );
  }

  // Étape 3 : Déterminer combien de jobs (splits) on peut créer au total
  // On a slotsAvailable slots max = slotsAvailable jobs max
  // Chaque produit a droit à au moins 1 job
  const baseJobsCount = uniqueProductCount;
  let bonusJobsAvailable = slotsAvailable - baseJobsCount; // Jobs supplémentaires qu'on peut créer via split

  // ✅ DÉTERMINISME: Trier par temps décroissant PUIS par productTypeID pour ordre stable
  const sortedDescriptors = [...consolidatedDescriptors].sort((a, b) => {
    // Tri primaire par productionTimeDays (décroissant)
    if (b.productionTimeDays !== a.productionTimeDays) {
      return b.productionTimeDays - a.productionTimeDays;
    }
    // Tri secondaire par productTypeID pour stabilité
    if (a.productTypeID !== b.productTypeID) {
      return a.productTypeID - b.productTypeID;
    }
    // Tri tertiaire par ME
    if ((a.me || 0) !== (b.me || 0)) {
      return (a.me || 0) - (b.me || 0);
    }
    // Tri quaternaire par TE
    return (a.te || 0) - (b.te || 0);
  });

  // Initialiser : 1 job par produit
  const jobsAllocation = new Map();
  for (const jobDesc of sortedDescriptors) {
    const key = `${jobDesc.productTypeID}_${jobDesc.me || 0}_${jobDesc.te || 0}`;
    jobsAllocation.set(key, {
      allocatedJobs: 1,
      productionTimeDays: jobDesc.productionTimeDays
    });
  }

  // Distribuer les jobs bonus UN PAR UN aux jobs les plus longs qui peuvent en bénéficier
  while (bonusJobsAvailable > 0) {
    // Trouver le job le plus long qui peut encore accepter un split (runs > allocatedJobs)
    let bestJobDesc = null;
    let bestTime = 0;

    for (const jobDesc of sortedDescriptors) {
      // NE JAMAIS splitter les end products (produits finaux demandés par l'utilisateur)
      if (jobDesc.isEndProduct) continue;

      const key = `${jobDesc.productTypeID}_${jobDesc.me || 0}_${jobDesc.te || 0}`;
      const allocation = jobsAllocation.get(key);

      // Calculer le temps d'un job SI on le split davantage
      const timePerJobIfSplit = jobDesc.productionTimeDays / (allocation.allocatedJobs + 1);

      // RÈGLE: Ne splitter que si le temps APRÈS split reste > dontSplitShorterThan
      // ET qu'on a encore des runs à splitter
      if (jobDesc.runs > allocation.allocatedJobs &&
          timePerJobIfSplit > config.dontSplitShorterThan) {

        // Prendre le job dont le temps par split actuel est le plus élevé
        const currentTimePerJob = jobDesc.productionTimeDays / allocation.allocatedJobs;

        if (currentTimePerJob > bestTime) {
          bestTime = currentTimePerJob;
          bestJobDesc = jobDesc;
        }
      }
    }

    // Si aucun job ne peut accepter de split supplémentaire, stop
    if (!bestJobDesc) break;

    // Allouer un job bonus au bestJobDesc
    const key = `${bestJobDesc.productTypeID}_${bestJobDesc.me || 0}_${bestJobDesc.te || 0}`;
    jobsAllocation.get(key).allocatedJobs++;
    bonusJobsAvailable--;
  }
  
  // VÉRIFICATION FINALE : total des jobs ne doit JAMAIS dépasser slotsAvailable
  let totalJobsCount = 0;
  for (const allocation of jobsAllocation.values()) {
    totalJobsCount += allocation.allocatedJobs;
  }
  
  if (totalJobsCount > slotsAvailable) {
    throw new Error(
      `❌ BUG : Allocation a créé ${totalJobsCount} jobs mais seulement ${slotsAvailable} slots disponibles !`
    );
  }

  // Étape 4 : Splitter les JobDescriptors selon le nombre de jobs alloués
  const splitDescriptors = [];

  for (const jobDesc of consolidatedDescriptors) {
    const key = `${jobDesc.productTypeID}_${jobDesc.me || 0}_${jobDesc.te || 0}`;
    const allocation = jobsAllocation.get(key);
    const allocatedJobs = allocation.allocatedJobs;

    // Splitter si on a alloué plus d'1 job pour ce produit
    const shouldSplit = allocatedJobs > 1;

    if (shouldSplit) {
      const runsPerJob = Math.ceil(jobDesc.runs / allocatedJobs);

      let remainingRuns = jobDesc.runs;
      let splitIndex = 0;

      while (remainingRuns > 0) {
        const splitRuns = Math.min(runsPerJob, remainingRuns);

        splitDescriptors.push({
          ...jobDesc,
          runs: splitRuns,  // ✅ SEULEMENT runs
          splitFrom: jobDesc.runs,
          splitIndex: ++splitIndex,
          splitCount: allocatedJobs
          // PAS de materials[] ici!
        });

        remainingRuns -= splitRuns;
      }
    } else {
      // Garder le descriptor consolidé tel quel
      splitDescriptors.push(jobDesc);
    }
  }

  // Étape 5 : Simuler l'exécution avec les slots disponibles pour calculer timings
  let totalTimeDays = 0;
  if (splitDescriptors.length > 0) {
    // Calculer productionTimeDays pour chaque descriptor
    for (const jobDesc of splitDescriptors) {
      jobDesc.productionTimeDays = (jobDesc.productionTimePerRun * jobDesc.runs) / 86400;
    }

    const jobQueue = [...splitDescriptors].sort((a, b) => b.productionTimeDays - a.productionTimeDays);
    const slotTimelines = Array(slotsAvailable).fill(0);

    for (const jobDesc of jobQueue) {
      // Trouver le slot qui se libère le plus tôt
      const earliestSlotIndex = slotTimelines.indexOf(Math.min(...slotTimelines));
      const startTime = slotTimelines[earliestSlotIndex];

      // Ajouter ce job au slot
      slotTimelines[earliestSlotIndex] = startTime + jobDesc.productionTimeDays;

      // Mettre à jour le timing du descriptor
      jobDesc.startTime = startTime;
      jobDesc.endTime = startTime + jobDesc.productionTimeDays;
      jobDesc.slotUsed = earliestSlotIndex + 1;
    }

    // Le temps total est le max des timelines
    totalTimeDays = Math.max(...slotTimelines);
  }

  return {
    jobDescriptors: splitDescriptors,  // ✅ Retourne jobDescriptors au lieu de jobs
    totalTimeDays: totalTimeDays,
    slotsUsed: Math.min(splitDescriptors.length, slotsAvailable)
  };
}

/**
 * Calcule le plan de production complet
 * @param {Array} jobsInput - Jobs demandés par l'utilisateur [{product, runs, me, te}]
 * @param {string} stockText - Stock existant (format texte)
 * @param {Object} config - Configuration (slots, blacklist, etc.)
 * @returns {Object} Plan de production complet
 */
async function calculateProductionPlan(jobsInput, stockText, config) {
  logger.info(`Calculating production plan for ${jobsInput.length} jobs`);

  // ✅ DÉTERMINISME CRITIQUE: Trier les jobs par nom de produit AVANT tout traitement
  // Cela garantit que l'ordre d'entrée n'affecte JAMAIS le résultat
  const sortedJobsInput = [...jobsInput].sort((a, b) => {
    // Tri primaire par nom de produit
    if (a.product !== b.product) {
      return a.product.localeCompare(b.product);
    }
    // Tri secondaire par ME
    if ((a.me || 10) !== (b.me || 10)) {
      return (a.me || 10) - (b.me || 10);
    }
    // Tri tertiaire par TE
    if ((a.te || 20) !== (b.te || 20)) {
      return (a.te || 20) - (b.te || 20);
    }
    // Tri quaternaire par runs
    return (a.runs || 1) - (b.runs || 1);
  });

  logger.info(`✅ Jobs sorted deterministically: ${sortedJobsInput.map(j => j.product).join(', ')}`);

  // Parser le stock UNE SEULE FOIS (ne pas le modifier pendant le calcul)
  const stockResult = await parseStock(stockText);

  // Vérifier les erreurs de parsing de stock
  if (stockResult.errors && stockResult.errors.length > 0) {
    // Retourner immédiatement les erreurs de stock
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
      })),
      cacheStats: productionCache.getStats()
    };
  }

  // Cloner le stock pour chaque calcul (éviter la mutation entre calculs)
  const stock = new Map(stockResult.stock);

  // ✅ NOUVEAUX accumulateurs
  const materialRequests = new Map();  // Pour pooling
  const jobDescriptors = [];           // Jobs SANS materials
  const errors = [];

  // ✅ PASS 1: Construire structure de jobs (SANS materials)
  logger.info('PASS 1: Building job structure (without materials)...');

  for (const jobInput of sortedJobsInput) {
    const type = sde.findTypeByName(jobInput.product);
    if (!type) {
      const errorMsg = `❌ Produit introuvable : "${jobInput.product}". Vérifiez l'orthographe exacte du nom.`;
      logger.warn(`Product not found: ${jobInput.product}`);
      errors.push({ product: jobInput.product, error: errorMsg, critical: true });
      continue;
    }

    const blueprint = blueprintService.getBlueprintByProduct(type.typeId);
    if (!blueprint) {
      const errorMsg = `❌ Aucun blueprint trouvé pour : "${jobInput.product}". Ce produit ne peut pas être fabriqué.`;
      logger.warn(`No blueprint found for: ${jobInput.product}`);
      errors.push({ product: jobInput.product, error: errorMsg, critical: true });
      continue;
    }

    const activity = blueprint.activities?.manufacturing || blueprint.activities?.reaction;
    if (!activity || !activity.products || activity.products.length === 0) {
      const errorMsg = `❌ Blueprint invalide pour : "${jobInput.product}". Aucune activité de production disponible.`;
      logger.warn(`Invalid blueprint for: ${jobInput.product}`);
      errors.push({ product: jobInput.product, error: errorMsg, critical: true });
      continue;
    }

    const productsPerRun = activity.products[0]?.quantity || 1;
    const quantityNeeded = jobInput.runs * productsPerRun;

    // Calculer arbre SANS materials (crée JobDescriptors)
    calculateProductionTree(
      type.typeId,
      quantityNeeded,
      stock,
      config.blacklist || {},
      materialRequests,  // ✅ Pour pooling
      jobDescriptors,    // ✅ JobDescriptors (sans materials)
      errors,
      0,
      jobInput.me || 10,
      jobInput.te || 20
    );
  }

  // VÉRIFICATION CRITIQUE : Si des erreurs critiques existent, arrêter immédiatement
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
      errors: criticalErrors,
      cacheStats: productionCache.getStats()
    };
  }

  // ✅ DÉTERMINISME: Consolider les JobDescriptors identiques AVANT de les organiser par catégorie
  // Cela évite que l'ordre des jobs d'entrée affecte la consolidation
  logger.info(`PASS 2: Consolidating and organizing ${jobDescriptors.length} job descriptors...`);

  // ✅ ÉTAPE CRITIQUE: Trier TOUS les jobDescriptors AVANT consolidation
  // Cela garantit que l'ordre de traitement est toujours le même
  jobDescriptors.sort((a, b) => {
    // Tri primaire par productTypeID
    if (a.productTypeID !== b.productTypeID) {
      return a.productTypeID - b.productTypeID;
    }
    // Tri secondaire par depth
    if (a.depth !== b.depth) {
      return a.depth - b.depth;
    }
    // Tri tertiaire par ME
    if ((a.me || 0) !== (b.me || 0)) {
      return (a.me || 0) - (b.me || 0);
    }
    // Tri quaternaire par TE
    if ((a.te || 0) !== (b.te || 0)) {
      return (a.te || 0) - (b.te || 0);
    }
    // Tri par isEndProduct (end products en dernier)
    if (a.isEndProduct !== b.isEndProduct) {
      return a.isEndProduct ? 1 : -1;
    }
    return 0;
  });

  // Grouper les job descriptors identiques (même produit, même ME/TE, même depth)
  // IMPORTANT: Ne PAS consolider les end products - ils doivent rester séparés selon la demande utilisateur
  const consolidationMap = new Map();
  let endProductSequence = 0;  // Compteur pour garder les end products séparés (maintenant déterministe grâce au tri)

  for (const jobDesc of jobDescriptors) {
    // Clé unique basée sur le produit, PAS sur l'ordre de création
    let key;

    if (jobDesc.isEndProduct) {
      // Pour les end products, créer une clé unique pour chaque occurrence
      // Le compteur est maintenant déterministe car jobDescriptors est trié
      key = `${jobDesc.productTypeID}_${jobDesc.me || 0}_${jobDesc.te || 0}_${jobDesc.depth}_end_${endProductSequence++}`;
    } else {
      // Pour les composants intermédiaires, consolider normalement
      key = `${jobDesc.productTypeID}_${jobDesc.me || 0}_${jobDesc.te || 0}_${jobDesc.depth}`;
    }

    if (!consolidationMap.has(key)) {
      consolidationMap.set(key, {
        ...jobDesc,
        runs: 0
      });
    }

    const group = consolidationMap.get(key);
    group.runs += jobDesc.runs;
  }

  // Convertir la Map en array et trier de manière déterministe
  const consolidatedJobDescriptors = Array.from(consolidationMap.values()).sort((a, b) => {
    // Tri primaire par productTypeID
    if (a.productTypeID !== b.productTypeID) {
      return a.productTypeID - b.productTypeID;
    }
    // Tri secondaire par depth
    if (a.depth !== b.depth) {
      return a.depth - b.depth;
    }
    // Tri tertiaire par ME
    if ((a.me || 0) !== (b.me || 0)) {
      return (a.me || 0) - (b.me || 0);
    }
    // Tri quaternaire par TE
    return (a.te || 0) - (b.te || 0);
  });

  logger.info(`Consolidated ${jobDescriptors.length} descriptors into ${consolidatedJobDescriptors.length} unique jobs`);

  // Organiser les JobDescriptors consolidés par catégories
  const organizedDescriptors = organizeJobs(consolidatedJobDescriptors);

  // ✅ PASS 2: Optimiser (consolider + splitter)
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
      allOptimizedDescriptors.push(...optimized.jobDescriptors);  // ✅ Toujours descriptors
      maxTimeDays = Math.max(maxTimeDays, optimized.totalTimeDays);
    }

    // Optimiser manufacturing
    if (mfgDescs.length > 0) {
      const optimized = optimizeJobsForCategory(mfgDescs, config, 'manufacturing', `${category}_manufacturing`);
      allOptimizedDescriptors.push(...optimized.jobDescriptors);
      maxTimeDays = Math.max(maxTimeDays, optimized.totalTimeDays);
    }

    // ✅ PASS 3: Résoudre materials pour jobs optimisés
    logger.info(`PASS 3: Resolving materials for ${allOptimizedDescriptors.length} jobs in ${category}...`);
    const completeJobs = resolveMaterialsForJobs(allOptimizedDescriptors);

    organizedJobs[category] = completeJobs;  // ✅ MAINTENANT complets
    categoryTimings[category] = {
      totalTimeDays: maxTimeDays,
      slotsUsed: completeJobs.length,
      jobCount: completeJobs.length
    };

    totalProductionTime = Math.max(totalProductionTime, maxTimeDays);
  }

  // ✅ Pool les MaterialRequests pour minimiser excess
  logger.info(`Pooling ${materialRequests.size} material requests...`);
  const pooledMaterials = poolMaterialRequests(materialRequests);

  // Convertir en liste de matériaux
  const materials = [];
  for (const [typeID, quantity] of pooledMaterials) {
    const type = sde.getTypeById(typeID);
    materials.push({
      typeID: typeID,
      name: type?.name || `Unknown (${typeID})`,
      quantity: quantity
    });
  }

  // Trier
  materials.sort((a, b) => a.name.localeCompare(b.name));

  logger.info(`Production plan complete: ${jobDescriptors.length} jobs, ${materials.length} materials`);

  return {
    materials: materials,
    jobs: organizedJobs,
    categoryTimings: categoryTimings,
    totalProductionTimeDays: totalProductionTime,
    totalJobs: jobDescriptors.length,
    totalMaterials: materials.length,
    errors: errors.length > 0 ? errors : undefined,
    cacheStats: productionCache.getStats()
  };
}

/**
 * Nettoyer le cache (pour tests ou reset)
 */
function clearCache() {
  productionCache.clear();
}

export default {
  calculateProductionPlan,
  parseStock,
  isBlacklisted,
  clearCache,
  getCacheStats: () => productionCache.getStats()
};
