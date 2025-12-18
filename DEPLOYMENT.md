# Guide de Déploiement - WhatDidIMine sur Raspberry Pi

Ce guide vous explique comment déployer WhatDidIMine en production sur un Raspberry Pi avec Docker.

## 📋 Prérequis

### Matériel
- Raspberry Pi 4 (recommandé 4GB RAM minimum)
- Carte SD 32GB minimum (ou SSD pour de meilleures performances)
- Connexion Internet stable

### Logiciels requis sur le Raspberry Pi
- Raspberry Pi OS (64-bit recommandé)
- Docker et Docker Compose
- Git

---

## 🔧 Étape 1: Préparer le Raspberry Pi

### 1.1 Connexion SSH au Raspberry Pi

```bash
ssh pi@VOTRE_IP_RASPBERRY
```

Mot de passe par défaut: `raspberry` (changez-le immédiatement!)

### 1.2 Mise à jour du système

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.3 Installation de Docker

```bash
# Installer Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Ajouter votre utilisateur au groupe docker
sudo usermod -aG docker $USER

# Activer Docker au démarrage
sudo systemctl enable docker

# Redémarrer pour appliquer les changements de groupe
sudo reboot
```

Reconnectez-vous après le redémarrage.

### 1.4 Vérifier l'installation Docker

```bash
docker --version
docker-compose --version
```

Vous devriez voir les versions installées.

---

## 📥 Étape 2: Télécharger le code

### 2.1 Cloner le repository

```bash
# Se placer dans le répertoire home
cd ~

# Cloner le projet (remplacez par votre URL git)
git clone https://github.com/VOTRE_USERNAME/whatdidimine.git

# Aller dans le répertoire
cd whatdidimine
```

### 2.2 Alternative: Transférer depuis votre PC

Si vous n'utilisez pas Git, transférez le dossier depuis votre PC:

```bash
# Sur votre PC Windows (PowerShell)
scp -r C:\Users\Polo\Desktop\whatdidimine-master pi@VOTRE_IP_RASPBERRY:~/whatdidimine
```

---

## ⚙️ Étape 3: Configuration

### 3.1 Créer le fichier de configuration production

```bash
cd ~/whatdidimine
cp .env.production.example .env.production
nano .env.production
```

### 3.2 Configurer les variables d'environnement

Éditez `.env.production` avec vos vraies valeurs:

```bash
# Eve Online SSO Configuration
EVE_CLIENT_ID=votre_client_id
EVE_CLIENT_SECRET=votre_client_secret
EVE_CALLBACK_URL=https://votre-domaine.com/api/auth/callback

# Server Configuration
SESSION_SECRET=$(openssl rand -hex 32)  # Générez une vraie clé secrète!

# Frontend URL
CLIENT_URL=https://votre-domaine.com

# Discord Bot Configuration
DISCORD_CLIENT_ID=votre_discord_app_id
DISCORD_CLIENT_SECRET=votre_discord_secret
DISCORD_CALLBACK_URL=https://votre-domaine.com/api/discord/callback
DISCORD_BOT_TOKEN=votre_bot_token
DISCORD_ADMIN_USER_ID=votre_user_id
```

**Important**: Pour générer un SESSION_SECRET sécurisé:
```bash
openssl rand -hex 32
```

Sauvegardez avec `Ctrl+O`, puis quittez avec `Ctrl+X`.

### 3.3 Télécharger les SDE (Static Data Export)

Les SDE sont nécessaires au fonctionnement. Vous pouvez:

**Option 1: Transférer depuis votre PC** (recommandé - plus rapide)
```bash
# Sur votre PC Windows
scp -r "C:\Users\Polo\Desktop\whatdidimine-master\eve-online-static-data-3133773-jsonl" pi@VOTRE_IP_RASPBERRY:~/whatdidimine/
```

**Option 2: Télécharger sur le Raspberry Pi**
```bash
cd ~/whatdidimine
wget https://developers.eveonline.com/static-data/eve-online-static-data-3142455-jsonl.zip
unzip eve-online-static-data-3142455-jsonl.zip
rm eve-online-static-data-3142455-jsonl.zip
```

---

## 🚀 Étape 4: Déploiement

### 4.1 Rendre les scripts exécutables

```bash
chmod +x deploy.sh backup.sh
```

### 4.2 Lancer le déploiement

```bash
./deploy.sh
```

Ce script va:
1. ✅ Vérifier la configuration
2. 📁 Créer les répertoires nécessaires
3. 🔨 Construire l'image Docker
4. ▶️  Démarrer le container
5. 🔍 Vérifier que tout fonctionne

**Note**: Le premier build peut prendre 10-20 minutes sur Raspberry Pi.

### 4.3 Vérifier le statut

```bash
# Voir les containers en cours
docker-compose ps

# Voir les logs en temps réel
docker-compose logs -f

# Voir uniquement les dernières lignes
docker-compose logs --tail=50
```

Pour sortir des logs, appuyez sur `Ctrl+C`.

---

## 🌐 Étape 5: Accès à l'application

### 5.1 Accès local

Depuis votre réseau local:
```
http://IP_DU_RASPBERRY_PI:3000
```

### 5.2 Accès depuis Internet (optionnel)

Pour rendre l'application accessible depuis Internet, vous avez plusieurs options:

#### Option A: Reverse Proxy avec Nginx (recommandé)

```bash
sudo apt install nginx certbot python3-certbot-nginx -y

# Créer la configuration Nginx
sudo nano /etc/nginx/sites-available/whatdidimine
```

Contenu du fichier:
```nginx
server {
    listen 80;
    server_name votre-domaine.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Activer le site:
```bash
sudo ln -s /etc/nginx/sites-available/whatdidimine /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Obtenir un certificat SSL gratuit
sudo certbot --nginx -d votre-domaine.com
```

#### Option B: Cloudflare Tunnel (sans ouvrir de ports)

Plus simple et plus sécurisé, consultez: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/

---

## 🔧 Commandes Utiles

### Gestion du container

```bash
# Démarrer
docker-compose up -d

# Arrêter
docker-compose down

# Redémarrer
docker-compose restart

# Reconstruire après modifications du code
docker-compose up -d --build

# Voir les logs
docker-compose logs -f

# Voir l'utilisation des ressources
docker stats
```

### Sauvegarde

```bash
# Créer une sauvegarde
./backup.sh

# Les sauvegardes sont dans le dossier backups/
ls -lh backups/
```

### Mise à jour de l'application

```bash
cd ~/whatdidimine

# Sauvegarder avant de mettre à jour
./backup.sh

# Récupérer les dernières modifications
git pull

# Reconstruire et redémarrer
docker-compose down
docker-compose up -d --build
```

### Mise à jour du SDE

```bash
# Vérifier la version actuelle
docker-compose exec whatdidimine node server/scripts/sde-version.js

# Vérifier les mises à jour disponibles
docker-compose exec whatdidimine node server/scripts/sde-check.js

# Installer la mise à jour
docker-compose exec whatdidimine node server/scripts/sde-update.js
```

---

## 📊 Monitoring

### Voir l'état de santé

```bash
# Health check manuel
curl http://localhost:3000/api/health

# Voir les ressources utilisées
docker stats whatdidimine
```

### Logs

```bash
# Logs de l'application
docker-compose logs -f

# Logs système (dans le volume)
tail -f logs/combined.log
tail -f logs/error.log
```

---

## 🛡️ Sécurité

### Recommandations importantes

1. **Changez le mot de passe du Raspberry Pi**
   ```bash
   passwd
   ```

2. **Configurez le pare-feu**
   ```bash
   sudo apt install ufw -y
   sudo ufw allow 22/tcp    # SSH
   sudo ufw allow 80/tcp    # HTTP
   sudo ufw allow 443/tcp   # HTTPS
   sudo ufw enable
   ```

3. **Gardez le système à jour**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

4. **Sauvegardes régulières**
   ```bash
   # Ajouter au crontab pour sauvegardes automatiques quotidiennes
   crontab -e

   # Ajouter cette ligne:
   0 2 * * * cd ~/whatdidimine && ./backup.sh
   ```

5. **Ne partagez JAMAIS vos fichiers .env.production**

---

## ❗ Dépannage

### Le container ne démarre pas

```bash
# Voir les logs d'erreur
docker-compose logs

# Vérifier la configuration
docker-compose config

# Supprimer et recréer complètement
docker-compose down -v
docker-compose up -d
```

### L'application est lente

```bash
# Vérifier l'utilisation CPU/RAM
docker stats

# Le Raspberry Pi peut avoir besoin de swap
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile
# Changez CONF_SWAPSIZE=100 à CONF_SWAPSIZE=2048
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

### Erreurs de mémoire

Le build peut échouer par manque de mémoire. Solutions:
1. Augmenter le swap (voir ci-dessus)
2. Fermer les autres applications
3. Build sur votre PC et transférer l'image:

```bash
# Sur votre PC
docker build -t whatdidimine .
docker save whatdidimine > whatdidimine.tar

# Transférer
scp whatdidimine.tar pi@RASPBERRY_IP:~/

# Sur le Raspberry Pi
docker load < whatdidimine.tar
```

### Base de données corrompue

```bash
# Restaurer depuis une sauvegarde
cd ~/whatdidimine
tar -xzf backups/whatdidimine_backup_XXXXXX.tar.gz
docker-compose restart
```

---

## 📞 Support

### Vérifications de base

1. ✅ Docker est installé: `docker --version`
2. ✅ Container en cours: `docker-compose ps`
3. ✅ Port accessible: `curl http://localhost:3000/api/health`
4. ✅ Variables d'environnement: vérifier `.env.production`
5. ✅ SDE présents: `ls -la eve-online-static-data-*`

### Fichiers de log

- Application: `docker-compose logs`
- Système: `logs/combined.log` et `logs/error.log`
- Docker: `sudo journalctl -u docker`

---

## 🎯 Checklist de déploiement

- [ ] Raspberry Pi mis à jour
- [ ] Docker installé
- [ ] Code téléchargé
- [ ] `.env.production` configuré avec vraies valeurs
- [ ] SESSION_SECRET généré (32+ caractères aléatoires)
- [ ] SDE téléchargés
- [ ] `deploy.sh` exécuté avec succès
- [ ] Application accessible sur `http://IP:3000`
- [ ] Health check OK: `http://IP:3000/api/health`
- [ ] Authentification Eve Online testée
- [ ] Bot Discord configuré et fonctionnel
- [ ] Sauvegarde configurée (cron)
- [ ] Firewall configuré
- [ ] (Optionnel) Nginx + SSL configuré
- [ ] (Optionnel) Nom de domaine pointant vers le Raspberry Pi

---

## 📚 Ressources

- [Documentation Docker](https://docs.docker.com/)
- [Raspberry Pi Documentation](https://www.raspberrypi.org/documentation/)
- [Eve Online Developers](https://developers.eveonline.com/)
- [Discord Developer Portal](https://discord.com/developers/applications)

---

**Bon déploiement! 🚀**
