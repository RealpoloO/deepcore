/**
 * Script de test pour calculer la production d'un Archon
 */
import sde from '../services/sde.js';
import blueprintService from '../services/blueprintService.js';
import productionPlanner from '../services/productionPlanner.js';
import logger from '../utils/logger.js';

async function testArchonProduction() {
  console.log('🚀 Testing Archon Production Plan...\n');

  // Charger les services
  await sde.loadTypes();
  console.log('✅ SDE types loaded\n');
  
  await blueprintService.loadBlueprints();
  console.log('✅ Blueprints loaded\n');

  // Configuration
  const jobs = [
    {
      product: 'Archon',
      runs: 1,
      me: 10,
      te: 20
    }
  ];

  const stock = ''; // Pas de stock

  const config = {
    reactionSlots: 20,
    manufacturingSlots: 30,
    dontSplitShorterThan: 1.2,
    blacklist: {
      fuelBlocks: false,
      intermediateCompositeReactions: false,
      compositeReactions: false,
      biochemicalReactions: false,
      hybridReactions: false,
      capitalComponents: false,
      advancedComponents: false,
      customItems: ''
    }
  };

  try {
    const plan = await productionPlanner.calculateProductionPlan(jobs, stock, config);

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

        // Afficher TOUS les jobs pour cette catégorie
        jobs.forEach(job => {
          console.log(`  - ${job.productName} x${job.runs} (${job.productionTimeDays.toFixed(2)} days) [depth: ${job.depth}]`);
          if (job.splitFrom) {
            console.log(`    [Split ${job.splitIndex}/${job.splitFrom}]`);
          }
        });
      }
    }

    // Afficher les premiers matériaux
    console.log('\n💎 MATERIALS TO BUY (Top 10):');
    console.log('='.repeat(60));
    plan.materials.slice(0, 10).forEach(mat => {
      console.log(`  ${mat.name}: ${mat.quantity.toLocaleString()}`);
    });
    
    if (plan.materials.length > 10) {
      console.log(`  ... and ${plan.materials.length - 10} more materials`);
    }

    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

testArchonProduction();
