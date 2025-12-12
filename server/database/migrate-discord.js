import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '../../data/whatdidimine.db');

const db = new Database(dbPath);

console.log('🔧 Starting Discord columns migration...');

try {
  // Add Discord columns to users table
  const migrations = [
    'ALTER TABLE users ADD COLUMN discord_id TEXT',
    'ALTER TABLE users ADD COLUMN discord_username TEXT',
    'ALTER TABLE users ADD COLUMN discord_access_token TEXT',
    'ALTER TABLE users ADD COLUMN discord_refresh_token TEXT',
    'ALTER TABLE users ADD COLUMN discord_token_expires_at DATETIME',
    // Add alert columns to industry_jobs table
    'ALTER TABLE industry_jobs ADD COLUMN alert_enabled BOOLEAN DEFAULT 0',
    'ALTER TABLE industry_jobs ADD COLUMN alert_sent BOOLEAN DEFAULT 0'
  ];

  const errors = [];

  migrations.forEach((sql, index) => {
    try {
      db.exec(sql);
    } catch (err) {
      if (!err.message.includes('duplicate column name')) {
        errors.push(`Migration ${index + 1} failed: ${err.message}`);
      }
    }
  });

  if (errors.length > 0) {
    console.error('⚠️  Some migrations failed:');
    errors.forEach(e => console.error(`  - ${e}`));
  } else {
    console.log('✅ Discord columns migration completed successfully!');
  }
} catch (error) {
  console.error('❌ Migration error:', error.message);
  process.exit(1);
} finally {
  db.close();
}
