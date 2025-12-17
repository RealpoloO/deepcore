import axios from 'axios';

const DISCORD_API = 'https://discord.com/api/v10';

class DiscordService {
  constructor() {
    // Bot token loaded lazily from environment
  }

  /**
   * Get bot token from environment (lazy loading)
   */
  get botToken() {
    return process.env.DISCORD_BOT_TOKEN;
  }

  /**
   * Send a Direct Message to a Discord user
   * @param {string} userId - Discord user ID
   * @param {string} message - Message content
   * @param {object} embed - Optional embed object
   */
  async sendDM(userId, message, embed = null) {
    try {
      // Create DM channel
      const channelResponse = await axios.post(
        `${DISCORD_API}/users/@me/channels`,
        { recipient_id: userId },
        {
          headers: {
            Authorization: `Bot ${this.botToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const channelId = channelResponse.data.id;

      // Send message
      const payload = { content: message };
      if (embed) {
        payload.embeds = [embed];
      }

      await axios.post(
        `${DISCORD_API}/channels/${channelId}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bot ${this.botToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return { success: true };
    } catch (error) {
      console.error('Discord DM error:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create an embed for SDE update available notification
   * @param {number} currentVersion - Current build number
   * @param {number} newVersion - New available build number
   */
  createSdeUpdateAvailableEmbed(currentVersion, newVersion) {
    return {
      title: '📦 Nouvelle version SDE disponible',
      description: 'Une mise à jour du Static Data Export est disponible.',
      color: 0x00D4FF, // Cyan
      fields: [
        {
          name: 'Version actuelle',
          value: `Build ${currentVersion}`,
          inline: true
        },
        {
          name: 'Nouvelle version',
          value: `Build ${newVersion}`,
          inline: true
        },
        {
          name: 'Commande',
          value: '```bash\nnpm run sde:update\n```',
          inline: false
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'WhatDidIMine - SDE Update Manager'
      }
    };
  }

  /**
   * Create an embed for SDE update success notification
   * @param {number} oldVersion - Previous build number
   * @param {number} newVersion - New build number
   */
  createSdeUpdateSuccessEmbed(oldVersion, newVersion) {
    return {
      title: '✅ SDE mis à jour avec succès',
      description: 'Le Static Data Export a été mis à jour automatiquement.',
      color: 0x00FF00, // Green
      fields: [
        {
          name: 'Ancienne version',
          value: `Build ${oldVersion}`,
          inline: true
        },
        {
          name: 'Nouvelle version',
          value: `Build ${newVersion}`,
          inline: true
        },
        {
          name: 'État',
          value: 'Services rechargés automatiquement',
          inline: false
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'WhatDidIMine - SDE Update Manager'
      }
    };
  }

  /**
   * Create an embed for a completed job notification
   * @param {object} job - Job object
   */
  createJobCompletedEmbed(job) {
    const activityNames = {
      1: '🏭 Manufacturing',
      3: '⏱️ Researching Time Efficiency',
      4: '🔬 Researching Material Efficiency',
      5: '📄 Copying',
      8: '💡 Invention',
      9: '⚗️ Reactions'
    };

    const activityColors = {
      1: 0xFF9900, // Manufacturing - Orange
      3: 0x3371B6, // Research - Blue
      4: 0x3371B6, // Research - Blue
      5: 0x3371B6, // Research - Blue
      8: 0x9B59B6, // Invention - Purple
      9: 0x11E5C9  // Reactions - Cyan
    };

    return {
      title: '✅ Job Terminé !',
      description: `Votre job **${job.product_name}** est terminé !`,
      color: activityColors[job.activity_id] || 0x00D4FF,
      fields: [
        {
          name: 'Type',
          value: activityNames[job.activity_id] || `Activity ${job.activity_id}`,
          inline: true
        },
        {
          name: 'Personnage',
          value: job.character_name,
          inline: true
        },
        {
          name: 'Runs',
          value: job.runs.toString(),
          inline: true
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'WhatDidIMine - Eve Online Industry Tracker'
      }
    };
  }
}

export default new DiscordService();
