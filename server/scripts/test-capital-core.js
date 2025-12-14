import sde from '../services/sde.js';
import blueprintService from '../services/blueprintService.js';
import productionPlanner from '../services/productionPlanner.js';

async function testCapitalCore() {
  console.log('⏳ Chargement de la SDE et des blueprints...\n');
  await sde.loadTypes();
  await blueprintService.loadBlueprints();
  console.log('✅ SDE et blueprints chargés !\n');

  console.log('========================================');
  console.log('TEST: Capital Core Temperature Regulator 1 10 20');
  console.log('========================================\n');

  const jobs = [
    { product: 'Capital Core Temperature Regulator', runs: 1, me: 10, te: 20 }
  ];

  const config = {
    reactionSlots: 20,
    manufacturingSlots: 30,
    dontSplitShorterThan: 1.2,
    blacklist: {}
  };

  try {
    const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

    console.log('\n� CONSTRUCTION COMPONENTS:\n');
    
    const constructionJobs = plan.jobs.construction_components || [];
    console.log(`Nombre de jobs: ${constructionJobs.length}\n`);
    
    // Grouper par nom pour voir les doublons
    const jobsByName = new Map();
    for (const job of constructionJobs) {
      if (!jobsByName.has(job.productName)) {
        jobsByName.set(job.productName, []);
      }
      jobsByName.get(job.productName).push(job);
    }
    
    for (const [productName, jobs] of jobsByName) {
      console.log(`${productName}: ${jobs.length} occurrence(s)`);
      jobs.forEach((job, idx) => {
        console.log(`  [${idx + 1}] blueprintTypeID=${job.blueprintTypeID}, productTypeID=${job.productTypeID}`);
        console.log(`       runs=${job.runs}, qty=${job.quantityProduced}, time=${job.productionTimeDays.toFixed(2)}d`);
      });
      console.log('');
    }

  } catch (error) {
    console.error('❌ ERREUR:', error.message);
    console.error(error.stack);
  }
  
  process.exit(0);
}

testCapitalCore().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
