# Guide de Mise à Jour - WhatDidIMine

Ce guide explique comment mettre à jour votre installation WhatDidIMine.

## 🔄 Mise à jour de l'application

### Méthode recommandée (avec sauvegarde automatique)

```bash
cd ~/whatdidimine

# 1. Créer une sauvegarde avant la mise à jour
./backup.sh

# 2. Récupérer les dernières modifications
git pull

# 3. Vérifier s'il y a des changements dans .env.production.example
diff .env.production .env.production.example
# Si de nouvelles variables existent, ajoutez-les à votre .env.production

# 4. Reconstruire et redémarrer
docker-compose down
docker-compose up -d --build

# 5. Vérifier que tout fonctionne
docker-compose logs -f
```

### Vérification après mise à jour

```bash
# Health check
curl http://localhost:3000/api/health

# Voir les logs
docker-compose logs --tail=50

# Vérifier le statut
docker-compose ps
```

---

## 📦 Mise à jour du SDE (Static Data Export)

### Automatique (recommandé)

Le système vérifie automatiquement tous les jours et vous envoie un DM Discord quand une nouvelle version est disponible.

**Pour installer manuellement une mise à jour détectée:**

```bash
docker-compose exec whatdidimine npm run sde:update
```

### Manuel

```bash
# 1. Vérifier la version actuelle
docker-compose exec whatdidimine npm run sde:version

# 2. Vérifier si une mise à jour est disponible
docker-compose exec whatdidimine npm run sde:check

# 3. Installer la mise à jour si disponible
docker-compose exec whatdidimine npm run sde:update
```

Le processus de mise à jour SDE:
1. ✅ Télécharge la nouvelle version
2. ✅ Extrait les fichiers
3. ✅ Fait une sauvegarde de l'ancienne version
4. ✅ Installe la nouvelle version
5. ✅ Recharge les services automatiquement
6. ✅ Envoie une notification Discord de succès

En cas d'erreur, l'ancienne version est automatiquement restaurée.

---

## 🐳 Mise à jour de Docker

```bash
# Mettre à jour Docker
sudo apt update
sudo apt upgrade docker-ce docker-ce-cli containerd.io

# Vérifier la version
docker --version
```

---

## 🔧 Mise à jour du système Raspberry Pi

```bash
# Mise à jour complète du système
sudo apt update
sudo apt upgrade -y
sudo apt autoremove -y

# Redémarrer si nécessaire
sudo reboot
```

---

## 🗂️ Migration de données

Si vous changez de Raspberry Pi ou de serveur:

### 1. Sur l'ancien serveur

```bash
cd ~/whatdidimine

# Créer une sauvegarde complète
./backup.sh

# Copier la sauvegarde vers votre PC
# La sauvegarde est dans: backups/whatdidimine_backup_XXXXXXXX.tar.gz
```

### 2. Transférer vers le nouveau serveur

```bash
# Sur votre PC
scp backups/whatdidimine_backup_XXXXXXXX.tar.gz pi@NOUVELLE_IP:~/
```

### 3. Sur le nouveau serveur

```bash
# Installer WhatDidIMine (suivez QUICKSTART.md)
cd ~/whatdidimine

# Extraire la sauvegarde
tar -xzf ~/whatdidimine_backup_XXXXXXXX.tar.gz

# Les fichiers data/ et .env.production sont restaurés

# Démarrer
./deploy.sh
```

---

## 📋 Changelog - Vérifier les changements

Avant de mettre à jour, consultez toujours les changements:

```bash
# Voir les commits récents
git log --oneline -10

# Voir les différences avant de pull
git fetch
git diff HEAD origin/main
```

---

## ⚠️ Rollback (Retour arrière)

Si la mise à jour cause des problèmes:

### Restaurer depuis une sauvegarde

```bash
cd ~/whatdidimine

# Arrêter l'application
docker-compose down

# Restaurer la sauvegarde
tar -xzf backups/whatdidimine_backup_XXXXXXXX.tar.gz

# Redémarrer
docker-compose up -d

# Vérifier
docker-compose logs -f
```

### Revenir à un commit Git précédent

```bash
# Voir l'historique
git log --oneline

# Revenir au commit précédent
git reset --hard COMMIT_HASH

# Reconstruire
docker-compose down
docker-compose up -d --build
```

---

## 🔐 Mise à jour des secrets

Si vous devez changer des secrets (tokens, passwords):

### 1. Mettre à jour .env.production

```bash
nano .env.production
# Modifier les valeurs nécessaires
```

### 2. Redémarrer l'application

```bash
docker-compose restart
```

Les nouvelles valeurs seront chargées au redémarrage.

---

## 📊 Vérification de l'intégrité

Après toute mise à jour:

```bash
# 1. Health check
curl http://localhost:3000/api/health

# 2. Vérifier les logs pour les erreurs
docker-compose logs | grep -i error

# 3. Tester l'authentification Eve Online
# Ouvrir http://IP:3000 et se connecter

# 4. Vérifier les notifications Discord
docker-compose exec whatdidimine npm run sde:check

# 5. Monitorer l'utilisation des ressources
docker stats whatdidimine
```

---

## 🆘 Problèmes courants après mise à jour

### "Container ne démarre pas"

```bash
# Voir les erreurs
docker-compose logs

# Vérifier la configuration
docker-compose config

# Reconstruire from scratch
docker-compose down -v
docker-compose up -d --build
```

### "Base de données corrompue"

```bash
# Restaurer depuis backup
cd ~/whatdidimine
docker-compose down
tar -xzf backups/whatdidimine_backup_RECENT.tar.gz
docker-compose up -d
```

### "Nouvelles variables d'environnement manquantes"

```bash
# Comparer avec l'example
diff .env.production .env.production.example

# Ajouter les nouvelles variables nécessaires
nano .env.production

# Redémarrer
docker-compose restart
```

### "Conflits Git lors du pull"

```bash
# Sauvegarder vos changements locaux
git stash

# Récupérer les mises à jour
git pull

# Réappliquer vos changements
git stash pop

# Résoudre les conflits si nécessaire
```

---

## 📅 Planning de maintenance recommandé

### Quotidien (Automatique)
- ✅ Vérification SDE (automatique)
- ✅ Notifications Discord (automatique)

### Hebdomadaire
- 🔍 Vérifier les logs: `docker-compose logs | grep -i error`
- 📊 Monitorer: `./monitor.sh`
- 🧹 Nettoyer les vieux logs: `find logs/ -type f -mtime +30 -delete`

### Mensuel
- 🔄 Mise à jour de l'application: `git pull && docker-compose up -d --build`
- 🐳 Mise à jour Docker: `sudo apt upgrade docker-ce`
- 💾 Vérifier les sauvegardes: `ls -lh backups/`

### Trimestriel
- 🔐 Rotation des secrets (tokens, passwords)
- 🗂️ Nettoyage des vieilles sauvegardes
- 💿 Mise à jour système complète: `sudo apt update && sudo apt full-upgrade`

---

## 📞 Support

Si vous rencontrez des problèmes après une mise à jour:

1. Vérifiez les logs: `docker-compose logs -f`
2. Consultez le fichier error.log: `tail -f logs/error.log`
3. Vérifiez la configuration: `docker-compose config`
4. Testez le health check: `curl http://localhost:3000/api/health`
5. En dernier recours, restaurez depuis une sauvegarde

---

**Bonne mise à jour! o7**
