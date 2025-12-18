#!/bin/bash

# Script de déploiement pour WhatDidIMine
# Ce script doit être exécuté sur le Raspberry Pi

set -e

echo "🚀 Déploiement de WhatDidIMine..."

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
docker-compose down || true

# Construire l'image
echo "🔨 Construction de l'image Docker..."
docker-compose build --no-cache

# Démarrer les services
echo "▶️  Démarrage des services..."
docker-compose up -d

# Attendre que le service soit prêt
echo "⏳ Attente du démarrage du service..."
sleep 10

# Vérifier le statut
echo "🔍 Vérification du statut..."
docker-compose ps

echo ""
echo "✅ Déploiement terminé!"
echo "📊 Pour voir les logs: docker-compose logs -f"
echo "🛑 Pour arrêter: docker-compose down"
echo "🔄 Pour redémarrer: docker-compose restart"
