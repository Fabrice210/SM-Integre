#!/bin/sh
# Point d'entrée du conteneur API : migrations, démo optionnelle, puis la commande (gunicorn).
set -eu

if [ "${MIGRATE_ON_START:-1}" = "1" ]; then
    echo "[entrypoint] Migrations…"
    python manage.py migrate --noinput
fi

if [ "${LOAD_DEMO:-0}" = "1" ]; then
    # Sans effet si l'organisme de démo existe déjà (pas de --reset ici).
    echo "[entrypoint] Chargement de la démo…"
    python manage.py load_demo
fi

exec "$@"
