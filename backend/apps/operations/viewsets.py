"""
Actions métier du module 5 (workflows du front, droits vérifiés côté serveur).

GED (GedPage.tsx, gedDetail.tsx : docAct, newVersion, diffuser, markObsolete) :
  POST /documents/{id}/soumettre/        Rédaction | Refusé -> Vérification   (rédacteur, propriétaire, RSM)
  POST /documents/{id}/verifier/         Vérification -> Approbation          (vérificateur)
  POST /documents/{id}/approuver/        Approbation -> Diffusé (publication)  (approbateur désigné ou RSM)
  POST /documents/{id}/refuser/          Vérification | Approbation -> Rédaction {motif}
  POST /documents/{id}/nouvelle-version/ Diffusé -> Rédaction, version ajoutée {contenu, motif}
  POST /documents/{id}/diffuser/         diffusion contrôlée d'un document diffusé {diffusion}
  POST /documents/{id}/obsolete/         classement obsolète (archives)       (propriétaire ou RSM)
  POST /documents/{id}/fichier/          pièce jointe (multipart `file`)      (rédacteur, propriétaire, RSM)
  GET  /documents/{id}/fichier/          téléchargement de la pièce jointe
  Vérificateur : propriétaire du document, pilote ou copilote du processus, ou Responsable SM.
  Les mêmes règles s'appliquent quand le statut change par PUT / PATCH.
Situations d'urgence (UrgencesPage.tsx : addExercice, crExercice) :
  POST /urgences/{id}/exercices/                      planifier un exercice
  POST /urgences/{id}/exercices/{n}/compte-rendu/     compte-rendu -> Réalisé {compteRendu, actions, creer?}
"""

import os
from types import SimpleNamespace

from django.conf import settings
from django.db import transaction
from django.http import FileResponse
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser

from apps.core import registry, tracing
from apps.core.models import Role
from apps.core.permissions import ADMIN_ROLES, IsMemberAnyMethod
from apps.core.viewsets import OrgModelViewSet
from apps.support.common import (
    ActionMixin,
    fd,
    is_registered,
    payload,
    require_state,
    today,
)

from .models import Document, Urgence

S = Document.Statut

# Pièces jointes GED : taille maximale et extensions autorisées (surchargeables dans les réglages).
MAX_UPLOAD_SIZE = getattr(settings, "GED_MAX_UPLOAD_SIZE", 20 * 1024 * 1024)
ALLOWED_EXTENSIONS = getattr(
    settings,
    "GED_ALLOWED_EXTENSIONS",
    (
        ".pdf",
        ".doc",
        ".docx",
        ".odt",
        ".xls",
        ".xlsx",
        ".ods",
        ".ppt",
        ".pptx",
        ".txt",
        ".csv",
        ".png",
        ".jpg",
        ".jpeg",
    ),
)


# ---------- Droits GED ----------


def _is_rsm(user) -> bool:
    return bool(user.is_superuser or user.has_role(Role.RESPONSABLE_SM))


def can_edit_document(user, doc) -> bool:
    """Rédacteur, propriétaire ou Responsable SM / administrateur."""
    return (
        user.is_superuser
        or user.has_role(*ADMIN_ROLES)
        or (bool(user.nom) and user.nom in (doc.redacteur, doc.proprietaire))
    )


def _process_pilots(organisation, pid) -> set[str]:
    if not pid or not is_registered("processus"):
        return set()
    p = registry.get("processus").model.objects.filter(organisation=organisation, uid=pid).first()
    if p is None:
        return set()
    copilotes = getattr(p, "copilote", None) or []
    return {getattr(p, "proprietaire", ""), *copilotes} - {""}


def can_verify_document(user, doc) -> bool:
    return (
        _is_rsm(user)
        or user.nom == doc.proprietaire
        or user.nom in _process_pilots(user.organisation, doc.processus)
    )


def can_approve_document(user, doc) -> bool:
    """Seul l'approbateur désigné, ou un Responsable SM, approuve (ou refuse à l'approbation)."""
    return _is_rsm(user) or (bool(doc.approbateur) and user.nom == doc.approbateur)


# Contrôle des changements de statut, qu'ils passent par une action ou par PUT / PATCH.
TRANSITION_RULES = {
    S.VERIFICATION: (
        can_edit_document,
        "Seul le rédacteur, le propriétaire ou le Responsable SM peut soumettre.",
    ),
    S.APPROBATION: (
        can_verify_document,
        "Seul le vérificateur (propriétaire, pilote du processus) peut valider.",
    ),
    S.DIFFUSE: (can_approve_document, "Seul l'approbateur désigné ou un Responsable SM peut approuver."),
}


class RefusInput(serializers.Serializer):
    motif = serializers.CharField()


class VersionInput(serializers.Serializer):
    contenu = serializers.CharField(trim_whitespace=False)
    motif = serializers.CharField()


class DiffusionInput(serializers.Serializer):
    diffusion = serializers.CharField()
    accuse = serializers.BooleanField(default=True, help_text="Exiger un accusé de lecture")


class UploadInput(serializers.Serializer):
    file = serializers.FileField()

    def validate_file(self, f):
        ext = os.path.splitext(f.name)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise serializers.ValidationError(
                f"Type de fichier non autorisé ({ext or 'sans extension'}). Autorisés : {', '.join(ALLOWED_EXTENSIONS)}."
            )
        if f.size > MAX_UPLOAD_SIZE:
            raise serializers.ValidationError(
                f"Fichier trop volumineux ({MAX_UPLOAD_SIZE // (1024 * 1024)} Mo maximum)."
            )
        return f


class DocumentViewSet(ActionMixin, OrgModelViewSet):
    MOD = "GED"

    def _check_transition(self, old, new, doc):
        if new == old or new not in TRANSITION_RULES:
            return
        rule, message = TRANSITION_RULES[new]
        if not rule(self.request.user, doc):
            raise PermissionDenied(message)

    def perform_create(self, serializer):
        vd = serializer.validated_data
        doc = SimpleNamespace(
            **{"redacteur": "", "proprietaire": "", "approbateur": "", "processus": "", **vd}
        )
        self._check_transition(None, vd.get("statut", S.REDACTION), doc)
        super().perform_create(serializer)

    def perform_update(self, serializer):
        # Droits évalués sur l'état avant modification (on ne se désigne pas approbateur pour approuver).
        inst = serializer.instance
        self._check_transition(inst.statut, serializer.validated_data.get("statut", inst.statut), inst)
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        if instance.fichier:
            instance.fichier.delete(save=False)
        super().perform_destroy(instance)

    def _act(self, d, statut, msg):
        """docAct() du front : hist « Document … », journal « a <verbe> le document <ref> »."""
        d.statut = statut
        return self._done(
            d, f"Document {msg}", f"a {msg.split(' ')[0]} le document {d.ref}", self.MOD, d.statut
        )

    @action(detail=True, methods=["post"], permission_classes=[IsMemberAnyMethod])
    @transaction.atomic
    def soumettre(self, request, uid=None):
        d = self.get_object()
        require_state(d, (S.REDACTION, S.REFUSE), "Soumission")
        self._check_transition(d.statut, S.VERIFICATION, d)
        return self._act(d, S.VERIFICATION, "soumis à vérification — vérificateur notifié")

    @action(detail=True, methods=["post"], permission_classes=[IsMemberAnyMethod])
    @transaction.atomic
    def verifier(self, request, uid=None):
        d = self.get_object()
        require_state(d, (S.VERIFICATION,), "Vérification")
        self._check_transition(d.statut, S.APPROBATION, d)
        return self._act(d, S.APPROBATION, "vérifié — approbateur notifié")

    @action(detail=True, methods=["post"], permission_classes=[IsMemberAnyMethod])
    @transaction.atomic
    def approuver(self, request, uid=None):
        """Approbation et publication : la dernière version devient la version en vigueur."""
        d = self.get_object()
        require_state(d, (S.APPROBATION,), "Approbation")
        self._check_transition(d.statut, S.DIFFUSE, d)
        d.version = d.derniere_version["v"]
        d.accuses = 0
        d.refus = None
        return self._act(d, S.DIFFUSE, "approuvé et diffusé ; la version précédente est archivée")

    @action(detail=True, methods=["post"], permission_classes=[IsMemberAnyMethod])
    @transaction.atomic
    def refuser(self, request, uid=None):
        d = self.get_object()
        require_state(d, (S.VERIFICATION, S.APPROBATION), "Refus")
        rule = can_verify_document if d.statut == S.VERIFICATION else can_approve_document
        if not rule(request.user, d):
            raise PermissionDenied(
                "Seul le vérificateur peut refuser à la vérification."
                if d.statut == S.VERIFICATION
                else "Seul l'approbateur désigné ou un Responsable SM peut refuser à l'approbation."
            )
        d.refus = payload(RefusInput, request)["motif"]
        return self._act(d, S.REDACTION, f"refusé et renvoyé à l'auteur — motif : {d.refus}")

    @action(detail=True, methods=["post"], url_path="nouvelle-version")
    @transaction.atomic
    def nouvelle_version(self, request, uid=None):
        """newVersion() du front : la version diffusée reste en vigueur jusqu'à l'approbation de la nouvelle."""
        d = self.get_object()
        require_state(d, (S.DIFFUSE,), "Nouvelle version")
        x = payload(VersionInput, request)
        last = d.derniere_version["v"]
        v = str(int(last) + 1) if last.isdigit() else f"{last}.1"
        d.versions = [
            *d.versions,
            {"v": v, "date": today().isoformat(), "auteur": request.user.nom, "contenu": x["contenu"]},
        ]
        d.statut = S.REDACTION
        return self._done(
            d,
            f"Version {v} ouverte : {x['motif']}",
            f"a ouvert la version {v} de {d.ref}",
            self.MOD,
            "Brouillon",
        )

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def diffuser(self, request, uid=None):
        """diffuser() du front : diffusion contrôlée, accusés de lecture remis à zéro."""
        d = self.get_object()
        require_state(d, (S.DIFFUSE,), "Diffusion")
        x = payload(DiffusionInput, request)
        d.diffusion = x["diffusion"]
        d.accuses = 0
        return self._done(d, f"Diffusé à : {d.diffusion}", f"a diffusé {d.ref}", self.MOD)

    @action(detail=True, methods=["post"], permission_classes=[IsMemberAnyMethod])
    @transaction.atomic
    def obsolete(self, request, uid=None):
        """markObsolete() du front : archivé, reste consultable pour la traçabilité."""
        d = self.get_object()
        if not (_is_rsm(request.user) or request.user.nom == d.proprietaire):
            raise PermissionDenied(
                "Seul le propriétaire du document ou un Responsable SM peut le rendre obsolète."
            )
        require_state(d, [s for s in S.values if s != S.OBSOLETE], "Classement obsolète")
        d.statut = S.OBSOLETE
        d.extra = {**(d.extra or {}), "obsolete": True}
        return self._done(
            d, "Classé obsolète (traçabilité conservée)", f"a classé obsolète « {d.intitule} »", "documents"
        )

    @action(
        detail=True,
        methods=["get", "post"],
        permission_classes=[IsMemberAnyMethod],
        parser_classes=[MultiPartParser, FormParser],
    )
    def fichier(self, request, uid=None):
        d = self.get_object()
        if request.method == "GET":
            if not d.fichier:
                raise NotFound("Aucune pièce jointe pour ce document.")
            return FileResponse(
                d.fichier.open("rb"), as_attachment=True, filename=os.path.basename(d.fichier.name)
            )
        return self._upload(request, d)

    @transaction.atomic
    def _upload(self, request, d):
        if not can_edit_document(request.user, d):
            raise PermissionDenied(
                "Seul le rédacteur, le propriétaire ou le Responsable SM peut joindre un fichier."
            )
        require_state(d, (S.REDACTION, S.REFUSE), "Pièce jointe")
        f = payload(UploadInput, request)["file"]
        old = d.fichier.name if d.fichier else None
        d.fichier.save(os.path.basename(f.name), f, save=False)
        if old and old != d.fichier.name:
            d.fichier.storage.delete(old)
        return self._done(
            d, f"Pièce jointe : {os.path.basename(d.fichier.name)}", f"a joint un fichier à {d.ref}", self.MOD
        )


# ---------- 5.3 Situations d'urgence ----------


class ExerciceInput(serializers.Serializer):
    date = serializers.DateField()
    participants = serializers.CharField()
    scenario = serializers.CharField()
    procedure = serializers.CharField(help_text="Procédure / instruction jointe (nom du fichier)")


class CompteRenduInput(serializers.Serializer):
    compteRendu = serializers.CharField()
    actions = serializers.CharField()
    creer = serializers.BooleanField(
        default=False, help_text="Créer les actions dans le registre d'amélioration"
    )
    processus = serializers.CharField(
        required=False, help_text="Processus de l'action corrective (défaut : P11)"
    )


def add_registre(request, type_, intitule, origine, processus, normes, responsable):
    """addRegistre() du front : apps.core.tracing.add_registre, tracé dans l'AuditLog."""
    return tracing.add_registre(
        request.user.organisation, type_, intitule, origine, processus, normes, responsable, request=request
    )


class UrgenceViewSet(ActionMixin, OrgModelViewSet):
    MOD = "Situations d'urgence"

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def exercices(self, request, uid=None):
        u: Urgence = self.get_object()
        d = payload(ExerciceInput, request)
        ex = {
            "date": d["date"].isoformat(),
            "participants": d["participants"],
            "scenario": d["scenario"],
            "procedure": d["procedure"],
            "statut": Urgence.ExerciceStatut.PLANIFIE,
            "compteRendu": "—",
            "actions": "—",
        }
        u.exercices = [*u.exercices, ex]
        return self._done(
            u,
            f"Exercice planifié le {fd(ex['date'])}",
            f"a planifié un exercice : {u.type}",
            self.MOD,
            "Planifié",
            code=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path=r"exercices/(?P<index>\d+)/compte-rendu")
    @transaction.atomic
    def compte_rendu(self, request, uid=None, index=None):
        u: Urgence = self.get_object()
        i = int(index)
        if i >= len(u.exercices):
            raise NotFound("Exercice introuvable.")
        d = payload(CompteRenduInput, request)
        exercices = [dict(e) for e in u.exercices]
        if exercices[i]["statut"] == Urgence.ExerciceStatut.REALISE:
            raise serializers.ValidationError("Le compte-rendu de cet exercice est déjà enregistré.")
        exercices[i].update(
            compteRendu=d["compteRendu"], actions=d["actions"], statut=Urgence.ExerciceStatut.REALISE
        )
        u.exercices = exercices
        if d["creer"]:
            processus = d.get("processus") or "P11"
            add_registre(
                request,
                "Action corrective",
                d["actions"],
                f"Exercice : {u.type}",
                processus,
                ["45001", "14001"],
                u.responsables.split(" (")[0],
            )
        return self._done(
            u, "Compte-rendu enregistré", f"a enregistré le compte-rendu de l'exercice {u.type}", self.MOD
        )
