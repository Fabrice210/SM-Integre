# syntax=docker/dockerfile:1
# Front React/Vite de SM Intégré, servi par nginx (non root, port 8080).
# nginx sert la SPA et relaie /api/, /admin/ et /static/ vers l'API Django (même origine, pas de CORS).

# ---------- Étape 1 : build Vite ----------
FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Sources (le contexte est restreint par .dockerignore : src/, public/, index.html, configs).
COPY . .

# URL de l'API vue du navigateur. Par défaut même origine : nginx relaie /api/ vers le backend.
# Laisser vide (--build-arg VITE_API_URL=) pour construire le mode local (données navigateur).
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# ---------- Étape 2 : nginx ----------
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

# Adresse de l'API vue depuis le conteneur nginx (substituée dans le gabarit au démarrage).
ENV BACKEND_URL=http://backend:8000

COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
