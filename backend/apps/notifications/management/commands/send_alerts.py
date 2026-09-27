"""
manage.py send_alerts [--dry-run] [--today AAAA-MM-JJ] [--org ID]

Envoie à chaque utilisateur concerné le récapitulatif e-mail du jour : échéances
dépassées ou proches et validations en attente (voir apps.notifications.services).
À planifier une fois par jour (service `scheduler` de docker-compose.yml).
"""

import datetime as dt

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.core.models import Organisation
from apps.notifications.services import send_alerts


class Command(BaseCommand):
    help = "Envoie le récapitulatif e-mail quotidien des alertes et validations en attente."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run", action="store_true", help="Affiche les envois sans rien envoyer ni enregistrer."
        )
        parser.add_argument("--today", help="Date de référence AAAA-MM-JJ (défaut : aujourd'hui).")
        parser.add_argument("--org", type=int, help="Limiter à un organisme (identifiant).")

    def handle(self, *args, dry_run=False, today=None, org=None, **opts):
        try:
            day = dt.date.fromisoformat(today) if today else timezone.localdate()
        except ValueError as exc:
            raise CommandError("--today : date AAAA-MM-JJ attendue.") from exc
        orgs = Organisation.objects.order_by("id")
        if org is not None:
            orgs = orgs.filter(pk=org)
        report = send_alerts(day, dry_run=dry_run, organisations=orgs)
        for line in report.lines:
            self.stdout.write(line)
        verb = "à envoyer" if dry_run else "envoyé(s)"
        msg = f"{day.isoformat()} : {report.sent} e-mail(s) {verb}, {report.skipped} sans nouveauté, {report.failed} échec(s)."
        self.stdout.write(self.style.SUCCESS(msg) if not report.failed else self.style.WARNING(msg))
        if report.failed and not report.sent:
            raise CommandError("Aucun e-mail n'a pu être envoyé (voir les journaux).")
