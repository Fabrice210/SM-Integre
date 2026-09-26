"""
Actions métier du module 4 (workflows du front, droits vérifiés côté serveur).

Ressources (ressources.tsx, resAct) :
  POST /ressources/{id}/soumettre/           Brouillon | Refusée -> Soumise (demandeur ou rôle de pilotage)
  POST /ressources/{id}/valider/             Soumise -> Validée   (valideur du circuit)
  POST /ressources/{id}/refuser/             Soumise -> Refusée   (valideur du circuit) {motif?}
  POST /ressources/{id}/mise-a-disposition/  Validée -> Mise à disposition, dateReelle {date?}
Compétences (competences.tsx) :
  GET  /competences/ecarts/          competenceGaps()
  POST /competences/niveau/          {collaborateur, competence, niveau?} (sans niveau : niveau suivant)
  POST /competences/collaborateurs/  {nom, direction}
  POST /competences/import/          CSV « Nom;Direction;niveaux… » (fichier `file` ou champ `csv`)
Savoirs : POST /savoirs/{id}/planifier-formation/  session préremplie depuis un savoir critique
Formations : POST /formations/{id}/evaluer/  {resultat, niveau? (Kirkpatrick 1-4), evaluationDate?}
Communications : POST /communications/{id}/realiser/  {preuve, dateRealisation}
"""

import datetime as dt
from types import SimpleNamespace

from django.db import transaction
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.core.models import AuditLog, Role
from apps.core.permissions import IsMemberAnyMethod
from apps.core.viewsets import OrgModelViewSet, SingletonViewSet, log_write

from .common import ActionMixin, fd, is_writer, log_act, payload, require_state, today
from .models import Communication, Formation, Ressource, Savoir
from .serializers import FormationSerializer
from .services import competence_gaps, parse_matrix_csv

# Direction qui valide chaque circuit de demande de ressource.
CIRCUIT_DIRECTIONS = {
    Ressource.Circuit.RH: "Direction des Ressources Humaines",
    Ressource.Circuit.FINANCE: "Direction Administrative & Financière",
    Ressource.Circuit.ACHATS: "Direction Achats & Logistique",
}
MAX_IMPORT_SIZE = 1024 * 1024


# ---------- 4.1 Ressources ----------


def can_submit_resource(user, r) -> bool:
    return is_writer(user) or (bool(r.demandeur) and r.demandeur == user.nom)


def can_validate_resource(user, r) -> bool:
    """Valideur du circuit : Dirigeant, Responsable SM ou pilote de la direction du circuit.
    Le demandeur ne valide jamais sa propre demande."""
    if r.demandeur and r.demandeur == user.nom:
        return False
    if user.is_superuser or user.has_role(Role.DIRIGEANT, Role.RESPONSABLE_SM):
        return True
    return is_writer(user) and user.direction == CIRCUIT_DIRECTIONS.get(r.circuit)


class MotifInput(serializers.Serializer):
    motif = serializers.CharField(required=False, allow_blank=True)


class DispoInput(serializers.Serializer):
    date = serializers.DateField(required=False)


class RessourceViewSet(ActionMixin, OrgModelViewSet):
    MOD = "Ressources"

    def _check_statut(self, old, new, r):
        S = Ressource.Statut
        if new == old:
            return
        if new in (S.VALIDEE, S.REFUSEE) and not can_validate_resource(self.request.user, r):
            raise PermissionDenied(f"Seul un valideur du circuit {r.circuit} peut statuer sur cette demande.")

    def perform_create(self, serializer):
        vd = serializer.validated_data
        data = SimpleNamespace(
            **{"circuit": "", **vd, "demandeur": vd.get("demandeur") or self.request.user.nom}
        )
        self._check_statut(None, vd.get("statut", Ressource.Statut.BROUILLON), data)
        super().perform_create(serializer)

    def perform_update(self, serializer):
        inst = serializer.instance
        self._check_statut(inst.statut, serializer.validated_data.get("statut", inst.statut), inst)
        super().perform_update(serializer)

    def _transition(self, r, statut, label):
        r.statut = statut
        return self._done(r, label, f"{label} : {r.besoin}", self.MOD)

    @action(detail=True, methods=["post"], permission_classes=[IsMemberAnyMethod])
    @transaction.atomic
    def soumettre(self, request, uid=None):
        r = self.get_object()
        if not can_submit_resource(request.user, r):
            raise PermissionDenied("Seul le demandeur ou un rôle de pilotage peut soumettre la demande.")
        require_state(r, (Ressource.Statut.BROUILLON, Ressource.Statut.REFUSEE), "Soumission")
        return self._transition(r, Ressource.Statut.SOUMISE, f"Soumise au circuit {r.circuit}")

    @action(detail=True, methods=["post"], permission_classes=[IsMemberAnyMethod])
    @transaction.atomic
    def valider(self, request, uid=None):
        r = self.get_object()
        if not can_validate_resource(request.user, r):
            raise PermissionDenied(f"Seul un valideur du circuit {r.circuit} peut valider cette demande.")
        require_state(r, (Ressource.Statut.SOUMISE,), "Validation")
        return self._transition(r, Ressource.Statut.VALIDEE, f"Validée par le circuit {r.circuit}")

    @action(detail=True, methods=["post"], permission_classes=[IsMemberAnyMethod])
    @transaction.atomic
    def refuser(self, request, uid=None):
        r = self.get_object()
        if not can_validate_resource(request.user, r):
            raise PermissionDenied(f"Seul un valideur du circuit {r.circuit} peut refuser cette demande.")
        require_state(r, (Ressource.Statut.SOUMISE,), "Refus")
        motif = payload(MotifInput, request).get("motif")
        label = "Refusée — retour au demandeur" + (f" (motif : {motif})" if motif else "")
        return self._transition(r, Ressource.Statut.REFUSEE, label)

    @action(
        detail=True, methods=["post"], url_path="mise-a-disposition", permission_classes=[IsMemberAnyMethod]
    )
    @transaction.atomic
    def mise_a_disposition(self, request, uid=None):
        r = self.get_object()
        if not can_submit_resource(request.user, r):
            raise PermissionDenied(
                "Seul le demandeur ou un rôle de pilotage peut confirmer la mise à disposition."
            )
        require_state(r, (Ressource.Statut.VALIDEE,), "Mise à disposition")
        r.date_reelle = (payload(DispoInput, request).get("date") or today()).isoformat()
        return self._transition(r, Ressource.Statut.MISE_A_DISPOSITION, "Mise à disposition confirmée")


# ---------- 4.2 Compétences ----------


class NiveauInput(serializers.Serializer):
    collaborateur = serializers.JSONField(help_text="Index (0…) ou nom du collaborateur")
    competence = serializers.JSONField(help_text="Index (0…) ou libellé de la compétence")
    niveau = serializers.IntegerField(min_value=0, max_value=4, required=False)


class CollaborateurInput(serializers.Serializer):
    nom = serializers.CharField()
    direction = serializers.CharField(required=False, allow_blank=True, default="")


class ImportInput(serializers.Serializer):
    file = serializers.FileField(required=False)
    csv = serializers.CharField(required=False)

    def validate(self, attrs):
        f = attrs.get("file")
        if f is not None:
            if f.size > MAX_IMPORT_SIZE:
                raise serializers.ValidationError({"file": "Fichier trop volumineux (1 Mo maximum)."})
            raw = f.read()
            try:
                attrs["csv"] = raw.decode("utf-8")
            except UnicodeDecodeError:
                attrs["csv"] = raw.decode("latin-1")
        if not attrs.get("csv"):
            raise serializers.ValidationError("Fichier CSV (`file`) ou contenu (`csv`) attendu.")
        return attrs


def _index(value, items, label):
    if isinstance(value, int) and not isinstance(value, bool):
        if 0 <= value < len(items):
            return value
    elif isinstance(value, str) and value in items:
        return items.index(value)
    raise serializers.ValidationError({label: f"{label.capitalize()} inconnu(e) : {value}"})


class CompetencesViewSet(SingletonViewSet):
    MOD = "Compétences"

    def _save(self, comp, journal_text=None):
        comp.save()
        if journal_text:
            log_act(self.request.user, journal_text, self.MOD)
        data = self.get_serializer(comp).data
        log_write(self.request, self.collection.name, AuditLog.Action.UPDATE, "", data)
        return data

    @action(detail=False, methods=["get"])
    def ecarts(self, request):
        return Response(competence_gaps(self.get_object()))

    @action(detail=False, methods=["post"])
    @transaction.atomic
    def niveau(self, request):
        comp = self.get_object()
        d = payload(NiveauInput, request)
        noms = [p["nom"] for p in comp.collaborateurs]
        ci = _index(d["collaborateur"], noms, "collaborateur")
        k = _index(d["competence"], comp.liste, "competence")
        p = comp.collaborateurs[ci]
        p["niveaux"][k] = d["niveau"] if "niveau" in d else (p["niveaux"][k] + 1) % 5
        data = self._save(comp, f"a mis à jour le niveau de {p['nom']} en « {comp.liste[k]} »")
        return Response(data)

    @action(detail=False, methods=["post"])
    @transaction.atomic
    def collaborateurs(self, request):
        comp = self.get_object()
        d = payload(CollaborateurInput, request)
        comp.collaborateurs.append(
            {"nom": d["nom"], "direction": d["direction"], "niveaux": [1] * len(comp.liste)}
        )
        return Response(self._save(comp), status=status.HTTP_201_CREATED)

    @action(
        detail=False,
        methods=["post"],
        url_path="import",
        parser_classes=[MultiPartParser, FormParser, JSONParser],
    )
    @transaction.atomic
    def importer(self, request):
        comp = self.get_object()
        d = payload(ImportInput, request)
        rows = parse_matrix_csv(d["csv"], len(comp.liste))
        comp.collaborateurs.extend(rows)
        data = self._save(comp, f"a importé une matrice de compétences ({len(rows)} lignes)")
        return Response({"importes": len(rows), "competences": data})


class SavoirViewSet(OrgModelViewSet):
    MOD = "Compétences"

    @action(detail=True, methods=["post"], url_path="planifier-formation")
    @transaction.atomic
    def planifier_formation(self, request, uid=None):
        """planFormation() du front : session préremplie (surchargeable par le corps de la requête)."""
        s: Savoir = self.get_object()
        if s.criticite != Savoir.Criticite.CRITIQUE:
            raise serializers.ValidationError(
                "Seul un savoir critique donne lieu à une formation de transfert."
            )
        data = {
            "theme": s.savoir,
            "date": (today() + dt.timedelta(days=30)).isoformat(),
            "formateur": s.detenteurs.split(",")[0].strip(),
            "participants": f"À désigner — transfert de savoir depuis {s.detenteurs}",
            "statut": Formation.Statut.PLANIFIEE,
            "evaluationDate": (today() + dt.timedelta(days=60)).isoformat(),
            "evaluationResponsable": request.user.nom,
            "resultat": "À évaluer : test pratique et observation au poste",
            "normes": ["9001"],
            **{k: v for k, v in request.data.items() if k != "id"},
        }
        ser = FormationSerializer(data=data, context=self.get_serializer_context())
        ser.is_valid(raise_exception=True)
        f = ser.save()
        log_act(request.user, f"a créé « {f.theme} » (Session de formation)", self.MOD)
        log_write(request, "formations", AuditLog.Action.CREATE, f.uid, ser.data)
        return Response(ser.data, status=status.HTTP_201_CREATED)


# ---------- Formations ----------


class EvaluationInput(serializers.Serializer):
    resultat = serializers.CharField()
    niveau = serializers.IntegerField(
        min_value=1, max_value=4, required=False, help_text="Niveau Kirkpatrick"
    )
    evaluation_date = serializers.DateField(required=False)

    def to_internal_value(self, data):
        if hasattr(data, "get") and "evaluationDate" in data:
            data = {**data, "evaluation_date": data["evaluationDate"]}
        return super().to_internal_value(data)


class FormationViewSet(ActionMixin, OrgModelViewSet):
    MOD = "Compétences"

    @action(detail=True, methods=["post"], permission_classes=[IsMemberAnyMethod])
    @transaction.atomic
    def evaluer(self, request, uid=None):
        """Évaluation post-formation : par le responsable désigné ou un rôle de pilotage."""
        f: Formation = self.get_object()
        user = request.user
        if not (is_writer(user) or (f.evaluation_responsable and f.evaluation_responsable == user.nom)):
            raise PermissionDenied("Seul le responsable de l'évaluation ou un rôle de pilotage peut évaluer.")
        require_state(f, (Formation.Statut.REALISEE,), "Évaluation")
        d = payload(EvaluationInput, request)
        resultat = d["resultat"].strip()
        if "niveau" in d and not resultat.startswith("Niveau"):
            resultat = f"Niveau {d['niveau']} Kirkpatrick : {resultat}"
        f.resultat = resultat
        if d.get("evaluation_date"):
            if d["evaluation_date"] < f.date:
                raise serializers.ValidationError(
                    {"evaluationDate": "L'évaluation post-formation ne peut pas précéder la session."}
                )
            f.evaluation_date = d["evaluation_date"]
        return self._done(
            f,
            "Évaluation post-formation enregistrée",
            f"a enregistré l'évaluation de la formation « {f.theme} »",
            self.MOD,
        )


# ---------- 4.3 Communication ----------


class RealisationInput(serializers.Serializer):
    preuve = serializers.CharField(max_length=255)
    date_realisation = serializers.DateField()

    def to_internal_value(self, data):
        if hasattr(data, "get") and "dateRealisation" in data:
            data = {**data, "date_realisation": data["dateRealisation"]}
        return super().to_internal_value(data)


class CommunicationViewSet(ActionMixin, OrgModelViewSet):
    MOD = "Communication"

    @action(detail=True, methods=["post"], permission_classes=[IsMemberAnyMethod])
    @transaction.atomic
    def realiser(self, request, uid=None):
        """comDone() du front : preuve jointe et date de réalisation effective -> « Fait »."""
        c: Communication = self.get_object()
        user = request.user
        if not (is_writer(user) or (c.qui_fait and c.qui_fait == user.nom)):
            raise PermissionDenied("Seul le porteur de l'action ou un rôle de pilotage peut la clôturer.")
        d = payload(RealisationInput, request)
        c.preuve = d["preuve"]
        c.date_realisation = d["date_realisation"].isoformat()
        c.statut = Communication.Statut.FAIT
        return self._done(
            c,
            f"Réalisée le {fd(c.date_realisation)} — preuve jointe",
            f"a joint la preuve de l'action « {c.objectif} »",
            self.MOD,
        )
