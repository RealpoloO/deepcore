import { z } from 'zod';
import logger from '../utils/logger.js';

/**
 * @fileoverview Middlewares et schémas de validation Zod pour l'API
 * Valide toutes les entrées utilisateur pour prévenir les injections et erreurs
 * @module middleware/validation
 */

/**
 * Middleware de validation Zod
 * Valide les données de la requête selon un schéma Zod et retourne une erreur 400 si invalide
 *
 * @param {z.ZodSchema} schema - Schéma Zod à valider
 * @param {('body'|'params'|'query')} source - Source des données à valider
 * @returns {import('express').RequestHandler} Middleware Express
 * @example
 * router.post('/sync/:characterId',
 *   validate(characterIdSchema, 'params'),
 *   handler
 * );
 */
export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      // Valider les données
      const validated = schema.parse(req[source]);
      // Remplacer avec les données validées et nettoyées
      req[source] = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Erreur de validation', {
          path: req.path,
          errors: error.errors,
          data: req[source]
        });

        return res.status(400).json({
          error: 'Données invalides',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      next(error);
    }
  };
};

// ============================================
// Schémas de validation pour les différentes routes
// ============================================

/**
 * Validation pour l'ID de personnage (nombre positif)
 */
export const characterIdSchema = z.object({
  characterId: z.string().regex(/^\d+$/, 'Character ID doit être un nombre').transform(Number)
});

/**
 * Validation pour l'ID de job (nombre positif)
 */
export const jobIdSchema = z.object({
  jobId: z.string().regex(/^\d+$/, 'Job ID doit être un nombre').transform(Number)
});

/**
 * Validation pour les paramètres de synchronisation de minage
 */
export const miningSyncSchema = z.object({
  characterId: z.string().regex(/^\d+$/, 'Character ID doit être un nombre').transform(Number)
});

/**
 * Validation pour les filtres de données de minage
 */
export const miningQuerySchema = z.object({
  characterId: z.string().optional(),
  startDate: z.string().datetime({ message: 'Format de date invalide' }).optional(),
  endDate: z.string().datetime({ message: 'Format de date invalide' }).optional(),
  oreType: z.string().optional()
});

/**
 * Validation pour la mise à jour des alertes de jobs
 */
export const updateAlertSchema = z.object({
  alertEnabled: z.boolean({
    required_error: 'alertEnabled est requis',
    invalid_type_error: 'alertEnabled doit être un booléen'
  })
});

/**
 * Validation pour les paramètres de prix du marché
 */
export const marketPriceQuerySchema = z.object({
  typeId: z.string().regex(/^\d+$/, 'Type ID doit être un nombre').transform(Number).optional(),
  station: z.enum(['jita', 'cj'], {
    errorMap: () => ({ message: 'Station doit être "jita" ou "cj"' })
  }).optional()
});

/**
 * Validation pour la suppression de personnage
 */
export const deleteCharacterSchema = z.object({
  characterId: z.string().regex(/^\d+$/, 'Character ID doit être un nombre').transform(Number)
});

/**
 * Validation pour les webhooks Discord
 */
export const discordWebhookSchema = z.object({
  content: z.string().min(1).max(2000, 'Le contenu ne doit pas dépasser 2000 caractères'),
  embeds: z.array(z.object({
    title: z.string().max(256).optional(),
    description: z.string().max(4096).optional(),
    color: z.number().int().min(0).max(16777215).optional(),
    fields: z.array(z.object({
      name: z.string().max(256),
      value: z.string().max(1024),
      inline: z.boolean().optional()
    })).max(25).optional()
  })).max(10).optional()
});
