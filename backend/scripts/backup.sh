#!/bin/sh
# Sauvegarde de SM Intégré : base PostgreSQL (pg_dump, format « custom ») + fichiers déposés.
#
# Usage : backend/scripts/backup.sh [dossier de destination]   (défaut : ./backups)
#
# Deux modes :
#   - DATABASE_URL défini (postgres://utilisateur:motdepasse@hôte:5432/base) : pg_dump local
#     (client PostgreSQL 16 requis) ; les fichiers de MEDIA_ROOT sont archivés s'il existe ;
#   - sinon : pile docker compose (à lancer depuis n'importe où) : pg_dump dans le conteneur
#     `db`, fichiers copiés depuis le conteneur `backend` (/app/media).
#
# Variables : BACKUP_RETENTION_DAYS (défaut 14 ; 0 = ne rien supprimer), BACKUP_MEDIA (1 par
# défaut ; 0 pour ne sauvegarder que la base). Stockage S3 : les fichiers sont dans le bucket,
# à sauvegarder côté fournisseur (versionnement / réplication).
#
# Restauration : voir docs/DEPLOIEMENT.md (pg_restore --clean --if-exists --no-owner).
# Planification : cron, ex. « 15 2 * * * /opt/sm-integre/backend/scripts/backup.sh /srv/sauvegardes »
set -eu

DEST=${1:-${BACKUP_DIR:-./backups}}
KEEP=${BACKUP_RETENTION_DAYS:-14}
MEDIA=${BACKUP_MEDIA:-1}
STAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$DEST"
DEST=$(cd "$DEST" && pwd)
DUMP="$DEST/sm_integre-$STAMP.dump"
ARCHIVE="$DEST/sm_integre-media-$STAMP.tgz"
REPO_ROOT=$(cd "$(dirname "$0")/../.." && pwd)

log() { echo "[backup] $*" >&2; }
fail() { rm -f "$DUMP.tmp" "$ARCHIVE.tmp"; log "ÉCHEC : $*"; exit 1; }

if [ -n "${DATABASE_URL:-}" ]; then
    log "pg_dump de DATABASE_URL -> $DUMP"
    pg_dump --format=custom --no-owner --no-privileges --dbname="$DATABASE_URL" --file="$DUMP.tmp" \
        || fail "pg_dump"
    if [ "$MEDIA" = "1" ] && [ -n "${MEDIA_ROOT:-}" ] && [ -d "$MEDIA_ROOT" ]; then
        log "Fichiers de $MEDIA_ROOT -> $ARCHIVE"
        tar czf "$ARCHIVE.tmp" -C "$MEDIA_ROOT" . || fail "archive des fichiers"
    fi
else
    log "pg_dump dans le conteneur db (docker compose) -> $DUMP"
    (cd "$REPO_ROOT" && docker compose exec -T db \
        sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-privileges') \
        > "$DUMP.tmp" || fail "pg_dump (docker compose)"
    if [ "$MEDIA" = "1" ]; then
        log "Fichiers du conteneur backend (/app/media) -> $ARCHIVE"
        (cd "$REPO_ROOT" && docker compose exec -T backend tar czf - -C /app/media .) \
            > "$ARCHIVE.tmp" || fail "archive des fichiers (docker compose)"
    fi
fi

[ -s "$DUMP.tmp" ] || fail "sauvegarde vide"
# Contrôle de lisibilité quand pg_restore est disponible sur l'hôte.
if command -v pg_restore >/dev/null 2>&1; then
    pg_restore --list "$DUMP.tmp" >/dev/null || fail "archive pg_dump illisible"
fi
mv "$DUMP.tmp" "$DUMP"
[ -f "$ARCHIVE.tmp" ] && mv "$ARCHIVE.tmp" "$ARCHIVE"

if [ "$KEEP" -gt 0 ] 2>/dev/null; then
    find "$DEST" -maxdepth 1 -name 'sm_integre-*' -type f -mtime +"$KEEP" -print -delete \
        | sed 's/^/[backup] supprimé (rétention) : /' >&2
fi

log "Terminé : $(ls -1 "$DEST" | grep -c "$STAMP") fichier(s) dans $DEST"
