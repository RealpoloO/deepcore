/**
 * Test pour comprendre pourquoi Avatar seul != Avatar dans (Avatar+Archon)
 */

import productionPlanner from '../services/productionPlanner.js';
import sde from '../services/sde.js';
import blueprintService from '../services/blueprintService.js';

const config = {
  manufacturingSlots: 50,
  reactionSlots: 50,
  dontSplitShorterThan: 1,
  blacklist: {}
};

async function test() {
  console.log('🔬 TEST: Avatar seul vs Avatar dans (Avatar+Archon)\n');

  await sde.loadTypes();
  await blueprintService.loadBlueprints();

  // Test 1: Avatar seul
  const jobs1 = [{ product: 'Avatar', runs: 1, me: 10, te: 20 }];
  const result1 = await productionPlanner.calculateProductionPlan(jobs1, '', config);

  // Test 2: Avatar + Archon (qui devient Archon + Avatar après tri)
  const jobs2 = [
    { product: 'Avatar', runs: 1, me: 10, te: 20 },
    { product: 'Archon', runs: 1, me: 10, te: 20 }
  ];
  const result2 = await productionPlanner.calculateProductionPlan(jobs2, '', config);

  // Test 3: Double Avatar
  const jobs3 = [
    { product: 'Avatar', runs: 1, me: 10, te: 20 },
    { product: 'Avatar', runs: 1, me: 10, te: 20 }
  ];
  const result3 = await productionPlanner.calculateProductionPlan(jobs3, '', config);

  console.log('📊 RÉSULTATS:\n');

  const atmo1 = result1.materials.find(m => m.name === 'Atmospheric Gases');
  const atmo2 = result2.materials.find(m => m.name === 'Atmospheric Gases');
  const atmo3 = result3.materials.find(m => m.name === 'Atmospheric Gases');

  console.log(`1. Avatar seul:            ${atmo1?.quantity || 0} Atmospheric Gases`);
  console.log(`   Total jobs:             ${result1.totalJobs}`);
  console.log(`   Total materials types:  ${result1.materials.length}`);

  console.log(`\n2. Archon + Avatar:        ${atmo2?.quantity || 0} Atmospheric Gases`);
  console.log(`   Total jobs:             ${result2.totalJobs}`);
  console.log(`   Total materials types:  ${result2.materials.length}`);

  console.log(`\n3. Avatar + Avatar (x2):   ${atmo3?.quantity || 0} Atmospheric Gases`);
  console.log(`   Total jobs:             ${result3.totalJobs}`);
  console.log(`   Total materials types:  ${result3.materials.length}`);

  console.log('\n🔍 ANALYSE:');
  console.log(`   Avatar seul devrait être = (Archon+Avatar) - Archon`);
  console.log(`   Mais on a: ${atmo1?.quantity || 0} vs ${atmo2?.quantity || 0}`);
  console.log(`   Différence: ${((atmo1?.quantity || 0) / (atmo2?.quantity || 0)).toFixed(2)}x`);

  console.log(`\n   2x Avatar devrait être ≈ 2 * (1x Avatar)`);
  console.log(`   On a: ${atmo3?.quantity || 0} vs ${2 * (atmo1?.quantity || 0)}`);
  console.log(`   Ratio: ${((atmo3?.quantity || 0) / (2 * (atmo1?.quantity || 0))).toFixed(2)}x`);

  // Comparons le nombre de jobs
  console.log('\n📋 JOBS:');
  console.log(`   Avatar seul:         ${result1.totalJobs} jobs`);
  console.log(`   Archon + Avatar:     ${result2.totalJobs} jobs`);
  console.log(`   2x Avatar:           ${result3.totalJobs} jobs`);
}

test().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
