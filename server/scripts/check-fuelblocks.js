import sde from '../services/sde.js';
import blueprintService from '../services/blueprintService.js';

// Charger le SDE d'abord
await sde.loadTypes();
await blueprintService.loadBlueprints();

// Vérifier les Fuel Blocks (groupID 1136)
const fuelBlockNames = [
  'Helium Fuel Block',
  'Oxygen Fuel Block',
  'Nitrogen Fuel Block',
  'Hydrogen Fuel Block'
];

console.log('🔍 Vérification des Fuel Blocks:');
console.log('='.repeat(60));

for (const name of fuelBlockNames) {
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
  
  const hasReaction = !!blueprint.activities?.reaction;
  const hasManufacturing = !!blueprint.activities?.manufacturing;
  const activityType = blueprintService.getActivityType(blueprint);
  
  console.log(`\n${name}:`);
  console.log(`  TypeID: ${type.typeId}`);
  console.log(`  GroupID: ${type.groupId}`);
  console.log(`  Has reaction: ${hasReaction}`);
  console.log(`  Has manufacturing: ${hasManufacturing}`);
  console.log(`  Activity type: ${activityType}`);
}
