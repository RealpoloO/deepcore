/**
 * Test de déterminisme du Production Planner
 * Vérifie que les mêmes inputs produisent TOUJOURS les mêmes outputs
 */

import productionPlanner from '../services/productionPlanner.js';
import sde from '../services/sde.js';
import blueprintService from '../services/blueprintService.js';

const config = {
  manufacturingSlots: 50,
  reactionSlots: 50,
  dontSplitShorterThan: 1,
  blacklist: {}
};

// Fonction pour comparer deux résultats
function compareResults(result1, result2, testName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST: ${testName}`);
  console.log('='.repeat(60));

  // Comparer le nombre de matériaux
  if (result1.materials.length !== result2.materials.length) {
    console.log(`❌ ÉCHEC: Nombre de matériaux différent`);
    console.log(`   Run 1: ${result1.materials.length} matériaux`);
    console.log(`   Run 2: ${result2.materials.length} matériaux`);
    return false;
  }

  // Comparer chaque matériau
  for (let i = 0; i < result1.materials.length; i++) {
    const mat1 = result1.materials[i];
    const mat2 = result2.materials[i];

    if (mat1.typeID !== mat2.typeID) {
      console.log(`❌ ÉCHEC: Matériau ${i} différent`);
      console.log(`   Run 1: ${mat1.name} (${mat1.typeID})`);
      console.log(`   Run 2: ${mat2.name} (${mat2.typeID})`);
      return false;
    }

    if (mat1.quantity !== mat2.quantity) {
      console.log(`❌ ÉCHEC: Quantité différente pour ${mat1.name}`);
      console.log(`   Run 1: ${mat1.quantity}`);
      console.log(`   Run 2: ${mat2.quantity}`);
      return false;
    }
  }

  // Comparer le nombre total de jobs
  if (result1.totalJobs !== result2.totalJobs) {
    console.log(`❌ ÉCHEC: Nombre de jobs différent`);
    console.log(`   Run 1: ${result1.totalJobs} jobs`);
    console.log(`   Run 2: ${result2.totalJobs} jobs`);
    return false;
  }

  console.log(`✅ SUCCÈS: Résultats identiques`);
  console.log(`   - ${result1.materials.length} matériaux identiques`);
  console.log(`   - ${result1.totalJobs} jobs identiques`);
  console.log(`   - Temps total: ${result1.totalProductionTimeDays.toFixed(2)} jours`);

  return true;
}

// Fonction pour afficher les matériaux
function displayMaterials(materials, label) {
  console.log(`\n${label}:`);
  for (const mat of materials) {
    console.log(`  - ${mat.name}: ${mat.quantity}`);
  }
}

async function runTests() {
  console.log('🔬 TESTS DE DÉTERMINISME DU PRODUCTION PLANNER\n');

  // Initialiser le SDE
  console.log('📂 Chargement du SDE...');
  await sde.loadTypes();
  await blueprintService.loadBlueprints();
  console.log('✅ SDE chargé\n');

  let passedTests = 0;
  let totalTests = 0;

  // ========================================
  // TEST 1: Ordre inversé simple
  // ========================================
  totalTests++;
  console.log('\n📋 TEST 1: Ordre inversé (Archon/Avatar vs Avatar/Archon)');

  const jobs1 = [
    { product: 'Archon', runs: 1, me: 10, te: 20 },
    { product: 'Avatar', runs: 1, me: 10, te: 20 }
  ];

  const jobs2 = [
    { product: 'Avatar', runs: 1, me: 10, te: 20 },
    { product: 'Archon', runs: 1, me: 10, te: 20 }
  ];

  const result1 = await productionPlanner.calculateProductionPlan(jobs1, '', config);
  const result2 = await productionPlanner.calculateProductionPlan(jobs2, '', config);

  if (result1.errors || result2.errors) {
    console.log('❌ Erreurs détectées:');
    if (result1.errors) console.log('Run 1:', result1.errors);
    if (result2.errors) console.log('Run 2:', result2.errors);
  } else {
    if (compareResults(result1, result2, 'Ordre inversé')) {
      passedTests++;
    } else {
      displayMaterials(result1.materials, 'Matériaux Run 1 (Archon puis Avatar)');
      displayMaterials(result2.materials, 'Matériaux Run 2 (Avatar puis Archon)');
    }
  }

  // ========================================
  // TEST 2: ME différent (0 vs 10)
  // ========================================
  totalTests++;
  console.log('\n📋 TEST 2: Variation ME (Avatar ME=0 vs Avatar ME=10)');

  const jobs3 = [
    { product: 'Avatar', runs: 1, me: 0, te: 20 }
  ];

  const jobs4 = [
    { product: 'Avatar', runs: 1, me: 10, te: 20 }
  ];

  const result3 = await productionPlanner.calculateProductionPlan(jobs3, '', config);
  const result4 = await productionPlanner.calculateProductionPlan(jobs4, '', config);

  if (result3.errors || result4.errors) {
    console.log('❌ Erreurs détectées:');
    if (result3.errors) console.log('ME=0:', result3.errors);
    if (result4.errors) console.log('ME=10:', result4.errors);
  } else {
    console.log(`\nAvatar ME=0:`);
    console.log(`  - ${result3.materials.length} matériaux`);
    console.log(`  - ${result3.totalJobs} jobs`);

    console.log(`\nAvatar ME=10:`);
    console.log(`  - ${result4.materials.length} matériaux`);
    console.log(`  - ${result4.totalJobs} jobs`);

    // Le nombre de matériaux devrait être DIFFÉRENT (ME différent)
    // Mais chaque exécution doit donner le MÊME résultat
    if (result3.materials.length === result4.materials.length) {
      console.log('⚠️  ATTENTION: ME différent devrait donner des quantités différentes!');
    } else {
      console.log('✅ ME différent produit des quantités différentes (attendu)');
      passedTests++;
    }
  }

  // ========================================
  // TEST 3: Exécutions multiples identiques
  // ========================================
  totalTests++;
  console.log('\n📋 TEST 3: Exécutions multiples (3 fois le même job)');

  const jobsRepeat = [
    { product: 'Avatar', runs: 1, me: 10, te: 20 }
  ];

  const results = [];
  for (let i = 0; i < 3; i++) {
    results.push(await productionPlanner.calculateProductionPlan(jobsRepeat, '', config));
  }

  let allIdentical = true;
  for (let i = 1; i < results.length; i++) {
    if (!compareResults(results[0], results[i], `Run 1 vs Run ${i + 1}`)) {
      allIdentical = false;
      break;
    }
  }

  if (allIdentical) {
    console.log('✅ Toutes les exécutions sont identiques');
    passedTests++;
  } else {
    console.log('❌ Les exécutions ne sont PAS identiques');
  }

  // ========================================
  // TEST 4: Jobs multiples avec ordre variable
  // ========================================
  totalTests++;
  console.log('\n📋 TEST 4: 3 jobs dans ordres différents');

  const jobs5 = [
    { product: 'Archon', runs: 1, me: 10, te: 20 },
    { product: 'Avatar', runs: 1, me: 10, te: 20 },
    { product: 'Ragnarok', runs: 1, me: 10, te: 20 }
  ];

  const jobs6 = [
    { product: 'Ragnarok', runs: 1, me: 10, te: 20 },
    { product: 'Archon', runs: 1, me: 10, te: 20 },
    { product: 'Avatar', runs: 1, me: 10, te: 20 }
  ];

  const result5 = await productionPlanner.calculateProductionPlan(jobs5, '', config);
  const result6 = await productionPlanner.calculateProductionPlan(jobs6, '', config);

  if (result5.errors || result6.errors) {
    console.log('❌ Erreurs détectées:');
    if (result5.errors) console.log('Run 1:', result5.errors);
    if (result6.errors) console.log('Run 2:', result6.errors);
  } else {
    if (compareResults(result5, result6, 'Ordre variable avec 3 jobs')) {
      passedTests++;
    } else {
      displayMaterials(result5.materials, 'Matériaux Run 1');
      displayMaterials(result6.materials, 'Matériaux Run 2');
    }
  }

  // ========================================
  // RÉSUMÉ
  // ========================================
  console.log('\n' + '='.repeat(60));
  console.log('📊 RÉSUMÉ DES TESTS');
  console.log('='.repeat(60));
  console.log(`Tests réussis: ${passedTests}/${totalTests}`);
  console.log(`Taux de réussite: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (passedTests === totalTests) {
    console.log('\n✅ TOUS LES TESTS SONT RÉUSSIS - Le système est DÉTERMINISTE');
  } else {
    console.log('\n❌ CERTAINS TESTS ONT ÉCHOUÉ - Le système n\'est PAS entièrement déterministe');
  }

  process.exit(passedTests === totalTests ? 0 : 1);
}

runTests().catch(err => {
  console.error('❌ Erreur lors de l\'exécution des tests:', err);
  process.exit(1);
});
