import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import discordService from '../services/discord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.development
dotenv.config({ path: join(__dirname, '../../.env.development') });

async function testDiscordDM() {
  console.log('🧪 Testing Discord DM...\n');

  const userId = process.env.DISCORD_ADMIN_USER_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;

  if (!userId) {
    console.error('❌ DISCORD_ADMIN_USER_ID not configured in .env.development');
    process.exit(1);
  }

  if (!botToken) {
    console.error('❌ DISCORD_BOT_TOKEN not configured in .env.development');
    process.exit(1);
  }

  console.log(`📝 User ID: ${userId}`);
  console.log(`📝 Bot Token: ${botToken.substring(0, 10)}...`);
  console.log('');

  // Test simple message
  console.log('📤 Sending test message...');
  const result = await discordService.sendDM(
    userId,
    '🧪 **Test Message**\n\nCeci est un message de test pour vérifier que le bot Discord fonctionne correctement.'
  );

  if (result.success) {
    console.log('✅ Message sent successfully!');
  } else {
    console.error('❌ Failed to send message:', result.error);
  }

  // Test with embed (SDE notification)
  console.log('\n📤 Sending test embed...');
  const embed = discordService.createSdeUpdateAvailableEmbed(3133773, 3142455);
  const embedResult = await discordService.sendDM(userId, '', embed);

  if (embedResult.success) {
    console.log('✅ Embed sent successfully!');
  } else {
    console.error('❌ Failed to send embed:', embedResult.error);
  }
}

testDiscordDM().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
