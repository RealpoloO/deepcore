# WhatDidIMine - Eve Online Mining Tracker

Application web pour suivre votre minage Eve Online sur tous vos personnages.

## Fonctionnalités

- 🔐 Authentification Eve SSO (OAuth 2.0)
- 👥 Gestion multi-personnages
- 📊 Historique de minage par personnage
- 📈 Statistiques et totaux agrégés
- 💎 Suivi des volumes de minerais

## Prérequis

- Node.js 18+ 
- Compte développeur Eve Online

## Configuration

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

Mode développement (backend + frontend):
```bash
npm run dev
```

L'application sera accessible sur:
- Frontend: http://localhost:3001
- Backend: http://localhost:3000

## Stack Technique

- **Backend**: Node.js, Express, SQLite
- **Frontend**: React, Vite, React Router
- **API**: Eve Online ESI API
- **Auth**: Eve SSO OAuth 2.0
