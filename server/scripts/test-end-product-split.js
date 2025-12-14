/**
 * Test pour vérifier que les end products ne sont pas splittés
 */

import sde from '../services/sde.js';
import blueprintService from '../services/blueprintService.js';
import productionPlanner from '../services/productionPlanner.js';

// Attendre que SDE soit chargé
async function waitForSDE() {
  console.log('⏳ Chargement de la SDE et des blueprints...\n');
  await sde.loadTypes();
  await blueprintService.loadBlueprints();
  console.log('✅ SDE et blueprints chargés !\n');
}

async function testEndProductNoSplit() {
  console.log('\n========================================');
  console.log('TEST: End Product ne doit PAS être splitté');
  console.log('========================================\n');

  const jobs = [
    { product: 'Avatar', runs: 10, me: 10, te: 20 }
  ];

  const config = {
    reactionSlots: 20,
    manufacturingSlots: 30,
    dontSplitShorterThan: 1.2,
    blacklist: {}
  };

  try {
    const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

    console.log('\n📊 RÉSULTATS:');
    console.log(`Total matériaux: ${plan.materials.length}`);
    console.log(`Total jobs: ${plan.totalJobs}`);

    // Trouver les jobs Avatar (end product)
    const avatarJobs = [];
    for (const category in plan.organizedJobs) {
      const categoryJobs = plan.organizedJobs[category];
      for (const job of categoryJobs) {
        if (job.productName === 'Avatar') {
          avatarJobs.push(job);
        }
      }
    }

    console.log('\n📦 JOBS AVATAR (End Product):');
    console.log(`Nombre de jobs Avatar: ${avatarJobs.length}`);
    
    avatarJobs.forEach((job, idx) => {
      console.log(`\n  Job ${idx + 1}:`);
      console.log(`    - Runs: ${job.runs}`);
      console.log(`    - Quantité produite: ${job.quantityProduced}`);
      console.log(`    - Temps: ${job.productionTimeDays?.toFixed(2)} jours`);
      console.log(`    - End Product: ${job.isEndProduct ? '✅ OUI' : '❌ NON'}`);
      if (job.splitFrom) {
        console.log(`    - Split de ${job.splitFrom} runs en ${job.splitCount} jobs`);
      }
    });

    console.log('\n✅ VALIDATION:');
    if (avatarJobs.length === 1 && avatarJobs[0].runs === 10) {
      console.log('✅ SUCCÈS: Avatar n\'a PAS été splitté (1 job de 10 runs)');
    } else {
      console.log(`❌ ÉCHEC: Avatar a été splitté en ${avatarJobs.length} jobs`);
    }

  } catch (error) {
    console.error('❌ ERREUR:', error.message);
    console.error(error.stack);
  }
}

async function testRecalculationConsistency() {
  console.log('\n========================================');
  console.log('TEST: Re-calcul doit donner le même résultat');
  console.log('========================================\n');

  const jobs = [
    { product: 'avatar', runs: 1, me: 10, te: 20 }
  ];

  const config = {
    reactionSlots: 20,
    manufacturingSlots: 30,
    dontSplitShorterThan: 1.2,
    blacklist: {}
  };

  try {
    console.log('🔄 Calcul 1...');
    const plan1 = await productionPlanner.calculateProductionPlan(jobs, '', config);
    const jobs1Count = plan1.totalJobs;
    const materials1Count = plan1.materials.length;

    console.log(`  - Total jobs: ${jobs1Count}`);
    console.log(`  - Total matériaux: ${materials1Count}`);

    console.log('\n🔄 Calcul 2 (sans changement)...');
    const plan2 = await productionPlanner.calculateProductionPlan(jobs, '', config);
    const jobs2Count = plan2.totalJobs;
    const materials2Count = plan2.materials.length;

    console.log(`  - Total jobs: ${jobs2Count}`);
    console.log(`  - Total matériaux: ${materials2Count}`);

    console.log('\n✅ VALIDATION:');
    if (jobs1Count === jobs2Count && materials1Count === materials2Count) {
      console.log('✅ SUCCÈS: Les deux calculs donnent le même résultat');
    } else {
      console.log('❌ ÉCHEC: Les résultats diffèrent entre les deux calculs');
      console.log(`  Jobs: ${jobs1Count} vs ${jobs2Count}`);
      console.log(`  Matériaux: ${materials1Count} vs ${materials2Count}`);
    }

  } catch (error) {
    console.error('❌ ERREUR:', error.message);
    console.error(error.stack);
  }
}

async function runTests() {
  await waitForSDE();
  
  await testEndProductNoSplit();
  await testRecalculationConsistency();
  
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
