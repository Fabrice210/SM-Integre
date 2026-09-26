"""
Outils des règles métier du module 3, repris du front :
historique d'un enregistrement (hist), journal d'audit (logAct), dates affichées (fd),
niveaux de risque (niv / nivLbl), avancement des objectifs (objProg / objLate), et
création d'éléments liés dans des collections d'autres modules (NC, registre).
"""

import datetime

from django.db.models import F

from apps.core import registry, tracing
from apps.core.models import AuditLog
from apps.core.refs import validate_refs
from apps.core.tracing import add_hist, now_stamp, today  # noqa: F401 (réexport)
from apps.core.viewsets import log_write

# src/data/referentiels.ts : MOIS
MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]


def fd(d: datetime.date) -> str:
    """fd() du front : « 21 sept. 2026 »."""
    return f"{d.day} {MOIS[d.month - 1]} {d.year}"


def add_years(d: datetime.date, n: int) -> datetime.date:
    """Date.setFullYear(annee + n) du front (le 29 février devient le 1er mars)."""
    try:
        return d.replace(year=d.year + n)
    except ValueError:
        return datetime.date(d.year + n, 3, 1)


is_registered = registry.is_registered


def validate_optional_refs(serializer, collection: str, value):
    """validate_refs, ignorée tant que la collection cible n'est pas enregistrée (autre lot)."""
    if not is_registered(collection):
        return value
    return validate_refs(serializer, collection, value)


def log_act(request, action: str, mod: str, statut: str = "Terminé") -> None:
    """logAct() du front (apps.core.tracing), à partir de la requête."""
    tracing.log_act(request.user, action, mod, statut)


def niveau(rec: dict) -> int:
    """niv() du front : probabilité × (criticité || impact)."""
    return (rec.get("probabilite") or 0) * (rec.get("criticite") or rec.get("impact") or 0)


def niveau_label(score: int) -> str:
    """nivLbl() du front."""
    if score >= 12:
        return "Très élevé"
    if score >= 8:
        return "Élevé"
    if score >= 4:
        return "Moyen"
    return "Faible"


def objectif_avancement(actions: list) -> float:
    """objProg() du front : % d'actions clôturées."""
    if not actions:
        return 0
    return len([a for a in actions if a.get("statut") == "Clôturé"]) / len(actions) * 100


def objectif_en_retard(actions: list, ref: datetime.date | None = None) -> bool:
    """objLate() du front : une action non clôturée a dépassé son échéance."""
    ref = ref or today()
    for a in actions:
        if a.get("statut") == "Clôturé":
            continue
        try:
            if datetime.date.fromisoformat(a.get("echeance") or "") < ref:
                return True
        except ValueError:
            continue
    return False


def next_padded_uid(model, org, prefix: str, width: int = 2) -> str:
    """Id séquentiel des risques (R08) et opportunités (O04) : préfixe + nombre d'éléments."""
    n = model.objects.filter(organisation=org).count() + 1
    while model.objects.filter(organisation=org, uid=f"{prefix}{n:0{width}d}").exists():
        n += 1
    return f"{prefix}{n:0{width}d}"


def create_linked(request, collection: str, data: dict, unshift: bool = True):
    """
    Crée un élément dans la collection d'un autre module (ncs, registre…) via son
    sérialiseur, si elle est enregistrée ; `unshift` le place en tête comme le front.
    Renvoie l'objet créé, ou None si la collection n'existe pas (encore).
    """
    if not is_registered(collection):
        return None
    col = registry.get(collection)
    org = request.user.organisation
    ctx = {"organisation": org, "request": request, "skip_ref_validation": True}
    ser = col.serializer(data=data, context=ctx)
    ser.is_valid(raise_exception=True)
    obj = ser.save()
    if unshift:
        col.model.objects.filter(organisation=org).exclude(pk=obj.pk).update(position=F("position") + 1)
        obj.position = 0
        obj.save(update_fields=["position"])
    log_write(request, collection, AuditLog.Action.CREATE, obj.uid, ser.data)
    return obj


def count_of(collection: str, org) -> int:
    if not is_registered(collection):
        return 0
    return registry.get(collection).model.objects.filter(organisation=org).count()


def add_registre(request, type_: str, intitule: str, origine: str, processus: str, normes, responsable: str):
    """addRegistre() du front : apps.core.tracing.add_registre, tracé dans l'AuditLog."""
    return tracing.add_registre(
        request.user.organisation, type_, intitule, origine, processus, normes, responsable, request=request
    )
