# Démarrage Rapide - WhatDidIMine sur Raspberry Pi

Guide ultra-rapide pour déployer WhatDidIMine en production.

## 🚀 En 5 minutes

### 1. Sur votre Raspberry Pi

Connectez-vous en SSH:
```bash
ssh pi@VOTRE_IP_RASPBERRY
```

### 2. Installer Docker (si pas déjà fait)

```bash
# Télécharger le script d'installation
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Ajouter votre utilisateur au groupe docker
sudo usermod -aG docker $USER

# Activer Docker au démarrage
sudo systemctl enable docker

# Redémarrer
sudo reboot
```

Reconnectez-vous après le redémarrage.

### 3. Télécharger le projet

**Option A: Depuis Git**
```bash
cd ~
git clone VOTRE_URL_GIT whatdidimine
cd whatdidimine
```

**Option B: Transfert depuis votre PC**
```bash
# Sur votre PC (PowerShell/CMD)
scp -r "C:\Users\Polo\Desktop\whatdidimine-master" pi@VOTRE_IP:~/whatdidimine
```

### 4. Configuration

```bash
cd ~/whatdidimine

# Copier le template de configuration
cp .env.production.example .env.production

# Éditer la configuration
nano .env.production
```

**Valeurs minimales à changer:**
```bash
# Eve Online (créez une app sur https://developers.eveonline.com/applications)
EVE_CLIENT_ID=votre_client_id
EVE_CLIENT_SECRET=votre_client_secret
EVE_CALLBACK_URL=http://VOTRE_IP:3000/api/auth/callback

# Session secret (IMPORTANT - générez une valeur aléatoire!)
SESSION_SECRET=$(openssl rand -hex 32)

# Discord Bot (créez un bot sur https://discord.com/developers/applications)
DISCORD_BOT_TOKEN=votre_bot_token
DISCORD_ADMIN_USER_ID=votre_discord_user_id

# URL publique
CLIENT_URL=http://VOTRE_IP:3000
```

💡 **Astuce**: Pour générer un SESSION_SECRET sécurisé:
```bash
openssl rand -hex 32
```

Sauvegardez avec `Ctrl+O`, quittez avec `Ctrl+X`.

### 5. Transférer les SDE (données Eve Online)

**Sur votre PC Windows (PowerShell):**
```powershell
# Transférer le dossier SDE vers le Raspberry Pi
scp -r "C:\Users\Polo\Desktop\whatdidimine-master\eve-online-static-data-*" pi@VOTRE_IP:~/whatdidimine/
```

### 6. Déployer!

```bash
cd ~/whatdidimine
chmod +x deploy.sh
./deploy.sh
```

Le script va:
- ✅ Vérifier la configuration
- 📁 Créer les répertoires
- 🔨 Builder l'image Docker (10-20 min)
- 🚀 Démarrer l'application

### 7. Accéder à l'application

Ouvrez votre navigateur:
```
http://VOTRE_IP_RASPBERRY:3000
```

---

## 📊 Commandes Essentielles

```bash
# Voir les logs
docker-compose logs -f

# Redémarrer
docker-compose restart

# Arrêter
docker-compose down

# Créer une sauvegarde
./backup.sh

# Vérifier les mises à jour SDE
docker-compose exec whatdidimine npm run sde:check

# Installer une mise à jour SDE
docker-compose exec whatdidimine npm run sde:update
```

---

## ⚠️ Checklist de Vérification

Avant de dire que c'est terminé, vérifiez:

- [ ] L'application est accessible sur http://IP:3000
- [ ] Le health check fonctionne: `curl http://localhost:3000/api/health`
- [ ] L'authentification Eve Online fonctionne
- [ ] Le bot Discord peut vous envoyer des DM (testez avec `npm run sde:check`)
- [ ] Les logs s'affichent correctement: `docker-compose logs -f`

---

## 🆘 Problèmes Courants

### "Container ne démarre pas"
```bash
docker-compose logs
# Regardez les erreurs
```

### "Cannot connect to Discord"
- Vérifiez que le bot est invité sur un serveur commun
- Vérifiez que DISCORD_BOT_TOKEN est correct
- Vérifiez que vous avez envoyé un message au bot d'abord

### "Out of memory" pendant le build
```bash
# Augmenter le swap
sudo nano /etc/dphys-swapfile
# CONF_SWAPSIZE=2048
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
sudo reboot
```

### "Permission denied"
```bash
# S'assurer que vous êtes dans le groupe docker
groups
# Si 'docker' n'apparaît pas, reconnectez-vous
```

---

## 📚 Documentation Complète

Pour plus de détails, consultez:
- [DEPLOYMENT.md](DEPLOYMENT.md) - Guide complet de déploiement
- [README.md](README.md) - Documentation générale du projet
- [docs/SDE_AUTO_UPDATE.md](docs/SDE_AUTO_UPDATE.md) - Système de mise à jour SDE

---

**C'est parti! o7**
