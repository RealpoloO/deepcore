/**
 * Test pour vérifier l'impact du ME/TE sur les matériaux
 */
import sde from '../services/sde.js';
import blueprintService from '../services/blueprintService.js';
import productionPlanner from '../services/productionPlanner.js';

async function testMETEImpact() {
  console.log('🧪 Testing ME/TE Impact on Materials...\n');

  await sde.loadTypes();
  await blueprintService.loadBlueprints();

  const config = {
    reactionSlots: 20,
    manufacturingSlots: 30,
    dontSplitShorterThan: 1.2,
    blacklist: {}
  };

  // Test 1: ME=0 vs ME=10
  console.log('📋 TEST 1: Archon avec ME différents\n');

  const planME0 = await productionPlanner.calculateProductionPlan(
    [{ product: 'Archon', runs: 1, me: 0, te: 10 }],
    '',
    config
  );

  const planME10 = await productionPlanner.calculateProductionPlan(
    [{ product: 'Archon', runs: 1, me: 10, te: 20 }],
    '',
    config
  );

  console.log('Plan avec ME=0:');
  console.log(`  Total materials à acheter: ${planME0.totalMaterials}`);
  console.log(`  Total jobs: ${planME0.totalJobs}`);

  console.log('\nPlan avec ME=10:');
  console.log(`  Total materials à acheter: ${planME10.totalMaterials}`);
  console.log(`  Total jobs: ${planME10.totalJobs}`);

  // Comparer les totaux des matériaux à acheter
  const totalME0 = planME0.materials.reduce((sum, m) => sum + m.quantity, 0);
  const totalME10 = planME10.materials.reduce((sum, m) => sum + m.quantity, 0);

  console.log(`\n📊 Quantités totales:`);
  console.log(`  ME=0: ${totalME0.toLocaleString()} unités`);
  console.log(`  ME=10: ${totalME10.toLocaleString()} unités`);
  console.log(`  Différence: ${(totalME0 - totalME10).toLocaleString()} unités`);

  if (totalME0 === totalME10) {
    console.log('\n⚠️  PROBLÈME: Les totaux sont IDENTIQUES alors qu\'ils devraient différer!');
    console.log('   Explication: Les composants (depth > 0) utilisent tous ME=10');
    console.log('   Les end products ont ME différent, mais ça n\'affecte que leurs propres matériaux');
  } else {
    console.log('\n✅ Les totaux diffèrent (normal)');
  }

  // Vérifier les matériaux des END PRODUCTS eux-mêmes
  console.log('\n\n🔍 Vérification des matériaux des END PRODUCTS:\n');

  const archonJobME0 = planME0.jobs.end_product_jobs?.find(j => j.productName === 'Archon');
  const archonJobME10 = planME10.jobs.end_product_jobs?.find(j => j.productName === 'Archon');

  if (archonJobME0 && archonJobME10) {
    console.log('Archon job avec ME=0:');
    console.log(`  Nombre de matériaux: ${archonJobME0.materials.length}`);
    const totalArchonME0 = archonJobME0.materials.reduce((sum, m) => sum + m.quantity, 0);
    console.log(`  Total: ${totalArchonME0.toLocaleString()} unités`);

    console.log('\nArchon job avec ME=10:');
    console.log(`  Nombre de matériaux: ${archonJobME10.materials.length}`);
    const totalArchonME10 = archonJobME10.materials.reduce((sum, m) => sum + m.quantity, 0);
    console.log(`  Total: ${totalArchonME10.toLocaleString()} unités`);

    console.log(`\n📊 Différence pour l'Archon lui-même:`);
    console.log(`  ${(totalArchonME0 - totalArchonME10).toLocaleString()} unités`);

    if (totalArchonME0 > totalArchonME10) {
      console.log('\n✅ CORRECT: ME=0 nécessite PLUS de matériaux que ME=10 pour l\'end product');
    } else if (totalArchonME0 === totalArchonME10) {
      console.log('\n❌ ERREUR: Les matériaux de l\'end product sont identiques!');
    }

    // Afficher quelques exemples de matériaux
    console.log('\n📦 Exemples de matériaux (top 3):');
    console.log('\n  ME=0:');
    archonJobME0.materials.slice(0, 3).forEach(m => {
      const name = sde.getTypeById(m.typeID)?.name || 'Unknown';
      console.log(`    - ${name}: ${m.quantity}`);
    });

    console.log('\n  ME=10:');
    archonJobME10.materials.slice(0, 3).forEach(m => {
      const name = sde.getTypeById(m.typeID)?.name || 'Unknown';
      console.log(`    - ${name}: ${m.quantity}`);
    });
  }

  console.log('\n\n💡 EXPLICATION:');
  console.log('='.repeat(70));
  console.log('Le ME/TE de l\'end product affecte SEULEMENT ses propres matériaux directs.');
  console.log('Les composants (depth > 0) utilisent TOUJOURS ME=10 et TE=20 (hardcodé).');
  console.log('');
  console.log('Donc:');
  console.log('  - L\'Archon lui-même (depth=0) utilise le ME spécifié (0 ou 10)');
  console.log('  - Capital Armor Plates (depth=1) utilise toujours ME=10');
  console.log('  - Tritanium (depth=2+) utilise toujours ME=10');
  console.log('');
  console.log('Résultat:');
  console.log('  - Matériaux de l\'Archon: DIFFÉRENTS selon ME');
  console.log('  - Matériaux à acheter (composants): IDENTIQUES');
  console.log('='.repeat(70));

  process.exit(0);
}

testMETEImpact();
