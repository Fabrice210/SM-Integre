"""
Traçabilité fonctionnelle des actions métier, comme le front :

  - logAct() : entrée en tête du journal d'audit (db.journal) ;
  - hist()   : historique d'un enregistrement (clé `hist`, conservée dans `extra`).

Utilisé par les actions métier des modules 1 et 2 (candidat à un déplacement dans core).
"""

from django.utils import timezone

from apps.core.models import JournalEntry


def today() -> str:
    """iso(TODAY) du front : date du jour AAAA-MM-JJ."""
    return timezone.localdate().isoformat()


def now_stamp() -> str:
    """nowStamp() du front : AAAA-MM-JJ HH:MM."""
    return timezone.localtime().strftime("%Y-%m-%d %H:%M")


def log_act(user, a: str, mod: str, statut: str = "Terminé") -> JournalEntry:
    return JournalEntry.objects.create(
        organisation=user.organisation, d=now_stamp(), u=user.nom, a=a, mod=mod, statut=statut, user=user
    )


def add_hist(obj, user, a: str) -> None:
    """Ajoute {d, u, a} en tête de obj.extra['hist'] (sans sauvegarder)."""
    extra = dict(obj.extra or {})
    extra["hist"] = [{"d": now_stamp(), "u": user.nom, "a": a}, *(extra.get("hist") or [])]
    obj.extra = extra
