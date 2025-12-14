import sde from '../services/sde.js';
import blueprintService from '../services/blueprintService.js';

await sde.loadTypes();
await blueprintService.loadBlueprints();

const itemsToCheck = [
  'Isotropic Neofullerene Alpha-3',
  'Isotropic Neofullerene Beta-6',
  'Isotropic Neofullerene Gamma-9',
  'Meta-Operant Neurolink Enhancer',
  'Hypnagogic Neurolink Enhancer'
];

console.log('🔍 Vérification des items ADVANCED_COMPONENTS:');
console.log('='.repeat(60));

for (const name of itemsToCheck) {
  const type = sde.findTypeByName(name);
  if (!type) {
    console.log(`❌ ${name}: Not found`);
    continue;
  }
  
  const blueprint = blueprintService.getBlueprintByProduct(type.typeId);
  if (!blueprint) {
    console.log(`❌ ${name}: No blueprint`);
    continue;
  }
  
  const activityType = blueprintService.getActivityType(blueprint);
  
  console.log(`\n${name}:`);
  console.log(`  Activity type: ${activityType}`);
}
