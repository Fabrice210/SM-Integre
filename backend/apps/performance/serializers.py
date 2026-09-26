"""Sérialiseurs du module 6 : format exact du front + validation des références et des tableaux imbriqués."""

import datetime as dt

from django.utils import timezone
from rest_framework import serializers
from rest_framework.utils.serializer_helpers import ReturnList

from apps.core import registry
from apps.core.refs import validate_refs
from apps.core.serializers import OrgModelSerializer, OrgSingletonSerializer

from . import models as m

# ---------- Outils ----------


class NumberField(serializers.FloatField):
    """Nombre du front : rendu entier quand la valeur est entière (90 et non 90.0)."""

    def to_representation(self, value):
        v = float(value)
        return int(v) if v.is_integer() else v


def _skip(serializer) -> bool:
    return bool(serializer.context.get("skip_ref_validation"))


def _iso_date(value, label: str) -> str:
    if not isinstance(value, str):
        raise serializers.ValidationError(f"{label} : date AAAA-MM-JJ attendue.")
    try:
        dt.date.fromisoformat(value)
    except ValueError as exc:
        raise serializers.ValidationError(f"{label} : date AAAA-MM-JJ attendue.") from exc
    return value


def _objects(value, label: str) -> list[dict]:
    if not isinstance(value, list) or not all(isinstance(x, dict) for x in value):
        raise serializers.ValidationError(f"{label} : liste d'objets attendue.")
    return value


def _text(item: dict, key: str, label: str, required=True) -> None:
    v = item.get(key)
    if v is None and not required:
        return
    if not isinstance(v, str) or (required and not v.strip()):
        raise serializers.ValidationError(f"{label} : « {key} » (texte) obligatoire.")


def _choice(item: dict, key: str, choices, label: str) -> None:
    if item.get(key) not in choices.values:
        raise serializers.ValidationError(
            f"{label} : « {key} » doit valoir {', '.join(choices.values)} (reçu : {item.get(key)!r})."
        )


def _series(attrs: dict, keys: tuple[str, ...], labels_key: str, instance=None) -> dict:
    """Séries d'un graphique : listes de même longueur, nombres (sauf libellés)."""
    data = {k: attrs.get(k, getattr(instance, k, None) if instance else None) for k in keys}
    errors = {}
    for k, v in data.items():
        if v is None:
            continue
        if not isinstance(v, list):
            errors[k] = "Liste attendue."
        elif k == labels_key and not all(isinstance(x, str) for x in v):
            errors[k] = "Liste de libellés attendue."
        elif k != labels_key and not all(isinstance(x, int | float) and not isinstance(x, bool) for x in v):
            errors[k] = "Liste de nombres attendue."
    if errors:
        raise serializers.ValidationError(errors)
    lengths = {len(v) for v in data.values() if isinstance(v, list)}
    if len(lengths) > 1:
        raise serializers.ValidationError("Les séries doivent avoir la même longueur que les libellés.")
    return attrs


# ---------- 6.1 Surveillance ----------


class IndicateurSerializer(OrgModelSerializer):
    cible = NumberField()
    valeur = NumberField(required=False, allow_null=True)

    class Meta(OrgModelSerializer.Meta):
        model = m.Indicateur

    def validate_processus(self, value):
        return validate_refs(self, "processus", value)

    def validate_objectif(self, value):
        """Code d'objectif (OB-01…) ou « — » ; vérifié si la collection objectifs est disponible."""
        if value in ("", "—") or _skip(self):
            return value
        try:
            model = registry.get("objectifs").model
        except KeyError:
            return value
        if not any(f.name == "code" for f in model._meta.get_fields()):
            return value
        if not model.objects.filter(organisation=self.organisation, code=value).exists():
            raise serializers.ValidationError(f"Objectif inconnu : {value}")
        return value


NOTE_KEYS = ("qualite", "delai", "securite", "environnement")


def validate_notes(value):
    if not isinstance(value, dict):
        raise serializers.ValidationError("Objet {qualite, delai, securite, environnement} attendu.")
    unknown = set(value) - set(NOTE_KEYS)
    if unknown:
        raise serializers.ValidationError(f"Critères inconnus : {', '.join(sorted(unknown))}")
    for k in NOTE_KEYS:
        v = value.get(k)
        if isinstance(v, bool) or not isinstance(v, int) or not 1 <= v <= 5:
            raise serializers.ValidationError(f"« {k} » : note entière de 1 à 5 obligatoire.")
    return value


class PrestataireSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = m.Prestataire

    def validate_processus(self, value):
        return validate_refs(self, "processus", value)

    def validate_notes(self, value):
        return validate_notes(value)


class EvaluationSerializer(serializers.Serializer):
    """Évaluation d'un intervenant externe (evalPresta) : quatre notes de 1 à 5."""

    qualite = serializers.IntegerField(min_value=1, max_value=5)
    delai = serializers.IntegerField(min_value=1, max_value=5)
    securite = serializers.IntegerField(min_value=1, max_value=5)
    environnement = serializers.IntegerField(min_value=1, max_value=5)


class StatsSurveillanceSerializer(OrgSingletonSerializer):
    class Meta(OrgSingletonSerializer.Meta):
        model = m.StatsSurveillance

    def validate(self, attrs):
        keys = ("mois", "incidents", "dysfonctionnements", "dechets")
        return _series(attrs, keys, "mois", self.instance)


# ---------- 6.2 Audits ----------


class AuditeurSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = m.Auditeur


def validate_constat(item) -> dict:
    if not isinstance(item, dict):
        raise serializers.ValidationError("Constat : objet {type, description, processus} attendu.")
    _choice(item, "type", m.Audit.TypeConstat, "Constat")
    _text(item, "description", "Constat")
    _text(item, "processus", "Constat", required=False)
    return item


class AuditSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = m.Audit

    def validate_perimetre(self, value):
        return validate_refs(self, "processus", value)

    def validate_constats(self, value):
        for c in _objects(value, "Constats"):
            validate_constat(c)
        procs = sorted({c["processus"] for c in value if c.get("processus")})
        validate_refs(self, "processus", procs)
        return value

    def validate(self, attrs):
        """Auditeur connu et indépendant du périmètre (contrôle du formulaire du front)."""
        if _skip(self):
            return attrs
        inst = self.instance
        nom = attrs.get("auditeur", getattr(inst, "auditeur", ""))
        perimetre = attrs.get("perimetre", getattr(inst, "perimetre", ""))
        changed = inst is None or nom != inst.auditeur or perimetre != inst.perimetre
        if not nom or not changed:
            return attrs
        a = m.Auditeur.objects.filter(organisation=self.organisation, nom=nom).first()
        if a is None:
            raise serializers.ValidationError({"auditeur": f"Auditeur inconnu : {nom}"})
        if perimetre and perimetre in (a.independance or ""):
            raise serializers.ValidationError(
                {"auditeur": "Auditeur non indépendant de ce processus : choisissez-en un autre."}
            )
        return attrs


class RapportAuditSerializer(serializers.Serializer):
    """Dépôt du rapport d'audit (audReport)."""

    rapport = serializers.CharField(max_length=255)
    compteRendu = serializers.CharField()


class ConstatSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=m.Audit.TypeConstat.choices)
    processus = serializers.CharField(max_length=32, required=False, allow_blank=True)
    description = serializers.CharField()

    def validate_processus(self, value):
        return validate_refs(self, "processus", value)


# ---------- 6.3 Revues ----------


def validate_action_revue(item) -> dict:
    if not isinstance(item, dict):
        raise serializers.ValidationError("Action : objet {libelle, responsable, echeance, statut} attendu.")
    _text(item, "libelle", "Action")
    _text(item, "responsable", "Action", required=False)
    _iso_date(item.get("echeance"), "Action : échéance")
    _choice(item, "statut", m.Revue.StatutAction, "Action")
    return item


class RevueSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = m.Revue

    def validate_ordre_du_jour(self, value):
        # Le formulaire du front saisit l'ordre du jour « un point par ligne ».
        if isinstance(value, str):
            value = [x for x in value.split("\n") if x]
        if not isinstance(value, list) or not all(isinstance(x, str) for x in value):
            raise serializers.ValidationError("Liste de points (texte) attendue.")
        return value

    def validate_actions(self, value):
        for a in _objects(value, "Actions"):
            validate_action_revue(a)
        return value


class ActionRevueSerializer(serializers.Serializer):
    libelle = serializers.CharField()
    responsable = serializers.CharField(required=False, allow_blank=True, default="")
    echeance = serializers.DateField()
    statut = serializers.ChoiceField(
        choices=m.Revue.StatutAction.choices, default=m.Revue.StatutAction.MISE_EN_OEUVRE
    )


# ---------- 6.4 Non-conformités ----------

NC_PREFIX = {
    m.NonConformite.Categorie.NON_CONFORMITE: "NC",
    m.NonConformite.Categorie.ACCIDENT: "INC",
    m.NonConformite.Categorie.AMELIORATION: "AM",
    m.NonConformite.Categorie.OBSERVATION: "OBS",
}


class NonConformiteSerializer(OrgModelSerializer):
    ref = serializers.CharField(max_length=64, required=False, allow_blank=True)
    date = serializers.DateField(required=False)

    class Meta(OrgModelSerializer.Meta):
        model = m.NonConformite

    def validate_processus(self, value):
        return validate_refs(self, "processus", value)

    def validate_source(self, value):
        if not value or _skip(self):
            return value
        sources = (
            m.SourcesNC.objects.filter(organisation=self.organisation)
            .values_list("valeurs", flat=True)
            .first()
        )
        if sources and value not in sources:
            raise serializers.ValidationError(f"Source inconnue : {value} (voir la liste des sources).")
        return value

    def create(self, validated_data):
        """Déclaration : date du jour et référence <préfixe>-<année>-0<25 + nb> comme le front."""
        org = self.organisation
        validated_data.setdefault("date", timezone.localdate())
        if not validated_data.get("ref"):
            cat = validated_data.get("categorie", m.NonConformite.Categorie.NON_CONFORMITE)
            n = m.NonConformite.objects.filter(organisation=org).count() + 1
            validated_data["ref"] = f"{NC_PREFIX.get(cat, 'NC')}-{timezone.localdate().year}-0{25 + n}"
        return super().create(validated_data)


class SourcesNCSerializer(OrgSingletonSerializer):
    """db.sourcesNC est une simple liste de libellés : rendue et acceptée telle quelle."""

    class Meta(OrgSingletonSerializer.Meta):
        model = m.SourcesNC
        fields = ["valeurs"]

    def to_representation(self, instance):
        return list(instance.valeurs or [])

    def to_internal_value(self, data):
        if isinstance(data, dict) and set(data) == {"valeurs"}:
            data = data["valeurs"]
        if not isinstance(data, list) or not all(isinstance(x, str) and x.strip() for x in data):
            raise serializers.ValidationError({"valeurs": ["Liste de libellés non vides attendue."]})
        if len(set(data)) != len(data):
            raise serializers.ValidationError({"valeurs": ["Libellés en double."]})
        return {"valeurs": data}

    @property
    def data(self):
        # Serializer.data enveloppe dans un ReturnDict : ici la représentation est une liste.
        return ReturnList(serializers.BaseSerializer.data.fget(self), serializer=self)


class EfficaciteSerializer(serializers.Serializer):
    efficacite = serializers.CharField()


class AnalyseSerializer(serializers.Serializer):
    cause = serializers.CharField(required=False)
    action = serializers.CharField(required=False)
    miseEnOeuvre = serializers.CharField(required=False)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError("Renseignez la cause, l'action ou la mise en œuvre.")
        return attrs


# ---------- 6.5 Registre ----------


class RegistreEntreeSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = m.RegistreEntree

    def validate_processus(self, value):
        return validate_refs(self, "processus", value)
