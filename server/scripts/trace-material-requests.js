/**
 * Trace pour comprendre le problème de pooling
 */

import productionPlanner from '../services/productionPlanner.js';
import sde from '../services/sde.js';
import blueprintService from '../services/blueprintService.js';

const config = {
  manufacturingSlots: 50,  // Plus de slots pour tester avec multiples end products
  reactionSlots: 50,
  dontSplitShorterThan: 1,
  blacklist: {}
};

async function trace() {
  console.log('🔬 TRACE DES MATERIAL REQUESTS\n');

  await sde.loadTypes();
  await blueprintService.loadBlueprints();

  // Test Archon seul pour voir combien de materialRequests il crée
  console.log('🔹 Calcul Archon seul...');
  const jobs1 = [{ product: 'Archon', runs: 1, me: 10, te: 20 }];
  const result1 = await productionPlanner.calculateProductionPlan(jobs1, '', config);

  console.log('🔹 Calcul Avatar seul...');
  const jobs2 = [{ product: 'Avatar', runs: 1, me: 10, te: 20 }];
  const result2 = await productionPlanner.calculateProductionPlan(jobs2, '', config);

  console.log('🔹 Calcul Archon + Avatar...');
  const jobs3 = [
    { product: 'Archon', runs: 1, me: 10, te: 20 },
    { product: 'Avatar', runs: 1, me: 10, te: 20 }
  ];
  const result3 = await productionPlanner.calculateProductionPlan(jobs3, '', config);

  console.log('\n📊 ANALYSE DES JOBDESCRIPTORS CRÉÉS:\n');

  console.log(`Archon seul:       ${result1.totalJobs} jobDescriptors`);
  console.log(`Avatar seul:       ${result2.totalJobs} jobDescriptors`);
  console.log(`Archon + Avatar:   ${result3.totalJobs} jobDescriptors`);

  const expectedCombined = result1.totalJobs + result2.totalJobs;
  console.log(`\nAttendu (somme):   ${expectedCombined} jobDescriptors`);
  console.log(`Réel (combiné):    ${result3.totalJobs} jobDescriptors`);
  console.log(`Différence:        ${result3.totalJobs - expectedCombined} jobDescriptors`);

  // Vérifier si les composants communs sont consolidés
  console.log('\n📋 HYPOTHÈSE:');
  console.log('Si Archon et Avatar partagent des composants intermédiaires,');
  console.log('alors le total combiné devrait être MOINS que la somme.');
  console.log(`Résultat: ${result3.totalJobs < expectedCombined ? '✅ CONSOLIDATION détectée' : '❌ PAS de consolidation'}`);

  // Comparer les matériaux finaux
  const atmo1 = result1.materials.find(m => m.name === 'Atmospheric Gases');
  const atmo2 = result2.materials.find(m => m.name === 'Atmospheric Gases');
  const atmo3 = result3.materials.find(m => m.name === 'Atmospheric Gases');

  console.log('\n📊 ATMOSPHERIC GASES (matériau de base):');
  console.log(`Archon seul:       ${atmo1?.quantity || 0}`);
  console.log(`Avatar seul:       ${atmo2?.quantity || 0}`);
  console.log(`Somme attendue:    ${(atmo1?.quantity || 0) + (atmo2?.quantity || 0)}`);
  console.log(`Archon + Avatar:   ${atmo3?.quantity || 0}`);
  console.log(`Différence:        ${(atmo3?.quantity || 0) - ((atmo1?.quantity || 0) + (atmo2?.quantity || 0))}`);

  const ratio = (atmo3?.quantity || 0) / ((atmo1?.quantity || 0) + (atmo2?.quantity || 0));
  console.log(`Ratio:             ${ratio.toFixed(3)}x`);

  if (ratio < 1.0) {
    console.log('\n❌ PROBLÈME CRITIQUE: Le combiné utilise MOINS de matériaux que la somme!');
    console.log('   Cela signifie que les matériaux sont partagés INCORRECTEMENT entre end products.');
  } else if (ratio > 1.0) {
    console.log('\n⚠️  Le combiné utilise PLUS de matériaux que la somme.');
    console.log('   Cela peut être dû à un arrondi différent (pooling).');
  } else {
    console.log('\n✅ Le combiné est égal à la somme (correct!)');
  }

  process.exit(0);
}

trace().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
