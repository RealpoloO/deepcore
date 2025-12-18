#!/bin/bash

# Script d'installation de Docker sur Raspberry Pi
# Ce script doit être exécuté sur le Raspberry Pi

set -e

echo "🐳 Installation de Docker sur Raspberry Pi..."
echo ""

# Vérifier si Docker est déjà installé
if command -v docker &> /dev/null; then
    echo "✅ Docker est déjà installé:"
    docker --version
    echo ""
    read -p "Voulez-vous réinstaller Docker? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Installation annulée."
        exit 0
    fi
fi

# Mise à jour du système
echo "📦 Mise à jour du système..."
sudo apt update
sudo apt upgrade -y

# Installation de Docker
echo "🐳 Installation de Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
rm get-docker.sh

# Ajouter l'utilisateur actuel au groupe docker
echo "👤 Ajout de l'utilisateur au groupe docker..."
sudo usermod -aG docker $USER

# Installation de Docker Compose
echo "📦 Installation de Docker Compose..."

# Méthode 1: Plugin Docker Compose (recommandé pour versions récentes)
echo "   Tentative d'installation du plugin Docker Compose..."
sudo apt install -y docker-compose-plugin 2>/dev/null || {
    echo "   Plugin non disponible, installation de docker-compose standalone..."
    # Méthode 2: Standalone (pour compatibilité)
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
    sudo curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
}

# Activer Docker au démarrage
echo "🚀 Activation de Docker au démarrage..."
sudo systemctl enable docker
sudo systemctl start docker

echo ""
echo "✅ Installation terminée!"
echo ""
echo "📋 Versions installées:"
docker --version

# Vérifier quelle version de compose est disponible
if command -v docker-compose &> /dev/null; then
    docker-compose --version
elif docker compose version &> /dev/null; then
    docker compose version
fi
echo ""
echo "⚠️  IMPORTANT: Vous devez redémarrer votre session pour que les changements prennent effet."
echo "   Déconnectez-vous et reconnectez-vous, ou redémarrez avec: sudo reboot"
echo ""
echo "🔍 Après reconnexion, vérifiez que Docker fonctionne:"
echo "   docker run hello-world"
