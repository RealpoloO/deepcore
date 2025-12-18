#!/bin/bash

# Script de monitoring simple pour WhatDidIMine
# Affiche l'état du système et de l'application

set -e

# Détecter la commande docker compose disponible
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo "❌ Erreur: docker-compose n'est pas installé!"
    exit 1
fi

echo "📊 WhatDidIMine - Monitoring Dashboard"
echo "========================================"
echo ""

# État du container
echo "🐳 État des containers Docker:"
$DOCKER_COMPOSE ps
echo ""

# Utilisation des ressources
echo "💻 Utilisation des ressources:"
docker stats --no-stream whatdidimine 2>/dev/null || echo "Container non démarré"
echo ""

# Health check
echo "🏥 Health Check:"
HEALTH=$(curl -s http://localhost:3000/api/health 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ API accessible"
    echo "$HEALTH" | jq . 2>/dev/null || echo "$HEALTH"
else
    echo "❌ API non accessible"
fi
echo ""

# Version SDE
echo "📦 Version SDE:"
$DOCKER_COMPOSE exec -T whatdidimine node server/scripts/sde-version.js 2>/dev/null || echo "Impossible de récupérer la version SDE"
echo ""

# Espace disque
echo "💾 Espace disque:"
df -h . | tail -1 | awk '{print "Utilisé: " $3 " / " $2 " (" $5 ")"}'
echo ""

# Taille des répertoires importants
echo "📁 Taille des données:"
if [ -d "data" ]; then
    echo "  Database: $(du -sh data 2>/dev/null | cut -f1)"
fi
if [ -d "logs" ]; then
    echo "  Logs: $(du -sh logs 2>/dev/null | cut -f1)"
fi
if [ -d "eve-online-static-data"* ]; then
    echo "  SDE: $(du -sh eve-online-static-data-* 2>/dev/null | head -1 | cut -f1)"
fi
if [ -d "backups" ]; then
    echo "  Backups: $(du -sh backups 2>/dev/null | cut -f1)"
fi
echo ""

# Dernières lignes des logs
echo "📝 Dernières lignes des logs (5 dernières):"
$DOCKER_COMPOSE logs --tail=5 2>/dev/null || echo "Logs non disponibles"
echo ""

# Uptime du système
echo "⏱️  Uptime du système:"
uptime
echo ""

# Informations réseau
echo "🌐 Accès à l'application:"
echo "  Local: http://localhost:3000"
IP=$(hostname -I | awk '{print $1}')
echo "  Réseau local: http://$IP:3000"
echo ""

echo "========================================"
echo "💡 Commandes utiles:"
echo "  $DOCKER_COMPOSE logs -f       # Voir les logs en direct"
echo "  $DOCKER_COMPOSE restart       # Redémarrer"
echo "  ./backup.sh                   # Créer une sauvegarde"
echo "  $DOCKER_COMPOSE exec whatdidimine npm run sde:check  # Vérifier SDE"
