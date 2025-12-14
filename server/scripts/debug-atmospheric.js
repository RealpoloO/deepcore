import sdeService from '../services/sde.js';
import blueprintService from '../services/blueprintService.js';

console.log('🔍 Debugging Atmospheric Gases usage...\n');

await sdeService.loadTypes();
await blueprintService.loadBlueprints();

// Check fuel block blueprints
const fuelBlocks = ['Helium Fuel Block', 'Oxygen Fuel Block', 'Nitrogen Fuel Block', 'Hydrogen Fuel Block'];

for (const fuelName of fuelBlocks) {
  const type = sdeService.findTypeByName(fuelName);
  if (!type) continue;
  
  const blueprint = blueprintService.getBlueprintByProduct(type.typeId);
  if (!blueprint) continue;
  
  const activity = blueprint.activities?.reaction || blueprint.activities?.manufacturing;
  console.log(`\n${fuelName} (typeID: ${type.typeId}):`);
  console.log(`  Blueprint: ${blueprint._key}`);
  console.log(`  Activity: ${activity ? 'reaction' : 'manufacturing'}`);
  console.log(`  Materials:`);
  
  if (activity?.materials) {
    for (const mat of activity.materials) {
      const matType = sdeService.getTypeById(mat.typeID);
      console.log(`    - ${matType?.name || 'Unknown'}: ${mat.quantity}`);
    }
  }
}

// Check Atmospheric Gases usage
console.log('\n\n🔍 Searching for Atmospheric Gases in all blueprints...\n');
const atmosphericType = sdeService.findTypeByName('Atmospheric Gases');
console.log(`Atmospheric Gases typeID: ${atmosphericType.typeId}`);

const allBlueprints = blueprintService.getAllBlueprints();
let count = 0;

for (const bp of allBlueprints) {
  const activity = bp.activities?.reaction || bp.activities?.manufacturing;
  if (!activity?.materials) continue;
  
  for (const mat of activity.materials) {
    if (mat.typeID === atmosphericType.typeId) {
      const products = activity.products || [];
      const productNames = products.map(p => {
        const t = sdeService.getTypeById(p.typeID);
        return t?.name || 'Unknown';
      }).join(', ');
      
      console.log(`  ${productNames}: requires ${mat.quantity} Atmospheric Gases`);
      count++;
    }
  }
}

console.log(`\nTotal blueprints using Atmospheric Gases: ${count}`);
