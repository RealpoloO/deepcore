import sde from '../services/sde.js';
import blueprintService from '../services/blueprintService.js';

async function checkBiochem() {
  await sde.loadTypes();
  await blueprintService.loadBlueprints();

  console.log('\n=== Checking Fuel Blocks ===\n');
  const fuelBlock = sde.findTypeByName('Helium Fuel Block');
  console.log('Helium Fuel Block:', {
    typeId: fuelBlock?.typeId,
    name: fuelBlock?.name,
    groupId: fuelBlock?.groupId
  });

  console.log('\n=== Checking Biochem Reactions ===\n');
  const neofullerene = sde.findTypeByName('Isotropic Neofullerene Alpha-3');
  console.log('Isotropic Neofullerene Alpha-3:', {
    typeId: neofullerene?.typeId,
    name: neofullerene?.name,
    groupId: neofullerene?.groupId
  });

  const neurolink = sde.findTypeByName('Hypnagogic Neurolink Enhancer');
  console.log('Hypnagogic Neurolink Enhancer:', {
    typeId: neurolink?.typeId,
    name: neurolink?.name,
    groupId: neurolink?.groupId
  });

  console.log('\n=== Checking all Fuel Block types ===\n');
  const allTypes = Array.from({ length: 60000 }, (_, i) => sde.getTypeById(i)).filter(Boolean);
  const fuelBlocks = allTypes.filter(t => t.name.includes('Fuel Block'));
  const uniqueGroupIds = [...new Set(fuelBlocks.map(fb => fb.groupId))];
  console.log('Fuel Block groupIds:', uniqueGroupIds);

  console.log('\n=== Checking all Neofullerene types ===\n');
  const neofullerenes = allTypes.filter(t => t.name.includes('Neofullerene'));
  const neoGroupIds = [...new Set(neofullerenes.map(n => n.groupId))];
  console.log('Neofullerene groupIds:', neoGroupIds);

  console.log('\n=== Checking all Neurolink types ===\n');
  const neurolinks = allTypes.filter(t => t.name.includes('Neurolink'));
  const neurolinkGroupIds = [...new Set(neurolinks.map(n => n.groupId))];
  console.log('Neurolink groupIds:', neurolinkGroupIds);
}

checkBiochem().catch(console.error);
