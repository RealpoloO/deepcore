/**
 * Migration: Ajouter des timestamps (created_at, updated_at) aux tables
 *
 * Ce script ajoute les colonnes created_at et updated_at aux tables qui n'en ont pas
 * et crée des triggers pour mettre à jour automatiquement updated_at
 *
 * Note: SQLite ne supporte pas CURRENT_TIMESTAMP dans ALTER TABLE ADD COLUMN
 * On ajoute les colonnes sans défaut, puis on met à jour les valeurs existantes
 *
 * Usage: node server/database/migrations/add-timestamps.js
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../../../data/whatdidimine.db');
const db = new Database(dbPath);

console.log('🔄 Début de la migration des timestamps...\n');

/**
 * Vérifie si une colonne existe dans une table
 */
function columnExists(tableName, columnName) {
  const columns = db.pragma(`table_info(${tableName})`);
  return columns.some(col => col.name === columnName);
}

/**
 * Ajoute une colonne timestamp à une table
 */
function addTimestampColumn(tableName, columnName) {
  if (columnExists(tableName, columnName)) {
    console.log(`   ℹ️  Colonne ${columnName} existe déjà dans ${tableName}`);
    return false;
  }

  try {
    // Ajouter la colonne sans valeur par défaut (limitation SQLite)
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} DATETIME`);
    console.log(`   ✅ Colonne ${columnName} ajoutée à ${tableName}`);
    return true;
  } catch (err) {
    console.error(`   ❌ Erreur lors de l'ajout de ${columnName} à ${tableName}:`, err.message);
    throw err;
  }
}

/**
 * Met à jour les valeurs NULL avec la date actuelle
 */
function updateNullTimestamps(tableName, columnName, defaultValue = 'CURRENT_TIMESTAMP') {
  const result = db.prepare(`
    UPDATE ${tableName}
    SET ${columnName} = ${defaultValue}
    WHERE ${columnName} IS NULL
  `).run();

  if (result.changes > 0) {
    console.log(`   ✅ ${result.changes} enregistrement(s) mis à jour dans ${tableName}.${columnName}`);
  }
  return result.changes;
}

try {
  db.exec('BEGIN TRANSACTION');

  // 1. Table users
  console.log('📝 Mise à jour de la table users...');
  if (addTimestampColumn('users', 'updated_at')) {
    updateNullTimestamps('users', 'updated_at', 'created_at');
  }

  // 2. Table mining_records
  console.log('\n📝 Mise à jour de la table mining_records...');
  const addedCreatedAt = addTimestampColumn('mining_records', 'created_at');
  const addedUpdatedAt = addTimestampColumn('mining_records', 'updated_at');

  if (addedCreatedAt) {
    // Utiliser synced_at comme valeur par défaut pour created_at
    updateNullTimestamps('mining_records', 'created_at', 'synced_at');
  }
  if (addedUpdatedAt) {
    // Utiliser synced_at comme valeur par défaut pour updated_at
    updateNullTimestamps('mining_records', 'updated_at', 'synced_at');
  }

  // 3. Table ore_types - DEPRECATED
  // Note: La table ore_types n'est plus utilisée (remplacée par le service SDE)
  // Cette migration est conservée pour la compatibilité avec les anciennes bases de données
  console.log('\n📝 Migration de la table ore_types (deprecated)...');

  // Vérifier si la table existe encore
  const tableCheckResult = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='ore_types'
  `).get();

  if (tableCheckResult) {
    console.log('   ℹ️  Table ore_types détectée (legacy) - migration des timestamps...');

    // Vérifier si cached_at existe
    const hasCachedAt = columnExists('ore_types', 'cached_at');
    const hasCreatedAt = columnExists('ore_types', 'created_at');

    if (hasCachedAt && !hasCreatedAt) {
      // Recréer la table pour renommer cached_at en created_at
      console.log('   🔄 Renommage de cached_at en created_at...');

      db.exec(`
        -- Créer une nouvelle table avec le bon schéma
        CREATE TABLE ore_types_new (
          type_id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          volume REAL DEFAULT 1,
          created_at DATETIME,
          updated_at DATETIME
        );

        -- Copier les données
        INSERT INTO ore_types_new (type_id, name, volume, created_at, updated_at)
        SELECT type_id, name, volume, cached_at, cached_at FROM ore_types;

        -- Supprimer l'ancienne table
        DROP TABLE ore_types;

        -- Renommer la nouvelle table
        ALTER TABLE ore_types_new RENAME TO ore_types;
      `);

      console.log('   ✅ Table ore_types migrée avec succès');
    } else {
      addTimestampColumn('ore_types', 'created_at');
      addTimestampColumn('ore_types', 'updated_at');

      updateNullTimestamps('ore_types', 'created_at');
      updateNullTimestamps('ore_types', 'updated_at', 'created_at');
    }

    console.log('   💡 Note: Cette table peut être supprimée manuellement (DROP TABLE ore_types)');
  } else {
    console.log('   ✅ Table ore_types non trouvée (déjà supprimée ou utilisation du SDE)');
  }

  // 4. Table industry_jobs
  console.log('\n📝 Mise à jour de la table industry_jobs...');
  const addedJobCreatedAt = addTimestampColumn('industry_jobs', 'created_at');
  const addedJobUpdatedAt = addTimestampColumn('industry_jobs', 'updated_at');

  if (addedJobCreatedAt) {
    updateNullTimestamps('industry_jobs', 'created_at', 'synced_at');
  }
  if (addedJobUpdatedAt) {
    updateNullTimestamps('industry_jobs', 'updated_at', 'synced_at');
  }

  // 5. Créer des triggers pour mettre à jour automatiquement updated_at
  console.log('\n📝 Création des triggers pour updated_at...');

  const triggers = [
    {
      name: 'update_users_timestamp',
      table: 'users',
      sql: `
        CREATE TRIGGER IF NOT EXISTS update_users_timestamp
        AFTER UPDATE ON users
        FOR EACH ROW
        WHEN NEW.updated_at = OLD.updated_at OR NEW.updated_at IS NULL
        BEGIN
          UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
      `
    },
    {
      name: 'update_characters_timestamp',
      table: 'characters',
      sql: `
        CREATE TRIGGER IF NOT EXISTS update_characters_timestamp
        AFTER UPDATE ON characters
        FOR EACH ROW
        WHEN NEW.updated_at = OLD.updated_at OR NEW.updated_at IS NULL
        BEGIN
          UPDATE characters SET updated_at = CURRENT_TIMESTAMP WHERE character_id = NEW.character_id;
        END;
      `
    },
    {
      name: 'update_mining_records_timestamp',
      table: 'mining_records',
      sql: `
        CREATE TRIGGER IF NOT EXISTS update_mining_records_timestamp
        AFTER UPDATE ON mining_records
        FOR EACH ROW
        WHEN NEW.updated_at = OLD.updated_at OR NEW.updated_at IS NULL
        BEGIN
          UPDATE mining_records SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
      `
    },
    {
      name: 'update_ore_types_timestamp',
      table: 'ore_types',
      sql: `
        CREATE TRIGGER IF NOT EXISTS update_ore_types_timestamp
        AFTER UPDATE ON ore_types
        FOR EACH ROW
        WHEN NEW.updated_at = OLD.updated_at OR NEW.updated_at IS NULL
        BEGIN
          UPDATE ore_types SET updated_at = CURRENT_TIMESTAMP WHERE type_id = NEW.type_id;
        END;
      `
    },
    {
      name: 'update_industry_jobs_timestamp',
      table: 'industry_jobs',
      sql: `
        CREATE TRIGGER IF NOT EXISTS update_industry_jobs_timestamp
        AFTER UPDATE ON industry_jobs
        FOR EACH ROW
        WHEN NEW.updated_at = OLD.updated_at OR NEW.updated_at IS NULL
        BEGIN
          UPDATE industry_jobs SET updated_at = CURRENT_TIMESTAMP WHERE job_id = NEW.job_id;
        END;
      `
    }
  ];

  for (const trigger of triggers) {
    try {
      db.exec(trigger.sql);
      console.log(`   ✅ Trigger ${trigger.name} créé pour ${trigger.table}`);
    } catch (err) {
      // Les triggers peuvent déjà exister, ignorer l'erreur
      if (!err.message.includes('already exists')) {
        throw err;
      }
      console.log(`   ℹ️  Trigger ${trigger.name} existe déjà pour ${trigger.table}`);
    }
  }

  // 6. Mettre à jour les valeurs NULL restantes
  console.log('\n📝 Finalisation : mise à jour des valeurs NULL...');

  const now = new Date().toISOString();
  const updates = [
    { table: 'users', column: 'updated_at' },
    { table: 'mining_records', column: 'created_at' },
    { table: 'mining_records', column: 'updated_at' },
    { table: 'ore_types', column: 'created_at' },
    { table: 'ore_types', column: 'updated_at' },
    { table: 'industry_jobs', column: 'created_at' },
    { table: 'industry_jobs', column: 'updated_at' }
  ];

  for (const update of updates) {
    try {
      const result = db.prepare(`
        UPDATE ${update.table}
        SET ${update.column} = ?
        WHERE ${update.column} IS NULL
      `).run(now);

      if (result.changes > 0) {
        console.log(`   ✅ ${result.changes} valeur(s) NULL mise(s) à jour dans ${update.table}.${update.column}`);
      }
    } catch (err) {
      // Ignorer si la colonne n'existe pas
      if (!err.message.includes('no such column')) {
        throw err;
      }
    }
  }

  db.exec('COMMIT');

  console.log('\n✅ Migration des timestamps terminée avec succès !');
  console.log('\n📊 Résumé :');
  console.log('   - Colonnes created_at et updated_at ajoutées aux tables');
  console.log('   - Triggers créés pour mise à jour automatique de updated_at');
  console.log('   - Enregistrements existants mis à jour');
  console.log('\n🎉 Votre base de données est maintenant auditée avec des timestamps !');

} catch (error) {
  db.exec('ROLLBACK');
  console.error('\n❌ Erreur lors de la migration:', error.message);
  console.error('\n🔄 Transaction annulée. Base de données non modifiée.');
  console.error('\nStack trace:', error.stack);
  process.exit(1);
} finally {
  db.close();
}
