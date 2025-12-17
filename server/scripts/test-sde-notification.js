import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import sdeManager from '../services/sdeManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env.development') });

/**
 * Test du système de notification automatique
 * Simule ce que fait le serveur au démarrage
 */
async function testNotification() {
  console.log('🧪 Testing automatic SDE notification...\n');

  console.log('Environment variables:');
  console.log(`  DISCORD_BOT_TOKEN: ${process.env.DISCORD_BOT_TOKEN ? '✅ Set' : '❌ Not set'}`);
  console.log(`  DISCORD_ADMIN_USER_ID: ${process.env.DISCORD_ADMIN_USER_ID || '❌ Not set'}`);
  console.log('');

  try {
    console.log('📋 Running checkForUpdates(true) - same as server startup...\n');

    const result = await sdeManager.checkForUpdates(true); // notify = true

    console.log('\n📊 Check result:');
    console.log(`  Has update: ${result.hasUpdate}`);
    console.log(`  Current version: ${result.currentVersion?.buildNumber || 'N/A'}`);
    console.log(`  Latest version: ${result.latestVersion?.buildNumber || 'N/A'}`);

    if (result.hasUpdate) {
      console.log('\n✅ Update available - Discord notification should have been sent!');
      console.log('   Check your Discord DMs.');
    } else {
      console.log('\n✅ Already up to date - no notification sent.');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testNotification();
