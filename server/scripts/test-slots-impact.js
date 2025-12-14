import sdeService from '../services/sde.js';
import blueprintService from '../services/blueprintService.js';
import productionPlanner from '../services/productionPlanner.js';

console.log('🧪 Test avec plusieurs produits parallèles...\n');

await sdeService.loadTypes();
await blueprintService.loadBlueprints();

// Plusieurs Reinforced Carbon Fiber pour avoir beaucoup de jobs de réactions
const jobs = [
  { product: 'Reinforced Carbon Fiber', runs: 100, me: 10, te: 20 }
];

const stock = '';

// Test 1: 5 slots de réaction
console.log('='.repeat(80));
console.log('TEST 1: 5 reaction slots, 10 manufacturing slots');
console.log('='.repeat(80));

const config1 = {
  reactionSlots: 5,
  manufacturingSlots: 10,
  dontSplitShorterThan: 1.2,
  blacklist: {}
};

const result1 = await productionPlanner.calculateProductionPlan(jobs, stock, config1);

console.log(`\nTotal Jobs: ${result1.totalJobs}`);
console.log(`Total Time: ${result1.totalProductionTimeDays.toFixed(2)} days\n`);
Object.entries(result1.categoryTimings || {}).forEach(([cat, timing]) => {
  if (timing.totalTimeDays > 0) {
    console.log(`${cat}:`);
    console.log(`  Time: ${timing.totalTimeDays.toFixed(2)} days`);
    console.log(`  Jobs: ${result1.jobs[cat]?.length || 0}`);
    console.log(`  Slots used: ${timing.slotsUsed}/${cat.includes('reaction') ? config1.reactionSlots : config1.manufacturingSlots}`);
  }
});

// Test 2: 20 slots de réaction
console.log('\n' + '='.repeat(80));
console.log('TEST 2: 20 reaction slots, 30 manufacturing slots');
console.log('='.repeat(80));

const config2 = {
  reactionSlots: 20,
  manufacturingSlots: 30,
  dontSplitShorterThan: 1.2,
  blacklist: {}
};

const result2 = await productionPlanner.calculateProductionPlan(jobs, stock, config2);

console.log(`\nTotal Jobs: ${result2.totalJobs}`);
console.log(`Total Time: ${result2.totalProductionTimeDays.toFixed(2)} days\n`);
Object.entries(result2.categoryTimings || {}).forEach(([cat, timing]) => {
  if (timing.totalTimeDays > 0) {
    console.log(`${cat}:`);
    console.log(`  Time: ${timing.totalTimeDays.toFixed(2)} days`);
    console.log(`  Jobs: ${result2.jobs[cat]?.length || 0}`);
    console.log(`  Slots used: ${timing.slotsUsed}/${cat.includes('reaction') ? config2.reactionSlots : config2.manufacturingSlots}`);
  }
});

// Test 3: 50 slots de réaction
console.log('\n' + '='.repeat(80));
console.log('TEST 3: 50 reaction slots, 100 manufacturing slots');
console.log('='.repeat(80));

const config3 = {
  reactionSlots: 50,
  manufacturingSlots: 100,
  dontSplitShorterThan: 1.2,
  blacklist: {}
};

const result3 = await productionPlanner.calculateProductionPlan(jobs, stock, config3);

console.log(`\nTotal Jobs: ${result3.totalJobs}`);
console.log(`Total Time: ${result3.totalProductionTimeDays.toFixed(2)} days\n`);
Object.entries(result3.categoryTimings || {}).forEach(([cat, timing]) => {
  if (timing.totalTimeDays > 0) {
    console.log(`${cat}:`);
    console.log(`  Time: ${timing.totalTimeDays.toFixed(2)} days`);
    console.log(`  Jobs: ${result3.jobs[cat]?.length || 0}`);
    console.log(`  Slots used: ${timing.slotsUsed}/${cat.includes('reaction') ? config3.reactionSlots : config3.manufacturingSlots}`);
  }
});

console.log('\n' + '='.repeat(80));
console.log('COMPARAISON DES TEMPS:');
console.log('='.repeat(80));
console.log(`5 slots:   ${result1.totalProductionTimeDays.toFixed(2)} days`);
console.log(`20 slots:  ${result2.totalProductionTimeDays.toFixed(2)} days (${((result1.totalProductionTimeDays - result2.totalProductionTimeDays) / result1.totalProductionTimeDays * 100).toFixed(1)}% gain)`);
console.log(`50 slots:  ${result3.totalProductionTimeDays.toFixed(2)} days (${((result1.totalProductionTimeDays - result3.totalProductionTimeDays) / result1.totalProductionTimeDays * 100).toFixed(1)}% gain)`);

console.log('\n✅ Test terminé!');
