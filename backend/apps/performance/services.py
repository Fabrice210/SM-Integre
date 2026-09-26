"""
Services métier du module 6, équivalents des utilitaires du front :

  - hist()        -> add_hist()      historique d'un enregistrement (clé `hist`, rangée dans `extra`) ;
  - logAct()      -> log_act()       entrée du journal d'audit fonctionnel ;
  - procOwner()   -> proc_owner()    pilote d'un processus ;
  - addRegistre() -> add_registre()  entrée du registre d'amélioration continue
                                     (src/services/registre.ts) — réutilisable par les autres
                                     modules (risque réalisé, exercice d'urgence, veille…).
"""

from django.db.models import F
from django.utils import timezone

from apps.core import registry
from apps.core.models import JournalEntry, Organisation
from apps.core.permissions import WRITE_ROLES

# procOwner() du front : pilote par défaut quand le processus est inconnu.
DEFAULT_OWNER = "Florence DOSSOU-YOVO"


def now_stamp() -> str:
    """nowStamp() du front : « AAAA-MM-JJ HH:MM » (heure locale du serveur)."""
    return timezone.localtime().strftime("%Y-%m-%d %H:%M")


def can_write(user) -> bool:
    return bool(user.is_superuser or user.has_role(*WRITE_ROLES))


def add_hist(obj, user, text: str) -> None:
    """hist(s, rec, a) : entrée en tête de `rec.hist` (conservée dans `extra`, non sauvegardée ici)."""
    extra = dict(obj.extra or {})
    extra["hist"] = [{"d": now_stamp(), "u": user.nom, "a": text}, *(extra.get("hist") or [])]
    obj.extra = extra


def log_act(org: Organisation, user, a: str, mod: str, statut: str = "Terminé") -> JournalEntry:
    """logAct(s, a, mod, statut) : entrée du journal d'audit (non modifiable)."""
    return JournalEntry.objects.create(
        organisation=org, user=user, d=now_stamp(), u=user.nom, a=a, mod=mod, statut=statut
    )


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


def add_registre(
    org: Organisation,
    type: str,
    intitule: str,
    origine: str,
    processus: str,
    normes,
    responsable: str,
    today=None,
):
    """
    addRegistre() du front : nouvelle entrée « En cours » en tête du registre.
    Référence RG-<année>-0<38 + nombre d'entrées> comme le front.
    """
    from .models import RegistreEntree

    today = today or timezone.localdate()
    qs = RegistreEntree.objects.filter(organisation=org)
    count = qs.count()
    qs.update(position=F("position") + 1)  # unshift : la nouvelle entrée passe en tête
    return RegistreEntree.objects.create(
        organisation=org,
        uid=org.next_uid(RegistreEntree.UID_PREFIX),
        position=0,
        ref=f"RG-{today.year}-0{38 + count}",
        type=type,
        intitule=intitule,
        origine=origine,
        processus=processus or "",
        normes=list(normes or []),
        statut=RegistreEntree.Statut.EN_COURS,
        date=today,
        responsable=responsable or "",
    )
