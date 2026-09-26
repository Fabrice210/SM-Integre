"""
Services métier du module 6, équivalents des utilitaires du front :

  - hist()        -> add_hist()      historique d'un enregistrement (clé `hist`, rangée dans `extra`) ;
  - logAct()      -> log_act()       entrée du journal d'audit fonctionnel ;
  - procOwner()   -> proc_owner()    pilote d'un processus ;
  - addRegistre() -> add_registre()  entrée du registre d'amélioration continue
                                     (src/services/registre.ts) — réutilisable par les autres
                                     modules (risque réalisé, exercice d'urgence, veille…).
"""

from apps.core import registry, tracing
from apps.core.models import JournalEntry, Organisation
from apps.core.permissions import WRITE_ROLES
from apps.core.tracing import add_hist, add_registre, now_stamp  # noqa: F401 (réexport)

# procOwner() du front : pilote par défaut quand le processus est inconnu.
DEFAULT_OWNER = "Florence DOSSOU-YOVO"


def can_write(user) -> bool:
    return bool(user.is_superuser or user.has_role(*WRITE_ROLES))


def log_act(org: Organisation, user, a: str, mod: str, statut: str = "Terminé") -> JournalEntry:
    """logAct(s, a, mod, statut) : apps.core.tracing.log_act."""
    return tracing.log_act(user, a, mod, statut)


def proc_owner(org: Organisation, pid: str) -> str:
    """procOwner(pid) : propriétaire (pilote) du processus, sinon le pilote par défaut du front."""
    try:
        model = registry.get("processus").model
    except KeyError:
        return DEFAULT_OWNER
    p = model.objects.filter(organisation=org, uid=pid).first()
    if p is None:
        return DEFAULT_OWNER
    return getattr(p, "proprietaire", "") or ""
