"""
manage.py purge_logs [--days N] [--dry-run]

Conservation limitée des traces techniques contenant des données personnelles : supprime les
AuditLog (trace automatique des écritures API) et les NotificationLog (envois du récapitulatif
e-mail) plus anciens que N jours. N vaut par défaut AUDITLOG_RETENTION_DAYS ; 0 = ne rien purger.

Le journal fonctionnel (JournalEntry, /api/v1/journal/) n'est JAMAIS purgé : c'est la preuve
de traçabilité exigée par les normes ISO (informations documentées conservées). Voir
docs/DONNEES_PERSONNELLES.md.
"""

import datetime as dt

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.core.models import AuditLog
from apps.notifications.models import NotificationLog


class Command(BaseCommand):
    help = "Supprime les AuditLog et NotificationLog plus anciens que N jours (journal fonctionnel conservé)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=None,
            help="Durée de conservation en jours (défaut : AUDITLOG_RETENTION_DAYS ; 0 = jamais).",
        )
        parser.add_argument("--dry-run", action="store_true", help="Compte sans rien supprimer.")

    def handle(self, *args, days=None, dry_run=False, **opts):
        if days is None:
            days = settings.AUDITLOG_RETENTION_DAYS
        if days < 0:
            raise CommandError("--days : nombre de jours positif ou nul attendu.")
        if days == 0:
            self.stdout.write("Conservation illimitée (0 jour) : rien à purger.")
            return
        cutoff = timezone.now() - dt.timedelta(days=days)
        audit = AuditLog.objects.filter(at__lt=cutoff)
        notif = NotificationLog.objects.filter(sent_at__lt=cutoff)
        n_audit, n_notif = audit.count(), notif.count()
        stamp = timezone.localtime(cutoff).strftime("%Y-%m-%d %H:%M")
        if dry_run:
            self.stdout.write(
                f"Avant le {stamp} : {n_audit} AuditLog et {n_notif} NotificationLog seraient supprimés "
                "(journal fonctionnel conservé)."
            )
            return
        with transaction.atomic():
            n_audit, _ = audit.delete()
            n_notif, _ = notif.delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"Avant le {stamp} : {n_audit} AuditLog et {n_notif} NotificationLog supprimés "
                "(journal fonctionnel conservé)."
            )
        )
