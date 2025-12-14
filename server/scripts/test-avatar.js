import sde from '../services/sde.js';
import blueprintService from '../services/blueprintService.js';
import productionPlanner from '../services/productionPlanner.js';

await sde.loadTypes();
await blueprintService.loadBlueprints();

console.log('🧪 Testing Avatar Production Plan...\n');

const jobs = [{ product: 'Avatar', runs: 1, me: 10, te: 20 }];
const stock = '';
const config = {
  reactionSlots: 20,
  manufacturingSlots: 30,
  dontSplitShorterThan: 1.2,
  blacklist: {}
};

try {
  const plan = await productionPlanner.calculateProductionPlan(jobs, stock, config);
  
  console.log('✅ Production plan calculated successfully!');
  console.log(`Total jobs: ${plan.totalJobs}`);
  console.log(`Total materials: ${plan.totalMaterials}`);
  
  if (plan.errors && plan.errors.length > 0) {
    console.log('\n⚠️  Errors:');
    plan.errors.forEach(err => console.log(`  - ${err.error}`));
  }
  
  console.log('\n📊 Jobs by category:');
  for (const [category, jobs] of Object.entries(plan.jobs)) {
    if (jobs.length > 0) {
      console.log(`  ${category}: ${jobs.length} jobs`);
    }
  }
} catch (err) {
  console.error('❌ Error:', err.message);
}
