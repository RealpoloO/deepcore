/**
 * Debug du non-déterminisme
 */

import productionPlanner from '../services/productionPlanner.js';
import sde from '../services/sde.js';
import blueprintService from '../services/blueprintService.js';

const config = {
  manufacturingSlots: 20,
  reactionSlots: 20,
  dontSplitShorterThan: 1,
  blacklist: {}
};

async function debug() {
  console.log('🔬 DEBUG DU NON-DÉTERMINISME\n');

  // Initialiser le SDE
  console.log('📂 Chargement du SDE...');
  await sde.loadTypes();
  await blueprintService.loadBlueprints();
  console.log('✅ SDE chargé\n');

  const jobs1 = [
    { product: 'Archon', runs: 1, me: 10, te: 20 },
    { product: 'Avatar', runs: 1, me: 10, te: 20 }
  ];

  const jobs2 = [
    { product: 'Avatar', runs: 1, me: 10, te: 20 },
    { product: 'Archon', runs: 1, me: 10, te: 20 }
  ];

  console.log('🔹 Run 1: Archon puis Avatar');
  const result1 = await productionPlanner.calculateProductionPlan(jobs1, '', config);

  console.log('\n🔹 Run 2: Avatar puis Archon');
  const result2 = await productionPlanner.calculateProductionPlan(jobs2, '', config);

  // Comparer les matériaux "Atmospheric Gases"
  const atmo1 = result1.materials.find(m => m.name === 'Atmospheric Gases');
  const atmo2 = result2.materials.find(m => m.name === 'Atmospheric Gases');

  console.log('\n📊 Atmospheric Gases:');
  console.log(`   Run 1: ${atmo1?.quantity || 0}`);
  console.log(`   Run 2: ${atmo2?.quantity || 0}`);
  console.log(`   Différence: ${Math.abs((atmo1?.quantity || 0) - (atmo2?.quantity || 0))}`);

  // Comparer TOUS les matériaux
  console.log('\n📋 Matériaux différents:');
  const allTypeIDs = new Set([
    ...result1.materials.map(m => m.typeID),
    ...result2.materials.map(m => m.typeID)
  ]);

  let diffCount = 0;
  for (const typeID of allTypeIDs) {
    const mat1 = result1.materials.find(m => m.typeID === typeID);
    const mat2 = result2.materials.find(m => m.typeID === typeID);

    const qty1 = mat1?.quantity || 0;
    const qty2 = mat2?.quantity || 0;

    if (qty1 !== qty2) {
      diffCount++;
      console.log(`   ${mat1?.name || mat2?.name}:`);
      console.log(`      Run 1: ${qty1}`);
      console.log(`      Run 2: ${qty2}`);
      console.log(`      Δ: ${qty2 - qty1} (${((qty2 / qty1 - 1) * 100).toFixed(1)}%)`);
    }
  }

  console.log(`\n📊 Total: ${diffCount} matériaux différents sur ${allTypeIDs.size}`);

  process.exit(0);
}

debug().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
