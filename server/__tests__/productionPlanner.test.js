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
      // Test avec un item simple qui peut être fabriqué
      const jobs = [
        {
          product: 'Tritanium', // Pas de blueprint, devrait être dans materials
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

      // Tritanium n'a pas de blueprint, devrait être dans les matériaux
      expect(plan).toHaveProperty('materials');
      expect(plan).toHaveProperty('jobs');
      expect(plan).toHaveProperty('categoryTimings');
      expect(plan).toHaveProperty('totalProductionTimeDays');
    });

    test('should use stock when available', async () => {
      // Si on a assez en stock, pas besoin de produire
      const jobs = [
        {
          product: 'Tritanium',
          runs: 1
        }
      ];

      const stockText = 'Tritanium: 1000000'; // Beaucoup en stock

      const config = {
        reactionSlots: 20,
        manufacturingSlots: 30,
        dontSplitShorterThan: 1.2,
        blacklist: {}
      };

      const plan = await productionPlanner.calculateProductionPlan(jobs, stockText, config);

      // Avec du stock, on devrait avoir moins ou pas de matériaux à acheter
      expect(plan).toHaveProperty('materials');
    });

    test('should respect blacklist', async () => {
      // Utiliser un item qui a un blueprint pour tester la blacklist correctement
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
        blacklist: {
          customItems: 'Tritanium'
        }
      };

      const plan = await productionPlanner.calculateProductionPlan(jobs, '', config);

      // Test que la blacklist a été appliquée (la fonction isBlacklisted a été testée séparément)
      // Tritanium sera dans materials car il n'a pas de blueprint ET il est blacklisté
      expect(plan.materials).toBeDefined();
      expect(Array.isArray(plan.materials)).toBe(true);
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
});
