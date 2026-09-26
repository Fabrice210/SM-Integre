from rest_framework import serializers

from apps.core.refs import validate_refs
from apps.core.serializers import OrgModelSerializer

from . import models as m


def validate_origine(serializer, value):
    """Origine d'un enjeu : un facteur SWOT (SW…) ou PESTEL (PE…) existant."""
    if not value or serializer.context.get("skip_ref_validation"):
        return value
    org = serializer.context["organisation"]
    if m.Swot.objects.filter(organisation=org, uid=value).exists():
        return value
    return validate_refs(serializer, "pestel", value)


def validate_justification(value):
    # check: (v) => String(v).length >= 10 du formulaire du front.
    if len((value or "").strip()) < 10:
        raise serializers.ValidationError("Justification obligatoire (au moins 10 caractères).")
    return value


class ProcessusSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = m.Processus


class SwotSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = m.Swot


class PestelSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = m.Pestel


class AxeSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = m.Axe


class EnjeuSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = m.Enjeu

    def validate_axes(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Liste d'identifiants d'axes attendue.")
        return validate_refs(self, "axes", value)

    def validate_origine(self, value):
        return validate_origine(self, value)


class AnalyseVersionSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = m.AnalyseVersion


class PartieInteresseeSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = m.PartieInteressee


class SiteSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = m.Site

    def validate_justification(self, value):
        return validate_justification(value)


class ActiviteSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = m.Activite

    def validate_justification(self, value):
        return validate_justification(value)

    def validate_site(self, value):
        """Le front référence le site par son nom (siteOpts())."""
        if not value or self.context.get("skip_ref_validation"):
            return value
        if not m.Site.objects.filter(organisation=self.context["organisation"], nom=value).exists():
            raise serializers.ValidationError(f"Site inconnu : {value}")
        return value


class DomaineVersionSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = m.DomaineVersion


class ApplicabiliteSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = m.Applicabilite


class VersionCommentaireSerializer(serializers.Serializer):
    """Corps de « Figer une version » : commentaire de version obligatoire."""

    commentaire = serializers.CharField()
