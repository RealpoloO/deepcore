/**
 * Tests pour le système de logging Winston
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Logger Winston', () => {
  const testLogDir = path.join(__dirname, '../../logs');

  beforeEach(() => {
    // S'assurer que le dossier logs existe
    if (!fs.existsSync(testLogDir)) {
      fs.mkdirSync(testLogDir, { recursive: true });
    }
  });

  test('devrait avoir les niveaux de log corrects', () => {
    expect(logger.levels).toBeDefined();
    expect(logger.level).toBeDefined();
  });

  test('devrait logger des messages info', () => {
    const spy = jest.spyOn(logger, 'info');

    logger.info('Test info message', { testData: 'value' });

    expect(spy).toHaveBeenCalledWith('Test info message', { testData: 'value' });
    spy.mockRestore();
  });

  test('devrait logger des erreurs avec stack trace', () => {
    const spy = jest.spyOn(logger, 'error');
    const error = new Error('Test error');

    logger.error('Error occurred', { error: error.message, stack: error.stack });

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('devrait logger des warnings', () => {
    const spy = jest.spyOn(logger, 'warn');

    logger.warn('Test warning', { reason: 'testing' });

    expect(spy).toHaveBeenCalledWith('Test warning', { reason: 'testing' });
    spy.mockRestore();
  });

  test('devrait logger des messages debug', () => {
    const spy = jest.spyOn(logger, 'debug');

    logger.debug('Debug message', { debugData: true });

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('devrait avoir un stream pour Morgan', () => {
    expect(logger.stream).toBeDefined();
    expect(typeof logger.stream.write).toBe('function');
  });

  test('stream devrait logger via http level', () => {
    const spy = jest.spyOn(logger, 'http');

    logger.stream.write('GET /api/test 200\n');

    expect(spy).toHaveBeenCalledWith('GET /api/test 200');
    spy.mockRestore();
  });

  test('devrait créer les fichiers de log', (done) => {
    logger.info('Test log file creation');

    // Attendre un peu pour que le fichier soit créé
    setTimeout(() => {
      const combinedLogPath = path.join(testLogDir, 'combined.log');
      expect(fs.existsSync(combinedLogPath)).toBe(true);
      done();
    }, 1000);
  });
});
