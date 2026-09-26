import re

from rest_framework import serializers

from apps.core.refs import validate_refs
from apps.core.serializers import OrgModelSerializer, OrgSingletonSerializer

from . import models as m

ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class PlanStratSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = m.PlanStrat


class ChampPersoSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = m.ChampPerso


class PolitiqueSerializer(OrgSingletonSerializer):
    class Meta(OrgSingletonSerializer.Meta):
        model = m.Politique


class PreuveComSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = m.PreuveCom


class AccuseSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = m.Accuse

    def validate_date(self, value):
        if value != "—" and not ISO_DATE.match(value or ""):
            raise serializers.ValidationError("Date AAAA-MM-JJ ou « — » (non lu) attendue.")
        return value


class DiffusionSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = m.Diffusion
        read_only_fields = ("d", "u")


class PosteSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = m.Poste

    def validate_processus(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Liste d'identifiants de processus attendue.")
        return validate_refs(self, "processus", value)


class RepresentantSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = m.Representant


class MembreComiteSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = m.MembreComite


class ReunionSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = m.Reunion


# ---------- Corps des actions métier ----------


class PublierPolitiqueSerializer(serializers.Serializer):
    """Formulaire « Rédiger la politique SM » (POL_F du front)."""

    orientations = serializers.CharField(help_text="Orientations, une par ligne")
    signataire = serializers.CharField()
    date = serializers.DateField(help_text="Date de publication")


class DiffuserSerializer(serializers.Serializer):
    """Formulaire de diffusion (DIFF_F du front)."""

    doc = serializers.CharField(help_text="Document diffusé (ex. « Politique SM v3 », « Organigramme »)")
    canal = serializers.ChoiceField(choices=m.Diffusion.Canal.choices, default=m.Diffusion.Canal.INTERNE)
    destinataires = serializers.CharField()
    piece = serializers.CharField(required=False, allow_blank=True, default="")
    message = serializers.CharField(
        required=False, allow_blank=True, help_text="Non conservé (comme le front)"
    )

    def validate(self, attrs):
        if attrs["canal"] == m.Diffusion.Canal.EXTERNE and not attrs.get("piece"):
            raise serializers.ValidationError(
                {"piece": "En diffusion externe, la pièce jointe est obligatoire."}
            )
        return attrs


class RealiserReunionSerializer(serializers.Serializer):
    """Formulaire « Marquer la réunion comme réalisée » (RF_FIELDS du front)."""

    compteRendu = serializers.CharField()
    planAction = serializers.CharField(help_text="Plan d'action de suivi (action, responsable, échéance)")
    statutPlan = serializers.ChoiceField(
        choices=m.Reunion.StatutPlan.choices, default=m.Reunion.StatutPlan.A_FAIRE
    )
    preuve1 = serializers.CharField(help_text="Preuve 1 (PV, feuille de présence…)")
    preuve2 = serializers.CharField(help_text="Preuve 2")
