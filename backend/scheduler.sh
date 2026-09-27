#!/bin/sh
# Planificateur minimal du service `scheduler` (docker-compose.yml) : exécute
# `manage.py send_alerts` une fois par jour à ALERTS_TIME (HH:MM, horloge du conteneur, UTC
# par défaut ; 06:00 UTC = 07:00 à Porto-Novo). Un échec est journalisé et retenté le lendemain
# (l'anti-doublon de NotificationLog évite tout double envoi en cas de relance manuelle).
# Si AUDITLOG_RETENTION_DAYS > 0, `manage.py purge_logs` suit chaque jour (conservation des
# AuditLog / NotificationLog ; le journal fonctionnel n'est jamais purgé).
set -eu

ALERTS_TIME="${ALERTS_TIME:-06:00}"
AUDITLOG_RETENTION_DAYS="${AUDITLOG_RETENTION_DAYS:-0}"

purge() {
    if [ "$AUDITLOG_RETENTION_DAYS" -gt 0 ] 2>/dev/null; then
        python manage.py purge_logs --days "$AUDITLOG_RETENTION_DAYS" \
            || echo "[scheduler] purge_logs a échoué (nouvel essai demain)"
    fi
}

echo "[scheduler] send_alerts chaque jour à ${ALERTS_TIME} (heure du conteneur : $(date +%H:%M))"
if [ "$AUDITLOG_RETENTION_DAYS" -gt 0 ] 2>/dev/null; then
    echo "[scheduler] purge_logs chaque jour ensuite (conservation : ${AUDITLOG_RETENTION_DAYS} jours)"
fi

if [ "${ALERTS_ON_START:-0}" = "1" ]; then
    python manage.py send_alerts || echo "[scheduler] send_alerts a échoué"
    purge
fi

while true; do
    now=$(date +%s)
    next=$(date -d "today ${ALERTS_TIME}" +%s)
    if [ "$next" -le "$now" ]; then
        next=$(date -d "tomorrow ${ALERTS_TIME}" +%s)
    fi
    sleep $((next - now))
    echo "[scheduler] $(date '+%Y-%m-%d %H:%M') : send_alerts"
    python manage.py send_alerts || echo "[scheduler] send_alerts a échoué (nouvel essai demain)"
    purge
done
