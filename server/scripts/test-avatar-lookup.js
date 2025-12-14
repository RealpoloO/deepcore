import sde from '../services/sde.js';

async function testAvatar() {
  await sde.loadTypes();
  
  console.log('\n=== Searching for all "avatar" entries in nameLookup ===\n');
  
  // Accéder directement au cache (pour debug)
  const allTypes = [];
  for (let i = 0; i < 100000; i++) {
    const type = sde.getTypeById(i);
    if (type && type.name.toLowerCase() === 'avatar') {
      allTypes.push({
        typeId: type.typeId,
        name: type.name,
        groupId: type.groupId,
        published: type.published
      });
    }
  }
  
  console.log('Found types with name "Avatar":', allTypes);
  
  console.log('\n=== Testing findTypeByName("Avatar") ===\n');
  const result = sde.findTypeByName('Avatar');
  console.log('Result:', {
    typeId: result.typeId,
    name: result.name,
    groupId: result.groupId,
    published: result.published
  });
}

testAvatar().catch(console.error);
