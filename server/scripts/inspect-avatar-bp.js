import sde from '../services/sde.js';
import blueprintService from '../services/blueprintService.js';

await sde.loadTypes();
await blueprintService.loadBlueprints();

// Trouver le blueprint Avatar
const allBlueprints = blueprintService.getAllBlueprints();
const avatarBP = allBlueprints.find(bp => {
  const bpType = sde.getTypeById(bp.blueprintTypeID);
  return bpType?.name === 'Avatar Blueprint';
});

if (!avatarBP) {
  console.log('❌ Avatar Blueprint introuvable');
} else {
  console.log('📋 Avatar Blueprint trouvé:');
  console.log(JSON.stringify(avatarBP, null, 2));
}
