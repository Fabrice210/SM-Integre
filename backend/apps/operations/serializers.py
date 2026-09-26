import os

from rest_framework import serializers

from apps.core.serializers import OrgModelSerializer
from apps.support.common import (
    OptionalDateField,
    check_keys,
    is_iso_date,
    today,
    validate_named_refs,
    validate_optional_refs,
    validate_person,
    validate_str_list,
)

from .models import Document, Modele, PlanOps, Urgence

TOUS = "Tous"


class FileNameField(serializers.CharField):
    """Pièce jointe exposée comme dans le front : le seul nom du fichier (chaîne), en lecture seule."""

    def __init__(self, **kwargs):
        kwargs["read_only"] = True
        super().__init__(**kwargs)

    def to_representation(self, value):
        return os.path.basename(value.name) if value else None


def _current_user_name(serializer) -> str:
    request = serializer.context.get("request")
    user = getattr(request, "user", None)
    return getattr(user, "nom", "") if user and user.is_authenticated else ""


class ModeleSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = Modele

    def validate_processus(self, value):
        if value == TOUS:
            return value
        return validate_optional_refs(self, "processus", value, "processus")


def validate_versions(value):
    if not isinstance(value, list) or not value:
        raise serializers.ValidationError("Au moins une version est attendue.")
    seen = set()
    for i, v in enumerate(value):
        where = f"Version {i + 1}"
        check_keys(v, {"v": str, "date": str, "auteur": str, "contenu": str}, where)
        if not is_iso_date(v["date"]):
            raise serializers.ValidationError(f"{where} : date au format AAAA-MM-JJ attendue.")
        if v["v"] in seen:
            raise serializers.ValidationError(f"Version en double : {v['v']}.")
        seen.add(v["v"])
    return value


class DocumentSerializer(OrgModelSerializer):
    date_version = OptionalDateField(required=False, allow_null=True)
    fichier = FileNameField()

    class Meta(OrgModelSerializer.Meta):
        model = Document

    def validate_processus(self, value):
        return validate_optional_refs(self, "processus", value, "processus")

    def validate_versions(self, value):
        return validate_versions(value)

    def validate_proprietaire(self, value):
        return validate_person(self, value, "proprietaire")

    def validate_redacteur(self, value):
        return validate_person(self, value, "redacteur")

    def validate_approbateur(self, value):
        return validate_person(self, value, "approbateur")

    def validate(self, attrs):
        if self.instance is None:
            # Création depuis le formulaire du front : `contenu` devient la version 1 (save() de FORMS.documents).
            extra = dict(attrs.get("extra") or {})
            contenu = extra.pop("contenu", None)
            if "extra" in attrs:
                attrs["extra"] = extra
            auteur = attrs.get("redacteur") or _current_user_name(self)
            if not attrs.get("versions"):
                if not isinstance(contenu, str) or not contenu.strip():
                    raise serializers.ValidationError(
                        {"versions": "Au moins une version (ou le contenu de la version 1) est attendue."}
                    )
                attrs["versions"] = [
                    {
                        "v": attrs.get("version") or "1",
                        "date": today().isoformat(),
                        "auteur": auteur,
                        "contenu": contenu,
                    }
                ]
            if not attrs.get("redacteur") and auteur:
                attrs["redacteur"] = auteur
            if not attrs.get("date_version"):
                attrs["date_version"] = today()
        return attrs


class PlanOpsSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = PlanOps

    def validate_processus(self, value):
        return validate_optional_refs(self, "processus", value, "processus")

    def validate_responsable(self, value):
        return validate_person(self, value, "responsable")


EXERCICE_STATUTS = set(Urgence.ExerciceStatut.values)


def validate_exercices(value):
    if not isinstance(value, list):
        raise serializers.ValidationError("Liste d'exercices attendue.")
    for i, e in enumerate(value):
        where = f"Exercice {i + 1}"
        check_keys(
            e,
            {"date": str, "statut": str},
            where,
            {k: str for k in ("participants", "scenario", "procedure", "compteRendu", "actions")},
        )
        if not is_iso_date(e["date"]):
            raise serializers.ValidationError(f"{where} : date au format AAAA-MM-JJ attendue.")
        if e["statut"] not in EXERCICE_STATUTS:
            raise serializers.ValidationError(f"{where} : statut inconnu « {e['statut']} ».")
    return value


class UrgenceSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = Urgence

    def validate_risques(self, value):
        validate_str_list(value, "risque")
        return validate_optional_refs(self, "risques", value, "risques")

    def validate_sites(self, value):
        validate_str_list(value, "site")
        return validate_named_refs(self, "sites", "nom", value, "sites")

    def validate_exercices(self, value):
        return validate_exercices(value)
