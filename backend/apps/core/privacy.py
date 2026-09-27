"""
Protection des données personnelles (Code du numérique du Bénin, livre V ; esprit RGPD).

  GET  /api/v1/auth/me/export/        droit d'accès / portabilité : fichier JSON des données
                                      personnelles de l'utilisateur connecté ;
  POST /api/v1/users/<id>/anonymiser/ effacement (action d'administration, cf. UserViewSet).

Les personnes sont référencées par leur nom complet dans les collections du registre (pilote,
responsable, participants…, cf. backend/README.md) : la recherche et le remplacement portent
sur les champs texte et les JSON (listes, objets, `extra` dont `hist`) de chaque collection de
l'organisme, jamais sur ceux d'un autre organisme.

Compromis traçabilité ISO / effacement : le journal fonctionnel (JournalEntry) et la trace
technique (AuditLog) sont conservés ; le nom n'y est pseudonymisé que si l'administrateur le
demande (`remplacerDansDonnees`). Voir docs/DONNEES_PERSONNELLES.md.
"""

import re

from django.db import models
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from . import registry
from .models import AuditLog, JournalEntry, Organisation
from .naming import to_camel
from .tracing import log_act

# En dessous, un « nom » est trop court pour être recherché sans faux positifs.
MIN_NAME_LENGTH = 3
# Champs techniques jamais parcourus.
_SKIPPED_FIELDS = {"uid", "organisation"}


def anonymous_label(user) -> str:
    return f"Utilisateur supprimé #{user.pk}"


def anonymous_email(user) -> str:
    # Domaine réservé .invalid (RFC 2606) : jamais routable, unique par clé primaire.
    return f"utilisateur-supprime-{user.pk}@anonymise.invalid"


def name_pattern(name: str) -> re.Pattern | None:
    """Nom complet en mot entier, insensible à la casse ; None si trop court pour être sûr."""
    name = (name or "").strip()
    if len(name) < MIN_NAME_LENGTH:
        return None
    return re.compile(r"(?<!\w)" + re.escape(name) + r"(?!\w)", re.IGNORECASE)


def _contains(value, pattern: re.Pattern) -> bool:
    if isinstance(value, str):
        return bool(pattern.search(value))
    if isinstance(value, list):
        return any(_contains(v, pattern) for v in value)
    if isinstance(value, dict):
        return any(_contains(v, pattern) for v in value.values())
    return False


def _replace(value, pattern: re.Pattern, repl: str):
    """Copie de `value` (texte / JSON) où le nom est remplacé ; renvoie (valeur, nombre)."""
    if isinstance(value, str):
        return pattern.subn(lambda _m: repl, value)
    if isinstance(value, list):
        out, n = [], 0
        for v in value:
            v2, k = _replace(v, pattern, repl)
            out.append(v2)
            n += k
        return out, n
    if isinstance(value, dict):
        out, n = {}, 0
        for key, v in value.items():
            v2, k = _replace(v, pattern, repl)
            out[key] = v2
            n += k
        return out, n
    return value, 0


def _text_fields(model) -> list[models.Field]:
    return [
        f
        for f in model._meta.concrete_fields
        if isinstance(f, (models.CharField, models.TextField, models.JSONField))
        and not f.choices
        and f.name not in _SKIPPED_FIELDS
    ]


def _org_records(org: Organisation):
    """(collection, id, objet, champs texte) de chaque élément du registre de l'organisme."""
    for col in registry.all_collections():
        fields = _text_fields(col.model)
        if not fields:
            continue
        for obj in col.model.objects.filter(organisation=org).order_by("pk"):
            yield col.name, getattr(obj, "uid", ""), obj, fields


def _api_names(field: models.Field, value, pattern: re.Pattern) -> list[str]:
    """Nom(s) de champ côté API : les clés de `extra` sont exposées à plat."""
    if field.name == "extra" and isinstance(value, dict):
        return [k for k, v in value.items() if _contains(v, pattern)]
    return [to_camel(field.name)] if _contains(value, pattern) else []


def find_mentions(org: Organisation | None, name: str) -> list[dict]:
    """Éléments du registre où `name` apparaît : [{collection, id, champs}]."""
    pattern = name_pattern(name)
    if org is None or pattern is None:
        return []
    found = []
    for col_name, uid, obj, fields in _org_records(org):
        champs = [c for f in fields for c in _api_names(f, getattr(obj, f.name), pattern)]
        if champs:
            found.append({"collection": col_name, "id": uid, "champs": champs})
    profil_keys = [k for k, v in (org.profil or {}).items() if _contains(v, pattern)]
    if profil_keys:
        found.append({"collection": "organisation", "id": "", "champs": profil_keys})
    return found


def replace_mentions(org: Organisation, name: str, repl: str) -> int:
    """Remplace `name` par `repl` dans le registre et la fiche de l'organisme ; renvoie le total."""
    pattern = name_pattern(name)
    if pattern is None:
        return 0
    total = 0
    for _col, _uid, obj, fields in _org_records(org):
        changed = []
        for f in fields:
            value, n = _replace(getattr(obj, f.name), pattern, repl)
            if n:
                setattr(obj, f.name, value)
                changed.append(f.name)
                total += n
        if changed:
            # save(update_fields) : sans passer par les sérialiseurs (aucune règle métier rejouée).
            obj.save(update_fields=[*changed, *(["updated_at"] if hasattr(obj, "updated_at") else [])])
    profil, n = _replace(org.profil or {}, pattern, repl)
    if n:
        org.profil = profil
        org.save(update_fields=["profil"])
        total += n
    return total


def pseudonymise_logs(org: Organisation, user, name: str, repl: str) -> int:
    """Nom remplacé dans le journal fonctionnel et la trace technique (historique conservé)."""
    pattern = name_pattern(name)
    total = 0
    entries = JournalEntry.objects.filter(organisation=org)
    for e in entries:
        changed = []
        if e.user_id == user.pk or (pattern and pattern.fullmatch(e.u or "")):
            if e.u != repl:
                e.u = repl
                changed.append("u")
        if pattern:
            a, n = _replace(e.a, pattern, repl)
            if n:
                e.a = a
                changed.append("a")
        if changed:
            e.save(update_fields=changed)
            total += 1
    if pattern:
        for log in AuditLog.objects.filter(organisation=org):
            data, n = _replace(log.data, pattern, repl)
            if n:
                log.data = data
                log.save(update_fields=["data"])
                total += 1
    return total


def export_payload(user) -> dict:
    """Données personnelles de `user` (sans hash du mot de passe), prêtes pour un fichier JSON."""
    from apps.notifications.models import NotificationLog, NotificationPreference

    org = user.organisation
    pref = NotificationPreference.for_user(user)
    journal = JournalEntry.objects.filter(user=user)
    if org is not None and user.nom:
        journal = JournalEntry.objects.filter(organisation=org).filter(
            models.Q(user=user) | models.Q(u=user.nom)
        )
    return {
        "format": "sm-integre/donnees-personnelles",
        "version": 1,
        "exporteLe": timezone.now().isoformat(),
        "organisme": {"nom": org.nom, "sigle": org.sigle} if org else None,
        "compte": {
            "id": user.uid,
            "nom": user.nom,
            "email": user.email,
            "poste": user.poste,
            "direction": user.direction,
            "roles": list(user.roles or []),
            "actif": user.is_active,
            "inscritLe": user.date_joined.isoformat() if user.date_joined else None,
            "derniereConnexion": user.last_login.isoformat() if user.last_login else None,
        },
        "preferencesNotifications": {
            "actif": pref.actif,
            "echeances": pref.echeances,
            "validations": pref.validations,
            "enregistrees": pref.pk is not None,
        },
        "notificationsEnvoyees": [
            {"date": n.date.isoformat(), "type": n.kind, "titre": n.titre, "envoyeLe": n.sent_at.isoformat()}
            for n in NotificationLog.objects.filter(user=user).order_by("sent_at", "id")
        ],
        "journal": [
            {"d": e.d, "u": e.u, "a": e.a, "mod": e.mod, "statut": e.statut} for e in journal.order_by("id")
        ],
        "traceTechnique": [
            {
                "le": log.at.isoformat(),
                "collection": log.collection,
                "id": log.uid,
                "action": log.action,
                "donnees": log.data,
            }
            for log in AuditLog.objects.filter(user=user).order_by("at", "id")
        ],
        "mentions": find_mentions(org, user.nom),
    }


def anonymise_user(user, *, replace_in_data: bool = False) -> dict:
    """
    Efface les données d'identification de `user` (l'appelant ouvre la transaction).

    Compte désactivé et conservé (les références d'historique restent cohérentes), nom /
    e-mail / poste / direction remplacés, mot de passe inutilisable, jetons de
    rafraîchissement révoqués, préférences et envois de notifications supprimés. Avec
    `replace_in_data`, le nom est aussi remplacé dans le registre, le journal et l'AuditLog.
    """
    from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

    from apps.notifications.models import NotificationLog, NotificationPreference

    org = user.organisation
    old_name = user.nom
    label = anonymous_label(user)

    tokens = 0
    for tok in OutstandingToken.objects.filter(user=user):
        _, created = BlacklistedToken.objects.get_or_create(token=tok)
        tokens += int(created)
    NotificationPreference.objects.filter(user=user).delete()
    NotificationLog.objects.filter(user=user).delete()

    remplacements = journal = 0
    if replace_in_data and org is not None:
        remplacements = replace_mentions(org, old_name, label)
        journal = pseudonymise_logs(org, user, old_name, label)

    user.nom = label
    user.email = user.username = anonymous_email(user)
    user.first_name = user.last_name = ""
    user.poste = user.direction = ""
    user.roles = []
    user.is_active = False
    user.last_login = None
    user.set_unusable_password()
    user.save()
    return {
        "id": user.uid,
        "nom": label,
        "jetonsRevoques": tokens,
        "remplacementsDonnees": remplacements,
        "journalPseudonymise": journal,
    }


# ---------- Vue : export des données de l'utilisateur connecté ----------


class MyDataExportView(APIView):
    """Droit d'accès et à la portabilité : tout utilisateur connecté, auditeurs externes compris."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "export"

    @extend_schema(
        summary="Exporter mes données personnelles (fichier JSON)",
        responses=OpenApiResponse(
            response=OpenApiTypes.OBJECT,
            description="{format, version, exporteLe, organisme, compte, preferencesNotifications, "
            "notificationsEnvoyees, journal, traceTechnique, mentions: [{collection, id, champs}]}",
        ),
    )
    def get(self, request):
        user = request.user
        payload = export_payload(user)
        if user.organisation_id:
            log_act(user, "a exporté ses données personnelles", "Données personnelles")
        stamp = timezone.localdate().isoformat()
        filename = f"donnees-personnelles-{user.uid or user.pk}-{stamp}.json"
        response = Response(payload)
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["Cache-Control"] = "no-store"
        return response
