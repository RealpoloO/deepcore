import dbHelpers from '../database/helpers.js';
import discordService from './discord.js';

class JobAlertService {
  constructor() {
    this.checkInterval = null;
  }

  /**
   * Start the job checking service (runs every minute)
   */
  start() {
    console.log('🔔 Job Alert Service started - checking every minute');
    
    // Check immediately on start
    this.checkCompletedJobs();
    
    // Then check every minute
    this.checkInterval = setInterval(() => {
      this.checkCompletedJobs();
    }, 60 * 1000); // 1 minute
  }

  /**
   * Stop the service
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      console.log('🔕 Job Alert Service stopped');
    }
  }

  /**
   * Check for completed jobs that need alerts
   */
  async checkCompletedJobs() {
    try {
      const now = new Date().toISOString();

      // Find jobs that:
      // 1. Have alerts enabled
      // 2. Haven't sent alert yet
      // 3. Are completed (end_date <= now)
      const jobsToAlert = await dbHelpers.all(
        `SELECT 
          j.job_id, j.character_id, j.activity_id, j.product_name, 
          j.runs, j.end_date,
          c.character_name, c.user_id,
          u.discord_id, u.discord_username
        FROM industry_jobs j
        JOIN characters c ON j.character_id = c.character_id
        JOIN users u ON c.user_id = u.id
        WHERE j.alert_enabled = 1 
          AND j.alert_sent = 0 
          AND j.end_date <= ?
          AND u.discord_id IS NOT NULL`,
        [now]
      );

      if (jobsToAlert.length === 0) {
        return;
      }

      console.log(`📢 Found ${jobsToAlert.length} job(s) to alert`);

      for (const job of jobsToAlert) {
        await this.sendJobAlert(job);
      }
    } catch (error) {
      console.error('Error checking completed jobs:', error);
    }
  }

  /**
   * Send Discord alert for a completed job
   * @param {object} job - Job object with user info
   */
  async sendJobAlert(job) {
    try {
      const embed = discordService.createJobCompletedEmbed(job);
      
      const result = await discordService.sendDM(
        job.discord_id,
        `🎉 Bonne nouvelle, ${job.discord_username} !`,
        embed
      );

      if (result.success) {
        // Mark alert as sent
        await dbHelpers.run(
          'UPDATE industry_jobs SET alert_sent = 1 WHERE job_id = ?',
          [job.job_id]
        );
        
        console.log(`✅ Alert sent for job ${job.job_id} (${job.product_name}) to ${job.discord_username}`);
      } else {
        console.error(`❌ Failed to send alert for job ${job.job_id}:`, result.error);
      }
    } catch (error) {
      console.error(`Error sending alert for job ${job.job_id}:`, error);
    }
  }
}

export default new JobAlertService();
