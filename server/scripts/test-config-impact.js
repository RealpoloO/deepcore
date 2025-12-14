import sdeService from '../services/sde.js';
import blueprintService from '../services/blueprintService.js';
import productionPlanner from '../services/productionPlanner.js';

console.log('🧪 Testing configuration impact on job splitting and slots...\n');

await sdeService.loadTypes();
await blueprintService.loadBlueprints();

const jobs = [
  { product: 'Archon', runs: 1, me: 10, te: 20 }
];

const stock = ''; // Empty string instead of empty object

// Test 1: Config par défaut (20 reaction slots, 30 manufacturing slots)
console.log('='.repeat(80));
console.log('TEST 1: Config par défaut (20 reaction, 30 manufacturing, 1.2 days split)');
console.log('='.repeat(80));

const config1 = {
  reactionSlots: 20,
  manufacturingSlots: 30,
  dontSplitShorterThan: 1.2,
  blacklist: {}
};

const result1 = await productionPlanner.calculateProductionPlan(jobs, stock, config1);

console.log('\nRésultats:');
console.log(`Total Jobs: ${result1.totalJobs}`);
console.log(`Total Time: ${result1.totalProductionTimeDays.toFixed(2)} days`);
console.log('\nPar catégorie:');
Object.entries(result1.categoryTimings || {}).forEach(([cat, timing]) => {
  console.log(`  ${cat}: ${timing.totalTimeDays.toFixed(2)} days (${timing.slotsUsed}/${cat.includes('reaction') ? config1.reactionSlots : config1.manufacturingSlots} slots)`);
});

// Test 2: Plus de slots (40 reaction, 50 manufacturing)
console.log('\n' + '='.repeat(80));
console.log('TEST 2: Plus de slots (40 reaction, 50 manufacturing, 1.2 days split)');
console.log('='.repeat(80));

const config2 = {
  reactionSlots: 40,
  manufacturingSlots: 50,
  dontSplitShorterThan: 1.2,
  blacklist: {}
};

const result2 = await productionPlanner.calculateProductionPlan(jobs, stock, config2);

console.log('\nRésultats:');
console.log(`Total Jobs: ${result2.totalJobs}`);
console.log(`Total Time: ${result2.totalProductionTimeDays.toFixed(2)} days`);
console.log('\nPar catégorie:');
Object.entries(result2.categoryTimings || {}).forEach(([cat, timing]) => {
  console.log(`  ${cat}: ${timing.totalTimeDays.toFixed(2)} days (${timing.slotsUsed}/${cat.includes('reaction') ? config2.reactionSlots : config2.manufacturingSlots} slots)`);
});

// Test 3: Moins de split (5 days)
console.log('\n' + '='.repeat(80));
console.log('TEST 3: Moins de split (20 reaction, 30 manufacturing, 5.0 days split)');
console.log('='.repeat(80));

const config3 = {
  reactionSlots: 20,
  manufacturingSlots: 30,
  dontSplitShorterThan: 5.0,
  blacklist: {}
};

const result3 = await productionPlanner.calculateProductionPlan(jobs, stock, config3);

console.log('\nRésultats:');
console.log(`Total Jobs: ${result3.totalJobs}`);
console.log(`Total Time: ${result3.totalProductionTimeDays.toFixed(2)} days`);
console.log('\nPar catégorie:');
Object.entries(result3.categoryTimings || {}).forEach(([cat, timing]) => {
  console.log(`  ${cat}: ${timing.totalTimeDays.toFixed(2)} days (${timing.slotsUsed}/${cat.includes('reaction') ? config3.reactionSlots : config3.manufacturingSlots} slots)`);
});

// Test 4: Très peu de slots (5 reaction, 10 manufacturing)
console.log('\n' + '='.repeat(80));
console.log('TEST 4: Très peu de slots (5 reaction, 10 manufacturing, 1.2 days split)');
console.log('='.repeat(80));

const config4 = {
  reactionSlots: 5,
  manufacturingSlots: 10,
  dontSplitShorterThan: 1.2,
  blacklist: {}
};

const result4 = await productionPlanner.calculateProductionPlan(jobs, stock, config4);

console.log('\nRésultats:');
console.log(`Total Jobs: ${result4.totalJobs}`);
console.log(`Total Time: ${result4.totalProductionTimeDays.toFixed(2)} days`);
console.log('\nPar catégorie:');
Object.entries(result4.categoryTimings || {}).forEach(([cat, timing]) => {
  console.log(`  ${cat}: ${timing.totalTimeDays.toFixed(2)} days (${timing.slotsUsed}/${cat.includes('reaction') ? config4.reactionSlots : config4.manufacturingSlots} slots)`);
});

console.log('\n' + '='.repeat(80));
console.log('COMPARAISON:');
console.log('='.repeat(80));
console.log(`Test 1 (défaut):     ${result1.totalProductionTimeDays.toFixed(2)} days`);
console.log(`Test 2 (+ slots):    ${result2.totalProductionTimeDays.toFixed(2)} days (${((result1.totalProductionTimeDays - result2.totalProductionTimeDays) / result1.totalProductionTimeDays * 100).toFixed(1)}% plus rapide)`);
console.log(`Test 3 (- split):    ${result3.totalProductionTimeDays.toFixed(2)} days`);
console.log(`Test 4 (- slots):    ${result4.totalProductionTimeDays.toFixed(2)} days (${((result4.totalProductionTimeDays - result1.totalProductionTimeDays) / result1.totalProductionTimeDays * 100).toFixed(1)}% plus lent)`);

console.log('\n✅ Test terminé!');
