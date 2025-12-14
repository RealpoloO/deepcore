import sde from '../services/sde.js';
import blueprintService from '../services/blueprintService.js';
import { calculateProductionTree, organizeJobs } from '../services/productionPlanner.js';

const materialsNeeded = new Map();
const allJobs = [];

const type = sde.findTypeByName('Archon');
calculateProductionTree(type.typeId, 1, {}, {}, materialsNeeded, allJobs, 0);

const organized = organizeJobs(allJobs);

for (const category in organized) {
  if (organized[category].length === 0) continue;
  
  const jobs = organized[category];
  const uniqueProducts = new Set();
  jobs.forEach(j => uniqueProducts.add(j.productTypeID));
  
  console.log(`${category}:`);
  console.log(`  Unique products: ${uniqueProducts.size}`);
  console.log(`  Total jobs: ${jobs.length}`);
}
