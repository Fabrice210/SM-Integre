"""
Droits fins par processus (réglage d'organisme `droitsParProcessus`, désactivé par défaut).

Quand le réglage est actif, un utilisateur dont les seuls rôles d'écriture sont « Pilote de
processus » / « Copilote de processus » (aucun rôle global : Dirigeant, Responsable SM,
Auditeur interne, Administrateur système) est « limité à ses processus » :

  - ses processus : ceux dont il est pilote (`Processus.proprietaire == user.nom`) ou
    copilote (`user.nom in Processus.copilote`) ;
  - rattachement d'un élément : son champ `processus` (uid, ou liste d'uids : au moins un
    doit lui appartenir). « Tous » ou vide : aucun processus, rôles globaux seulement ;
  - création : le `processus` fourni dans le corps doit lui appartenir ;
  - modification / suppression / action métier sur un élément (detail=True) : l'élément
    doit être rattaché à l'un de ses processus, et un nouveau `processus` envoyé par
    PUT / PATCH aussi (pas de déplacement vers le processus d'un autre) ;
  - collection `processus` : il modifie la fiche de ses propres processus, sans changer
    `proprietaire` ni `copilote` ; création et suppression : rôles globaux ;
  - objets uniques (politique, competences…), collections sans champ `processus`, actions
    de liste (detail=False : import, planification annuelle…) : rôles globaux seulement.

La lecture est inchangée, comme les routes ouvertes à tout membre (accusé de lecture,
déclaration de NC, journal, actions réservées à la personne nommée dans l'élément) : ces
routes n'utilisent pas IsOrgMember, qui applique ces règles (apps.core.permissions).
"""

from collections.abc import Mapping

from django.core.exceptions import FieldDoesNotExist

from . import registry
from .models import Role

GLOBAL_WRITE_ROLES = (Role.DIRIGEANT, Role.RESPONSABLE_SM, Role.AUDITEUR_INTERNE, Role.ADMIN)
PROCESS_ROLES = (Role.PILOTE, Role.COPILOTE)
PROCESS_FIELD = "processus"
PROCESS_COLLECTION = "processus"
# Valeur « tous les processus » (documents) : aucun processus précis.
ALL_PROCESSES = "Tous"
# Champs de la fiche processus que son pilote / copilote ne peut pas changer.
PROCESS_OWNER_FIELDS = ("proprietaire", "copilote")

DENIED = "Droits par processus : action réservée aux rôles globaux (Dirigeant, Responsable SM…)."
DENIED_PROCESS = (
    "Droits par processus : élément rattaché à un processus dont vous n'êtes ni pilote ni copilote."
)
DENIED_OWNER = "Droits par processus : le pilote et les copilotes d'un processus ne sont modifiables que par les rôles globaux."


def is_process_scoped(user) -> bool:
    """Utilisateur limité à ses processus (réglage actif, pilote / copilote sans rôle global)."""
    org = getattr(user, "organisation", None)
    return bool(
        org is not None
        and org.droits_par_processus
        and not user.is_superuser
        and user.has_role(*PROCESS_ROLES)
        and not user.has_role(*GLOBAL_WRITE_ROLES)
    )


def process_ids(value) -> set[str]:
    """Uids de processus d'une valeur `processus` (uid, liste d'uids, « Tous », vide)."""
    values = [value] if isinstance(value, str) else value if isinstance(value, (list, tuple)) else []
    return {v for v in values if isinstance(v, str) and v and v != ALL_PROCESSES}


def owned_processes(request) -> frozenset[str]:
    """Processus dont l'utilisateur est pilote ou copilote (mémorisé pour la requête)."""
    cached = getattr(request, "_owned_processes", None)
    if cached is not None:
        return cached
    user = request.user
    try:
        model = registry.get(PROCESS_COLLECTION).model
    except KeyError:
        owned = frozenset()
    else:
        rows = model.objects.filter(organisation=user.organisation).values_list(
            "uid", "proprietaire", "copilote"
        )
        owned = frozenset(
            uid
            for uid, pilote, copilotes in rows
            if pilote == user.nom or (isinstance(copilotes, list) and user.nom in copilotes)
        )
    request._owned_processes = owned
    return owned


def owns_any(request, value) -> bool:
    return bool(process_ids(value) & owned_processes(request))


def scope_kind(col) -> str | None:
    """'self' (la collection processus), 'field' (champ processus) ou None (rôles globaux)."""
    if col is None or col.singleton:
        return None
    if col.name == PROCESS_COLLECTION:
        return "self"
    try:
        col.model._meta.get_field(PROCESS_FIELD)
    except FieldDoesNotExist:
        return None
    return "field"


def _body(request) -> Mapping:
    data = request.data
    return data if isinstance(data, Mapping) else {}


def _is_detail(view) -> bool:
    lookup = getattr(view, "lookup_url_kwarg", None) or getattr(view, "lookup_field", None)
    return bool(lookup) and lookup in getattr(view, "kwargs", {})


def check_view(request, view) -> str | None:
    """Écriture d'un utilisateur limité, avant l'objet : None si autorisée, sinon le motif."""
    kind = scope_kind(getattr(view, "collection", None))
    if kind is None:
        return DENIED
    if getattr(view, "action", None) == "create":
        if kind == "self":
            return DENIED
        return None if owns_any(request, _body(request).get(PROCESS_FIELD)) else DENIED_PROCESS
    if _is_detail(view):
        return None  # contrôle sur l'objet (check_object)
    return DENIED  # action de liste (import, planification…)


def check_object(request, view, obj) -> str | None:
    """Écriture d'un utilisateur limité sur un élément : None si autorisée, sinon le motif."""
    kind = scope_kind(getattr(view, "collection", None))
    action = getattr(view, "action", None)
    body = _body(request)
    if kind == "self":
        if action == "destroy":
            return DENIED
        if obj.uid not in owned_processes(request):
            return DENIED_PROCESS
        if action in ("update", "partial_update") and any(
            k in body and body[k] != getattr(obj, k) for k in PROCESS_OWNER_FIELDS
        ):
            return DENIED_OWNER
        return None
    if kind != "field":
        return DENIED
    if not owns_any(request, getattr(obj, PROCESS_FIELD, None)):
        return DENIED_PROCESS
    if action in ("update", "partial_update") and PROCESS_FIELD in body:
        if not owns_any(request, body[PROCESS_FIELD]):
            return DENIED_PROCESS
    return None
