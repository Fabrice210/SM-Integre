"""
Validation des références entre collections (uid), sans ForeignKey.

    from apps.core.refs import validate_refs
    def validate_processus(self, value):
        return validate_refs(self, "processus", value)

`collection` est le nom de collection du registre. Accepte un uid ou une liste.
Ignoré pendant le chargement de la démo (context["skip_ref_validation"]).
"""

from rest_framework import serializers

from . import registry


def validate_refs(serializer, collection: str, value, allow_empty=True):
    if value in (None, "", []):
        if not allow_empty:
            raise serializers.ValidationError("Référence obligatoire.")
        return value
    uids = value if isinstance(value, list) else [value]
    # Une référence est un uid (texte) : tout autre type est une erreur de saisie (400, pas 500).
    if not all(isinstance(u, str) for u in uids):
        raise serializers.ValidationError(f"Identifiant(s) ({collection}) attendu(s) sous forme de texte.")
    if serializer.context.get("skip_ref_validation"):
        return value
    model = registry.get(collection).model
    org = serializer.context["organisation"]
    found = set(model.objects.filter(organisation=org, uid__in=uids).values_list("uid", flat=True))
    missing = [u for u in uids if u not in found]
    if missing:
        raise serializers.ValidationError(f"Références inconnues ({collection}) : {', '.join(missing)}")
    return value
