/**
 * Script de test pour calculer la production de 55 Archons
 * Pour tester le splitting et le calcul des matériaux après split
 */
import sde from '../services/sde.js';
import blueprintService from '../services/blueprintService.js';
import productionPlanner from '../services/productionPlanner.js';
import logger from '../utils/logger.js';

async function testArchon55Production() {
  console.log('🚀 Testing Archon 55 Runs Production Plan...\n');

  // Charger les services
  await sde.loadTypes();
  console.log('✅ SDE types loaded\n');

  await blueprintService.loadBlueprints();
  console.log('✅ Blueprints loaded\n');

  // Configuration
  const jobs = [
    {
      product: 'Archon',
      runs: 55,
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
    for (const [category, categoryJobs] of Object.entries(plan.jobs)) {
      if (categoryJobs.length > 0) {
        console.log(`\n${category.toUpperCase()} (${categoryJobs.length} jobs):`);

        const timing = plan.categoryTimings[category];
        if (timing) {
          console.log(`  ⏱️  Time: ${timing.totalTimeDays.toFixed(2)} days | Slots used: ${timing.slotsUsed}`);
        }

        // Afficher les jobs pour cette catégorie
        categoryJobs.forEach(job => {
          console.log(`  - ${job.productName} x${job.runs} runs (${job.productionTimeDays.toFixed(2)} days) [depth: ${job.depth}]`);
          if (job.splitFrom) {
            console.log(`    [Split ${job.splitIndex}/${job.splitCount} from ${job.splitFrom} runs]`);
          }

          // Pour les end product jobs, afficher les matériaux
          if (job.isEndProduct && job.materials) {
            console.log(`    Materials (${job.materials.length} types):`);
            job.materials.slice(0, 5).forEach(mat => {
              const matName = sde.getTypeById(mat.typeID)?.name || `Unknown (${mat.typeID})`;
              console.log(`      - ${matName}: ${mat.quantity}`);
            });
            if (job.materials.length > 5) {
              console.log(`      ... and ${job.materials.length - 5} more materials`);
            }
          }
        });
      }
    }

    // Vérifier que les end product jobs sont splittés correctement
    const endProductJobs = plan.jobs.end_product_jobs || [];
    const archonJobs = endProductJobs.filter(j => j.productName === 'Archon');

    console.log('\n🔍 VERIFICATION - Archon Jobs Splitting:');
    console.log('='.repeat(60));
    console.log(`Total Archon jobs: ${archonJobs.length}`);
    console.log(`Total runs across all jobs: ${archonJobs.reduce((sum, j) => sum + j.runs, 0)}`);

    if (archonJobs.length > 1) {
      console.log('\n✅ End product was split into multiple jobs');
      archonJobs.forEach((job, i) => {
        console.log(`  Job ${i + 1}: ${job.runs} runs, ${job.materials?.length || 0} material types`);
      });

      // Vérifier que chaque job splitté a ses propres matériaux calculés
      const allHaveMaterials = archonJobs.every(j => j.materials && j.materials.length > 0);
      if (allHaveMaterials) {
        console.log('\n✅ All split jobs have materials calculated');

        // Comparer les quantités de matériaux entre jobs splittés
        if (archonJobs.length >= 2) {
          const job1Materials = archonJobs[0].materials;
          const job2Materials = archonJobs[1].materials;

          console.log('\n🔬 Comparing materials between split jobs:');
          console.log(`  Job 1 (${archonJobs[0].runs} runs) vs Job 2 (${archonJobs[1].runs} runs)`);

          // Comparer le premier matériel
          if (job1Materials[0] && job2Materials[0]) {
            const mat1 = job1Materials[0];
            const mat2 = job2Materials[0];
            const matName = sde.getTypeById(mat1.typeID)?.name || 'Unknown';

            console.log(`  Material: ${matName}`);
            console.log(`    Job 1: ${mat1.quantity} units`);
            console.log(`    Job 2: ${mat2.quantity} units`);

            if (mat1.quantity !== mat2.quantity) {
              console.log(`    ✅ Quantities differ (as expected due to Math.ceil rounding)`);
            } else if (archonJobs[0].runs === archonJobs[1].runs) {
              console.log(`    ✅ Quantities same because runs are equal`);
            }
          }
        }
      } else {
        console.log('\n❌ Some split jobs are missing materials!');
      }
    } else {
      console.log('\n⚠️ End product was NOT split (runs too low or config prevents it)');
    }

    // Afficher les premiers matériaux
    console.log('\n💎 MATERIALS TO BUY (Top 15):');
    console.log('='.repeat(60));
    plan.materials.slice(0, 15).forEach(mat => {
      console.log(`  ${mat.name}: ${mat.quantity.toLocaleString()}`);
    });

    if (plan.materials.length > 15) {
      console.log(`  ... and ${plan.materials.length - 15} more materials`);
    }

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

testArchon55Production();
