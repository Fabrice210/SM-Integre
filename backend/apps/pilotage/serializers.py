from rest_framework import serializers

from apps.core.serializers import OrgModelSerializer, OrgSingletonSerializer

from . import models as m


class ExigenceNormativeSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = m.ExigenceNormative


class ClotureSerieSerializer(OrgSingletonSerializer):
    """Libellés et deux séries d'entiers positifs de même longueur."""

    def validate(self, attrs):
        data = {
            k: attrs.get(k, getattr(self.instance, k, None)) for k in ("labels", "clotures", "ouvertures")
        }
        errors = {}
        for k, v in data.items():
            if v is None:
                continue
            if not isinstance(v, list):
                errors[k] = "Liste attendue."
            elif k == "labels" and not all(isinstance(x, str) for x in v):
                errors[k] = "Liste de libellés attendue."
            elif k != "labels" and not all(
                isinstance(x, int) and not isinstance(x, bool) and x >= 0 for x in v
            ):
                errors[k] = "Liste d'entiers positifs attendue."
        if errors:
            raise serializers.ValidationError(errors)
        if len({len(v) for v in data.values() if isinstance(v, list)}) > 1:
            raise serializers.ValidationError("Les séries doivent avoir la même longueur que les libellés.")
        return attrs


class CloturesMoisSerializer(ClotureSerieSerializer):
    class Meta(OrgSingletonSerializer.Meta):
        model = m.CloturesMois


class CloturesAnSerializer(ClotureSerieSerializer):
    class Meta(OrgSingletonSerializer.Meta):
        model = m.CloturesAn
