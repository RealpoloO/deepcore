# WhatDidIMine - Eve Online Mining Tracker & Production Planner

Application web pour suivre votre minage Eve Online et planifier votre production industrielle.

## Fonctionnalités

### Mining Tracker
- 🔐 Authentification Eve SSO (OAuth 2.0)
- 👥 Gestion multi-personnages
- 📊 Historique de minage par personnage
- 📈 Statistiques et totaux agrégés
- 💎 Suivi des volumes de minerais

### Production Planner
- 🏭 Calcul de chaînes de production complètes (manufacturing + reactions)
- 📦 Bill of Materials (BOM) automatique avec gestion des profondeurs
- ⚙️ Support Material Efficiency (ME) et Time Efficiency (TE)
- 🔄 Job splitting intelligent basé sur les slots disponibles
- 📋 Gestion des stocks existants
- 🚫 Blacklist par catégories ou items personnalisés
- ⏱️ Calcul des timelines de production en parallèle
- 📊 Organisation par catégories (reactions, components, fuel blocks, etc.)

### Job Alerts
- 🔔 Notifications Discord pour les jobs industry terminés
- ⏰ Vérification automatique toutes les minutes
- 📱 Alertes en temps réel via DM Discord

### SDE Auto-Update
- 🔄 Vérification quotidienne des mises à jour du Static Data Export
- 📥 Téléchargement et installation automatiques
- 💬 Notifications Discord DM pour les nouvelles versions
- 🔒 Installation atomique avec rollback en cas d'erreur
- 🛠️ Scripts CLI: `npm run sde:check`, `npm run sde:update`, `npm run sde:version`

## Prérequis

- Node.js 18+ 
- Compte développeur Eve Online
- EVE Online Static Data Export (SDE)

## Installation

### 1. Télécharger les données statiques EVE (SDE)

Les fichiers SDE sont nécessaires pour le fonctionnement de l'application mais sont trop volumineux pour être versionnés sur GitHub.

**Windows:**
```powershell
.\download-sde.ps1
```

**Linux/Mac:**
```bash
chmod +x download-sde.sh
./download-sde.sh
```

Ou télécharger manuellement depuis: https://developers.eveonline.com/resource/resources

### 2. Configuration

1. Créer une application sur https://developers.eveonline.com/applications
   - Type: Authentication & API Access
   - Callback URL: `http://localhost:3000/api/auth/callback`
   - Scopes requis: `esi-industry.read_character_mining.v1`

2. Copier `.env.example` vers `.env` et remplir les valeurs:
   ```bash
   cp .env.example .env
   ```

3. Installer les dépendances:
   ```bash
   npm run install:all
   ```

## Démarrage

### Mode Développement

Mode développement (backend + frontend):
```bash
npm run dev
```

L'application sera accessible sur:
- Frontend: http://localhost:3001
- Backend: http://localhost:3000

### Mode Production (Docker)

Pour déployer en production sur Raspberry Pi ou serveur:

**Voir le guide complet:** [DEPLOYMENT.md](DEPLOYMENT.md)

**Résumé rapide:**
```bash
# Copier et configurer l'environnement
cp .env.production.example .env.production
# Éditer .env.production avec vos vraies valeurs

# Déployer
chmod +x deploy.sh
./deploy.sh

# L'application sera disponible sur http://IP:3000
```

**Commandes Docker utiles:**
```bash
docker-compose up -d              # Démarrer
docker-compose down               # Arrêter
docker-compose logs -f            # Logs
docker-compose restart            # Redémarrer
./backup.sh                       # Créer une sauvegarde
```

## Stack Technique

- **Backend**: Node.js, Express, SQLite
- **Frontend**: React, Vite, React Router
- **API**: Eve Online ESI API
- **Auth**: Eve SSO OAuth 2.0
- **Data**: Eve Online SDE (Static Data Export) - Types, Blueprints, Groups

## Architecture du Production Planner

Le Production Planner utilise une architecture en 4 phases:

### Phase 1: Calcul des BOM (Bill of Materials)
- Calcul récursif des matériaux nécessaires pour chaque end product
- Consommation du stock existant pendant le calcul
- Séparation entre matériaux à produire et matériaux à acheter
- Gestion de la blacklist (catégories et items personnalisés)

### Phase 2: Création et Splitting des Jobs
- Organisation des jobs par catégories (intermediate reactions, fuel blocks, components, etc.)
- Splitting intelligent des jobs longs selon les slots disponibles
- Respect des seuils configurés (`dontSplitShorterThan`)

### Phase 3: Calcul des Matériaux par Job
- Application des coefficients ME/TE pour chaque job
- Calcul des quantités finales et temps de production
- ME ne s'applique PAS aux reactions (conforme à Eve Online)

### Phase 4: Organisation et Timelines
- Simulation d'exécution parallèle par catégorie
- Calcul des timelines globales (reaction slots vs manufacturing slots)
- Agrégation finale des matériaux de base à acheter

## Tests

Le projet inclut 44 tests unitaires couvrant:
- Parsing des stocks
- Système de blacklist
- Calcul de production (manufacturing + reactions)
- Splitting des jobs
- Consommation de stock
- Gestion des erreurs
- Agrégation des matériaux

Lancer les tests:
```bash
npm test
```

Lancer uniquement les tests du Production Planner:
```bash
npm test -- productionPlanner.test.js
```
