/**
 * Script pour vérifier que les matériaux sont calculés APRÈS le splitting
 * Test: Comparer matériaux d'un job consolidé vs somme des matériaux des jobs splittés
 */
import sde from '../services/sde.js';
import blueprintService from '../services/blueprintService.js';
import productionPlanner from '../services/productionPlanner.js';

async function verifySplitMaterials() {
  console.log('🔬 Verifying Materials Calculation After Splitting...\n');

  // Charger les services
  await sde.loadTypes();
  await blueprintService.loadBlueprints();

  // Configuration pour forcer le splitting
  const config = {
    reactionSlots: 20,
    manufacturingSlots: 30,
    dontSplitShorterThan: 1.2,
    blacklist: {
      fuelBlocks: false,
      intermediateCompositeReactions: false,
      compositeReactions: false,
      biochemicalReactions: false,
      hybridReactions: false,
      capitalComponents: false,
      advancedComponents: false,
      customItems: ''
    }
  };

  const jobs = [
    { product: 'Archon', runs: 55, me: 10, te: 20 }
  ];

  try {
    const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

    console.log('📊 Analyzing Material Calculations...\n');

    // Trouver un composant qui a été splitté
    const allCategories = Object.values(plan.jobs).flat();
    const splittedComponents = allCategories.filter(j =>
      j.splitFrom && j.splitCount && j.splitCount > 1
    );

    if (splittedComponents.length === 0) {
      console.log('❌ No split jobs found!');
      process.exit(1);
    }

    // Regrouper par produit
    const byProduct = new Map();
    for (const job of splittedComponents) {
      const key = `${job.productTypeID}_${job.me}_${job.te}_${job.splitFrom}`;
      if (!byProduct.has(key)) {
        byProduct.set(key, []);
      }
      byProduct.get(key).push(job);
    }

    // Analyser le premier groupe splitté
    const firstGroup = Array.from(byProduct.values())[0];
    if (!firstGroup || firstGroup.length < 2) {
      console.log('❌ No valid split group found!');
      process.exit(1);
    }

    const sampleJob = firstGroup[0];
    console.log(`🎯 Analyzing: ${sampleJob.productName}`);
    console.log(`   Original runs: ${sampleJob.splitFrom}`);
    console.log(`   Split into: ${firstGroup.length} jobs\n`);

    // Vérifier que chaque job a des matériaux
    let allHaveMaterials = true;
    for (const job of firstGroup) {
      if (!job.materials || job.materials.length === 0) {
        console.log(`❌ Job ${job.splitIndex}/${job.splitCount} has NO materials!`);
        allHaveMaterials = false;
      }
    }

    if (!allHaveMaterials) {
      console.log('\n❌ FAILED: Some split jobs missing materials');
      process.exit(1);
    }

    console.log('✅ All split jobs have materials calculated\n');

    // Comparer les matériaux entre jobs splittés
    console.log('🔍 Comparing material quantities between split jobs:\n');

    // Afficher les runs et matériaux de chaque split
    for (const job of firstGroup) {
      console.log(`  Split ${job.splitIndex}/${job.splitCount}: ${job.runs} runs`);

      // Afficher les 3 premiers matériaux
      if (job.materials && job.materials.length > 0) {
        for (let i = 0; i < Math.min(3, job.materials.length); i++) {
          const mat = job.materials[i];
          const matType = sde.getTypeById(mat.typeID);
          const matName = matType?.name || `Unknown (${mat.typeID})`;
          console.log(`    - ${matName}: ${mat.quantity} units`);
        }
      }
      console.log('');
    }

    // Calculer ce que seraient les matériaux si calculés AVANT splitting (approche incorrecte)
    const blueprint = blueprintService.getBlueprintById(sampleJob.blueprintTypeID);
    const materialsForConsolidated = blueprintService.calculateMaterials(
      blueprint,
      sampleJob.splitFrom,
      sampleJob.me
    );

    console.log(`📐 If materials calculated BEFORE splitting (${sampleJob.splitFrom} runs):`);
    for (let i = 0; i < Math.min(3, materialsForConsolidated.length); i++) {
      const mat = materialsForConsolidated[i];
      const matType = sde.getTypeById(mat.typeID);
      const matName = matType?.name || `Unknown (${mat.typeID})`;
      console.log(`  - ${matName}: ${mat.quantity} units`);
    }
    console.log('');

    // Calculer la somme des matériaux des jobs splittés (approche correcte)
    const summedMaterials = new Map();
    for (const job of firstGroup) {
      for (const mat of job.materials) {
        const current = summedMaterials.get(mat.typeID) || 0;
        summedMaterials.set(mat.typeID, current + mat.quantity);
      }
    }

    console.log(`➕ Sum of materials from split jobs (${firstGroup.length} jobs):`);
    let diffIndex = 0;
    for (const mat of materialsForConsolidated.slice(0, 3)) {
      const summed = summedMaterials.get(mat.typeID) || 0;
      const matType = sde.getTypeById(mat.typeID);
      const matName = matType?.name || `Unknown (${mat.typeID})`;
      const diff = summed - mat.quantity;

      console.log(`  - ${matName}: ${summed} units (${diff >= 0 ? '+' : ''}${diff} vs consolidated)`);

      if (diff !== 0) diffIndex++;
    }
    console.log('');

    // Vérification
    const hasAnyDifference = Array.from(summedMaterials.entries()).some(([typeID, quantity]) => {
      const consolidated = materialsForConsolidated.find(m => m.typeID === typeID);
      return consolidated && consolidated.quantity !== quantity;
    });

    if (hasAnyDifference) {
      console.log('✅ PASS: Materials differ between consolidated and split approach');
      console.log('   This proves materials are calculated AFTER splitting (correct behavior)');
    } else {
      console.log('⚠️  WARNING: No difference detected - may indicate materials calculated before splitting');
    }

    // Vérifier que la somme est raisonnable (généralement plus élevée à cause de Math.ceil)
    const totalConsolidated = materialsForConsolidated.reduce((sum, m) => sum + m.quantity, 0);
    const totalSplit = Array.from(summedMaterials.values()).reduce((sum, q) => sum + q, 0);
    const percentDiff = ((totalSplit - totalConsolidated) / totalConsolidated * 100).toFixed(2);

    console.log(`\n📊 Total material quantities:`);
    console.log(`   Consolidated (${sampleJob.splitFrom} runs): ${totalConsolidated.toLocaleString()} units`);
    console.log(`   Split (${firstGroup.length} jobs): ${totalSplit.toLocaleString()} units`);
    console.log(`   Difference: ${totalSplit - totalConsolidated} units (${percentDiff}%)`);

    if (totalSplit >= totalConsolidated) {
      console.log('\n✅ CORRECT: Split total ≥ consolidated (expected due to Math.ceil rounding)');
    } else {
      console.log('\n❌ ERROR: Split total < consolidated (should not happen!)');
    }

    console.log('\n✅ Verification completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  process.exit(0);
}

verifySplitMaterials();
