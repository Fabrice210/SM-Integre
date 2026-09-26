"""
Traçabilité fonctionnelle et helpers partagés par les actions métier de tous les modules,
équivalents des fonctions du front :

  - nowStamp()     -> now_stamp()    horodatage affiché « AAAA-MM-JJ HH:MM » ;
  - logAct()       -> log_act()      entrée du journal d'audit (db.journal) ;
  - hist()         -> add_hist()     historique d'un enregistrement (`hist`, dans `extra`) ;
  - addRegistre()  -> add_registre() entrée du registre d'amélioration continue.

Les dates viennent de l'horloge du serveur (fuseau TIME_ZONE), pas du TODAY figé de la démo.
"""

import datetime

from django.db.models import F
from django.utils import timezone

from . import registry
from .models import AuditLog, JournalEntry, Organisation


def today() -> datetime.date:
    return timezone.localdate()


def now_stamp() -> str:
    """nowStamp() du front : « AAAA-MM-JJ HH:MM » (heure locale du serveur)."""
    return timezone.localtime().strftime("%Y-%m-%d %H:%M")


def log_act(user, a: str, mod: str, statut: str = "Terminé") -> JournalEntry:
    """logAct() du front : entrée du journal d'audit fonctionnel (non modifiable)."""
    return JournalEntry.objects.create(
        organisation=user.organisation, user=user, d=now_stamp(), u=user.nom, a=a, mod=mod, statut=statut
    )


def add_hist(obj, user, a: str) -> None:
    """hist() du front : {d, u, a} en tête de obj.extra['hist'] (sans sauvegarder)."""
    extra = dict(obj.extra or {})
    extra["hist"] = [{"d": now_stamp(), "u": user.nom, "a": a}, *(extra.get("hist") or [])]
    obj.extra = extra


def add_registre(
    org: Organisation,
    type: str,
    intitule: str,
    origine: str,
    processus: str,
    normes,
    responsable: str,
    today: datetime.date | None = None,
    request=None,
):
    """
    addRegistre() du front (src/services/registre.ts) : entrée « En cours » en tête du
    registre d'amélioration, référence RG-<année>-0<38 + nombre d'entrées> comme le front.
    Renvoie l'entrée créée, ou None si la collection `registre` n'est pas installée.
    Avec `request`, la création est tracée dans l'AuditLog.
    """
    if not registry.is_registered("registre"):
        return None
    model = registry.get("registre").model
    today = today or timezone.localdate()
    qs = model.objects.filter(organisation=org)
    count = qs.count()
    qs.update(position=F("position") + 1)  # unshift : la nouvelle entrée passe en tête
    entry = model.objects.create(
        organisation=org,
        uid=org.next_uid(model.UID_PREFIX),
        position=0,
        ref=f"RG-{today.year}-0{38 + count}",
        type=type,
        intitule=intitule,
        origine=origine,
        processus=processus or "",
        normes=list(normes or []),
        statut="En cours",
        date=today,
        responsable=responsable or "",
    )
    if request is not None:
        AuditLog.objects.create(
            organisation=org,
            user=request.user,
            collection="registre",
            uid=entry.uid,
            action=AuditLog.Action.CREATE,
            data={"ref": entry.ref, "origine": entry.origine},
        )
    return entry
