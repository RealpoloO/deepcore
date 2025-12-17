# Système de Mise à Jour Automatique du SDE

## Vue d'ensemble

Le système de mise à jour automatique du SDE (Static Data Export) vérifie quotidiennement si une nouvelle version est disponible et vous notifie via Discord webhook. Les mises à jour se font manuellement via des commandes CLI.

## Configuration

### Variables d'environnement

Ajoutez ces variables à votre fichier `.env.development` ou `.env.production`:

```bash
# SDE Configuration
SDE_DATA_DIR=eve-online-static-data
SDE_CHECK_INTERVAL=86400000  # 24 heures en millisecondes
SDE_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_URL
```


## Commandes CLI

### Vérifier les mises à jour

```bash
npm run sde:check
```

Affiche la version actuelle et la dernière version disponible. Indique si une mise à jour est disponible.

**Exemple de sortie:**
```
🔍 Checking for SDE updates...

📦 Current version: Build 3133773 (2025-12-08)
🌐 Latest version:  Build 3135421 (2025-12-17)

✨ New version available!
📝 To update, run: npm run sde:update
```

### Afficher la version actuelle

```bash
npm run sde:version
```

Affiche uniquement la version SDE actuellement installée.

### Mettre à jour le SDE

```bash
npm run sde:update
```

Lance le processus complet de mise à jour:
1. Vérifie qu'une nouvelle version est disponible
2. Télécharge le fichier ZIP (environ 500 MB)
3. Extrait les fichiers
4. Effectue un remplacement atomique
5. Recharge les services en mémoire
6. Envoie une notification Discord de succès

**⚠️ Avertissement:** Le téléchargement peut prendre plusieurs minutes selon votre connexion.

## Fonctionnement Automatique

### Vérification Quotidienne

Au démarrage du serveur et toutes les 24 heures:
- Le système vérifie automatiquement s'il existe une nouvelle version SDE
- Si une nouvelle version est détectée, un message Discord est envoyé
- **Aucune installation automatique** - vous devez lancer manuellement `npm run sde:update`

### Notification Discord

Lorsqu'une mise à jour est disponible, vous recevez:

```
📦 Nouvelle version SDE disponible

Version actuelle: Build 3133773
Nouvelle version: Build 3135421

Commande:
npm run sde:update
```

Après une mise à jour réussie:

```
✅ SDE mis à jour avec succès

Ancienne version: Build 3133773
Nouvelle version: Build 3135421

État: Services rechargés automatiquement
```

## Architecture Technique

### Fichiers clés

- `server/services/sdeManager.js` - Service principal de gestion des mises à jour
- `server/services/discord.js` - Service Discord pour les notifications DM
- `server/scripts/sde-check.js` - Script CLI de vérification
- `server/scripts/sde-update.js` - Script CLI de mise à jour
- `server/scripts/sde-version.js` - Script CLI d'affichage de version

### Processus de mise à jour

1. **Téléchargement** - Utilise l'API officielle CCP
   - URL: `https://developers.eveonline.com/static-data/eve-online-static-data-<build>-jsonl.zip`

2. **Extraction** - Utilise `adm-zip` pour décompresser
   - Validé: vérifie que `types.jsonl`, `blueprints.jsonl`, `_sde.jsonl` existent

3. **Installation atomique**
   - Renomme l'ancien répertoire en `.old`
   - Déplace le nouveau répertoire à sa place
   - Supprime le backup en cas de succès
   - **Rollback automatique** en cas d'erreur

4. **Hot-reload**
   - Recharge `sdeService.loadTypes()`
   - Recharge `blueprintService.loadBlueprints()`
   - **Pas de redémarrage serveur nécessaire**

### Sécurité et fiabilité

- ✅ **Verrouillage** - Une seule mise à jour à la fois
- ✅ **Backup automatique** - Ancien SDE conservé pendant l'installation
- ✅ **Rollback** - Restauration en cas d'échec
- ✅ **Validation** - Vérification de l'intégrité des fichiers
- ✅ **Retry** - Logique de retry sur les erreurs réseau (dans axios)
- ✅ **Pas de downtime** - Rechargement à chaud sans arrêt serveur

## Dépannage

### Erreur: "SDE directory not found"

Le répertoire SDE n'existe pas ou n'est pas au bon format.

**Solution:**
```bash
# Télécharger le SDE manuellement (Windows)
.\download-sde.ps1

# Ou (Linux/Mac)
./download-sde.sh
```

### Erreur: "Failed to download SDE"

Problème de connexion ou serveur CCP indisponible.

**Solutions:**
- Vérifiez votre connexion Internet
- Réessayez plus tard
- Vérifiez que `https://developers.eveonline.com` est accessible

### Le webhook Discord ne fonctionne pas

**Vérifications:**
1. L'URL webhook est-elle correcte dans `.env`?
2. Le webhook Discord est-il toujours actif?
3. Vérifiez les logs serveur pour les erreurs

### L'update échoue pendant l'extraction

Espace disque insuffisant ou fichier ZIP corrompu.

**Solutions:**
- Vérifiez l'espace disque disponible (~1 GB recommandé)
- Supprimez le dossier `temp/` et réessayez
- Le backup `.old` sera automatiquement restauré

## API Endpoints (Futur)

Pour l'instant, seules les commandes CLI sont disponibles. Des endpoints API pourront être ajoutés plus tard:

- `GET /api/admin/sde/version` - Version actuelle + dernière disponible
- `POST /api/admin/sde/check` - Vérifier les mises à jour
- `POST /api/admin/sde/update` - Lancer une mise à jour
- `GET /api/admin/sde/status` - Statut de la mise à jour en cours

## Logs

Les logs de mise à jour sont visibles:
- Dans la console du serveur
- Dans les fichiers de logs Winston (`logs/combined.log`, `logs/error.log`)

## Contribution

Pour modifier le système de mise à jour:

1. Service principal: `server/services/sdeManager.js`
2. Scripts CLI: `server/scripts/sde-*.js`
3. Intégration Discord: `server/services/discord.js`
4. Configuration paths: `server/services/sde.js` et `server/services/blueprintService.js`
