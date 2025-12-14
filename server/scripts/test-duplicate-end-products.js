/**
 * Test pour vérifier que les end products dupliqués restent séparés
 * Cas d'usage: L'utilisateur veut produire 2 Avatar en parallèle
 */
import sde from '../services/sde.js';
import blueprintService from '../services/blueprintService.js';
import productionPlanner from '../services/productionPlanner.js';

async function testDuplicateEndProducts() {
  console.log('🧪 Testing Duplicate End Products (Parallel Production)...\n');

  await sde.loadTypes();
  await blueprintService.loadBlueprints();

  const config = {
    reactionSlots: 20,
    manufacturingSlots: 30,
    dontSplitShorterThan: 1.2,
    blacklist: {}
  };

  // L'utilisateur entre 2 fois Avatar 1 run pour produire en parallèle
  const jobs = [
    { product: 'Avatar', runs: 1, me: 10, te: 20 },
    { product: 'Avatar', runs: 1, me: 10, te: 20 }
  ];

  console.log('📋 INPUT:');
  console.log('  Avatar 1 run (ME=10, TE=20)');
  console.log('  Avatar 1 run (ME=10, TE=20)');
  console.log('\n📍 ATTENDU: 2 jobs séparés de 1 run chacun (parallèles)');
  console.log('❌ PAS: 1 job de 2 runs (consolidé)\n');

  try {
    const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

    console.log('📊 RÉSULTATS:\n');

    // Vérifier les end product jobs
    const endProductJobs = plan.jobs.end_product_jobs || [];
    const avatarJobs = endProductJobs.filter(j => j.productName === 'Avatar' && j.isEndProduct);

    console.log(`✅ Production plan calculé`);
    console.log(`   Total jobs: ${plan.totalJobs}`);
    console.log(`   Total end product jobs: ${endProductJobs.length}`);
    console.log(`   Avatar jobs: ${avatarJobs.length}\n`);

    console.log('🔍 VÉRIFICATION - End Product Jobs:\n');

    avatarJobs.forEach((job, i) => {
      console.log(`  Job ${i + 1}:`);
      console.log(`    Produit: ${job.productName}`);
      console.log(`    Runs: ${job.runs}`);
      console.log(`    ME/TE: ${job.me}/${job.te}`);
      console.log(`    Durée: ${job.productionTimeDays.toFixed(2)} jours`);
      console.log(`    Split: ${job.splitFrom ? `Oui (${job.splitIndex}/${job.splitCount})` : 'Non'}`);
      console.log('');
    });

    // Validation
    if (avatarJobs.length === 2) {
      console.log('✅ SUCCÈS: 2 jobs Avatar séparés (peuvent être produits en parallèle)');

      const allHave1Run = avatarJobs.every(j => j.runs === 1);
      if (allHave1Run) {
        console.log('✅ Chaque job a 1 run (correct)');
      } else {
        console.log('❌ ERREUR: Les jobs n\'ont pas tous 1 run');
      }

      const noneAreSplit = avatarJobs.every(j => !j.splitFrom);
      if (noneAreSplit) {
        console.log('✅ Aucun job n\'est un split (correct - end products jamais splittés)');
      } else {
        console.log('⚠️  Certains jobs sont des splits (inattendu)');
      }

    } else if (avatarJobs.length === 1) {
      console.log('❌ ÉCHEC: Seulement 1 job Avatar trouvé');
      console.log('   Les end products ont été consolidés (incorrect)');
      console.log(`   Le job a ${avatarJobs[0].runs} runs au lieu de 2 jobs de 1 run`);
    } else {
      console.log(`⚠️  Nombre inattendu de jobs Avatar: ${avatarJobs.length}`);
    }

    // Tester aussi avec des runs différents
    console.log('\n\n🧪 TEST 2: End Products avec Runs Différents\n');

    const jobs2 = [
      { product: 'Archon', runs: 1, me: 10, te: 20 },
      { product: 'Archon', runs: 2, me: 10, te: 20 }
    ];

    console.log('📋 INPUT:');
    console.log('  Archon 1 run (ME=10, TE=20)');
    console.log('  Archon 2 runs (ME=10, TE=20)');
    console.log('\n📍 ATTENDU: 2 jobs séparés (1 run + 2 runs)\n');

    const plan2 = await productionPlanner.calculateProductionPlan(jobs2, '', config);
    const archonJobs = (plan2.jobs.end_product_jobs || []).filter(j => j.productName === 'Archon' && j.isEndProduct);

    console.log(`📊 Archon jobs trouvés: ${archonJobs.length}\n`);
    archonJobs.forEach((job, i) => {
      console.log(`  Job ${i + 1}: ${job.runs} run(s)`);
    });

    if (archonJobs.length === 2) {
      const has1Run = archonJobs.some(j => j.runs === 1);
      const has2Runs = archonJobs.some(j => j.runs === 2);

      if (has1Run && has2Runs) {
        console.log('\n✅ SUCCÈS: 2 jobs séparés avec runs différents conservés');
      } else {
        console.log('\n❌ ERREUR: Les runs ne correspondent pas');
      }
    } else {
      console.log('\n❌ ÉCHEC: Consolidation incorrecte');
    }

    console.log('\n✅ Tests terminés');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  process.exit(0);
}

testDuplicateEndProducts();
