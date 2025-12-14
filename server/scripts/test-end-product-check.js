import sde from '../services/sde.js';
import blueprintService from '../services/blueprintService.js';
import productionPlanner from '../services/productionPlanner.js';

async function testEndProduct() {
  console.log('⏳ Chargement...\n');
  await sde.loadTypes();
  await blueprintService.loadBlueprints();

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

    console.log('\n📦 RECHERCHE DU END PRODUCT:\n');
    
    for (const [category, categoryJobs] of Object.entries(plan.jobs)) {
      for (const job of categoryJobs) {
        if (job.productName.includes('Capital Core Temperature Regulator')) {
          console.log(`✅ Trouvé dans: ${category}`);
          console.log(`   productName: ${job.productName}`);
          console.log(`   runs: ${job.runs}`);
          console.log(`   qty: ${job.quantityProduced}`);
          console.log(`   time: ${job.productionTimeDays.toFixed(2)}d`);
          console.log(`   isEndProduct: ${job.isEndProduct || false}`);
          console.log(`   depth: ${job.depth}\n`);
        }
      }
    }

  } catch (error) {
    console.error('❌ ERREUR:', error.message);
  }
  
  process.exit(0);
}

testEndProduct();
