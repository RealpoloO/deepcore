#!/bin/bash

# Script de déploiement pour WhatDidIMine
# Ce script doit être exécuté sur le Raspberry Pi

set -e

echo "🚀 Déploiement de WhatDidIMine..."

# Détecter la commande docker compose disponible
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo "❌ Erreur: docker-compose n'est pas installé!"
    echo "📝 Installez Docker Compose avec: sudo apt install docker-compose-plugin"
    exit 1
fi

echo "📦 Utilisation de: $DOCKER_COMPOSE"

# Vérifier que .env.production existe
if [ ! -f .env.production ]; then
    echo "❌ Erreur: Le fichier .env.production n'existe pas!"
    echo "📝 Copiez .env.production.example vers .env.production et configurez-le."
    exit 1
fi

# Créer les répertoires nécessaires s'ils n'existent pas
echo "📁 Création des répertoires nécessaires..."
mkdir -p data logs temp

# Arrêter les containers existants
echo "🛑 Arrêt des containers existants..."
$DOCKER_COMPOSE down || true

# Construire l'image
echo "🔨 Construction de l'image Docker..."
$DOCKER_COMPOSE build --no-cache

# Démarrer les services
echo "▶️  Démarrage des services..."
$DOCKER_COMPOSE up -d

# Attendre que le service soit prêt
echo "⏳ Attente du démarrage du service..."
sleep 10

# Vérifier le statut
echo "🔍 Vérification du statut..."
$DOCKER_COMPOSE ps

echo ""
echo "✅ Déploiement terminé!"
echo "📊 Pour voir les logs: $DOCKER_COMPOSE logs -f"
echo "🛑 Pour arrêter: $DOCKER_COMPOSE down"
echo "🔄 Pour redémarrer: $DOCKER_COMPOSE restart"
