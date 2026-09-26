from rest_framework import serializers

from apps.core.serializers import OrgModelSerializer, OrgSingletonSerializer

from .common import (
    IsoDateOrPlaceholderField,
    check_keys,
    today,
    validate_optional_refs,
    validate_person,
    validate_str_list,
)
from .models import Communication, Competences, Formation, Ressource, Savoir

NIVEAUX = range(0, 5)  # 0 Non acquis … 4 Expert / formateur


def _current_user_name(serializer) -> str:
    request = serializer.context.get("request")
    user = getattr(request, "user", None)
    return getattr(user, "nom", "") if user and user.is_authenticated else ""


def _is_level(v) -> bool:
    return isinstance(v, int) and not isinstance(v, bool) and v in NIVEAUX


class RessourceSerializer(OrgModelSerializer):
    date_reelle = IsoDateOrPlaceholderField(required=False)

    class Meta(OrgModelSerializer.Meta):
        model = Ressource

    def validate_processus(self, value):
        return validate_optional_refs(self, "processus", value, "processus")

    def validate_demandeur(self, value):
        return validate_person(self, value, "demandeur")

    def validate_montant(self, value):
        if value < 0:
            raise serializers.ValidationError("Le montant ne peut pas être négatif.")
        return value

    def create(self, validated_data):
        if not validated_data.get("demandeur"):
            validated_data["demandeur"] = _current_user_name(self)
        return super().create(validated_data)


class CompetencesSerializer(OrgSingletonSerializer):
    """Matrice : chaque collaborateur a exactement un niveau (0 à 4) par compétence de `liste`."""

    class Meta(OrgSingletonSerializer.Meta):
        model = Competences

    def validate_liste(self, value):
        validate_str_list(value, "compétence")
        if len(set(value)) != len(value):
            raise serializers.ValidationError("Compétences en double.")
        return value

    def validate_requis(self, value):
        if not isinstance(value, dict) or not all(_is_level(v) for v in value.values()):
            raise serializers.ValidationError("Objet {compétence: niveau requis (0 à 4)} attendu.")
        return value

    def validate_collaborateurs(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Liste de collaborateurs attendue.")
        for i, p in enumerate(value):
            check_keys(p, {"nom": str, "niveaux": list}, f"Collaborateur {i + 1}", {"direction": str})
            if not p["nom"].strip():
                raise serializers.ValidationError(f"Collaborateur {i + 1} : nom obligatoire.")
            if not all(_is_level(v) for v in p["niveaux"]):
                raise serializers.ValidationError(f"{p['nom']} : niveaux entiers de 0 à 4 attendus.")
        return value

    def validate(self, attrs):
        inst = self.instance
        liste = attrs.get("liste", inst.liste if inst else [])
        requis = attrs.get("requis", inst.requis if inst else {})
        collabs = attrs.get("collaborateurs", inst.collaborateurs if inst else [])
        manquants = [c for c in liste if c not in requis]
        inconnus = [c for c in requis if c not in liste]
        if manquants or inconnus:
            raise serializers.ValidationError(
                {
                    "requis": f"Un niveau requis par compétence de la liste (manquants : {manquants}, inconnus : {inconnus})."
                }
            )
        for p in collabs:
            if len(p["niveaux"]) != len(liste):
                raise serializers.ValidationError(
                    {"collaborateurs": f"{p['nom']} : {len(liste)} niveaux attendus (un par compétence)."}
                )
        return attrs


class SavoirSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = Savoir


class FormationSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = Formation

    def validate_evaluation_responsable(self, value):
        return validate_person(self, value, "evaluation_responsable")

    def validate(self, attrs):
        inst = self.instance
        date = attrs.get("date", inst.date if inst else None)
        evaluation = attrs.get("evaluation_date", inst.evaluation_date if inst else None)
        if date and evaluation and evaluation < date:
            raise serializers.ValidationError(
                {"evaluationDate": "L'évaluation post-formation ne peut pas précéder la session."}
            )
        return attrs


class CommunicationSerializer(OrgModelSerializer):
    date_realisation = IsoDateOrPlaceholderField(placeholders=("",), required=False)

    class Meta(OrgModelSerializer.Meta):
        model = Communication

    def validate_processus(self, value):
        return validate_optional_refs(self, "processus", value, "processus")

    def validate_qui_fait(self, value):
        return validate_person(self, value, "qui_fait")

    def validate(self, attrs):
        # save() du formulaire front : une action « Fait » sans date de réalisation prend la date du jour.
        inst = self.instance
        statut = attrs.get("statut", inst.statut if inst else Communication.Statut.PAS_FAIT)
        realisee = attrs.get("date_realisation", inst.date_realisation if inst else "")
        if statut == Communication.Statut.FAIT and not realisee:
            attrs["date_realisation"] = today().isoformat()
        return attrs
