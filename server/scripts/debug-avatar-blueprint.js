import sde from '../services/sde.js';
import blueprintService from '../services/blueprintService.js';

async function debugAvatar() {
  console.log('Loading SDE data...');
  await sde.loadTypes();
  await blueprintService.loadBlueprints();

  console.log('\n=== Testing Avatar lookup ===\n');

  // 1. Chercher le type Avatar
  const avatarType = sde.findTypeByName('Avatar');
  console.log('1. findTypeByName("Avatar"):', avatarType ? {
    typeId: avatarType.typeId,
    name: avatarType.name,
    groupId: avatarType.groupId
  } : 'NOT FOUND');

  // 2. Chercher le blueprint par ce typeId
  if (avatarType) {
    const blueprint = blueprintService.getBlueprintByProduct(avatarType.typeId);
    console.log('\n2. getBlueprintByProduct(' + avatarType.typeId + '):', blueprint ? {
      blueprintTypeID: blueprint.blueprintTypeID,
      maxProductionLimit: blueprint.maxProductionLimit
    } : 'NOT FOUND');
  }

  // 3. Chercher "Avatar Blueprint" directement
  const avatarBlueprintType = sde.findTypeByName('Avatar Blueprint');
  console.log('\n3. findTypeByName("Avatar Blueprint"):', avatarBlueprintType ? {
    typeId: avatarBlueprintType.typeId,
    name: avatarBlueprintType.name,
    groupId: avatarBlueprintType.groupId
  } : 'NOT FOUND');

  // 4. Si le blueprint type existe, chercher le blueprint data
  if (avatarBlueprintType) {
    const blueprintData = blueprintService.getBlueprintById(avatarBlueprintType.typeId);
    console.log('\n4. getBlueprintById(' + avatarBlueprintType.typeId + '):', blueprintData ? {
      blueprintTypeID: blueprintData.blueprintTypeID,
      hasManufacturing: !!blueprintData.activities?.manufacturing,
      hasReaction: !!blueprintData.activities?.reaction,
      productTypeID: blueprintData.activities?.manufacturing?.products?.[0]?.typeID || 'N/A'
    } : 'NOT FOUND');
  }

  // 5. Chercher tous les blueprints contenant "Avatar"
  console.log('\n5. All blueprints matching "Avatar":');
  const allBlueprints = blueprintService.getAllBlueprints();
  const avatarBlueprints = allBlueprints.filter(bp => {
    const bpType = sde.getTypeById(bp.blueprintTypeID);
    return bpType && bpType.name.toLowerCase().includes('avatar');
  });
  
  avatarBlueprints.forEach(bp => {
    const bpType = sde.getTypeById(bp.blueprintTypeID);
    const productId = bp.activities?.manufacturing?.products?.[0]?.typeID;
    const productType = productId ? sde.getTypeById(productId) : null;
    console.log(`  - ${bpType.name} (${bp.blueprintTypeID}) -> produces ${productType ? productType.name : 'unknown'} (${productId})`);
  });
}

debugAvatar().catch(console.error);
