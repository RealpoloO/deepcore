/**
 * Tests pour le middleware de validation
 *
 * Pour exécuter ces tests :
 * 1. Installer les dépendances : npm install --save-dev jest supertest
 * 2. Ajouter dans package.json : "test": "jest"
 * 3. Exécuter : npm test
 */

import { describe, test, expect } from '@jest/globals';
import { characterIdSchema, miningSyncSchema, updateAlertSchema } from '../middleware/validation.js';

describe('Validation Schemas', () => {
  describe('characterIdSchema', () => {
    test('devrait accepter un ID valide', () => {
      const validData = { characterId: '123456' };
      const result = characterIdSchema.parse(validData);

      expect(result.characterId).toBe(123456);
      expect(typeof result.characterId).toBe('number');
    });

    test('devrait rejeter un ID non numérique', () => {
      const invalidData = { characterId: 'invalid' };

      expect(() => {
        characterIdSchema.parse(invalidData);
      }).toThrow();
    });

    test('devrait rejeter un ID négatif', () => {
      const invalidData = { characterId: '-123' };

      expect(() => {
        characterIdSchema.parse(invalidData);
      }).toThrow();
    });

    test('devrait rejeter un ID vide', () => {
      const invalidData = { characterId: '' };

      expect(() => {
        characterIdSchema.parse(invalidData);
      }).toThrow();
    });
  });

  describe('miningSyncSchema', () => {
    test('devrait accepter un character ID valide', () => {
      const validData = { characterId: '987654' };
      const result = miningSyncSchema.parse(validData);

      expect(result.characterId).toBe(987654);
    });

    test('devrait transformer la string en number', () => {
      const data = { characterId: '42' };
      const result = miningSyncSchema.parse(data);

      expect(typeof result.characterId).toBe('number');
    });
  });

  describe('updateAlertSchema', () => {
    test('devrait accepter un boolean true', () => {
      const validData = { alertEnabled: true };
      const result = updateAlertSchema.parse(validData);

      expect(result.alertEnabled).toBe(true);
    });

    test('devrait accepter un boolean false', () => {
      const validData = { alertEnabled: false };
      const result = updateAlertSchema.parse(validData);

      expect(result.alertEnabled).toBe(false);
    });

    test('devrait rejeter une string', () => {
      const invalidData = { alertEnabled: 'true' };

      expect(() => {
        updateAlertSchema.parse(invalidData);
      }).toThrow();
    });

    test('devrait rejeter un nombre', () => {
      const invalidData = { alertEnabled: 1 };

      expect(() => {
        updateAlertSchema.parse(invalidData);
      }).toThrow();
    });

    test('devrait rejeter une donnée manquante', () => {
      const invalidData = {};

      expect(() => {
        updateAlertSchema.parse(invalidData);
      }).toThrow();
    });
  });
});
