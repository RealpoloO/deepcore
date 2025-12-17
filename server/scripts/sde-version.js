import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import sdeManager from '../services/sdeManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env.development') });

/**
 * Script CLI pour afficher la version SDE actuelle
 */
async function main() {
  try {
    const version = await sdeManager.getCurrentVersion();

    if (!version) {
      console.log('❌ No SDE version found');
      process.exit(1);
    }

    console.log(`📦 Current SDE version: Build ${version.buildNumber}`);
    console.log(`📅 Release date: ${version.releaseDate}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
