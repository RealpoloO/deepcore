import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import sdeManager from '../services/sdeManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env.development') });

/**
 * Script CLI pour télécharger et installer une mise à jour SDE
 */
async function main() {
  try {
    console.log('📦 Starting SDE update process...\n');

    await sdeManager.performUpdate();

    console.log('\n🎉 Update completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Update failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
