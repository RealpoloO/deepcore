/**
 * Debug des material requests
 */

import productionPlanner from '../services/productionPlanner.js';
import sde from '../services/sde.js';
import blueprintService from '../services/blueprintService.js';

// Patcher productionPlanner pour logger materialRequests
import Module from 'module';
const originalRequire = Module.prototype.require;

const config = {
  manufacturingSlots: 20,
  reactionSlots: 20,
  dontSplitShorterThan: 1,
  blacklist: {}
};

async function debug() {
  console.log('🔬 DEBUG DES MATERIAL REQUESTS\n');

  // Initialiser le SDE
  console.log('📂 Chargement du SDE...');
  await sde.loadTypes();
  await blueprintService.loadBlueprints();
  console.log('✅ SDE chargé\n');

  const jobs1 = [
    { product: 'Archon', runs: 1, me: 10, te: 20 }
  ];

  const jobs2 = [
    { product: 'Avatar', runs: 1, me: 10, te: 20 }
  ];

  const jobs3 = [
    { product: 'Archon', runs: 1, me: 10, te: 20 },
    { product: 'Avatar', runs: 1, me: 10, te: 20 }
  ];

  console.log('🔹 Run 1: Archon uniquement');
  const result1 = await productionPlanner.calculateProductionPlan(jobs1, '', config);

  console.log('\n🔹 Run 2: Avatar uniquement');
  const result2 = await productionPlanner.calculateProductionPlan(jobs2, '', config);

  console.log('\n🔹 Run 3: Archon + Avatar');
  const result3 = await productionPlanner.calculateProductionPlan(jobs3, '', config);

  // Comparer "Atmospheric Gases"
  const atmo1 = result1.materials.find(m => m.name === 'Atmospheric Gases');
  const atmo2 = result2.materials.find(m => m.name === 'Atmospheric Gases');
  const atmo3 = result3.materials.find(m => m.name === 'Atmospheric Gases');

  console.log('\n📊 Atmospheric Gases:');
  console.log(`   Archon seul:      ${atmo1?.quantity || 0}`);
  console.log(`   Avatar seul:      ${atmo2?.quantity || 0}`);
  console.log(`   Archon + Avatar:  ${atmo3?.quantity || 0}`);
  console.log(`   Somme séparée:    ${(atmo1?.quantity || 0) + (atmo2?.quantity || 0)}`);
  console.log(`   Différence:       ${Math.abs((atmo3?.quantity || 0) - ((atmo1?.quantity || 0) + (atmo2?.quantity || 0)))}`);

  if ((atmo3?.quantity || 0) === (atmo1?.quantity || 0) + (atmo2?.quantity || 0)) {
    console.log('   ✅ La somme est égale !');
  } else {
    console.log('   ❌ La somme est DIFFÉRENTE !');
    const ratio = (atmo3?.quantity || 0) / ((atmo1?.quantity || 0) + (atmo2?.quantity || 0));
    console.log(`   Ratio: ${ratio.toFixed(3)}`);
  }

  process.exit(0);
}

debug().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
