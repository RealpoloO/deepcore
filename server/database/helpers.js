/**
 * @fileoverview Helper functions for database operations with better-sqlite3
 * Wraps synchronous better-sqlite3 API in Promises for backward compatibility
 * @module database/helpers
 */

import db from './init.js';

// Helper functions for database operations
export const dbHelpers = {
  /**
   * Run a query that modifies data (INSERT, UPDATE, DELETE)
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<{lastID: number, changes: number}>}
   */
  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      try {
        const stmt = db.prepare(sql);
        const info = stmt.run(params);
        resolve({
          lastID: info.lastInsertRowid,
          changes: info.changes
        });
      } catch (err) {
        reject(err);
      }
    });
  },

  /**
   * Get a single row from the database
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object|undefined>}
   */
  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      try {
        const stmt = db.prepare(sql);
        const row = stmt.get(params);
        resolve(row);
      } catch (err) {
        reject(err);
      }
    });
  },

  /**
   * Get multiple rows from the database
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Array<Object>>}
   */
  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      try {
        const stmt = db.prepare(sql);
        const rows = stmt.all(params);
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    });
  }
};

export default dbHelpers;
