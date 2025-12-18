# Multi-stage build pour optimiser la taille de l'image
FROM node:20-alpine AS builder

# Installation des dépendances de build
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copier les package.json
COPY package*.json ./
COPY client/package*.json ./client/

# Installer toutes les dépendances
RUN npm ci
RUN cd client && npm ci

# Copier le code source
COPY . .

# Build du frontend
RUN cd client && npm run build

# Stage de production
FROM node:20-alpine

# Installer uniquement les dépendances runtime nécessaires
RUN apk add --no-cache \
    sqlite \
    curl \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001

WORKDIR /app

# Copier les package.json
COPY package*.json ./

# Installer uniquement les dépendances de production
RUN npm ci --only=production && npm cache clean --force

# Copier le code du serveur
COPY server ./server

# Copier les fichiers de build du frontend depuis le builder
COPY --from=builder /app/client/dist ./client/dist

# Créer les répertoires nécessaires
RUN mkdir -p /app/data /app/temp /app/logs \
    && chown -R nodejs:nodejs /app

# Changer vers l'utilisateur non-root
USER nodejs

# Exposer le port
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node server/scripts/healthcheck.js || exit 1

# Commande de démarrage
CMD ["node", "server/index.js"]
