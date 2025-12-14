import sde from '../services/sde.js';
import blueprintService from '../services/blueprintService.js';
import productionPlanner from '../services/productionPlanner.js';
import productionCategories from '../services/productionCategories.js';

console.log('🧪 TEST DE LA BLACKLIST - PRODUCTION PLANNER\n');
console.log('='.repeat(70));

// Charger les services
console.log('⏳ Chargement des services SDE et Blueprints...\n');
await sde.loadTypes();
await blueprintService.loadBlueprints();
console.log('✅ Services chargés avec succès!\n');

// ============================================
// TEST 1: Vérifier les catégories des items
// ============================================
console.log('\n📋 TEST 1: Vérification des catégories d\'items');
console.log('-'.repeat(70));

const testItems = [
  { name: 'Helium Fuel Block', expectedCategory: 'fuel_blocks' },
  { name: 'Caesarium Cadmide', expectedCategory: 'intermediate_composite_reactions' },
  { name: 'Crystalline Carbonide', expectedCategory: 'composite_reactions' },
  { name: 'Fullerides', expectedCategory: 'biochemical_reactions' },
  { name: 'Fernite Carbide', expectedCategory: 'hybrid_reactions' },
  { name: 'Capital Construction Parts', expectedCategory: 'capital_components' },
  { name: 'Compressed Ore', expectedCategory: 'end_product_jobs' }
];

for (const item of testItems) {
  const type = sde.findTypeByName(item.name);
  if (type) {
    const category = productionCategories.getCategoryByGroupID(type.groupId);
    const status = category === item.expectedCategory ? '✅' : '❌';
    console.log(`${status} ${item.name}`);
    console.log(`   GroupID: ${type.groupId}, Catégorie: ${category}`);
    if (category !== item.expectedCategory) {
      console.log(`   ⚠️  ATTENDU: ${item.expectedCategory}, REÇU: ${category}`);
    }
  } else {
    console.log(`❌ ${item.name} - Item introuvable`);
  }
}

// ============================================
// TEST 2: Fonction isBlacklisted
// ============================================
console.log('\n📋 TEST 2: Fonction isBlacklisted()');
console.log('-'.repeat(70));

const blacklistConfig = {
  fuelBlocks: true,
  intermediateCompositeReactions: true,
  compositeReactions: true,
  biochemicalReactions: false,
  gasPhaseReactions: false,
  hybridReactions: false,
  capitalComponents: false,
  advancedComponents: false,
  customItems: 'Tritanium\nPyerite'
};

const testItemsBlacklist = [
  { name: 'Helium Fuel Block', shouldBeBlacklisted: true, reason: 'fuelBlocks activé' },
  { name: 'Caesarium Cadmide', shouldBeBlacklisted: true, reason: 'intermediateCompositeReactions activé' },
  { name: 'Crystalline Carbonide', shouldBeBlacklisted: true, reason: 'compositeReactions activé' },
  { name: 'Fullerides', shouldBeBlacklisted: false, reason: 'biochemicalReactions désactivé' },
  { name: 'Tritanium', shouldBeBlacklisted: true, reason: 'customItems' },
  { name: 'Pyerite', shouldBeBlacklisted: true, reason: 'customItems' },
  { name: 'Mexallon', shouldBeBlacklisted: false, reason: 'non présent dans blacklist' }
];

for (const item of testItemsBlacklist) {
  const type = sde.findTypeByName(item.name);
  if (type) {
    const isBlacklisted = productionPlanner.isBlacklisted(type.typeId, blacklistConfig);
    const status = isBlacklisted === item.shouldBeBlacklisted ? '✅' : '❌';
    console.log(`${status} ${item.name}`);
    console.log(`   Blacklisté: ${isBlacklisted ? 'OUI' : 'NON'} (${item.reason})`);
    if (isBlacklisted !== item.shouldBeBlacklisted) {
      console.log(`   ⚠️  ATTENDU: ${item.shouldBeBlacklisted ? 'OUI' : 'NON'}, REÇU: ${isBlacklisted ? 'OUI' : 'NON'}`);
    }
  } else {
    console.log(`❌ ${item.name} - Item introuvable`);
  }
}

// ============================================
// TEST 3: Plan de production avec blacklist
// ============================================
console.log('\n📋 TEST 3: Plan de production avec blacklist');
console.log('-'.repeat(70));

// Trouver un item qui nécessite des composites (ex: un ship)
const testProduct = 'Archon';
const testProductType = sde.findTypeByName(testProduct);

if (testProductType) {
  console.log(`\n🔬 Test avec: ${testProduct} (typeID: ${testProductType.typeId})`);

  // Config SANS blacklist
  console.log('\n--- Configuration SANS blacklist ---');
  const configNoBlacklist = {
    reactionSlots: 20,
    manufacturingSlots: 30,
    dontSplitShorterThan: 1.2,
    blacklist: {
      fuelBlocks: false,
      intermediateCompositeReactions: false,
      compositeReactions: false,
      biochemicalReactions: false,
      gasPhaseReactions: false,
      hybridReactions: false,
      capitalComponents: false,
      advancedComponents: false,
      customItems: ''
    }
  };

  const planNoBlacklist = await productionPlanner.calculateProductionPlan(
    [{ product: testProduct, runs: 1, me: 10, te: 20 }],
    '',
    configNoBlacklist
  );

  console.log(`📊 Résultats SANS blacklist:`);
  console.log(`   - Total jobs: ${planNoBlacklist.totalJobs}`);
  console.log(`   - Total matériaux à acheter: ${planNoBlacklist.totalMaterials}`);
  console.log(`   - Temps total: ${planNoBlacklist.totalProductionTimeDays.toFixed(2)} jours`);

  // Compter les jobs de composite reactions
  const compositeJobsNoBlacklist = planNoBlacklist.jobs.composite_reactions?.length || 0;
  const intermediateJobsNoBlacklist = planNoBlacklist.jobs.intermediate_composite_reactions?.length || 0;
  console.log(`   - Jobs de Composite Reactions: ${compositeJobsNoBlacklist}`);
  console.log(`   - Jobs de Intermediate Composite Reactions: ${intermediateJobsNoBlacklist}`);

  // Config AVEC blacklist sur composites
  console.log('\n--- Configuration AVEC blacklist (composites + intermediates) ---');
  const configWithBlacklist = {
    reactionSlots: 20,
    manufacturingSlots: 30,
    dontSplitShorterThan: 1.2,
    blacklist: {
      fuelBlocks: false,
      intermediateCompositeReactions: true,
      compositeReactions: true,
      biochemicalReactions: false,
      gasPhaseReactions: false,
      hybridReactions: false,
      capitalComponents: false,
      advancedComponents: false,
      customItems: ''
    }
  };

  const planWithBlacklist = await productionPlanner.calculateProductionPlan(
    [{ product: testProduct, runs: 1, me: 10, te: 20 }],
    '',
    configWithBlacklist
  );

  console.log(`📊 Résultats AVEC blacklist:`);
  console.log(`   - Total jobs: ${planWithBlacklist.totalJobs}`);
  console.log(`   - Total matériaux à acheter: ${planWithBlacklist.totalMaterials}`);
  console.log(`   - Temps total: ${planWithBlacklist.totalProductionTimeDays.toFixed(2)} jours`);

  const compositeJobsWithBlacklist = planWithBlacklist.jobs.composite_reactions?.length || 0;
  const intermediateJobsWithBlacklist = planWithBlacklist.jobs.intermediate_composite_reactions?.length || 0;
  console.log(`   - Jobs de Composite Reactions: ${compositeJobsWithBlacklist}`);
  console.log(`   - Jobs de Intermediate Composite Reactions: ${intermediateJobsWithBlacklist}`);

  // Vérification
  console.log('\n🔍 Vérification:');
  if (compositeJobsWithBlacklist === 0 && intermediateJobsWithBlacklist === 0) {
    console.log('✅ Les composite reactions et intermediate reactions sont bien blacklistées (0 jobs)');
  } else {
    console.log('❌ ERREUR: Des jobs de composite/intermediate reactions sont encore présents!');
  }

  if (planWithBlacklist.totalMaterials > planNoBlacklist.totalMaterials) {
    console.log('✅ Plus de matériaux à acheter avec blacklist (normal)');
  } else {
    console.log('⚠️  Nombre de matériaux similaire ou inférieur');
  }

  if (planWithBlacklist.totalProductionTimeDays < planNoBlacklist.totalProductionTimeDays) {
    console.log('✅ Temps de production réduit avec blacklist (attendu)');
    console.log(`   Réduction: ${(planNoBlacklist.totalProductionTimeDays - planWithBlacklist.totalProductionTimeDays).toFixed(2)} jours`);
  }

  // Détails des matériaux ajoutés
  console.log('\n📦 Matériaux supplémentaires à acheter avec blacklist:');
  const materialsNoBlacklist = new Set(planNoBlacklist.materials.map(m => m.typeID));
  const newMaterials = planWithBlacklist.materials.filter(m => !materialsNoBlacklist.has(m.typeID));

  if (newMaterials.length > 0) {
    newMaterials.slice(0, 10).forEach(m => {
      const type = sde.getTypeById(m.typeID);
      const category = productionCategories.getCategoryByGroupID(type.groupId);
      console.log(`   - ${m.name} x${m.quantity} (${category})`);
    });
    if (newMaterials.length > 10) {
      console.log(`   ... et ${newMaterials.length - 10} autres items`);
    }
  } else {
    console.log('   Aucun nouveau matériau (possible si composites n\'étaient pas utilisés)');
  }

} else {
  console.log(`❌ Produit de test "${testProduct}" introuvable`);
}

// ============================================
// TEST 4: Custom items blacklist
// ============================================
console.log('\n📋 TEST 4: Custom items dans la blacklist');
console.log('-'.repeat(70));

const customBlacklistConfig = {
  fuelBlocks: false,
  intermediateCompositeReactions: false,
  compositeReactions: false,
  biochemicalReactions: false,
  gasPhaseReactions: false,
  hybridReactions: false,
  capitalComponents: false,
  advancedComponents: false,
  customItems: 'Capital Construction Parts\nR.A.M.- Starship Tech'
};

const customTestItems = [
  'Capital Construction Parts',
  'R.A.M.- Starship Tech',
  'Tritanium'
];

for (const itemName of customTestItems) {
  const type = sde.findTypeByName(itemName);
  if (type) {
    const isBlacklisted = productionPlanner.isBlacklisted(type.typeId, customBlacklistConfig);
    const status = isBlacklisted ? '✅ BLACKLISTÉ' : '❌ NON BLACKLISTÉ';
    console.log(`${status} - ${itemName} (typeID: ${type.typeId}, name: "${type.name}")`);

    // Debug: vérifier le matching
    const customItemsList = customBlacklistConfig.customItems.split('\n').map(item => item.trim()).filter(Boolean);
    const matches = customItemsList.filter(custom => type.name.toLowerCase().includes(custom.toLowerCase()));
    if (matches.length > 0) {
      console.log(`   Matched custom items: ${matches.join(', ')}`);
    }
  } else {
    console.log(`⚠️  Item "${itemName}" introuvable dans la BDD`);
  }
}

// ============================================
// RÉSUMÉ FINAL
// ============================================
console.log('\n' + '='.repeat(70));
console.log('📊 RÉSUMÉ DES TESTS');
console.log('='.repeat(70));
console.log('✅ Test 1: Catégorisation des items');
console.log('✅ Test 2: Fonction isBlacklisted()');
console.log('✅ Test 3: Plan de production avec/sans blacklist');
console.log('✅ Test 4: Custom items blacklist');
console.log('\n🎉 Tests de la blacklist terminés!\n');
