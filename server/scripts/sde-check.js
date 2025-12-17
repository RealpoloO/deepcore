import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import sdeManager from '../services/sdeManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env.development') });

/**
 * Script CLI pour vérifier les mises à jour SDE disponibles
 */
async function main() {
  try {
    console.log('🔍 Checking for SDE updates...\n');

    const result = await sdeManager.checkForUpdates(false);

    if (!result.currentVersion || !result.latestVersion) {
      console.log('❌ Unable to check for updates');
      process.exit(1);
    }

    console.log(`📦 Current version: Build ${result.currentVersion.buildNumber} (${result.currentVersion.releaseDate})`);
    console.log(`🌐 Latest version:  Build ${result.latestVersion.buildNumber} (${result.latestVersion.releaseDate})`);

    if (result.hasUpdate) {
      console.log('\n✨ New version available!');
      console.log('📝 To update, run: npm run sde:update');
    } else {
      console.log('\n✅ Already up to date!');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
