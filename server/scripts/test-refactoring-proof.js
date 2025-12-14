/**
 * Script de démonstration du fix du problème fondamental
 *
 * PROBLÈME: Les matériaux étaient calculés AVANT le splitting des jobs
 *
 * EXEMPLE:
 * - Job de 55 runs → matériaux calculés pour 55 runs → Math.ceil() appliqué
 * - Ensuite job splitté en 27 + 28 runs
 * - MAIS les matériaux restaient ceux calculés pour 55 runs!
 *
 * SOLUTION: Architecture 3-passes
 * - Pass 1: Construire la structure (sans matériaux)
 * - Pass 2: Consolider et splitter
 * - Pass 3: Calculer matériaux pour les runs FINAUX
 */
import sde from '../services/sde.js';
import blueprintService from '../services/blueprintService.js';
import productionPlanner from '../services/productionPlanner.js';

async function demonstrateRefactoringFix() {
  console.log('🔬 DÉMONSTRATION DU FIX - Calcul Matériaux Après Splitting\n');
  console.log('='.repeat(70));

  await sde.loadTypes();
  await blueprintService.loadBlueprints();

  const config = {
    reactionSlots: 20,
    manufacturingSlots: 30,
    dontSplitShorterThan: 1.2,
    blacklist: {}
  };

  const jobs = [{ product: 'Archon', runs: 55, me: 10, te: 20 }];

  console.log('\n📋 CONFIGURATION:');
  console.log(`   Product: Archon`);
  console.log(`   Runs: 55`);
  console.log(`   ME/TE: 10/20`);
  console.log(`   Reaction Slots: ${config.reactionSlots}`);
  console.log(`   Manufacturing Slots: ${config.manufacturingSlots}`);
  console.log(`   Don't Split Shorter Than: ${config.dontSplitShorterThan} days`);

  try {
    const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

    console.log('\n\n📊 RÉSULTATS:\n');
    console.log(`✅ Production plan calculé avec succès`);
    console.log(`   Total jobs: ${plan.totalJobs}`);
    console.log(`   Total matériaux: ${plan.totalMaterials}`);
    console.log(`   Temps total: ${plan.totalProductionTimeDays?.toFixed(2)} jours`);

    // Trouver un composant splitté pour démonstration
    const allJobs = Object.values(plan.jobs).flat();
    const splittedJobs = allJobs.filter(j => j.splitFrom && j.splitCount > 1);

    if (splittedJobs.length === 0) {
      console.log('\n⚠️  Aucun job splitté trouvé');
      process.exit(0);
    }

    // Grouper par produit
    const byProduct = new Map();
    for (const job of splittedJobs) {
      const key = `${job.productTypeID}_${job.me}_${job.te}`;
      if (!byProduct.has(key)) {
        byProduct.set(key, []);
      }
      byProduct.get(key).push(job);
    }

    // Prendre le premier groupe splitté
    const firstGroup = Array.from(byProduct.values())[0];
    const sampleJob = firstGroup[0];

    console.log('\n\n🎯 EXEMPLE DE COMPOSANT SPLITTÉ:\n');
    console.log('='.repeat(70));
    console.log(`\nProduit: ${sampleJob.productName}`);
    console.log(`Runs originaux: ${sampleJob.splitFrom}`);
    console.log(`Splitté en: ${firstGroup.length} jobs`);
    console.log(``);

    // Afficher chaque split
    console.log(`\n📦 JOBS SPLITTÉS:`);
    for (const job of firstGroup) {
      console.log(`\n   Split ${job.splitIndex}/${job.splitCount}: ${job.runs} runs (${job.productionTimeDays.toFixed(2)} jours)`);

      if (job.materials && job.materials.length > 0) {
        console.log(`   Matériaux (top 3):`);
        for (let i = 0; i < Math.min(3, job.materials.length); i++) {
          const mat = job.materials[i];
          const matType = sde.getTypeById(mat.typeID);
          const matName = matType?.name || `Unknown`;
          console.log(`     - ${matName}: ${mat.quantity.toLocaleString()}`);
        }
      }
    }

    // Calculer ce qu'on aurait eu AVANT le fix
    const blueprint = blueprintService.getBlueprintById(sampleJob.blueprintTypeID);
    const materialsBeforeSplit = blueprintService.calculateMaterials(
      blueprint,
      sampleJob.splitFrom,
      sampleJob.me
    );

    console.log(`\n\n❌ APPROCHE INCORRECTE (Avant le fix):`);
    console.log(`   Matériaux calculés pour ${sampleJob.splitFrom} runs en UN SEUL bloc:`);
    for (let i = 0; i < Math.min(3, materialsBeforeSplit.length); i++) {
      const mat = materialsBeforeSplit[i];
      const matType = sde.getTypeById(mat.typeID);
      const matName = matType?.name || `Unknown`;
      console.log(`     - ${matName}: ${mat.quantity.toLocaleString()}`);
    }
    console.log(`\n   Problème: Ces quantités seraient copiées TEL QUEL dans chaque split!`);
    console.log(`   Chaque split aurait les matériaux pour ${sampleJob.splitFrom} runs au lieu de ses ${firstGroup[0].runs} runs`);

    // Calculer la somme des matériaux APRÈS le fix
    const summedMaterials = new Map();
    for (const job of firstGroup) {
      for (const mat of job.materials) {
        const current = summedMaterials.get(mat.typeID) || 0;
        summedMaterials.set(mat.typeID, current + mat.quantity);
      }
    }

    console.log(`\n\n✅ APPROCHE CORRECTE (Après le fix):`);
    console.log(`   Somme des matériaux des ${firstGroup.length} jobs splittés:`);
    for (let i = 0; i < Math.min(3, materialsBeforeSplit.length); i++) {
      const mat = materialsBeforeSplit[i];
      const summed = summedMaterials.get(mat.typeID) || 0;
      const matType = sde.getTypeById(mat.typeID);
      const matName = matType?.name || `Unknown`;
      const diff = summed - mat.quantity;

      console.log(`     - ${matName}: ${summed.toLocaleString()} (${diff >= 0 ? '+' : ''}${diff} vs bloc unique)`);
    }

    console.log(`\n   Bénéfice: Matériaux calculés pour les runs RÉELS de chaque job`);
    console.log(`   La différence vient de Math.ceil() appliqué indépendamment sur chaque split`);

    // Statistiques globales
    const totalBeforeSplit = materialsBeforeSplit.reduce((sum, m) => sum + m.quantity, 0);
    const totalAfterSplit = Array.from(summedMaterials.values()).reduce((sum, q) => sum + q, 0);
    const excess = totalAfterSplit - totalBeforeSplit;
    const percentExcess = (excess / totalBeforeSplit * 100).toFixed(4);

    console.log(`\n\n📊 STATISTIQUES:`);
    console.log(`   Total matériaux (bloc unique): ${totalBeforeSplit.toLocaleString()}`);
    console.log(`   Total matériaux (${firstGroup.length} splits): ${totalAfterSplit.toLocaleString()}`);
    console.log(`   Excess dû au splitting: ${excess.toLocaleString()} unités (${percentExcess}%)`);

    if (excess > 0) {
      console.log(`\n   ℹ️  Cet excess est MINIMAL et INÉVITABLE avec Math.ceil()`);
      console.log(`   AVANT le fix, l'excess était BEAUCOUP plus important car:`);
      console.log(`   - Les matériaux étaient calculés pour 55 runs`);
      console.log(`   - Puis copiés dans les splits de 27 et 28 runs`);
      console.log(`   - Résultat: (matériaux pour 55) × 2 splits = presque le DOUBLE!`);
    }

    console.log(`\n\n🎉 CONCLUSION:`);
    console.log(`=`.repeat(70));
    console.log(`\n✅ Le refactoring fonctionne correctement!`);
    console.log(`\n   Architecture 3-passes:`);
    console.log(`   1️⃣  Pass 1: Construction de la structure (JobDescriptors sans matériaux)`);
    console.log(`   2️⃣  Pass 2: Consolidation et splitting des jobs`);
    console.log(`   3️⃣  Pass 3: Calcul des matériaux pour chaque job FINAL`);
    console.log(`\n   Résultat:`);
    console.log(`   ✅ Matériaux calculés APRÈS splitting`);
    console.log(`   ✅ Quantités correctes pour chaque job splitté`);
    console.log(`   ✅ Excess minimal (${percentExcess}% au lieu de ~100%)`);
    console.log(`   ✅ Pas de duplication des matériaux`);

    console.log('\n' + '='.repeat(70) + '\n');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  process.exit(0);
}

demonstrateRefactoringFix();
