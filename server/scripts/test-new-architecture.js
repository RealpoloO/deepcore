/**
 * Test simple de la nouvelle architecture
 */

import productionPlanner from '../services/productionPlanner.js';
import sde from '../services/sde.js';
import blueprintService from '../services/blueprintService.js';

console.log('📖 Chargement du SDE...');
await sde.loadTypes();
console.log('✅ Types chargés');

console.log('📖 Chargement des blueprints...');
await blueprintService.loadBlueprints();
console.log('✅ Blueprints chargés');

console.log('\n🧪 Test 1: Archon 1 run ME 0 TE 0');
console.log('='.repeat(50));

const config = {
  reactionSlots: 10,
  manufacturingSlots: 10,
  dontSplitShorterThan: 1,
  blacklist: {}
};

const result1 = await productionPlanner.calculateProductionPlan(
  [{ product: 'Archon', runs: 1, me: 0, te: 0 }],
  '',
  config
);

console.log(`✅ Jobs créés: ${result1.totalJobs}`);
console.log(`✅ Matériaux: ${result1.totalMaterials}`);
console.log(`✅ Temps total: ${result1.totalProductionTimeDays.toFixed(2)} jours`);

if (result1.errors) {
  console.log('⚠️  Erreurs:', result1.errors);
}

console.log('\n🧪 Test 2: Archon 1 run ME 10 TE 20');
console.log('='.repeat(50));

const result2 = await productionPlanner.calculateProductionPlan(
  [{ product: 'Archon', runs: 1, me: 10, te: 20 }],
  '',
  config
);

console.log(`✅ Jobs créés: ${result2.totalJobs}`);
console.log(`✅ Matériaux: ${result2.totalMaterials}`);
console.log(`✅ Temps total: ${result2.totalProductionTimeDays.toFixed(2)} jours`);

// Comparer les matériaux
console.log('\n📊 Comparaison ME 0 vs ME 10:');
console.log('='.repeat(50));

const material1Map = new Map(result1.materials.map(m => [m.name, m.quantity]));
const material2Map = new Map(result2.materials.map(m => [m.name, m.quantity]));

let differences = 0;

for (const [name, qty1] of material1Map) {
  const qty2 = material2Map.get(name) || 0;
  if (qty1 !== qty2) {
    differences++;
    console.log(`  ${name}: ${qty1} (ME 0) vs ${qty2} (ME 10) - Diff: ${qty1 - qty2}`);
  }
}

if (differences === 0) {
  console.log('⚠️  AUCUNE différence détectée! ME ne fonctionne pas correctement.');
} else {
  console.log(`\n✅ ${differences} matériaux ont des quantités différentes - ME fonctionne!`);
}

console.log('\n✅ Tests terminés!');
process.exit(0);
