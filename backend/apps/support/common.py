"""
Outils partagés par les apps support (module 4) et operations (module 5).

Ils complètent apps.core sans le modifier :
  - références vers des collections d'autres apps, validées seulement si ces
    collections sont enregistrées (les lots sont développés en parallèle) ;
  - personnes référencées par leur nom complet (comme dans le front) ;
  - dates « ISO ou valeur de remplacement » ('—', '') présentes dans la démo ;
  - historique (`hist`) et journal fonctionnel écrits par les actions métier,
    avec les mêmes libellés que le front (logAct / hist) ;
  - erreur 409 pour une transition de workflow impossible.
"""

import datetime as dt

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.exceptions import APIException
from rest_framework.response import Response

from apps.core import registry
from apps.core.models import AuditLog, JournalEntry
from apps.core.permissions import WRITE_ROLES
from apps.core.refs import validate_refs
from apps.core.viewsets import log_write

MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]


# ---------- Dates ----------


def today() -> dt.date:
    return timezone.localdate()


def now_stamp() -> str:
    """nowStamp() du front : « AAAA-MM-JJ HH:MM » (heure locale)."""
    return timezone.localtime().strftime("%Y-%m-%d %H:%M")


def fd(value) -> str:
    """fd() du front : « 21 sept. 2026 » ; la valeur telle quelle si ce n'est pas une date."""
    if not value or value == "—":
        return "—"
    if isinstance(value, str):
        try:
            value = dt.date.fromisoformat(value)
        except ValueError:
            return value
    return f"{value.day} {MOIS[value.month - 1]} {value.year}"


def is_iso_date(value) -> bool:
    if not isinstance(value, str):
        return False
    try:
        dt.date.fromisoformat(value)
    except ValueError:
        return False
    return len(value) == 10


class IsoDateOrPlaceholderField(serializers.CharField):
    """Date ISO (AAAA-MM-JJ) ou valeur de remplacement du front ('—', '')."""

    def __init__(self, placeholders=("—",), **kwargs):
        self.placeholders = tuple(placeholders)
        kwargs.setdefault("max_length", 10)
        kwargs["allow_blank"] = "" in self.placeholders
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        if value in self.placeholders or is_iso_date(value):
            return value
        allowed = " ou ".join(repr(p) for p in self.placeholders)
        raise serializers.ValidationError(f"Date au format AAAA-MM-JJ attendue (ou {allowed}).")


class OptionalDateField(serializers.DateField):
    """DateField qui accepte '' (champ date vidé dans un formulaire) comme absence de valeur."""

    def to_internal_value(self, value):
        if value in ("", None):
            return None
        return super().to_internal_value(value)


# ---------- Références ----------


def is_registered(collection: str) -> bool:
    try:
        registry.get(collection)
    except KeyError:
        return False
    return True


def _unchanged(serializer, field: str | None, value) -> bool:
    inst = getattr(serializer, "instance", None)
    return (
        bool(field)
        and inst is not None
        and not isinstance(inst, list)
        and getattr(inst, field, None) == value
    )


def validate_optional_refs(serializer, collection: str, value, field: str | None = None):
    """validate_refs, seulement si la collection est enregistrée et la valeur modifiée."""
    if not is_registered(collection) or _unchanged(serializer, field, value):
        return value
    return validate_refs(serializer, collection, value)


def validate_named_refs(serializer, collection: str, attr: str, values, field: str | None = None):
    """Références par libellé (ex. sites d'une situation d'urgence référencés par leur `nom`)."""
    if not values or serializer.context.get("skip_ref_validation") or not is_registered(collection):
        return values
    if _unchanged(serializer, field, values):
        return values
    model = registry.get(collection).model
    if attr not in {f.name for f in model._meta.get_fields()}:
        return values
    names = values if isinstance(values, list) else [values]
    org = serializer.context["organisation"]
    found = set(model.objects.filter(organisation=org, **{f"{attr}__in": names}).values_list(attr, flat=True))
    missing = [n for n in names if n not in found]
    if missing:
        raise serializers.ValidationError(f"Références inconnues ({collection}) : {', '.join(missing)}")
    return values


def validate_person(serializer, value, field: str | None = None):
    """Personne référencée par son nom complet : doit être un utilisateur de l'organisme."""
    if not value or serializer.context.get("skip_ref_validation") or _unchanged(serializer, field, value):
        return value
    org = serializer.context["organisation"]
    if not get_user_model().objects.filter(organisation=org, nom=value).exists():
        raise serializers.ValidationError(f"Utilisateur inconnu : {value}")
    return value


def validate_str_list(value, label: str = "valeur"):
    if not isinstance(value, list) or not all(isinstance(v, str) and v.strip() for v in value):
        raise serializers.ValidationError(f"Liste de {label}s (texte non vide) attendue.")
    return value


def check_keys(item, required: dict, where: str, optional: dict | None = None):
    """Valide un objet imbriqué : clés obligatoires et types ({clé: type ou tuple de types})."""
    if not isinstance(item, dict):
        raise serializers.ValidationError(f"{where} : objet attendu.")
    missing = [k for k in required if k not in item]
    if missing:
        raise serializers.ValidationError(f"{where} : champ(s) manquant(s) : {', '.join(missing)}.")
    for k, types in {**required, **(optional or {})}.items():
        if k in item and not isinstance(item[k], types):
            raise serializers.ValidationError(f"{where} : type invalide pour « {k} ».")


# ---------- Workflow ----------


class TransitionError(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "Action impossible dans l'état actuel."
    default_code = "invalid_transition"


def require_state(obj, allowed, action: str):
    if obj.statut not in allowed:
        raise TransitionError(f"{action} impossible au statut « {obj.statut} ».")


def is_writer(user) -> bool:
    return bool(user.is_superuser or user.has_role(*WRITE_ROLES))


def add_hist(obj, user, text: str):
    """hist() du front : entrée en tête de l'historique de l'enregistrement (conservé dans extra)."""
    extra = dict(obj.extra or {})
    extra["hist"] = [{"d": now_stamp(), "u": user.nom, "a": text}, *(extra.get("hist") or [])]
    obj.extra = extra


def log_act(user, text: str, mod: str, statut: str = "Terminé"):
    """logAct() du front : entrée du journal fonctionnel."""
    JournalEntry.objects.create(
        organisation=user.organisation, user=user, d=now_stamp(), u=user.nom, a=text, mod=mod, statut=statut
    )


def payload(serializer_class, request) -> dict:
    """Corps d'une action métier validé par un petit sérialiseur d'entrée."""
    ser = serializer_class(data=request.data)
    ser.is_valid(raise_exception=True)
    return ser.validated_data


class ActionMixin:
    """Pour les ViewSets : enregistre une action métier (hist, journal fonctionnel, AuditLog)
    et renvoie l'objet au format du front."""

    def _done(self, obj, hist_text, journal_text, mod, statut="Terminé", code=status.HTTP_200_OK):
        user = self.request.user
        add_hist(obj, user, hist_text)
        obj.save()
        log_act(user, journal_text, mod, statut)
        data = self.get_serializer(obj).data
        log_write(self.request, self.collection.name, AuditLog.Action.UPDATE, obj.uid, data)
        return Response(data, status=code)
