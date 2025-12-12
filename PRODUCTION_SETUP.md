# Guide de Déploiement Production

## 1. Configuration des Environnements

Deux fichiers de configuration sont maintenant disponibles :
- `.env.development` : Configuration pour le développement local
- `.env.production` : Configuration pour l'environnement de production

## 2. Scripts NPM Disponibles

### Développement
```bash
npm run dev              # Lance server + client en mode développement
npm run start:dev        # Lance uniquement le server en mode développement
```

### Production
```bash
npm run start:prod       # Lance le server en mode production
npm start                # Alias pour start:prod
```

## 3. Configuration de l'Environnement de Production

### 3.1 Fichier .env.production

Vous devez remplir `.env.production` avec vos vraies valeurs de production :

#### Eve Online OAuth
1. Allez sur https://developers.eveonline.com/
2. Créez une nouvelle application (ou modifiez l'existante)
3. Configurez le Callback URL : `https://votredomaine.com/api/auth/callback`
4. Copiez le Client ID et Secret dans `.env.production`

```env
EVE_CLIENT_ID=votre_production_client_id
EVE_CLIENT_SECRET=votre_production_secret
EVE_CALLBACK_URL=https://votredomaine.com/api/auth/callback
```

#### Discord OAuth (Optionnel: Créer une app Discord séparée pour la production)
1. Allez sur https://discord.com/developers/applications
2. Créez une nouvelle application (recommandé pour séparer dev/prod)
3. Configurez OAuth2 Redirects : `https://votredomaine.com/api/discord/callback`
4. Créez un Bot et copiez le token

```env
DISCORD_CLIENT_ID=votre_production_discord_client_id
DISCORD_CLIENT_SECRET=votre_production_discord_secret
DISCORD_CALLBACK_URL=https://votredomaine.com/api/discord/callback
DISCORD_BOT_TOKEN=votre_production_bot_token
```

#### URLs et Secret de Session
```env
CLIENT_URL=https://votredomaine.com
SESSION_SECRET=<générer un secret fort>
```

**Générer un SESSION_SECRET fort :**
```bash
# Sous Linux/Mac
openssl rand -base64 32

# Sous Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

### 3.2 Construction du Client

Avant de déployer, construisez le client React :
```bash
cd client
npm run build
```

Le dossier `client/dist` contient les fichiers statiques à servir.

## 4. Déploiement sur un Serveur

### 4.1 Prérequis Serveur
- Node.js 16+ installé
- Un serveur web (nginx recommandé) pour servir les fichiers statiques
- HTTPS configuré (Let's Encrypt recommandé)
- PM2 pour gérer le processus Node (optionnel mais recommandé)

### 4.2 Installation sur le Serveur

1. Clonez le repository sur votre serveur
2. Installez les dépendances :
```bash
npm run install:all
```

3. Copiez et configurez `.env.production` :
```bash
cp .env.production .env.production.local
# Éditez .env.production.local avec vos vraies valeurs
```

4. Construisez le client :
```bash
cd client
npm run build
cd ..
```

### 4.3 Démarrage avec PM2 (Recommandé)

Installez PM2 globalement :
```bash
npm install -g pm2
```

Créez un fichier `ecosystem.config.js` :
```javascript
module.exports = {
  apps: [{
    name: 'whatdidimine',
    script: './server/index.js',
    env: {
      NODE_ENV: 'production'
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
  }]
};
```

Démarrez l'application :
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Configure PM2 pour démarrer au boot
```

### 4.4 Configuration Nginx

Exemple de configuration nginx (`/etc/nginx/sites-available/whatdidimine`) :

```nginx
server {
    listen 80;
    server_name votredomaine.com;
    
    # Redirection HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name votredomaine.com;

    # Certificats SSL (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/votredomaine.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/votredomaine.com/privkey.pem;

    # Servir les fichiers statiques du client
    root /chemin/vers/whatdidimine/client/dist;
    index index.html;

    # Proxy API vers le serveur Node
    location /api {
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

    # Servir index.html pour toutes les routes (React Router)
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Activez le site :
```bash
sudo ln -s /etc/nginx/sites-available/whatdidimine /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4.5 Obtenir un Certificat SSL avec Let's Encrypt

```bash
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d votredomaine.com
```

## 5. Base de Données

### 5.1 Sauvegarde en Production

Créez un script de sauvegarde quotidienne (`backup.sh`) :
```bash
#!/bin/bash
BACKUP_DIR="/chemin/vers/backups"
DB_FILE="/chemin/vers/whatdidimine/data/database.sqlite"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
cp $DB_FILE "$BACKUP_DIR/database_$DATE.sqlite"

# Garder seulement les 30 dernières sauvegardes
find $BACKUP_DIR -name "database_*.sqlite" -mtime +30 -delete
```

Ajoutez à crontab :
```bash
crontab -e
# Ajouter : 0 2 * * * /chemin/vers/backup.sh
```

## 6. Monitoring et Logs

### 6.1 Logs PM2
```bash
pm2 logs whatdidimine      # Voir les logs en temps réel
pm2 logs --lines 100       # Voir les 100 dernières lignes
```

### 6.2 Monitoring PM2
```bash
pm2 monit                  # Interface de monitoring
pm2 status                 # Status de l'application
```

## 7. Mises à Jour

Procédure pour mettre à jour l'application :

```bash
# Sur le serveur
cd /chemin/vers/whatdidimine
git pull
npm run install:all
cd client && npm run build && cd ..
pm2 restart whatdidimine
```

## 8. Checklist de Déploiement

- [ ] `.env.production` configuré avec les vraies valeurs
- [ ] SESSION_SECRET généré et unique
- [ ] Applications Eve Online et Discord créées avec les bons callback URLs
- [ ] Client React construit (`npm run build`)
- [ ] HTTPS configuré avec Let's Encrypt
- [ ] Nginx configuré pour servir les fichiers statiques et proxy API
- [ ] PM2 installé et configuré pour auto-restart
- [ ] Sauvegarde automatique de la base de données configurée
- [ ] DNS configuré pour pointer vers votre serveur
- [ ] Firewall configuré (ports 80, 443 ouverts)
- [ ] Tests des fonctionnalités principales après déploiement

## 9. Dépannage

### Le serveur ne démarre pas
```bash
pm2 logs whatdidimine --lines 50  # Vérifier les logs d'erreur
```

### Erreurs de connexion Discord/Eve
- Vérifiez que les callback URLs dans les portails développeurs correspondent exactement à votre domaine
- Vérifiez que les tokens/secrets sont corrects dans `.env.production`

### Base de données verrouillée
```bash
pm2 restart whatdidimine  # Redémarrer l'application
```

## 10. Sécurité

- Ne commitez JAMAIS `.env.production` dans git
- Utilisez des secrets forts pour SESSION_SECRET
- Gardez Node.js et les dépendances à jour : `npm audit fix`
- Configurez un firewall (ufw sur Ubuntu) :
  ```bash
  sudo ufw allow 22
  sudo ufw allow 80
  sudo ufw allow 443
  sudo ufw enable
  ```
- Limitez l'accès SSH avec des clés plutôt que des mots de passe
