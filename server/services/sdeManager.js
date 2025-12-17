import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import readline from 'readline';
import discordService from './discord.js';
import sdeService from './sde.js';
import blueprintService from './blueprintService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Service de gestion des mises à jour du SDE (Static Data Export)
 * Vérifie quotidiennement les nouvelles versions et notifie via Discord webhook
 */
class SdeManager {
  constructor() {
    this.baseUrl = 'https://developers.eveonline.com/static-data';
    this.updateLock = false;
    this.scheduler = null;
  }

  /**
   * Get configuration from environment variables (lazy loading)
   */
  get dataDir() {
    return process.env.SDE_DATA_DIR || 'eve-online-static-data';
  }

  get adminUserId() {
    return process.env.DISCORD_ADMIN_USER_ID;
  }

  get checkInterval() {
    return parseInt(process.env.SDE_CHECK_INTERVAL) || 86400000; // 24h
  }

  /**
   * Trouve le répertoire SDE actuel
   * @returns {string|null} Chemin du répertoire SDE ou null si non trouvé
   */
  findSdeDirectory() {
    try {
      const baseDir = path.join(__dirname, '../..');
      const dirs = fs.readdirSync(baseDir).filter(d =>
        d.startsWith(this.dataDir) && d.endsWith('-jsonl')
      );
      if (dirs.length === 0) return null;
      return path.join(baseDir, dirs[0]);
    } catch (error) {
      console.error('Error finding SDE directory:', error.message);
      return null;
    }
  }

  /**
   * Récupère la version SDE locale actuelle
   * @returns {Promise<{buildNumber: number, releaseDate: string}|null>}
   */
  async getCurrentVersion() {
    try {
      const sdeDir = this.findSdeDirectory();
      if (!sdeDir) {
        console.warn('⚠️  No SDE directory found');
        return null;
      }

      const metadataPath = path.join(sdeDir, '_sde.jsonl');
      if (!fs.existsSync(metadataPath)) {
        console.warn('⚠️  SDE metadata file not found');
        return null;
      }

      const rl = readline.createInterface({
        input: fs.createReadStream(metadataPath),
        crlfDelay: Infinity
      });

      for await (const line of rl) {
        try {
          const data = JSON.parse(line);
          if (data._key === 'sde') {
            return {
              buildNumber: data.buildNumber,
              releaseDate: data.releaseDate || 'Unknown'
            };
          }
        } catch (err) {
          continue;
        }
      }

      return null;
    } catch (error) {
      console.error('Error reading current SDE version:', error.message);
      return null;
    }
  }

  /**
   * Récupère la dernière version SDE disponible depuis l'API CCP
   * @returns {Promise<{buildNumber: number, releaseDate: string}|null>}
   */
  async getLatestVersion() {
    try {
      const url = `${this.baseUrl}/tranquility/latest.jsonl`;
      const response = await axios.get(url, {
        timeout: 10000,
        responseType: 'text' // Force text response to ensure we get a string
      });

      const lines = response.data.split('\n').filter(line => line.trim());
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data._key === 'sde') {
            return {
              buildNumber: data.buildNumber,
              releaseDate: data.releaseDate || 'Unknown'
            };
          }
        } catch (err) {
          continue;
        }
      }

      return null;
    } catch (error) {
      console.error('Error fetching latest SDE version:', error.message);
      return null;
    }
  }

  /**
   * Vérifie s'il existe une mise à jour SDE
   * @param {boolean} notify - Envoyer une notification Discord si mise à jour disponible
   * @returns {Promise<{hasUpdate: boolean, currentVersion: object, latestVersion: object}>}
   */
  async checkForUpdates(notify = false) {
    try {
      const current = await this.getCurrentVersion();
      const latest = await this.getLatestVersion();

      if (!current || !latest) {
        return { hasUpdate: false, currentVersion: current, latestVersion: latest };
      }

      const hasUpdate = latest.buildNumber > current.buildNumber;

      console.log(`🔍 Check results: hasUpdate=${hasUpdate}, notify=${notify}, adminUserId=${this.adminUserId || 'NOT SET'}`);

      if (hasUpdate && notify && this.adminUserId) {
        await this.sendDiscordNotification(current.buildNumber, latest.buildNumber);
      } else if (hasUpdate && notify && !this.adminUserId) {
        console.warn('⚠️  Update available but no admin user ID configured - skipping notification');
      }

      return { hasUpdate, currentVersion: current, latestVersion: latest };
    } catch (error) {
      console.error('Error checking for SDE updates:', error.message);
      return { hasUpdate: false, currentVersion: null, latestVersion: null };
    }
  }

  /**
   * Télécharge le SDE depuis l'API CCP
   * @param {number|string} buildNumber - Build number ou 'latest'
   * @returns {Promise<string>} Chemin du fichier ZIP téléchargé
   */
  async downloadSDE(buildNumber = 'latest') {
    const url = `${this.baseUrl}/eve-online-static-data-${buildNumber}-jsonl.zip`;
    const tempDir = path.join(__dirname, '../../temp');
    const zipPath = path.join(tempDir, `sde-${buildNumber}.zip`);

    // Créer le répertoire temp s'il n'existe pas
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    console.log(`📥 Downloading SDE from: ${url}`);

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 600000, // 10 minutes
      onDownloadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          if (percent % 10 === 0) {
            console.log(`   Progress: ${percent}%`);
          }
        }
      }
    });

    fs.writeFileSync(zipPath, response.data);
    console.log(`✅ Download complete: ${zipPath}`);

    return zipPath;
  }

  /**
   * Extrait le fichier ZIP SDE
   * @param {string} zipPath - Chemin du fichier ZIP
   * @returns {Promise<string>} Chemin du répertoire extrait
   */
  async extractSDE(zipPath) {
    console.log(`📦 Extracting SDE...`);

    const zip = new AdmZip(zipPath);
    const tempDir = path.join(__dirname, '../../temp');
    const extractDir = path.join(tempDir, 'extracted');

    // Nettoyer le répertoire d'extraction s'il existe
    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
    }

    zip.extractAllTo(extractDir, true);

    // Trouver le répertoire SDE extrait
    const entries = fs.readdirSync(extractDir);
    const sdeDir = entries.find(e =>
      e.startsWith(this.dataDir) && e.endsWith('-jsonl')
    );

    if (!sdeDir) {
      throw new Error('SDE directory not found in extracted files');
    }

    const fullPath = path.join(extractDir, sdeDir);

    // Valider que les fichiers essentiels existent
    const requiredFiles = ['types.jsonl', 'blueprints.jsonl', '_sde.jsonl'];
    for (const file of requiredFiles) {
      const filePath = path.join(fullPath, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Required file not found: ${file}`);
      }
    }

    console.log(`✅ Extraction complete: ${fullPath}`);
    return fullPath;
  }

  /**
   * Installe le SDE extrait (remplacement atomique)
   * @param {string} extractedDir - Chemin du répertoire SDE extrait
   * @returns {Promise<void>}
   */
  async installSDE(extractedDir) {
    console.log(`📁 Installing SDE...`);

    const baseDir = path.join(__dirname, '../..');
    const currentDir = this.findSdeDirectory();
    const targetDirName = path.basename(extractedDir);
    const targetDir = path.join(baseDir, targetDirName);

    // Backup ancien répertoire si existe
    if (currentDir && fs.existsSync(currentDir)) {
      const backupDir = `${currentDir}.old`;

      // Supprimer l'ancien backup s'il existe
      if (fs.existsSync(backupDir)) {
        fs.rmSync(backupDir, { recursive: true, force: true });
      }

      console.log(`   Creating backup: ${backupDir}`);
      fs.renameSync(currentDir, backupDir);
    }

    try {
      // Déplacer le nouveau répertoire
      console.log(`   Moving to: ${targetDir}`);
      fs.renameSync(extractedDir, targetDir);

      // Supprimer le backup si l'installation réussit
      if (currentDir) {
        const backupDir = `${currentDir}.old`;
        if (fs.existsSync(backupDir)) {
          fs.rmSync(backupDir, { recursive: true, force: true });
        }
      }

      console.log(`✅ Installation complete`);
    } catch (error) {
      // Rollback en cas d'erreur
      console.error(`❌ Installation failed, rolling back...`);

      if (currentDir) {
        const backupDir = `${currentDir}.old`;
        if (fs.existsSync(backupDir)) {
          if (fs.existsSync(targetDir)) {
            fs.rmSync(targetDir, { recursive: true, force: true });
          }
          fs.renameSync(backupDir, currentDir);
          console.log(`   Rollback successful`);
        }
      }

      throw error;
    }
  }

  /**
   * Recharge les services SDE et blueprints
   * @returns {Promise<void>}
   */
  async reloadServices() {
    console.log(`🔄 Reloading services...`);

    try {
      await sdeService.loadTypes();
      await blueprintService.loadBlueprints();
      console.log(`✅ Services reloaded successfully`);
    } catch (error) {
      console.error(`❌ Failed to reload services:`, error.message);
      throw error;
    }
  }

  /**
   * Effectue une mise à jour complète du SDE
   * @returns {Promise<void>}
   */
  async performUpdate() {
    if (this.updateLock) {
      console.log('⚠️  Update already in progress');
      return;
    }

    this.updateLock = true;

    try {
      console.log('🚀 Starting SDE update process...\n');

      // 1. Vérifier les versions
      const check = await this.checkForUpdates(false);
      if (!check.hasUpdate) {
        console.log('✅ Already up to date!');
        return;
      }

      const oldVersion = check.currentVersion.buildNumber;
      const newVersion = check.latestVersion.buildNumber;

      console.log(`   Current: Build ${oldVersion}`);
      console.log(`   Latest: Build ${newVersion}\n`);

      // 2. Télécharger
      const zipPath = await this.downloadSDE(newVersion);

      // 3. Extraire
      const extractedDir = await this.extractSDE(zipPath);

      // 4. Installer
      await this.installSDE(extractedDir);

      // 5. Recharger les services
      await this.reloadServices();

      // 6. Nettoyer
      const tempDir = path.join(__dirname, '../../temp');
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }

      // 7. Notifier le succès
      if (this.adminUserId) {
        const embed = discordService.createSdeUpdateSuccessEmbed(oldVersion, newVersion);
        await discordService.sendDM(this.adminUserId, '', embed);
      }

      console.log(`\n✅ SDE update complete! (${oldVersion} → ${newVersion})`);
    } catch (error) {
      console.error(`\n❌ SDE update failed:`, error.message);
      throw error;
    } finally {
      this.updateLock = false;
    }
  }

  /**
   * Envoie un DM Discord sur une mise à jour disponible
   * @param {number} currentVersion - Version actuelle
   * @param {number} newVersion - Nouvelle version disponible
   * @returns {Promise<void>}
   */
  async sendDiscordNotification(currentVersion, newVersion) {
    console.log(`📤 Attempting to send Discord notification...`);
    console.log(`   Admin User ID: ${this.adminUserId || 'NOT SET'}`);
    console.log(`   Version change: ${currentVersion} → ${newVersion}`);

    if (!this.adminUserId) {
      console.log('⚠️  No Discord admin user ID configured');
      return;
    }

    try {
      const embed = discordService.createSdeUpdateAvailableEmbed(currentVersion, newVersion);
      console.log(`   Embed created, sending DM...`);
      await discordService.sendDM(this.adminUserId, '', embed);
      console.log(`✅ Discord DM sent to admin`);
    } catch (error) {
      console.error(`❌ Failed to send Discord DM:`, error.message);
      console.error(error.stack);
    }
  }

  /**
   * Démarre le scheduler de vérification quotidienne
   * @returns {void}
   */
  startScheduler() {
    if (this.scheduler) {
      console.log('⚠️  Scheduler already running');
      return;
    }

    console.log(`📅 SDE update checker scheduled (every ${this.checkInterval / 3600000} hours)`);

    this.scheduler = setInterval(async () => {
      console.log('🔍 Scheduled SDE update check...');
      await this.checkForUpdates(true); // notify = true
    }, this.checkInterval);
  }

  /**
   * Arrête le scheduler
   * @returns {void}
   */
  stopScheduler() {
    if (this.scheduler) {
      clearInterval(this.scheduler);
      this.scheduler = null;
      console.log('⏹️  Scheduler stopped');
    }
  }
}

export default new SdeManager();
