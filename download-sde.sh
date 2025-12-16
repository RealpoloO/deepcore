#!/bin/bash
# Script pour télécharger les EVE Online Static Data Export (SDE)
# https://developers.eveonline.com/resource/resources

echo "📦 Téléchargement des EVE Online SDE..."

SDE_URL="https://eve-static-data-export.s3-eu-west-1.amazonaws.com/tranquility/sde.zip"
ZIP_FILE="sde.zip"
EXTRACT_FOLDER="eve-online-static-data-3133773-jsonl"

# Vérifier si le dossier existe déjà
if [ -d "$EXTRACT_FOLDER" ]; then
    echo "✅ SDE déjà présent dans $EXTRACT_FOLDER"
    read -p "Voulez-vous re-télécharger? (o/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Oo]$ ]]; then
        echo "⏭ Téléchargement annulé"
        exit 0
    fi
    rm -rf "$EXTRACT_FOLDER"
fi

# Télécharger le fichier
echo "⬇ Téléchargement de $SDE_URL..."
if ! curl -L -o "$ZIP_FILE" "$SDE_URL"; then
    echo "❌ Erreur lors du téléchargement"
    exit 1
fi
echo "✅ Téléchargement terminé"

# Extraire le ZIP
echo "📂 Extraction des fichiers..."
if ! unzip -q "$ZIP_FILE"; then
    echo "❌ Erreur lors de l'extraction"
    exit 1
fi
echo "✅ Extraction terminée"

# Nettoyer le fichier ZIP
rm "$ZIP_FILE"
echo "🧹 Fichier ZIP supprimé"

echo ""
echo "✅ SDE installé avec succès!"
echo "📁 Dossier: $EXTRACT_FOLDER"
