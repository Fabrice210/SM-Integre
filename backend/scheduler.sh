#!/bin/sh
# Planificateur minimal du service `scheduler` (docker-compose.yml) : exécute
# `manage.py send_alerts` une fois par jour à ALERTS_TIME (HH:MM, horloge du conteneur, UTC
# par défaut ; 06:00 UTC = 07:00 à Porto-Novo). Un échec est journalisé et retenté le lendemain
# (l'anti-doublon de NotificationLog évite tout double envoi en cas de relance manuelle).
set -eu

ALERTS_TIME="${ALERTS_TIME:-06:00}"
echo "[scheduler] send_alerts chaque jour à ${ALERTS_TIME} (heure du conteneur : $(date +%H:%M))"

if [ "${ALERTS_ON_START:-0}" = "1" ]; then
    python manage.py send_alerts || echo "[scheduler] send_alerts a échoué"
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
done
