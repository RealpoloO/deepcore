import dotenv from 'dotenv';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.development
dotenv.config({ path: join(__dirname, '../../.env.development') });

const DISCORD_API = 'https://discord.com/api/v10';

async function checkBot() {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const userId = process.env.DISCORD_ADMIN_USER_ID;

  console.log('🔍 Discord Bot Diagnostic\n');
  console.log(`Bot Token: ${botToken ? botToken.substring(0, 20) + '...' : 'NOT SET'}`);
  console.log(`Admin User ID: ${userId || 'NOT SET'}\n`);

  if (!botToken) {
    console.error('❌ DISCORD_BOT_TOKEN is not set');
    return;
  }

  // Test 1: Get bot user info
  console.log('📋 Test 1: Getting bot information...');
  try {
    const response = await axios.get(`${DISCORD_API}/users/@me`, {
      headers: {
        Authorization: `Bot ${botToken}`
      }
    });

    console.log('✅ Bot authentication successful!');
    console.log(`   Bot Name: ${response.data.username}#${response.data.discriminator}`);
    console.log(`   Bot ID: ${response.data.id}`);
    console.log(`   Bot: ${response.data.bot ? 'Yes' : 'No'}\n`);
  } catch (error) {
    console.error('❌ Bot authentication failed!');
    console.error(`   Error: ${error.response?.data?.message || error.message}`);
    console.error(`   Status: ${error.response?.status}\n`);

    if (error.response?.status === 401) {
      console.log('💡 Troubleshooting:');
      console.log('   1. Verify your bot token in Discord Developer Portal');
      console.log('   2. Make sure you copied the entire token');
      console.log('   3. If you regenerated the token, update .env.development');
      console.log('   4. Bot tokens start with "MTQ..." or "MTE..." or similar');
    }
    return;
  }

  // Test 2: Check if bot can create DM channel
  console.log('📋 Test 2: Checking DM permissions...');
  if (!userId) {
    console.warn('⚠️  DISCORD_ADMIN_USER_ID not set, skipping DM test\n');
    return;
  }

  try {
    const channelResponse = await axios.post(
      `${DISCORD_API}/users/@me/channels`,
      { recipient_id: userId },
      {
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ DM channel created successfully!');
    console.log(`   Channel ID: ${channelResponse.data.id}\n`);

    // Test 3: Send test message
    console.log('📋 Test 3: Sending test DM...');
    await axios.post(
      `${DISCORD_API}/channels/${channelResponse.data.id}/messages`,
      {
        content: '🧪 **Test de connexion réussi!**\n\nCe message confirme que le bot Discord fonctionne correctement.'
      },
      {
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Test message sent successfully!');
    console.log('   Check your Discord DMs for the test message.\n');

  } catch (error) {
    console.error('❌ DM test failed!');
    console.error(`   Error: ${error.response?.data?.message || error.message}`);

    if (error.response?.status === 403) {
      console.log('\n💡 Troubleshooting:');
      console.log('   1. The bot needs to share a server with you to send DMs');
      console.log('   2. Make sure you haven\'t blocked the bot');
      console.log('   3. Check your Discord privacy settings (allow DMs from server members)');
      console.log('   4. Verify the User ID is correct (right-click your name → Copy ID)');
    } else if (error.response?.status === 404) {
      console.log('\n💡 The user ID might be incorrect');
    }
  }
}

checkBot().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
