import sde from '../services/sde.js';
import blueprintService from '../services/blueprintService.js';
import productionCategories from '../services/productionCategories.js';

// Charger les blueprints
await blueprintService.loadBlueprints();

// Vérifier tous les groupIDs et leur activityType
const allBlueprints = blueprintService.getAllBlueprints();

const categoryActivityTypes = {};

for (const bp of allBlueprints) {
  // Trouver le produit
  const manufacturing = bp.activities?.manufacturing;
  const reaction = bp.activities?.reaction;
  
  if (!manufacturing && !reaction) continue;
  
  const activity = manufacturing || reaction;
  if (!activity?.products || activity.products.length === 0) continue;
  
  const productTypeID = activity.products[0]?.typeId;
  if (!productTypeID) continue;
  
  const type = sde.getTypeById(productTypeID);
  if (!type) continue;
  
  const category = productionCategories.getCategoryByGroupID(type.groupId);
  const activityType = reaction ? 'reaction' : 'manufacturing';
  
  if (!categoryActivityTypes[category]) {
    categoryActivityTypes[category] = { reactions: 0, manufacturing: 0, groupIds: new Set() };
  }
  
  if (activityType === 'reaction') {
    categoryActivityTypes[category].reactions++;
  } else {
    categoryActivityTypes[category].manufacturing++;
  }
  
  categoryActivityTypes[category].groupIds.add(type.groupId);
}

console.log('📊 Activity Types par Catégorie:');
console.log('='.repeat(60));

for (const [category, stats] of Object.entries(categoryActivityTypes)) {
  console.log(`\n${category}:`);
  console.log(`  Reactions: ${stats.reactions}`);
  console.log(`  Manufacturing: ${stats.manufacturing}`);
  console.log(`  GroupIDs: ${[...stats.groupIds].sort((a,b) => a-b).join(', ')}`);
  
  if (stats.reactions > 0 && stats.manufacturing > 0) {
    console.log(`  ⚠️  MÉLANGE : Cette catégorie contient les deux types !`);
  }
}
