import datetime

from rest_framework import exceptions, serializers

from apps.core.models import Role
from apps.core.serializers import OrgModelSerializer

from . import models as m
from .services import next_padded_uid, today, validate_optional_refs

# ---------- Plan d'action d'un objectif (ACT_F de helpers.ts) ----------

# `pi` : partie intéressée dont le plan d'engagement est suivi par l'action
# (planEngagementAction() du module 1).
ACTION_KEYS = ("libelle", "responsable", "echeance", "statut", "pieces", "observation", "pi")
ACTION_REQUIRED = ("libelle", "echeance", "statut")


def validate_action(action, index: int | None = None) -> dict:
    """Structure d'une action d'objectif : {libelle, responsable, echeance, statut, pieces?, observation, pi?}."""
    where = f"Action {index + 1} : " if index is not None else ""
    if not isinstance(action, dict):
        raise serializers.ValidationError(f"{where}objet attendu.")
    unknown = sorted(set(action) - set(ACTION_KEYS))
    if unknown:
        raise serializers.ValidationError(f"{where}clés inconnues : {', '.join(unknown)}.")
    missing = [k for k in ACTION_REQUIRED if not action.get(k)]
    if missing:
        raise serializers.ValidationError(f"{where}champs obligatoires manquants : {', '.join(missing)}.")
    for k in ACTION_KEYS:
        if k in action and not isinstance(action[k], str):
            raise serializers.ValidationError(f"{where}« {k} » doit être du texte.")
    try:
        datetime.date.fromisoformat(action["echeance"])
    except ValueError:
        raise serializers.ValidationError(f"{where}échéance invalide (AAAA-MM-JJ attendu).") from None
    if action["statut"] not in m.StatutAction.values:
        raise serializers.ValidationError(
            f"{where}statut inconnu « {action['statut']} » ({', '.join(m.StatutAction.values)})."
        )
    return action


def validate_scale(value):
    """Échelles 1 à 4 des formulaires (t: 'scale', max: 4)."""
    if not 1 <= value <= 4:
        raise serializers.ValidationError("Valeur attendue entre 1 et 4.")
    return value


def current_user(serializer):
    request = serializer.context.get("request")
    return getattr(request, "user", None)


# ---------- 3.1 Objectifs ----------


class ObjectifSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = m.Objectif

    def validate_axe(self, value):
        return validate_optional_refs(self, "axes", value)

    def validate_processus(self, value):
        if not isinstance(value, list) or not value:
            raise serializers.ValidationError("Au moins un processus est requis.")
        return validate_optional_refs(self, "processus", value)

    def validate_normes(self, value):
        value = super().validate_normes(value)
        if not value:
            raise serializers.ValidationError("Au moins une norme est requise.")
        return value

    def validate_actions(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Liste d'actions attendue.")
        return [validate_action(a, i) for i, a in enumerate(value)]


# ---------- 3.2 Fiches de maîtrise ----------


class FicheMaitriseSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = m.FicheMaitrise

    def validate_processus(self, value):
        return validate_optional_refs(self, "processus", value)

    def validate_risques(self, value):
        if not isinstance(value, list) or not value:
            raise serializers.ValidationError("Au moins un risque est requis.")
        return validate_optional_refs(self, "risques", value)


# ---------- Veille réglementaire ----------


class TexteSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = m.Texte

    def validate_normes(self, value):
        value = super().validate_normes(value)
        if not value:
            raise serializers.ValidationError("Au moins une norme est requise.")
        return value


class DeclarationSerializer(OrgModelSerializer):
    """
    Déclaration d'écart au Directeur Général. En création, les valeurs par défaut du
    formulaire du front sont appliquées (Brouillon, auteur = utilisateur, date du jour,
    « Non soumise »). La décision (Validée / Refusée) est réservée au Dirigeant.
    """

    # commentaireDG : to_snake("commentaireDG") == "commentaire_d_g".
    commentaire_d_g = serializers.CharField(
        source="commentaire_dg", max_length=500, required=False, allow_blank=True
    )

    class Meta:
        model = m.Declaration
        exclude = ("commentaire_dg",)

    def validate_texte(self, value):
        return validate_optional_refs(self, "textes", value)

    def validate(self, attrs):
        statut = attrs.get("statut")
        decided = (m.Declaration.Statut.VALIDEE, m.Declaration.Statut.REFUSEE)
        user = current_user(self)
        changed = self.instance is None or statut != self.instance.statut
        if statut in decided and changed and user is not None:
            if not (user.is_superuser or user.has_role(Role.DIRIGEANT)):
                raise exceptions.PermissionDenied(
                    "Seul le Directeur Général (rôle Dirigeant) peut valider ou refuser."
                )
        return attrs

    def create(self, validated_data):
        user = current_user(self)
        validated_data.setdefault("statut", m.Declaration.Statut.BROUILLON)
        validated_data.setdefault("commentaire_dg", "Non soumise")
        if not validated_data.get("auteur") and user is not None:
            validated_data["auteur"] = user.nom
        return super().create(validated_data)

    def to_internal_value(self, data):
        if isinstance(data, dict) and self.instance is None and not data.get("date"):
            data = {**data, "date": today().isoformat()}
        return super().to_internal_value(data)


class RapportConformiteSerializer(OrgModelSerializer):
    """
    Rapport de conformité. En création, le formulaire du front préremplit la conclusion,
    le titre, la synthèse et les pièces à partir du texte ; la référence est séquentielle
    (RC-<année du rapport>-<n° sur 3 chiffres>).
    """

    class Meta(OrgModelSerializer.Meta):
        model = m.RapportConformite

    def validate_texte(self, value):
        return validate_optional_refs(self, "textes", value)

    def to_internal_value(self, data):
        if isinstance(data, dict) and self.instance is None:
            data = {
                **self._defaults_from_texte(data),
                **{k: v for k, v in data.items() if v not in (None, "")},
            }
        return super().to_internal_value(data)

    def _defaults_from_texte(self, data) -> dict:
        user = current_user(self)
        defaults = {"date": today().isoformat()}
        if user is not None:
            defaults["auteur"] = user.nom
        texte = m.Texte.objects.filter(organisation=self.organisation, uid=data.get("texte") or "").first()
        if texte:
            defaults.update(
                titre="Rapport de conformité — " + texte.intitule[:50],
                statut="Conforme" if texte.statut == m.Texte.Statut.FAIT else "Non conforme",
                synthese=texte.justificatif,
                pieces=texte.pieces or "Rapport_conformite.pdf",
            )
        return defaults

    def create(self, validated_data):
        if not validated_data.get("ref"):
            n = m.RapportConformite.objects.filter(organisation=self.organisation).count() + 1
            validated_data["ref"] = f"RC-{validated_data['date'].year}-{n:03d}"
        return super().create(validated_data)


# ---------- 3.3 Risques et opportunités ----------


class _TraitementSerializer(OrgModelSerializer):
    """Base commune : processus, normes, échelles 1 à 4 et id séquentiel (R08, O04)."""

    ID_PREFIX = ""

    def validate_processus(self, value):
        if not isinstance(value, list) or not value:
            raise serializers.ValidationError("Au moins un processus est requis.")
        return validate_optional_refs(self, "processus", value)

    def validate_normes(self, value):
        value = super().validate_normes(value)
        if not value:
            raise serializers.ValidationError("Au moins une norme est requise.")
        return value

    def validate_probabilite(self, value):
        return validate_scale(value)

    def create(self, validated_data):
        if not validated_data.get("uid"):
            validated_data["uid"] = next_padded_uid(self.Meta.model, self.organisation, self.ID_PREFIX)
        return super().create(validated_data)


class RisqueSerializer(_TraitementSerializer):
    ID_PREFIX = "R"

    class Meta(OrgModelSerializer.Meta):
        model = m.Risque

    def validate_criticite(self, value):
        return validate_scale(value)


class OpportuniteSerializer(_TraitementSerializer):
    ID_PREFIX = "O"

    class Meta(OrgModelSerializer.Meta):
        model = m.Opportunite

    def validate_impact(self, value):
        return validate_scale(value)
