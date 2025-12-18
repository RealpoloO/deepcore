#!/bin/bash

# Script de sauvegarde pour WhatDidIMine
# Sauvegarde la base de données et les configurations

set -e

BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="whatdidimine_backup_${TIMESTAMP}.tar.gz"

echo "💾 Création de la sauvegarde..."

# Créer le répertoire de backup s'il n'existe pas
mkdir -p "$BACKUP_DIR"

# Créer l'archive
tar -czf "$BACKUP_DIR/$BACKUP_FILE" \
    data/ \
    .env.production \
    logs/ \
    2>/dev/null || true

echo "✅ Sauvegarde créée: $BACKUP_DIR/$BACKUP_FILE"

# Garder seulement les 7 dernières sauvegardes
echo "🧹 Nettoyage des anciennes sauvegardes..."
cd "$BACKUP_DIR"
ls -t whatdidimine_backup_*.tar.gz | tail -n +8 | xargs -r rm
cd ..

echo "📦 Sauvegardes disponibles:"
ls -lh "$BACKUP_DIR"
