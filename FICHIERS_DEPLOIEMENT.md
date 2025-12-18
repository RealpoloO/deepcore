# 📋 Fichiers de Déploiement - Récapitulatif

Liste complète des fichiers créés pour le déploiement Docker de WhatDidIMine.

## 🐳 Configuration Docker

### `Dockerfile`
Configuration Docker multi-stage pour optimiser la taille de l'image:
- Stage 1: Build du frontend React
- Stage 2: Image de production légère (Node 20 Alpine)
- Utilisateur non-root pour la sécurité
- Health check intégré

### `docker-compose.yml`
Orchestration Docker:
- Configuration des ports (3000)
- Volumes persistants (data, logs, SDE)
- Variables d'environnement
- Health checks
- Restart policy
- Gestion des logs

### `.dockerignore`
Exclusion des fichiers inutiles du build:
- node_modules
- Fichiers de développement
- Logs
- Base de données locale

---

## ⚙️ Configuration

### `.env.production.example`
Template de configuration production avec:
- Eve Online SSO
- Discord Bot
- Session secrets
- Chemins de base de données
- Configuration SDE

### `.gitignore` (mis à jour)
Ajout de:
- backups/
- data/
- logs/
- Scripts de test

---

## 🚀 Scripts de Déploiement

### `deploy.sh`
Script principal de déploiement:
- Vérification de la configuration
- Création des répertoires
- Build de l'image
- Démarrage des containers
- Vérification du statut

**Usage:**
```bash
chmod +x deploy.sh
./deploy.sh
```

### `backup.sh`
Script de sauvegarde automatique:
- Sauvegarde de la base de données
- Sauvegarde de .env.production
- Sauvegarde des logs
- Rotation automatique (garde 7 dernières)
- Format: tar.gz horodaté

**Usage:**
```bash
chmod +x backup.sh
./backup.sh
```

### `install-docker.sh`
Installation automatique de Docker sur Raspberry Pi:
- Mise à jour du système
- Installation Docker
- Installation Docker Compose
- Configuration des permissions
- Activation au démarrage

**Usage:**
```bash
chmod +x install-docker.sh
./install-docker.sh
```

### `monitor.sh`
Dashboard de monitoring:
- État des containers
- Utilisation des ressources
- Health check
- Version SDE
- Espace disque
- Derniers logs

**Usage:**
```bash
chmod +x monitor.sh
./monitor.sh
```

---

## 🏥 Health Check

### `server/scripts/healthcheck.js`
Script de health check pour Docker:
- Vérifie que l'API répond
- Timeout de 5 secondes
- Utilisé par Docker HEALTHCHECK
- Endpoint: `/api/health`

---

## 📚 Documentation

### `DEPLOYMENT.md` (98KB)
Guide complet de déploiement sur Raspberry Pi:
- ✅ Prérequis et installation
- ✅ Configuration détaillée
- ✅ Procédure de déploiement
- ✅ Accès Internet (Nginx + SSL)
- ✅ Commandes utiles
- ✅ Monitoring
- ✅ Sécurité
- ✅ Dépannage complet
- ✅ Checklist de déploiement

### `QUICKSTART.md` (25KB)
Guide de démarrage rapide (5 minutes):
- ✅ Installation Docker express
- ✅ Configuration minimale
- ✅ Déploiement en 7 étapes
- ✅ Commandes essentielles
- ✅ Checklist de vérification
- ✅ Problèmes courants

### `UPDATE.md` (18KB)
Guide de mise à jour:
- ✅ Mise à jour de l'application
- ✅ Mise à jour du SDE
- ✅ Migration de données
- ✅ Rollback
- ✅ Mise à jour des secrets
- ✅ Planning de maintenance
- ✅ Vérification d'intégrité

### `README.md` (mis à jour)
Documentation principale enrichie avec:
- ✅ Section Docker/Production
- ✅ Fonctionnalités SDE Auto-Update
- ✅ Job Alerts
- ✅ Commandes Docker

---

## 🗂️ Structure de Déploiement

Après déploiement, la structure sera:

```
whatdidimine/
├── 📁 Fichiers Docker
│   ├── Dockerfile                    # Configuration image Docker
│   ├── docker-compose.yml            # Orchestration
│   └── .dockerignore                 # Exclusions build
│
├── 📁 Configuration
│   ├── .env.production               # Config production (CRÉER!)
│   └── .env.production.example       # Template
│
├── 📁 Scripts
│   ├── deploy.sh                     # Déploiement
│   ├── backup.sh                     # Sauvegarde
│   ├── install-docker.sh             # Installation Docker
│   └── monitor.sh                    # Monitoring
│
├── 📁 Documentation
│   ├── DEPLOYMENT.md                 # Guide complet
│   ├── QUICKSTART.md                 # Guide rapide
│   ├── UPDATE.md                     # Guide mise à jour
│   ├── README.md                     # Documentation principale
│   └── FICHIERS_DEPLOIEMENT.md       # Ce fichier
│
├── 📁 Données (créés au déploiement)
│   ├── data/                         # Base de données SQLite
│   ├── logs/                         # Logs application
│   ├── temp/                         # Téléchargements temporaires
│   ├── backups/                      # Sauvegardes
│   └── eve-online-static-data-*/     # SDE
│
└── 📁 Application
    ├── client/                       # Frontend React
    ├── server/                       # Backend Node.js
    └── package.json                  # Dépendances
```

---

## ✅ Checklist Pré-Déploiement

Avant de déployer, assurez-vous d'avoir:

- [ ] Raspberry Pi avec Raspberry Pi OS 64-bit
- [ ] Docker et Docker Compose installés
- [ ] Fichier `.env.production` créé et configuré
- [ ] Eve Online SSO application créée
- [ ] Discord Bot créé et invité sur un serveur
- [ ] SDE téléchargés (ou prêts à transférer)
- [ ] Scripts rendus exécutables (`chmod +x *.sh`)

---

## 🎯 Ordre de Déploiement Recommandé

1. **Préparation du Raspberry Pi**
   ```bash
   ./install-docker.sh
   sudo reboot
   ```

2. **Configuration**
   ```bash
   cp .env.production.example .env.production
   nano .env.production  # Configurer
   ```

3. **Transfert des SDE** (depuis votre PC)
   ```powershell
   scp -r eve-online-static-data-* pi@IP:~/whatdidimine/
   ```

4. **Déploiement**
   ```bash
   ./deploy.sh
   ```

5. **Vérification**
   ```bash
   ./monitor.sh
   curl http://localhost:3000/api/health
   ```

6. **Première sauvegarde**
   ```bash
   ./backup.sh
   ```

7. **Configuration cron pour sauvegardes automatiques**
   ```bash
   crontab -e
   # Ajouter: 0 2 * * * cd ~/whatdidimine && ./backup.sh
   ```

---

## 📞 Support et Ressources

### Documentation
- Guide complet: [DEPLOYMENT.md](DEPLOYMENT.md)
- Guide rapide: [QUICKSTART.md](QUICKSTART.md)
- Mises à jour: [UPDATE.md](UPDATE.md)

### Commandes de Debug
```bash
docker-compose logs -f              # Logs en temps réel
docker-compose ps                   # État des containers
docker stats whatdidimine          # Ressources
./monitor.sh                        # Dashboard complet
curl http://localhost:3000/api/health  # Health check
```

### Liens Utiles
- [Docker Documentation](https://docs.docker.com/)
- [Raspberry Pi Docs](https://www.raspberrypi.org/documentation/)
- [Eve Online Developers](https://developers.eveonline.com/)
- [Discord Developers](https://discord.com/developers/applications)

---

## 🎉 Résumé

**Fichiers créés pour le déploiement:**
- 4 fichiers de configuration Docker
- 4 scripts de gestion (.sh)
- 1 script de health check
- 4 fichiers de documentation (+ 1 récapitulatif)
- Mises à jour: README.md, .gitignore

**Total: ~140KB de documentation et scripts prêts pour la production!**

---

**Bon déploiement sur votre Raspberry Pi! 🚀 o7**
