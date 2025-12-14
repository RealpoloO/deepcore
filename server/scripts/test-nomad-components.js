import sde from '../services/sde.js';
import blueprintService from '../services/blueprintService.js';
import productionCategories from '../services/productionCategories.js';
import productionPlanner from '../services/productionPlanner.js';

console.log('🔬 TEST NOMAD COMPONENTS\n');
console.log('='.repeat(70));

// Charger les services
console.log('⏳ Chargement des services...\n');
await sde.loadTypes();
await blueprintService.loadBlueprints();
console.log('✅ Services chargés!\n');

// Trouver le Nomad et ses composants
const nomadType = sde.findTypeByName('Nomad');
const fenrirType = sde.findTypeByName('Fenrir');
const ramType = sde.findTypeByName('R.A.M.- Starship Tech');

console.log('📋 INFORMATION SUR LES ITEMS:');
console.log('-'.repeat(70));

if (nomadType) {
  console.log(`\nNomad:`);
  console.log(`  TypeID: ${nomadType.typeId}`);
  console.log(`  GroupID: ${nomadType.groupId}`);
  console.log(`  Catégorie: ${productionCategories.getCategoryByGroupID(nomadType.groupId)}`);
}

if (fenrirType) {
  console.log(`\nFenrir:`);
  console.log(`  TypeID: ${fenrirType.typeId}`);
  console.log(`  GroupID: ${fenrirType.groupId}`);
  console.log(`  Catégorie: ${productionCategories.getCategoryByGroupID(fenrirType.groupId)}`);
}

if (ramType) {
  console.log(`\nR.A.M.- Starship Tech:`);
  console.log(`  TypeID: ${ramType.typeId}`);
  console.log(`  GroupID: ${ramType.groupId}`);
  console.log(`  Catégorie: ${productionCategories.getCategoryByGroupID(ramType.groupId)}`);
}

// Vérifier le blueprint du Nomad
console.log('\n📘 BLUEPRINT DU NOMAD:');
console.log('-'.repeat(70));

if (nomadType) {
  const nomadBlueprint = blueprintService.getBlueprintByProduct(nomadType.typeId);

  if (nomadBlueprint) {
    console.log(`\nBlueprint trouvé: ${nomadBlueprint.blueprintTypeID}`);

    const activity = nomadBlueprint.activities?.manufacturing || nomadBlueprint.activities?.reaction;
    if (activity && activity.materials) {
      console.log(`\nMatériaux nécessaires (pour 1 run):`);
      for (const mat of activity.materials) {
        const matType = sde.getTypeById(mat.typeID);
        const category = productionCategories.getCategoryByGroupID(matType.groupId);
        console.log(`  - ${matType.name} x${mat.quantity} (groupID: ${matType.groupId}, catégorie: ${category})`);
      }
    }
  } else {
    console.log('❌ Aucun blueprint trouvé pour Nomad');
  }
}

// Tester le plan de production
console.log('\n🧪 TEST PLAN DE PRODUCTION:');
console.log('-'.repeat(70));

const config = {
  reactionSlots: 20,
  manufacturingSlots: 30,
  dontSplitShorterThan: 1.2,
  blacklist: {
    fuelBlocks: true,
    intermediateCompositeReactions: true,
    compositeReactions: true,
    biochemicalReactions: true,
    gasPhaseReactions: true,
    hybridReactions: true,
    capitalComponents: true,
    advancedComponents: true,
    customItems: ''
  }
};

const plan = await productionPlanner.calculateProductionPlan(
  [{ product: 'Nomad', runs: 1, me: 5, te: 10 }],
  '',
  config
);

console.log(`\n📊 Résultats:`);
console.log(`  Total jobs: ${plan.totalJobs}`);
console.log(`  Total matériaux: ${plan.totalMaterials}`);

console.log(`\n📦 Jobs par catégorie:`);
for (const [category, jobs] of Object.entries(plan.jobs)) {
  if (jobs.length > 0) {
    console.log(`\n  ${category}: ${jobs.length} jobs`);
    jobs.forEach(job => {
      console.log(`    - ${job.productName} (depth: ${job.depth}, isEndProduct: ${job.isEndProduct})`);
    });
  }
}

console.log('\n' + '='.repeat(70));
