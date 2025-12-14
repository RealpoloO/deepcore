import { describe, test, expect, beforeAll } from '@jest/globals';
import blueprintService from '../services/blueprintService.js';

describe('Blueprint Service', () => {
  beforeAll(async () => {
    // Charger les blueprints avant les tests
    await blueprintService.loadBlueprints();
  });

  describe('calculateMaterials', () => {
    test('should calculate materials without ME bonus', () => {
      // Blueprint fictif pour test
      const mockBlueprint = {
        activities: {
          manufacturing: {
            materials: [
              { typeID: 34, quantity: 1000 }, // Tritanium
              { typeID: 35, quantity: 500 }    // Pyerite
            ]
          }
        }
      };

      const materials = blueprintService.calculateMaterials(mockBlueprint, 1, 0);
      expect(materials).toHaveLength(2);
      expect(materials[0].quantity).toBe(1000);
      expect(materials[1].quantity).toBe(500);
    });

    test('should calculate materials with ME 10 bonus', () => {
      const mockBlueprint = {
        activities: {
          manufacturing: {
            materials: [
              { typeID: 34, quantity: 1000 },
              { typeID: 35, quantity: 500 }
            ]
          }
        }
      };

      const materials = blueprintService.calculateMaterials(mockBlueprint, 1, 10);
      // ME 10 = 10% reduction = 0.90 multiplier
      expect(materials[0].quantity).toBe(900);  // Math.ceil(1000 * 0.9)
      expect(materials[1].quantity).toBe(450);  // Math.ceil(500 * 0.9)
    });

    test('should calculate materials for multiple runs', () => {
      const mockBlueprint = {
        activities: {
          manufacturing: {
            materials: [
              { typeID: 34, quantity: 100 }
            ]
          }
        }
      };

      const materials = blueprintService.calculateMaterials(mockBlueprint, 10, 10);
      // 100 * 0.9 * 10 = 900
      expect(materials[0].quantity).toBe(900);
    });

    test('should handle reaction materials', () => {
      const mockBlueprint = {
        activities: {
          reaction: {
            materials: [
              { typeID: 16273, quantity: 100 } // Hydrocarbons
            ]
          }
        }
      };

      const materials = blueprintService.calculateMaterials(mockBlueprint, 1, 0);
      expect(materials).toHaveLength(1);
      expect(materials[0].quantity).toBe(100);
    });
  });

  describe('calculateProductionTime', () => {
    test('should calculate time without TE bonus', () => {
      const mockBlueprint = {
        activities: {
          manufacturing: {
            time: 3600 // 1 heure
          }
        }
      };

      const time = blueprintService.calculateProductionTime(mockBlueprint, 1, 0);
      expect(time).toBe(3600);
    });

    test('should calculate time with TE 20 bonus', () => {
      const mockBlueprint = {
        activities: {
          manufacturing: {
            time: 10000
          }
        }
      };

      const time = blueprintService.calculateProductionTime(mockBlueprint, 1, 20);
      // TE 20 = 20% reduction = 0.80 multiplier
      expect(time).toBe(8000); // Math.ceil(10000 * 0.8)
    });

    test('should calculate time for multiple runs', () => {
      const mockBlueprint = {
        activities: {
          manufacturing: {
            time: 1000
          }
        }
      };

      const time = blueprintService.calculateProductionTime(mockBlueprint, 10, 20);
      // 1000 * 0.8 * 10 = 8000
      expect(time).toBe(8000);
    });
  });

  describe('getActivityType', () => {
    test('should detect reaction activity', () => {
      const mockBlueprint = {
        activities: {
          reaction: { time: 1000 }
        }
      };

      expect(blueprintService.getActivityType(mockBlueprint)).toBe('reaction');
    });

    test('should detect manufacturing activity', () => {
      const mockBlueprint = {
        activities: {
          manufacturing: { time: 1000 }
        }
      };

      expect(blueprintService.getActivityType(mockBlueprint)).toBe('manufacturing');
    });

    test('should return unknown for missing activities', () => {
      const mockBlueprint = { activities: {} };
      expect(blueprintService.getActivityType(mockBlueprint)).toBe('unknown');
    });
  });

  describe('getBlueprintByProduct', () => {
    test('should find blueprint by product typeID', () => {
      // Tritanium (typeID 34) n'a pas de blueprint (raw material)
      const blueprint = blueprintService.getBlueprintByProduct(34);
      expect(blueprint).toBeNull();
    });

    test('should return null for non-existent product', () => {
      const blueprint = blueprintService.getBlueprintByProduct(999999999);
      expect(blueprint).toBeNull();
    });
  });
});
