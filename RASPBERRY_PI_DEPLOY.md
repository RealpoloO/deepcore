# Guide de Déploiement sur Raspberry Pi

## 🍓 Configuration Raspberry Pi

### Prérequis
- Raspberry Pi 3B+ ou 4 (2GB RAM minimum recommandé)
- Raspberry Pi OS Lite 64-bit
- Connexion Internet stable
- Nom de domaine avec DNS configuré
- Accès SSH à la Raspberry Pi

## 📦 Installation Initiale

### 1. Préparation du système

```bash
# Connexion SSH
ssh pi@votre-raspberry-ip

# Mise à jour du système
sudo apt update && sudo apt upgrade -y

# Installation des outils essentiels
sudo apt install -y git nginx certbot python3-certbot-nginx curl

# Installation de Node.js 18 (compatible ARM)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Vérification
node --version  # Doit afficher v18.x ou supérieur
npm --version
```

### 2. Installation de PM2

```bash
# Installation globale de PM2
sudo npm install -g pm2

# Configuration pour démarrage automatique
pm2 startup systemd
# Copier et exécuter la commande affichée
```

### 3. Clonage du projet

```bash
# Cloner dans le répertoire home
cd /home/pi
git clone https://github.com/RealpoloO/whatdidimine.git
cd whatdidimine

# Créer le dossier de logs
mkdir -p logs
```

## 🔧 Configuration

### 1. Fichier .env.production

```bash
cd /home/pi/whatdidimine
nano .env.production
```

Remplir avec vos valeurs :

```env
# Eve Online OAuth
EVE_CLIENT_ID=votre_production_client_id
EVE_CLIENT_SECRET=votre_production_secret
EVE_CALLBACK_URL=https://votredomaine.com/api/auth/callback

# Discord OAuth
DISCORD_CLIENT_ID=votre_discord_client_id
DISCORD_CLIENT_SECRET=votre_discord_secret
DISCORD_CALLBACK_URL=https://votredomaine.com/api/discord/callback
DISCORD_BOT_TOKEN=votre_bot_token

# URLs
CLIENT_URL=https://votredomaine.com

# Session (générer un secret fort)
SESSION_SECRET=VOTRE_SECRET_GENERE

# Port
PORT=3000
```

### 2. Générer SESSION_SECRET

```bash
# Sur la Raspberry Pi
openssl rand -base64 32
```

### 3. Configuration Eve Online

1. Allez sur https://developers.eveonline.com/
2. Créez/modifiez votre application
3. Callback URL : `https://votredomaine.com/api/auth/callback`
4. Scopes nécessaires :
   - `esi-wallet.read_character_wallet.v1`
   - `esi-industry.read_character_jobs.v1`
   - `esi-universe.read_structures.v1`

### 4. Configuration Discord

1. Allez sur https://discord.com/developers/applications
2. Créez une application production
3. OAuth2 → Redirects : `https://votredomaine.com/api/discord/callback`
4. Bot → Créez un bot et copiez le token

## 🚀 Déploiement

### 1. Installation des dépendances

```bash
cd /home/pi/whatdidimine

# Installer toutes les dépendances
npm run install:all
```

### 2. Build du client React

```bash
cd client
npm run build
cd ..
```

### 3. Démarrage avec PM2

```bash
# Démarrer l'application
pm2 start ecosystem.config.js

# Sauvegarder la configuration PM2
pm2 save

# Vérifier le statut
pm2 status

# Voir les logs
pm2 logs whatdidimine
```

## 🌐 Configuration Nginx

### 1. Copier la configuration

```bash
# Éditer la configuration
sudo nano /etc/nginx/sites-available/whatdidimine
```

Copier le contenu de `nginx-pi.conf` et remplacer `VOTRE_DOMAINE.com` par votre domaine réel.

### 2. Activer le site

```bash
# Créer le lien symbolique
sudo ln -s /etc/nginx/sites-available/whatdidimine /etc/nginx/sites-enabled/

# Désactiver le site par défaut
sudo rm /etc/nginx/sites-enabled/default

# Tester la configuration
sudo nginx -t

# Recharger Nginx
sudo systemctl reload nginx
```

### 3. Certificat SSL avec Let's Encrypt

```bash
# Obtenir le certificat (remplacer votredomaine.com)
sudo certbot --nginx -d votredomaine.com

# Certbot va automatiquement configurer SSL dans Nginx
# Suivre les instructions à l'écran

# Tester le renouvellement automatique
sudo certbot renew --dry-run
```

## 🔒 Configuration du Routeur

### Port Forwarding

Sur votre routeur, configurez :
- Port externe 80 → IP Raspberry Pi port 80 (HTTP)
- Port externe 443 → IP Raspberry Pi port 443 (HTTPS)

### IP Statique Locale

Configurez une IP statique pour votre Raspberry Pi dans votre routeur (ex: 192.168.1.100)

### DNS

Configurez votre domaine pour pointer vers votre IP publique :
- Type A : `votredomaine.com` → Votre IP publique

## 🔄 Mises à Jour

### Script de déploiement automatique

```bash
# Rendre le script exécutable
chmod +x deploy-pi.sh

# Lancer une mise à jour
./deploy-pi.sh votredomaine.com
```

### Mise à jour manuelle

```bash
cd /home/pi/whatdidimine
git pull origin master
npm ci --production
cd client && npm ci && npm run build && cd ..
pm2 restart whatdidimine
```

## 📊 Monitoring

### Commandes PM2 utiles

```bash
pm2 status                    # Statut de l'application
pm2 logs whatdidimine         # Logs en temps réel
pm2 logs whatdidimine --lines 100  # 100 dernières lignes
pm2 monit                     # Interface de monitoring
pm2 restart whatdidimine      # Redémarrer
pm2 stop whatdidimine         # Arrêter
pm2 delete whatdidimine       # Supprimer
```

### Logs système

```bash
# Logs Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Logs application
tail -f /home/pi/whatdidimine/logs/out.log
tail -f /home/pi/whatdidimine/logs/err.log
```

## 💾 Sauvegardes

### Script de sauvegarde automatique

```bash
# Créer le script
sudo nano /home/pi/backup-whatdidimine.sh
```

Contenu :

```bash
#!/bin/bash
BACKUP_DIR="/home/pi/backups"
DB_FILE="/home/pi/whatdidimine/data/database.sqlite"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
cp $DB_FILE "$BACKUP_DIR/database_$DATE.sqlite"

# Garder seulement les 30 dernières sauvegardes
find $BACKUP_DIR -name "database_*.sqlite" -mtime +30 -delete

echo "✅ Sauvegarde créée : database_$DATE.sqlite"
```

Rendre exécutable et ajouter au cron :

```bash
chmod +x /home/pi/backup-whatdidimine.sh

# Éditer crontab
crontab -e

# Ajouter (sauvegarde quotidienne à 3h du matin)
0 3 * * * /home/pi/backup-whatdidimine.sh >> /home/pi/backups/backup.log 2>&1
```

## ⚡ Optimisations Raspberry Pi

### 1. Swap (si RAM limitée)

```bash
# Augmenter le swap à 2GB
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile
# Changer CONF_SWAPSIZE=2048
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

### 2. Limiter l'utilisation mémoire

Le fichier `ecosystem.config.js` est déjà configuré avec `max_memory_restart: '512M'`

### 3. Optimiser SQLite

Dans `.env.production`, ajouter :

```env
# Optimisations SQLite pour Raspberry Pi
SQLITE_CACHE_SIZE=2000
SQLITE_PAGE_SIZE=4096
```

## 🛠️ Dépannage

### L'application ne démarre pas

```bash
pm2 logs whatdidimine --lines 50
# Vérifier les erreurs dans les logs
```

### Erreur de mémoire

```bash
# Vérifier l'utilisation mémoire
free -h
pm2 monit

# Redémarrer si nécessaire
pm2 restart whatdidimine
```

### Nginx ne démarre pas

```bash
sudo nginx -t  # Tester la configuration
sudo systemctl status nginx
sudo journalctl -u nginx -n 50
```

### Problème de certificat SSL

```bash
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

### Base de données verrouillée

```bash
pm2 restart whatdidimine
```

## 🔐 Sécurité

### Firewall

```bash
# Installer ufw
sudo apt install -y ufw

# Configurer les règles
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS

# Activer
sudo ufw enable

# Vérifier
sudo ufw status
```

### Fail2Ban (protection SSH)

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### Mise à jour automatique de sécurité

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## 📈 Performance

### Test de charge

La Raspberry Pi peut gérer environ 50-100 requêtes simultanées. Pour un usage personnel/petit groupe, c'est largement suffisant.

### Monitoring température

```bash
# Vérifier la température
vcgencmd measure_temp

# Si > 70°C, envisager un ventilateur/dissipateur
```

## ✅ Checklist finale

- [ ] Node.js 18+ installé
- [ ] PM2 installé et configuré au démarrage
- [ ] Projet cloné et dépendances installées
- [ ] `.env.production` configuré avec les bonnes valeurs
- [ ] Client React construit (`npm run build`)
- [ ] PM2 lance l'application (`pm2 status` = online)
- [ ] Nginx installé et configuré
- [ ] Certificat SSL installé via certbot
- [ ] Port forwarding configuré (80, 443)
- [ ] DNS pointe vers votre IP publique
- [ ] Firewall configuré (ufw)
- [ ] Sauvegardes automatiques configurées
- [ ] Application accessible via https://votredomaine.com
- [ ] Connexion Eve Online fonctionne
- [ ] Connexion Discord fonctionne
- [ ] Alertes Discord testées

## 🆘 Support

En cas de problème, vérifier dans l'ordre :
1. `pm2 logs whatdidimine` - Logs de l'application
2. `sudo systemctl status nginx` - Statut Nginx
3. `sudo tail -f /var/log/nginx/error.log` - Erreurs Nginx
4. Vérifier que les ports 80/443 sont bien forwardés
5. Vérifier que le DNS pointe vers votre IP publique
