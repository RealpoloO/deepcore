import { describe, test, expect } from '@jest/globals';
import productionCategories from '../services/productionCategories.js';

describe('Production Categories', () => {
  describe('getCategoryByGroupID', () => {
    test('should categorize Simple Reactions as intermediate_composite_reactions', () => {
      const category = productionCategories.getCategoryByGroupID(436);
      expect(category).toBe('intermediate_composite_reactions');
    });

    test('should categorize Complex Reactions as composite_reactions', () => {
      const category = productionCategories.getCategoryByGroupID(484);
      expect(category).toBe('composite_reactions');
    });

    test('should categorize Biochemical Reactions correctly', () => {
      const category1 = productionCategories.getCategoryByGroupID(661);
      const category2 = productionCategories.getCategoryByGroupID(662);
      expect(category1).toBe('biochemical_reactions');
      expect(category2).toBe('biochemical_reactions');
    });

    test('should categorize Hybrid Reactions correctly', () => {
      const category = productionCategories.getCategoryByGroupID(977);
      expect(category).toBe('hybrid_reactions');
    });

    test('should categorize Capital Components correctly', () => {
      const category = productionCategories.getCategoryByGroupID(873);
      expect(category).toBe('capital_components');
    });

    test('should categorize Advanced Components correctly', () => {
      const category = productionCategories.getCategoryByGroupID(913);
      expect(category).toBe('advanced_components');
    });

    test('should return end_product_jobs for unknown groupID', () => {
      const category = productionCategories.getCategoryByGroupID(99999);
      expect(category).toBe('end_product_jobs');
    });
  });

  describe('isInCategory', () => {
    test('should correctly identify if groupID is in category', () => {
      expect(productionCategories.isInCategory(436, 'intermediate_composite_reactions')).toBe(true);
      expect(productionCategories.isInCategory(484, 'composite_reactions')).toBe(true);
      expect(productionCategories.isInCategory(436, 'composite_reactions')).toBe(false);
    });
  });

  describe('isBlacklistedByCategory', () => {
    test('should blacklist intermediate composite reactions when enabled', () => {
      const blacklist = { intermediateCompositeReactions: true };
      expect(productionCategories.isBlacklistedByCategory(436, blacklist)).toBe(true);
    });

    test('should not blacklist when category is disabled', () => {
      const blacklist = { intermediateCompositeReactions: false };
      expect(productionCategories.isBlacklistedByCategory(436, blacklist)).toBe(false);
    });

    test('should blacklist multiple categories', () => {
      const blacklist = {
        compositeReactions: true,
        biochemicalReactions: true
      };
      expect(productionCategories.isBlacklistedByCategory(484, blacklist)).toBe(true);
      expect(productionCategories.isBlacklistedByCategory(661, blacklist)).toBe(true);
    });

    test('should return false for empty blacklist', () => {
      expect(productionCategories.isBlacklistedByCategory(436, {})).toBe(false);
      expect(productionCategories.isBlacklistedByCategory(436, null)).toBe(false);
    });
  });

  describe('getAllCategories', () => {
    test('should return all categories in production order', () => {
      const categories = productionCategories.getAllCategories();
      expect(categories).toHaveLength(8);
      expect(categories[0]).toBe('intermediate_composite_reactions');
      expect(categories[categories.length - 1]).toBe('end_product_jobs');
    });
  });
});
