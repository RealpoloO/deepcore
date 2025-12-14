import sde from '../services/sde.js';
import productionPlanner from '../services/productionPlanner.js';

const { parseStock } = productionPlanner;

// Attendre que la SDE soit chargée
async function testStockParsing() {
  console.log('='.repeat(60));
  console.log('TEST DE PARSING DU STOCK EXISTANT');
  console.log('='.repeat(60));

  // Stock de test avec tabulations
  const testStock = `Neurolink Protection Cell	15
Capital Core Temperature Regulator	10
Mexallon	25902400
Capital Shield Emitter	60
Megacyte	368939
Tritanium	151575009
Morphite	25261`;

  console.log('\n📦 Stock de test (format avec tabulations):');
  console.log(testStock);
  console.log('\n');

  // Parser le stock
  const parsedStock = await parseStock(testStock);

  console.log('✅ Stock parsé avec succès !');
  console.log(`   Nombre d'items différents: ${parsedStock.size}`);
  console.log('\n📊 Détails du stock parsé:');
  console.log('-'.repeat(60));

  for (const [typeID, quantity] of parsedStock) {
    const type = sde.getTypeById(typeID);
    const name = type ? type.name : 'Unknown';
    console.log(`   ${name.padEnd(40)} ${quantity.toLocaleString().padStart(12)} (typeID: ${typeID})`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('TEST DES SCÉNARIOS ARCHON & AVATAR');
  console.log('='.repeat(60));

  // Test 1: Archon sans stock
  console.log('\n📋 Test 1: Archon (1 run) SANS stock');
  console.log('-'.repeat(60));
  const archonType = sde.findTypeByName('Archon');
  if (archonType) {
    console.log(`   Archon trouvé: typeID = ${archonType.typeId}`);
    const emptyStock = new Map();
    console.log('   Stock: VIDE');
    console.log('   → Tous les matériaux devront être achetés');
  } else {
    console.log('   ❌ Archon non trouvé dans la SDE');
  }

  // Test 2: Archon avec stock
  console.log('\n📋 Test 2: Archon (1 run) AVEC stock');
  console.log('-'.repeat(60));
  if (archonType) {
    console.log(`   Archon trouvé: typeID = ${archonType.typeId}`);
    console.log('   Stock:');
    for (const [typeID, quantity] of parsedStock) {
      const type = sde.getTypeById(typeID);
      if (type) {
        console.log(`      - ${type.name}: ${quantity.toLocaleString()}`);
      }
    }
    console.log('   → Les matériaux en stock seront déduits');
  }

  // Test 3: Avatar sans stock
  console.log('\n📋 Test 3: Avatar (1 run) SANS stock');
  console.log('-'.repeat(60));
  const avatarType = sde.findTypeByName('Avatar');
  if (avatarType) {
    console.log(`   Avatar trouvé: typeID = ${avatarType.typeId}`);
    const emptyStock = new Map();
    console.log('   Stock: VIDE');
    console.log('   → Tous les matériaux devront être achetés');
  } else {
    console.log('   ❌ Avatar non trouvé dans la SDE');
  }

  // Test 4: Avatar avec stock
  console.log('\n📋 Test 4: Avatar (1 run) AVEC stock');
  console.log('-'.repeat(60));
  if (avatarType) {
    console.log(`   Avatar trouvé: typeID = ${avatarType.typeId}`);
    console.log('   Stock:');
    for (const [typeID, quantity] of parsedStock) {
      const type = sde.getTypeById(typeID);
      if (type) {
        console.log(`      - ${type.name}: ${quantity.toLocaleString()}`);
      }
    }
    console.log('   → Les matériaux en stock seront déduits');
  }

  console.log('\n' + '='.repeat(60));
  console.log('TEST DE FORMATS INVALIDES');
  console.log('='.repeat(60));

  // Test avec format deux-points (ne doit PAS fonctionner)
  const invalidStock = `Tritanium: 1000000
Pyerite: 500000`;

  console.log('\n📦 Stock avec deux-points (format invalide):');
  console.log(invalidStock);
  const parsedInvalid = await parseStock(invalidStock);
  console.log(`\n❌ Items parsés: ${parsedInvalid.size} (devrait être 0)`);

  // Test avec format espaces multiples (doit fonctionner)
  const validStock = `Tritanium  1000000
Pyerite   500000`;

  console.log('\n📦 Stock avec espaces (format valide):');
  console.log(validStock);
  const parsedValid = await parseStock(validStock);
  console.log(`\n✅ Items parsés: ${parsedValid.size} (devrait être 2)`);
  for (const [typeID, quantity] of parsedValid) {
    const type = sde.getTypeById(typeID);
    console.log(`   - ${type?.name}: ${quantity.toLocaleString()}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ TESTS TERMINÉS');
  console.log('='.repeat(60));
}

// Attendre que la SDE soit chargée
async function waitForSDE() {
  console.log('⏳ Chargement de la SDE...');
  
  // Charger la SDE
  try {
    await sde.loadTypes();
    console.log('✅ SDE chargée\n');
    await testStockParsing();
  } catch (err) {
    console.error('❌ Échec du chargement de la SDE:', err);
  }
  
  process.exit(0);
}

waitForSDE().catch(err => {
  console.error('Erreur:', err);
  process.exit(1);
});
