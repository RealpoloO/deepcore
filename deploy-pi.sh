#!/bin/bash

# Script de déploiement automatisé pour Raspberry Pi
# Usage: ./deploy-pi.sh

set -e

echo "🚀 Déploiement whatdidimine sur Raspberry Pi"
echo "=============================================="

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Variables
APP_DIR="/home/pi/whatdidimine"
NGINX_CONF="/etc/nginx/sites-available/whatdidimine"
DOMAIN="${1:-votredomaine.com}"

# 1. Mise à jour du code
echo -e "${YELLOW}1. Mise à jour du code...${NC}"
cd $APP_DIR
git pull origin master

# 2. Installation des dépendances
echo -e "${YELLOW}2. Installation des dépendances...${NC}"
npm ci --production
cd client && npm ci && cd ..

# 3. Build du client
echo -e "${YELLOW}3. Build du client React...${NC}"
cd client && npm run build && cd ..

# 4. Redémarrage PM2
echo -e "${YELLOW}4. Redémarrage de l'application...${NC}"
pm2 restart whatdidimine || pm2 start ecosystem.config.js

# 5. Sauvegarde PM2
pm2 save

echo -e "${GREEN}✅ Déploiement terminé avec succès !${NC}"
echo ""
echo "Vérifications :"
echo "- Application : pm2 status"
echo "- Logs : pm2 logs whatdidimine"
echo "- URL : https://$DOMAIN"
