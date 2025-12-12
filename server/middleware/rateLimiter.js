import rateLimit from 'express-rate-limit';
import logger from '../utils/logger.js';

/**
 * @fileoverview Middlewares de rate limiting pour protéger l'API contre les abus
 * Utilise express-rate-limit pour limiter le nombre de requêtes par IP
 * @module middleware/rateLimiter
 */

/**
 * Rate limiter général pour toutes les routes API
 * Limite à 500 requêtes par fenêtre de 15 minutes par adresse IP
 *
 * @type {import('express').RequestHandler}
 * @example
 * app.use('/api', generalLimiter);
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limite de 500 requêtes par fenêtre
  message: {
    error: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Retourne les infos de rate limit dans les headers `RateLimit-*`
  legacyHeaders: false, // Désactive les headers `X-RateLimit-*`
  handler: (req, res) => {
    logger.warn('Rate limit dépassé', {
      ip: req.ip,
      path: req.path,
      userId: req.session?.userId
    });
    res.status(429).json({
      error: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.',
      retryAfter: '15 minutes'
    });
  },
});

/**
 * Rate limiter strict pour les endpoints de synchronisation
 * Limite à 50 requêtes par fenêtre de 15 minutes pour protéger l'API EVE ESI
 * Utilisé sur les routes qui appellent intensivement l'API externe
 *
 * @type {import('express').RequestHandler}
 * @example
 * router.post('/sync/:characterId', requireAuth, syncLimiter, handler);
 */
export const syncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limite pour les syncs
  message: {
    error: 'Trop de synchronisations, veuillez patienter avant de réessayer.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    logger.warn('Rate limit de synchronisation dépassé', {
      ip: req.ip,
      path: req.path,
      characterId: req.params.characterId,
      userId: req.session?.userId
    });
    res.status(429).json({
      error: 'Trop de synchronisations, veuillez patienter avant de réessayer.',
      retryAfter: '15 minutes'
    });
  },
});

/**
 * Rate limiter pour les endpoints d'authentification
 * Limite stricte de 20 tentatives par 15 minutes pour prévenir les attaques par force brute
 * Ne compte que les tentatives échouées (skipSuccessfulRequests: true)
 *
 * @type {import('express').RequestHandler}
 * @example
 * router.get('/login', authLimiter, handler);
 * router.get('/callback', authLimiter, handler);
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limite pour éviter les attaques par force brute
  message: {
    error: 'Trop de tentatives de connexion, veuillez réessayer plus tard.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Ne compte que les échecs
  handler: (req, res) => {
    logger.warn('Rate limit d\'authentification dépassé', {
      ip: req.ip,
      path: req.path
    });
    res.status(429).json({
      error: 'Trop de tentatives de connexion, veuillez réessayer plus tard.',
      retryAfter: '15 minutes'
    });
  },
});

/**
 * Rate limiter pour les endpoints Discord
 * Limite à 100 requêtes par 15 minutes pour les opérations Discord OAuth et webhooks
 *
 * @type {import('express').RequestHandler}
 * @example
 * router.get('/discord/login', requireAuth, discordLimiter, handler);
 * router.post('/discord/disconnect', requireAuth, discordLimiter, handler);
 */
export const discordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    error: 'Trop de requêtes Discord, veuillez patienter.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit Discord dépassé', {
      ip: req.ip,
      path: req.path,
      userId: req.session?.userId
    });
    res.status(429).json({
      error: 'Trop de requêtes Discord, veuillez patienter.',
      retryAfter: '15 minutes'
    });
  },
});
