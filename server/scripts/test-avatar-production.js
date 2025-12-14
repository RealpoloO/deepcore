import productionPlanner from '../services/productionPlanner.js';
import sde from '../services/sde.js';
import blueprintService from '../services/blueprintService.js';

async function testAvatarProduction() {
  console.log('🔧 Initializing EVE SDE data...');
  await sde.loadTypes();
  await blueprintService.loadBlueprints();

  console.log('\n🚀 Testing Avatar Production Plan');
  console.log('='.repeat(60));

  const jobs = [
    { product: 'Avatar', runs: 1, me: 10, te: 20 }
  ];

  const config = {
    reactionSlots: 20,
    manufacturingSlots: 30,
    dontSplitShorterThan: 1.2,
    blacklist: {}
  };

  try {
    const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

    console.log('📊 PRODUCTION PLAN RESULTS:');
    console.log('='.repeat(60));
    console.log(`Total Jobs: ${plan.totalJobs}`);
    console.log(`Total Materials to Buy: ${plan.totalMaterials}`);
    console.log(`Total Production Time: ${plan.totalProductionTimeDays?.toFixed(2)} days`);
    console.log('');

    // Afficher les catégories de jobs
    console.log('📦 JOBS BY CATEGORY:');
    console.log('='.repeat(60));
    for (const [category, jobs] of Object.entries(plan.jobs)) {
      if (jobs.length > 0) {
        console.log(`\n${category.toUpperCase()} (${jobs.length} jobs):`);
        
        const timing = plan.categoryTimings[category];
        if (timing) {
          console.log(`  ⏱️  Time: ${timing.totalTimeDays.toFixed(2)} days | Slots used: ${timing.slotsUsed}`);
        }

        // Afficher quelques jobs pour cette catégorie
        jobs.slice(0, 5).forEach(job => {
          console.log(`  - ${job.productName} x${job.runs} (${job.productionTimeDays.toFixed(2)} days) [depth: ${job.depth}]`);
          if (job.splitFrom) {
            console.log(`    [Split ${job.splitIndex}/${job.splitFrom}]`);
          }
        });
        
        if (jobs.length > 5) {
          console.log(`  ... and ${jobs.length - 5} more jobs`);
        }
      }
    }

    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

testAvatarProduction();
