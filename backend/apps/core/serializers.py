"""
Sérialiseurs de base : l'API parle exactement le format du front.

  - noms de champs en camelCase (plan_mis_en_oeuvre <-> planMisEnOeuvre) ;
  - `uid` exposé sous le nom `id` ;
  - les valeurs None ne sont pas émises (champ absent côté front, comme dans la démo) ;
  - les clés inconnues sont conservées dans `extra` et renvoyées telles quelles ;
  - organisation, horodatages et position ne sont jamais exposés.

Le contenu des JSONField (tableaux imbriqués…) n'est jamais renommé.
"""

import re

from rest_framework import serializers

from .models import NORM_IDS, UID_REGEX
from .naming import to_camel, to_snake

HIDDEN = {"id", "organisation", "created_at", "updated_at", "position", "extra"}


class CamelSerializerMixin:
    def get_field_names(self, declared_fields, info):
        names = super().get_field_names(declared_fields, info)
        return [n for n in names if n not in HIDDEN or n in declared_fields]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        out = {}
        for k, v in data.items():
            if v is None:
                continue
            out["id" if k == "uid" else to_camel(k)] = v
        extra = getattr(instance, "extra", None) or {}
        for k, v in extra.items():
            out.setdefault(k, v)
        return out

    def to_internal_value(self, data):
        if not isinstance(data, dict):
            return super().to_internal_value(data)
        known = set(self.fields)
        mapped, extra = {}, {}
        for k, v in data.items():
            name = "uid" if k == "id" else to_snake(k)
            if name in known:
                mapped[name] = v
            elif name not in HIDDEN:
                extra[k] = v
        value = super().to_internal_value(mapped)
        if extra and hasattr(self.Meta.model, "extra"):
            value["extra"] = extra
        return value


class OrgModelSerializer(CamelSerializerMixin, serializers.ModelSerializer):
    """Base des collections (OrgModel). `id` facultatif en création : généré (R101…)."""

    uid = serializers.CharField(max_length=32, required=False)

    class Meta:
        fields = "__all__"

    @property
    def organisation(self):
        return self.context["organisation"]

    def validate_normes(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('Liste de normes attendue (ex. ["9001"]).')
        bad = [str(n) for n in value if n not in NORM_IDS]
        if bad:
            raise serializers.ValidationError(f"Normes inconnues : {', '.join(bad)}")
        return value

    def validate_uid(self, value):
        if not re.fullmatch(UID_REGEX, value):
            raise serializers.ValidationError(
                "Identifiant invalide : lettres, chiffres, « _ », « - » ou « . » (32 caractères au plus)."
            )
        qs = self.Meta.model.objects.filter(organisation=self.organisation, uid=value)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Identifiant déjà utilisé.")
        return value

    def create(self, validated_data):
        model = self.Meta.model
        org = self.organisation
        validated_data["organisation"] = org
        if not validated_data.get("uid"):
            validated_data["uid"] = org.next_uid(model.UID_PREFIX)
        elif not self.context.get("skip_ref_validation"):
            org.observe_uid(validated_data["uid"])
        if "position" not in validated_data:
            # ?at=start : en tête de liste (unshift() du front), sinon en fin (push()).
            request = self.context.get("request")
            at_start = request is not None and request.query_params.get("at") == "start"
            qs = model.objects.filter(organisation=org)
            if at_start:
                first = qs.order_by("position").first()
                validated_data["position"] = (first.position - 1) if first else 0
            else:
                last = qs.order_by("-position").first()
                validated_data["position"] = (last.position + 1) if last else 0
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if "extra" in validated_data and not self.partial:
            pass  # PUT : remplace extra
        elif "extra" in validated_data:
            validated_data["extra"] = {**(instance.extra or {}), **validated_data["extra"]}
        return super().update(instance, validated_data)


class OrgSingletonSerializer(CamelSerializerMixin, serializers.ModelSerializer):
    class Meta:
        fields = "__all__"
