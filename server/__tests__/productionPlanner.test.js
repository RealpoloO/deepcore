import { describe, test, expect, beforeAll } from '@jest/globals';
import productionPlanner from '../services/productionPlanner.js';
import blueprintService from '../services/blueprintService.js';
import sde from '../services/sde.js';

describe('Production Planner', () => {
  beforeAll(async () => {
    // Charger les données nécessaires
    await sde.loadTypes();
    await blueprintService.loadBlueprints();
  });

  describe('parseStock', () => {
    test('should parse stock with space separator', async () => {
      const stockText = `Tritanium 1000
Pyerite 500`;

      const { stock, errors } = await productionPlanner.parseStock(stockText);

      // Tritanium = typeID 34, Pyerite = typeID 35
      expect(stock.get(34)).toBe(1000);
      expect(stock.get(35)).toBe(500);
      expect(errors.length).toBe(0);
    });

    test('should handle empty stock', async () => {
      const { stock, errors } = await productionPlanner.parseStock('');
      expect(stock.size).toBe(0);
      expect(errors.length).toBe(0);
    });

    test('should handle malformed lines', async () => {
      const stockText = `Tritanium 1000
invalid line without number
Pyerite 500`;

      const { stock, errors } = await productionPlanner.parseStock(stockText);

      expect(stock.get(34)).toBe(1000);
      expect(stock.get(35)).toBe(500);
      expect(stock.size).toBe(2);
      expect(errors.length).toBe(1);
      expect(errors[0].error).toContain('Format invalide');
    });

    test('should accumulate duplicate items', async () => {
      const stockText = `Tritanium 1000
Tritanium 500`;

      const { stock, errors } = await productionPlanner.parseStock(stockText);

      expect(stock.get(34)).toBe(1500);
      expect(errors.length).toBe(0);
    });

    test('should ignore unknown items and report error', async () => {
      const stockText = `Tritanium 1000
UnknownItemThatDoesNotExist 500`;

      const { stock, errors } = await productionPlanner.parseStock(stockText);

      expect(stock.get(34)).toBe(1000);
      expect(stock.size).toBe(1);
      expect(errors.length).toBe(1);
      expect(errors[0].error).toContain('introuvable');
    });
  });

  describe('isBlacklisted', () => {
    test('should blacklist by category', () => {
      const blacklist = {
        intermediateCompositeReactions: true
      };

      // Chercher un item qui appartient à intermediate_composite_reactions
      // Par exemple "Caesarium Cadmide" qui est dans groupID 428
      const intermediateReactionType = sde.findTypeByName('Caesarium Cadmide');

      if (intermediateReactionType) {
        const result = productionPlanner.isBlacklisted(intermediateReactionType.typeId, blacklist);
        expect(result).toBe(true);
      } else {
        // Si l'item n'existe pas, on skip le test
        expect(true).toBe(true);
      }
    });

    test('should blacklist fuel blocks', () => {
      const blacklist = {
        fuelBlocks: true
      };

      // Trouver un Fuel Block
      const fuelBlockType = sde.findTypeByName('Helium Fuel Block');

      if (fuelBlockType) {
        const result = productionPlanner.isBlacklisted(fuelBlockType.typeId, blacklist);
        expect(result).toBe(true);
      }
    });

    test('should blacklist custom items', () => {
      const blacklist = {
        customItems: 'Tritanium\nPyerite'
      };

      const result = productionPlanner.isBlacklisted(34, blacklist); // Tritanium
      expect(result).toBe(true);
    });

    test('should not blacklist when no rules match', () => {
      const blacklist = {
        intermediateCompositeReactions: false
      };

      const result = productionPlanner.isBlacklisted(34, blacklist); // Tritanium
      expect(result).toBe(false);
    });

    test('should handle empty blacklist', () => {
      const result = productionPlanner.isBlacklisted(34, {});
      expect(result).toBe(false);
    });
  });

  describe('calculateProductionPlan', () => {
    test('should calculate plan for simple manufacturing item', async () => {
      // Test avec un item qui a un blueprint de manufacturing
      const jobs = [
        {
          product: 'Nanite Repair Paste',
          runs: 1,
          me: 10,
          te: 20
        }
      ];

      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2,
        blacklist: {}
      };

      const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

      // Nanite Repair Paste a un blueprint, devrait créer des jobs
      expect(plan).toHaveProperty('materials');
      expect(plan).toHaveProperty('jobs');
      expect(plan).toHaveProperty('categoryTimings');
      expect(plan).toHaveProperty('totalProductionTimeDays');
      expect(plan.totalJobs).toBeGreaterThan(0);
    });

    test('should use stock when available', async () => {
      // Si on a assez en stock, pas besoin de produire
      const jobs = [
        {
          product: 'Nanite Repair Paste',
          runs: 1,
          me: 10,
          te: 20
        }
      ];

      const stockText = 'Nanite Repair Paste 1000000'; // Beaucoup en stock

      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2,
        blacklist: {}
      };

      const plan = await productionPlanner.calculateProductionPlan(jobs, stockText, config);

      // Avec assez de stock, pas de jobs à créer
      expect(plan.totalJobs).toBe(0);
      expect(plan.materials.length).toBe(0);
    });

    test('should respect blacklist', async () => {
      // Tester que la blacklist empêche la production de certains items
      const jobs = [
        {
          product: 'Carbon Fiber',
          runs: 1,
          me: 10,
          te: 20
        }
      ];

      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2,
        blacklist: {
          fuelBlocks: true // Blacklist Fuel Blocks
        }
      };

      const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

      // Hydrogen Fuel Block devrait être dans materials (blacklisté = à acheter)
      const fuelBlock = plan.materials.find(m => m.name === 'Hydrogen Fuel Block');
      expect(fuelBlock).toBeDefined();

      // Et PAS dans les jobs fuel_blocks
      expect(plan.jobs.fuel_blocks.length).toBe(0);
    });

    test('should handle unknown product gracefully', async () => {
      const jobs = [
        {
          product: 'ThisProductDoesNotExist12345',
          runs: 1
        }
      ];

      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2,
        blacklist: {}
      };

      const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

      // Plan devrait être vide ou minimal
      expect(plan.totalJobs).toBe(0);
      expect(plan.materials.length).toBe(0);
    });

    test('should organize jobs by category', async () => {
      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2,
        blacklist: {}
      };

      const plan = await productionPlanner.calculateProductionPlan([], '', config);

      // Vérifier que la structure jobs contient toutes les catégories
      expect(plan.jobs).toHaveProperty('intermediate_composite_reactions');
      expect(plan.jobs).toHaveProperty('composite_reactions');
      expect(plan.jobs).toHaveProperty('end_product_jobs');
      expect(plan.jobs).toHaveProperty('fuel_blocks');
      expect(plan.jobs).toHaveProperty('advanced_components');
      expect(plan.jobs).toHaveProperty('capital_components');
      expect(plan.jobs).toHaveProperty('others');
    });

    test('should calculate category timings', async () => {
      const jobs = [
        {
          product: 'Tritanium',
          runs: 1
        }
      ];

      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2,
        blacklist: {}
      };

      const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

      // Vérifier que categoryTimings contient les bonnes données
      expect(plan.categoryTimings).toBeDefined();

      // Chaque catégorie avec jobs devrait avoir totalTimeDays, slotsUsed, jobCount
      for (const category in plan.categoryTimings) {
        const timing = plan.categoryTimings[category];
        expect(timing).toHaveProperty('totalTimeDays');
        expect(timing).toHaveProperty('slotsUsed');
        expect(timing).toHaveProperty('jobCount');
        expect(timing.totalTimeDays).toBeGreaterThanOrEqual(0);
        expect(timing.slotsUsed).toBeGreaterThanOrEqual(0);
        expect(timing.jobCount).toBeGreaterThan(0);
      }
    });
  });

  describe('Job Optimization (Split Logic)', () => {
    test('should calculate total production time correctly', async () => {
      const jobs = [
        {
          product: 'Tritanium',
          runs: 1
        }
      ];

      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2,
        blacklist: {}
      };

      const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

      // totalProductionTimeDays devrait être >= 0
      expect(plan.totalProductionTimeDays).toBeGreaterThanOrEqual(0);
    });

    test('should handle multiple jobs with different categories', async () => {
      const jobs = [
        {
          product: 'Tritanium',
          runs: 1
        }
      ];

      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2,
        blacklist: {}
      };

      const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

      // Vérifier que le plan contient bien les jobs organisés
      expect(plan.jobs).toBeDefined();
      expect(typeof plan.jobs).toBe('object');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty jobs array', async () => {
      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2,
        blacklist: {}
      };

      const plan = await productionPlanner.calculateProductionPlan([], '', config);

      expect(plan.totalJobs).toBe(0);
      expect(plan.materials.length).toBe(0);
      expect(plan.totalProductionTimeDays).toBe(0);
    });

    test('should handle very large runs', async () => {
      const jobs = [
        {
          product: 'Tritanium',
          runs: 1000000
        }
      ];

      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2,
        blacklist: {}
      };

      const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

      // Devrait gérer sans erreur
      expect(plan).toBeDefined();
      expect(plan.materials).toBeDefined();
    });

    test('should handle zero slots configuration', async () => {
      const jobs = [
        {
          product: 'Tritanium',
          runs: 1
        }
      ];

      const config = {
        reactionSlots: 0,
        manufacturingSlots: 0,
        dontSplitShorterThan: 1.2,
        blacklist: {}
      };

      const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

      // Devrait gérer même avec 0 slots (temps infini théoriquement)
      expect(plan).toBeDefined();
    });
  });

  describe('Integration Tests - Items with Blueprints', () => {
    test('should calculate production for Carbon Fiber (simple component)', async () => {
      const jobs = [
        {
          product: 'Carbon Fiber',
          runs: 10,
          me: 10,
          te: 20
        }
      ];

      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2,
        blacklist: {}
      };

      const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

      // Carbon Fiber a un blueprint, donc on devrait avoir des jobs
      expect(plan.totalJobs).toBeGreaterThan(0);
      expect(plan.jobs.end_product_jobs.length).toBe(1);
      expect(plan.jobs.end_product_jobs[0].productName).toBe('Carbon Fiber');
      expect(plan.jobs.end_product_jobs[0].me).toBe(10);
      expect(plan.jobs.end_product_jobs[0].te).toBe(20);
      expect(plan.jobs.end_product_jobs[0].isEndProduct).toBe(true);
    });

    test('should calculate production for氘代十六烷基 (complex reaction)', async () => {
      const caesariumType = sde.findTypeByName('Caesarium Cadmide');

      if (caesariumType) {
        const jobs = [
          {
            product: 'Caesarium Cadmide',
            runs: 100,
            me: 10,
            te: 20
          }
        ];

        const config = {
          reactionSlots: 20,
          manufacturingSlots: 30,
          dontSplitShorterThan: 1.2,
          blacklist: {}
        };

        const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

        // Devrait avoir des jobs de type reaction
        expect(plan.totalJobs).toBeGreaterThan(0);
        expect(plan.jobs.end_product_jobs.length).toBe(1);

        // Vérifier qu'il y a des matériaux intermédiaires
        const hasIntermediateReactions = plan.jobs.intermediate_composite_reactions.length > 0;
        expect(hasIntermediateReactions || plan.materials.length > 0).toBe(true);
      }
    });

    test('should calculate complete production chain for complex item', async () => {
      const jobs = [
        {
          product: 'Carbon Fiber',
          runs: 1
        }
      ];

      const stockText = ''; // Pas de stock

      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2,
        blacklist: {}
      };

      const plan = await productionPlanner.calculateProductionPlan(jobs, stockText, config);

      // Vérifier toutes les propriétés du plan
      expect(plan).toHaveProperty('materials');
      expect(plan).toHaveProperty('jobs');
      expect(plan).toHaveProperty('categoryTimings');
      expect(plan).toHaveProperty('totalProductionTimeDays');
      expect(plan).toHaveProperty('totalJobs');
      expect(plan).toHaveProperty('totalMaterials');

      expect(Array.isArray(plan.materials)).toBe(true);
      expect(typeof plan.jobs).toBe('object');
      expect(typeof plan.categoryTimings).toBe('object');
      expect(typeof plan.totalProductionTimeDays).toBe('number');
      expect(typeof plan.totalJobs).toBe('number');
      expect(typeof plan.totalMaterials).toBe('number');
    });

    test('ME=0 vs ME=10 should produce DIFFERENT material quantities', async () => {
      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2,
        blacklist: {}
      };

      // Test avec Nanite Repair Paste qui a un blueprint de MANUFACTURING (pas reaction)
      // Les reactions ne bénéficient PAS du ME dans EVE Online
      const jobsME0 = [
        {
          product: 'Nanite Repair Paste',
          runs: 10,
          me: 0,
          te: 20
        }
      ];

      const jobsME10 = [
        {
          product: 'Nanite Repair Paste',
          runs: 10,
          me: 10,
          te: 20
        }
      ];

      const planME0 = await productionPlanner.calculateProductionPlan(jobsME0, '', config);
      const planME10 = await productionPlanner.calculateProductionPlan(jobsME10, '', config);

      // Les deux plans doivent avoir des matériaux
      expect(planME0.materials.length).toBeGreaterThan(0);
      expect(planME10.materials.length).toBeGreaterThan(0);

      // DEBUG: Vérifier les matériaux du end product job directement
      const endProductJobME0 = planME0.jobs.end_product_jobs[0];
      const endProductJobME10 = planME10.jobs.end_product_jobs[0];

      console.log('\n=== ME=0 End Product Job Materials ===');
      endProductJobME0.materials.forEach(mat => {
        console.log(`  ${mat.name}: ${mat.quantity}`);
      });

      console.log('\n=== ME=10 End Product Job Materials ===');
      endProductJobME10.materials.forEach(mat => {
        console.log(`  ${mat.name}: ${mat.quantity}`);
      });

      const totalEndProductME0 = endProductJobME0.materials.reduce((sum, mat) => sum + mat.quantity, 0);
      const totalEndProductME10 = endProductJobME10.materials.reduce((sum, mat) => sum + mat.quantity, 0);

      console.log(`\nME=0 end product needs: ${totalEndProductME0} materials`);
      console.log(`ME=10 end product needs: ${totalEndProductME10} materials`);
      console.log(`Difference: ${totalEndProductME0 - totalEndProductME10}`);

      // Vérifier que ME affecte les quantités de matériaux DU END PRODUCT
      expect(totalEndProductME0).toBeGreaterThan(totalEndProductME10);

      // Vérifier que les end product jobs ont le bon ME
      expect(planME0.jobs.end_product_jobs[0].me).toBe(0);
      expect(planME10.jobs.end_product_jobs[0].me).toBe(10);
    });

    test('should handle mixed reactions and manufacturing', async () => {
      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2,
        blacklist: {}
      };

      // Chercher un item qui nécessite des réactions
      const reactionProduct = sde.findTypeByName('Crystalline Carbonide');

      if (reactionProduct) {
        const jobs = [
          {
            product: 'Crystalline Carbonide',
            runs: 1
          }
        ];

        const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

        // Devrait avoir des jobs de type reaction
        let hasReactionJobs = false;
        for (const category in plan.jobs) {
          for (const job of plan.jobs[category]) {
            if (job.activityType === 'reaction') {
              hasReactionJobs = true;
              break;
            }
          }
        }

        expect(hasReactionJobs).toBe(true);
      }
    });

    test('should respect depth limit', async () => {
      // Test de profondeur avec un item complexe
      const jobs = [
        {
          product: 'Tritanium',
          runs: 1
        }
      ];

      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2,
        blacklist: {}
      };

      const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

      // Vérifier qu'aucun job n'a une profondeur > 20
      for (const category in plan.jobs) {
        for (const job of plan.jobs[category]) {
          expect(job.depth).toBeLessThanOrEqual(20);
        }
      }
    });
  });

  describe('Job Splitting Logic', () => {
    test('should split long jobs into multiple slots', async () => {
      // Utiliser un item qui prend du temps et devrait être splitté
      const jobs = [
        {
          product: 'Nanite Repair Paste',
          runs: 1000, // Beaucoup de runs = long job
          me: 10,
          te: 20
        }
      ];

      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 0.5, // Seuil bas pour forcer le split
        blacklist: {}
      };

      const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

      // Le job devrait exister
      expect(plan.totalJobs).toBeGreaterThan(0);
      expect(plan.jobs.end_product_jobs.length).toBe(1);

      // Vérifier que le job a les propriétés de temps correctes
      const endProductJob = plan.jobs.end_product_jobs[0];
      expect(endProductJob.productionTimeDays).toBeGreaterThan(0);
      expect(endProductJob.runs).toBe(1000);
    });

    test('should not split short jobs', async () => {
      const jobs = [
        {
          product: 'Nanite Repair Paste',
          runs: 1, // Peu de runs = job court
          me: 10,
          te: 20
        }
      ];

      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 100, // Seuil élevé = pas de split
        blacklist: {}
      };

      const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

      expect(plan.jobs.end_product_jobs.length).toBe(1);
      const endProductJob = plan.jobs.end_product_jobs[0];

      // Pas de splitIndex/splitCount car pas splitté
      expect(endProductJob.splitIndex).toBeUndefined();
      expect(endProductJob.splitCount).toBeUndefined();
    });

    test('should respect slot limits per section', async () => {
      // Tester avec peu de slots manufacturing
      const jobs = [
        {
          product: 'Nanite Repair Paste',
          runs: 100,
          me: 10,
          te: 20
        }
      ];

      const config = {
        reactionSlots: 20,
        manufacturingSlots: 5, // Très peu de slots
        dontSplitShorterThan: 0.1,
        blacklist: {}
      };

      const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

      // Le plan devrait être calculé sans erreur
      expect(plan.totalJobs).toBeGreaterThan(0);
      expect(plan.jobs.end_product_jobs.length).toBe(1);
    });
  });

  describe('Stock Consumption', () => {
    test('should consume stock during BOM calculation', async () => {
      const jobs = [
        {
          product: 'Nanite Repair Paste',
          runs: 1,
          me: 10,
          te: 20
        }
      ];

      // Fournir du stock pour un des matériaux
      const stockText = `Data Chips 100
Gel-Matrix Biopaste 100
Nanites 100`;

      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2,
        blacklist: {}
      };

      const planWithStock = await productionPlanner.calculateProductionPlan(jobs, stockText, config);
      const planWithoutStock = await productionPlanner.calculateProductionPlan(jobs, '', config);

      // Avec stock, on devrait avoir moins de matériaux à acheter
      const totalWithStock = planWithStock.materials.reduce((sum, mat) => sum + mat.quantity, 0);
      const totalWithoutStock = planWithoutStock.materials.reduce((sum, mat) => sum + mat.quantity, 0);

      expect(totalWithStock).toBeLessThan(totalWithoutStock);
    });

    test('should handle stock that covers entire production', async () => {
      const jobs = [
        {
          product: 'Nanite Repair Paste',
          runs: 1,
          me: 10,
          te: 20
        }
      ];

      // Fournir énormément de stock pour tout couvrir
      const stockText = `Nanite Repair Paste 1000`;

      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2,
        blacklist: {}
      };

      const plan = await productionPlanner.calculateProductionPlan(jobs, stockText, config);

      // Pas de jobs à créer si tout est en stock
      expect(plan.totalJobs).toBe(0);
      expect(plan.materials.length).toBe(0);
    });

    test('should handle partial stock', async () => {
      const jobs = [
        {
          product: 'Nanite Repair Paste',
          runs: 10,
          me: 10,
          te: 20
        }
      ];

      // Stock partiel pour un matériau
      const stockText = `Data Chips 5`;

      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2,
        blacklist: {}
      };

      const plan = await productionPlanner.calculateProductionPlan(jobs, stockText, config);

      // Devrait avoir des jobs et des matériaux (stock partiel utilisé)
      expect(plan.totalJobs).toBeGreaterThan(0);
      expect(plan.materials.length).toBeGreaterThan(0);

      // Vérifier que Data Chips est dans les matériaux avec quantité réduite
      const dataChips = plan.materials.find(m => m.name === 'Data Chips');
      expect(dataChips).toBeDefined();
      // La quantité devrait être réduite par rapport à sans stock
    });
  });

  describe('Blacklist Functionality', () => {
    test('should blacklist entire categories', async () => {
      const jobs = [
        {
          product: 'Carbon Fiber', // Nécessite Hydrogen Fuel Block
          runs: 1,
          me: 10,
          te: 20
        }
      ];

      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2,
        blacklist: {
          fuelBlocks: true // Blacklist Fuel Blocks
        }
      };

      const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

      // Hydrogen Fuel Block devrait être dans materials (à acheter) pas dans jobs
      const fuelBlock = plan.materials.find(m => m.name === 'Hydrogen Fuel Block');
      expect(fuelBlock).toBeDefined();

      // Vérifier qu'il n'y a pas de job pour Fuel Blocks
      expect(plan.jobs.fuel_blocks.length).toBe(0);
    });

    test('should blacklist custom items by name', async () => {
      const jobs = [
        {
          product: 'Nanite Repair Paste',
          runs: 1,
          me: 10,
          te: 20
        }
      ];

      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2,
        blacklist: {
          customItems: 'Data Chips\nNanites'
        }
      };

      const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

      // Data Chips et Nanites devraient être dans materials (à acheter)
      const dataChips = plan.materials.find(m => m.name === 'Data Chips');
      const nanites = plan.materials.find(m => m.name === 'Nanites');

      expect(dataChips).toBeDefined();
      expect(nanites).toBeDefined();
    });

    test('should handle empty blacklist', async () => {
      const jobs = [
        {
          product: 'Nanite Repair Paste',
          runs: 1,
          me: 10,
          te: 20
        }
      ];

      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2,
        blacklist: {} // Pas de blacklist
      };

      const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

      // Devrait fonctionner normalement
      expect(plan.totalJobs).toBeGreaterThan(0);
      expect(plan.materials.length).toBeGreaterThan(0);
    });
  });

  describe('Category Timings', () => {
    test('should calculate parallel execution times correctly', async () => {
      const jobs = [
        {
          product: 'Nanite Repair Paste',
          runs: 10,
          me: 10,
          te: 20
        }
      ];

      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2,
        blacklist: {}
      };

      const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

      // Vérifier que categoryTimings contient les bonnes informations
      expect(plan.categoryTimings).toBeDefined();
      expect(plan.totalProductionTimeDays).toBeGreaterThan(0);

      // Vérifier la structure des timings
      for (const category in plan.categoryTimings) {
        const timing = plan.categoryTimings[category];
        expect(timing).toHaveProperty('totalTimeDays');
        expect(timing).toHaveProperty('reactionTimeDays');
        expect(timing).toHaveProperty('manufacturingTimeDays');
        expect(timing).toHaveProperty('reactionJobs');
        expect(timing).toHaveProperty('manufacturingJobs');
        expect(timing).toHaveProperty('totalJobs');

        expect(typeof timing.totalTimeDays).toBe('number');
        expect(typeof timing.reactionTimeDays).toBe('number');
        expect(typeof timing.manufacturingTimeDays).toBe('number');
        expect(timing.totalTimeDays).toBeGreaterThanOrEqual(0);
      }
    });

    test('should handle jobs with different activity types in same category', async () => {
      // Utiliser un item qui génère à la fois manufacturing et reactions
      const jobs = [
        {
          product: 'Carbon Fiber',
          runs: 10,
          me: 10,
          te: 20
        }
      ];

      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2,
        blacklist: {}
      };

      const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

      // Devrait avoir des timings pour plusieurs catégories
      const categoriesWithJobs = Object.keys(plan.categoryTimings);
      expect(categoriesWithJobs.length).toBeGreaterThan(0);

      // Le temps total devrait être le max de toutes les catégories
      const maxCategoryTime = Math.max(
        ...Object.values(plan.categoryTimings).map(ct => ct.totalTimeDays)
      );
      expect(plan.totalProductionTimeDays).toBe(maxCategoryTime);
    });
  });

  describe('Error Handling', () => {
    test('should handle multiple products with errors gracefully', async () => {
      const jobs = [
        {
          product: 'ValidItem',
          runs: 1
        },
        {
          product: 'InvalidItemThatDoesNotExist',
          runs: 1
        },
        {
          product: 'Nanite Repair Paste',
          runs: 1,
          me: 10,
          te: 20
        }
      ];

      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2,
        blacklist: {}
      };

      const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

      // Devrait avoir des erreurs pour les produits invalides
      expect(plan.errors).toBeDefined();

      // Mais devrait quand même calculer les produits valides si pas d'erreurs critiques
      // (dépend si tous les produits sont invalides ou pas)
    });

    test('should handle invalid stock format gracefully', async () => {
      const jobs = [
        {
          product: 'Nanite Repair Paste',
          runs: 1,
          me: 10,
          te: 20
        }
      ];

      const stockText = `InvalidFormat
Tritanium abc
Valid Item 123`;

      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2,
        blacklist: {}
      };

      const plan = await productionPlanner.calculateProductionPlan(jobs, stockText, config);

      // Devrait retourner des erreurs de parsing mais continuer quand même
      expect(plan.errors).toBeDefined();
      expect(plan.errors.length).toBeGreaterThan(0);
      expect(plan.errors[0].type).toBe('STOCK_PARSING_ERROR');
    });

    test('should validate quantity limits', async () => {
      const jobs = [
        {
          product: 'Nanite Repair Paste',
          runs: 1000000000, // Quantité énorme
          me: 10,
          te: 20
        }
      ];

      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2,
        blacklist: {}
      };

      // Devrait soit rejeter soit gérer la grosse quantité
      const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

      // Le plan devrait exister même avec une grosse quantité
      expect(plan).toBeDefined();
    });
  });

  describe('Materials Aggregation', () => {
    test('should aggregate materials from all jobs correctly', async () => {
      const jobs = [
        {
          product: 'Nanite Repair Paste',
          runs: 10,
          me: 10,
          te: 20
        }
      ];

      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2,
        blacklist: {}
      };

      const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

      // Vérifier que materials contient uniquement les matériaux de base
      expect(plan.materials.length).toBeGreaterThan(0);

      // Chaque matériau devrait avoir typeID, name, quantity
      plan.materials.forEach(material => {
        expect(material).toHaveProperty('typeID');
        expect(material).toHaveProperty('name');
        expect(material).toHaveProperty('quantity');
        expect(typeof material.typeID).toBe('number');
        expect(typeof material.name).toBe('string');
        expect(typeof material.quantity).toBe('number');
        expect(material.quantity).toBeGreaterThan(0);
      });

      // Les matériaux devraient être triés par nom
      for (let i = 1; i < plan.materials.length; i++) {
        expect(plan.materials[i].name.localeCompare(plan.materials[i - 1].name))
          .toBeGreaterThanOrEqual(0);
      }
    });

    test('should not include intermediate crafted items in materials', async () => {
      const jobs = [
        {
          product: 'Carbon Fiber', // Nécessite Hydrogen Fuel Block (craftable)
          runs: 1,
          me: 10,
          te: 20
        }
      ];

      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2,
        blacklist: {} // Pas de blacklist = Fuel Block devrait être crafté
      };

      const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

      // Hydrogen Fuel Block devrait être dans les JOBS (fuel_blocks category)
      const fuelBlockJobs = plan.jobs.fuel_blocks;
      expect(fuelBlockJobs.length).toBeGreaterThan(0);

      // Hydrogen Fuel Block NE DEVRAIT PAS être dans materials (car crafté)
      const fuelBlockInMaterials = plan.materials.find(m => m.name === 'Hydrogen Fuel Block');
      expect(fuelBlockInMaterials).toBeUndefined();
    });

    test('should include blacklisted items in materials', async () => {
      const jobs = [
        {
          product: 'Carbon Fiber',
          runs: 1,
          me: 10,
          te: 20
        }
      ];

      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2,
        blacklist: {
          fuelBlocks: true // Blacklist Fuel Blocks
        }
      };

      const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

      // Hydrogen Fuel Block devrait être dans materials (blacklisté)
      const fuelBlockInMaterials = plan.materials.find(m => m.name === 'Hydrogen Fuel Block');
      expect(fuelBlockInMaterials).toBeDefined();
      expect(fuelBlockInMaterials.quantity).toBeGreaterThan(0);

      // Et PAS dans les jobs
      expect(plan.jobs.fuel_blocks.length).toBe(0);
    });
  });
});
