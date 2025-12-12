/**
 * Tests pour le middleware de rate limiting
 */

import { describe, test, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { generalLimiter, syncLimiter, authLimiter } from '../middleware/rateLimiter.js';

describe('Rate Limiter Middleware', () => {
  describe('generalLimiter', () => {
    let app;

    beforeEach(() => {
      app = express();
      app.use(generalLimiter);
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });
    });

    test('devrait autoriser les requêtes sous la limite', async () => {
      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
    });

    test('devrait inclure les headers de rate limit', async () => {
      const response = await request(app).get('/test');

      expect(response.headers['ratelimit-limit']).toBe('100');
      expect(parseInt(response.headers['ratelimit-remaining'])).toBeLessThanOrEqual(100);
      expect(response.headers['ratelimit-reset']).toBeDefined();
    });
  });

  describe('syncLimiter', () => {
    let app;

    beforeEach(() => {
      app = express();
      app.use(syncLimiter);
      app.post('/sync', (req, res) => {
        res.json({ success: true });
      });
    });

    test('devrait avoir une limite plus stricte (10)', async () => {
      const response = await request(app).post('/sync');

      expect(response.status).toBe(200);
      expect(response.headers['ratelimit-limit']).toBe('10');
    });

    test('devrait retourner 429 après dépassement de la limite', async () => {
      // Faire 11 requêtes (limite = 10)
      const requests = [];
      for (let i = 0; i < 11; i++) {
        requests.push(request(app).post('/sync'));
      }

      const responses = await Promise.all(requests);
      const lastResponse = responses[responses.length - 1];

      // La dernière requête devrait être rate-limited
      expect(lastResponse.status).toBe(429);
      expect(lastResponse.body.error).toContain('synchronisations');
    });
  });

  describe('authLimiter', () => {
    let app;

    beforeEach(() => {
      app = express();
      app.use(authLimiter);
      app.get('/login', (req, res) => {
        res.json({ success: true });
      });
    });

    test('devrait avoir une limite très stricte (5)', async () => {
      const response = await request(app).get('/login');

      expect(response.status).toBe(200);
      expect(response.headers['ratelimit-limit']).toBe('5');
    });
  });
});
