/**
 * Service de catégorisation des items de production
 * Mappe les groupID EVE aux catégories du Production Planner
 */

// GroupID mappings basés sur le SDE
const GROUP_CATEGORIES = {
  // Intermediate Composite Reactions (Simple Reactions)
  intermediate_composite_reactions: [
    428,  // Intermediate Materials (Caesarium Cadmide, Dysporite, Prometium, etc.)
    436   // Simple Reaction
  ],

  // Fuel Blocks (séparés des reactions)
  fuel_blocks: [
    1136, // Fuel Block (Helium, Oxygen, Nitrogen, Hydrogen)
    1137  // Ice Product
  ],

  // Composite Reactions (Complex Reactions + Composites)
  composite_reactions: [
    429,  // Composite (Crystalline Carbonide, Fermionic Condensates, etc.)
    484,  // Complex Reactions
    1888  // Composite Reaction Formulas
  ],

  // Biochemical Reactions (Neofullerenes, Neurolink Enhancers, etc.)
  biochemical_reactions: [
    661,  // Simple Biochemical Reactions
    662,  // Complex Biochemical Reactions
    712,  // Biochemical Material (Boosters, etc.)
    1890, // Biochemical Reaction Formulas
    4096, // Molecular-Forged Materials (Neofullerenes, Neurolink Enhancers)
    4097  // Molecular-Forged Reaction Formulas
  ],

  // Hybrid Reactions (Polymers + Hybrid)
  hybrid_reactions: [
    974,  // Hybrid Polymers
    977,  // Hybrid Reactions
    1889  // Polymer Reaction Formulas
  ],

  // Advanced Components
  advanced_components: [
    913,  // Advanced Capital Construction Components
    914   // Advanced Capital Construction Component Blueprints
  ],

  // Capital Components
  capital_components: [
    873   // Capital Construction Components
  ],

  // Construction Components (intermédiaires)
  construction_components: [
    334   // Construction Components
  ]
};

/**
 * Détermine la catégorie d'un item basé sur son groupID
 * @param {number} groupID - Le groupID de l'item
 * @returns {string} La catégorie ou 'others'
 */
export function getCategoryByGroupID(groupID) {
  for (const [category, groupIDs] of Object.entries(GROUP_CATEGORIES)) {
    if (groupIDs.includes(groupID)) {
      return category;
    }
  }

  // Par défaut, items sans catégorie définie
  return 'others';
}

/**
 * Vérifie si un groupID appartient à une catégorie donnée
 * @param {number} groupID - Le groupID de l'item
 * @param {string} category - La catégorie à vérifier
 * @returns {boolean}
 */
export function isInCategory(groupID, category) {
  const groupIDs = GROUP_CATEGORIES[category];
  return groupIDs ? groupIDs.includes(groupID) : false;
}

/**
 * Retourne toutes les catégories disponibles dans l'ordre de production
 * @returns {Array<string>} Liste des catégories
 */
export function getAllCategories() {
  return [
    'intermediate_composite_reactions',
    'fuel_blocks',
    'composite_reactions',
    'biochemical_reactions',
    'hybrid_reactions',
    'construction_components',
    'advanced_components',
    'capital_components',
    'others',
    'end_product_jobs'
  ];
}

/**
 * Vérifie si un item est dans la blacklist de catégories
 * @param {number} groupID - Le groupID de l'item
 * @param {Object} blacklist - Configuration de blacklist
 * @returns {boolean}
 */
export function isBlacklistedByCategory(groupID, blacklist) {
  if (!blacklist) return false;

  // Vérifier chaque catégorie de blacklist
  if (blacklist.intermediateCompositeReactions && isInCategory(groupID, 'intermediate_composite_reactions')) {
    return true;
  }
  if (blacklist.fuelBlocks && isInCategory(groupID, 'fuel_blocks')) {
    return true;
  }
  if (blacklist.compositeReactions && isInCategory(groupID, 'composite_reactions')) {
    return true;
  }
  if (blacklist.biochemicalReactions && isInCategory(groupID, 'biochemical_reactions')) {
    return true;
  }
  if (blacklist.hybridReactions && isInCategory(groupID, 'hybrid_reactions')) {
    return true;
  }
  if (blacklist.advancedComponents && isInCategory(groupID, 'advanced_components')) {
    return true;
  }
  if (blacklist.capitalComponents && isInCategory(groupID, 'capital_components')) {
    return true;
  }

  return false;
}

export default {
  getCategoryByGroupID,
  isInCategory,
  getAllCategories,
  isBlacklistedByCategory
};
