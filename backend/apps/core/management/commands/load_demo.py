from django.conf import settings
from django.core.management.base import BaseCommand

from apps.core.demo import load_demo, read_demo
from apps.core.models import Organisation


class Command(BaseCommand):
    help = "Crée l'organisme de démonstration (AGRO-BÉNIN Industries) et ses utilisateurs."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset", action="store_true", help="Supprime d'abord l'organisme de démo existant"
        )

    def handle(self, *args, reset=False, **opts):
        demo = read_demo()
        existing = Organisation.objects.filter(nom=demo["org"]["nom"])
        if existing.exists():
            if not reset:
                self.stdout.write(self.style.WARNING("Organisme de démo déjà présent (utiliser --reset)."))
                return
            for org in existing:
                org.users.all().delete()
                org.delete()
        org = load_demo(demo)
        self.stdout.write(
            self.style.SUCCESS(
                f"Démo chargée : {org.nom} — {org.users.count()} utilisateurs "
                f"(mot de passe : DEMO_PASSWORD, défaut « {settings.DEMO_PASSWORD} »)"
            )
        )
