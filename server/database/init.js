import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '../../data/whatdidimine.db');
const db = new Database(dbPath);

export function initDatabase() {
  try {
    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Create users table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        discord_id TEXT UNIQUE,
        discord_username TEXT,
        discord_access_token TEXT,
        discord_refresh_token TEXT,
        discord_token_expires_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create characters table
    db.exec(`
      CREATE TABLE IF NOT EXISTS characters (
        character_id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL,
        character_name TEXT NOT NULL,
        corporation_id INTEGER,
        corporation_name TEXT,
        alliance_id INTEGER,
        alliance_name TEXT,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        token_expires_at DATETIME NOT NULL,
        is_primary BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create mining_records table
    db.exec(`
      CREATE TABLE IF NOT EXISTS mining_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        solar_system_id INTEGER NOT NULL,
        type_id INTEGER NOT NULL,
        quantity BIGINT NOT NULL,
        synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (character_id) REFERENCES characters(character_id) ON DELETE CASCADE,
        UNIQUE(character_id, date, solar_system_id, type_id)
      )
    `);

    // Create ore types cache table
    db.exec(`
      CREATE TABLE IF NOT EXISTS ore_types (
        type_id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        volume REAL DEFAULT 1,
        cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create industry jobs table
    db.exec(`
      CREATE TABLE IF NOT EXISTS industry_jobs (
        job_id INTEGER PRIMARY KEY,
        character_id INTEGER NOT NULL,
        activity_id INTEGER NOT NULL,
        product_type_id INTEGER,
        product_name TEXT,
        runs INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        status TEXT NOT NULL,
        alert_enabled BOOLEAN DEFAULT 0,
        alert_sent BOOLEAN DEFAULT 0,
        synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (character_id) REFERENCES characters(character_id) ON DELETE CASCADE
      )
    `);

    // Create Jita market prices table
    db.exec(`
      CREATE TABLE IF NOT EXISTS market_jita (
        type_id INTEGER PRIMARY KEY,
        buy_price REAL NOT NULL,
        sell_price REAL NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create C-J market prices table
    db.exec(`
      CREATE TABLE IF NOT EXISTS market_cj (
        type_id INTEGER PRIMARY KEY,
        buy_price REAL NOT NULL,
        sell_price REAL NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better performance
    db.exec('CREATE INDEX IF NOT EXISTS idx_characters_user_id ON characters(user_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_mining_character_id ON mining_records(character_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_mining_date ON mining_records(date)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_industry_character_id ON industry_jobs(character_id)');

    logger.info('Database initialized successfully');
    return Promise.resolve();
  } catch (error) {
    logger.error('Database initialization error', {
      error: error.message,
      stack: error.stack
    });
    return Promise.reject(error);
  }
}

export default db;
