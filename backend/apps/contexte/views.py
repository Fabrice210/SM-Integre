"""
Actions métier du module 1 (reprises de src/features/m1-contexte/actions.tsx et details.tsx).

  POST /enjeux/generer/                     genEnjeux() : un enjeu par facteur PESTEL sans enjeu
  POST /analyse-versions/figer/             saveVersion('analyseVersions') {commentaire}
  POST /domaine-versions/figer/             saveVersion('domaineVersions') {commentaire}
  POST /parties/{id}/basculer-plan/         piDetail() : plan d'engagement mis en œuvre / à traiter
"""

import re

from django.db import transaction
from django.db.models import F
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.models import AuditLog
from apps.core.viewsets import OrgModelViewSet, log_write

from . import models as m
from .serializers import VersionCommentaireSerializer
from .tracing import add_hist, log_act, today

# AXE_BY_NORM du front : axe de la politique associé à chaque norme.
AXE_BY_NORM = {"27001": "AX4", "45001": "AX2", "14001": "AX3", "9001": "AX1"}


class EnjeuViewSet(OrgModelViewSet):
    @action(detail=False, methods=["post"])
    @transaction.atomic
    def generer(self, request):
        """Génère un enjeu pour chaque facteur PESTEL qui n'en a pas encore, rattaché aux axes."""
        user = request.user
        org = user.organisation
        origines = set(m.Enjeu.objects.filter(organisation=org).values_list("origine", flat=True))
        crees = []
        for f in m.Pestel.objects.filter(organisation=org).order_by("position", "id"):
            if f.uid in origines:
                continue
            prefixe = "Saisir : " if f.qualification == m.Qualification.POSITIF else "Maîtriser : "
            e = m.Enjeu(
                organisation=org,
                uid=org.next_uid(m.Enjeu.UID_PREFIX),
                libelle=prefixe + f.facteur[:1].lower() + f.facteur[1:],
                source=m.Enjeu.Source.EXTERNE,
                qualification=f.qualification,
                axes=list(dict.fromkeys(AXE_BY_NORM[n] for n in f.normes if n in AXE_BY_NORM)),
                normes=list(f.normes),
                origine=f.uid,
                date=today(),
                statut=m.Enjeu.Statut.ACTIF,
            )
            add_hist(e, user, "Généré automatiquement depuis le facteur " + f.uid)
            crees.append(e)
        n = len(crees)
        if n:
            # unshift() successifs : le dernier généré en tête de liste.
            m.Enjeu.objects.filter(organisation=org).update(position=F("position") + n)
            for i, e in enumerate(crees):
                e.position = n - 1 - i
                e.save()
        data = self.get_serializer(list(reversed(crees)), many=True).data
        for row in data:
            log_write(request, self.collection.name, AuditLog.Action.CREATE, row["id"], row)
        log_act(user, f"a généré {n} enjeu(x) depuis la matrice PESTEL", "Enjeux")
        return Response({"generes": n, "enjeux": data})


def _next_version(last: str | None, decimals: int) -> str:
    """'v' + (parseFloat(version.slice(1)) + 1).toFixed(decimals)."""
    match = re.match(r"^[+-]?\d+(\.\d+)?", (last or "")[1:])
    base = float(match.group(0)) if match else 0.0
    return "v" + f"{base + 1:.{decimals}f}"


class VersionViewSet(OrgModelViewSet):
    """saveVersion(coll, label) : fige une nouvelle version (analyse du contexte ou domaine)."""

    decimals = 0
    label = ""

    @action(detail=False, methods=["post"], serializer_class=VersionCommentaireSerializer)
    @transaction.atomic
    def figer(self, request):
        body = VersionCommentaireSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        user = request.user
        org = user.organisation
        model = self.collection.model
        qs = model.objects.filter(organisation=org).order_by("position", "id")
        last = qs.last()
        version = _next_version(last.version if last else None, self.decimals)
        obj = model.objects.create(
            organisation=org,
            uid=org.next_uid(model.UID_PREFIX),
            position=(last.position + 1) if last else 0,
            version=version,
            date=today(),
            auteur=user.nom,
            commentaire=body.validated_data["commentaire"],
            facteurs=m.Swot.objects.filter(organisation=org).count()
            + m.Pestel.objects.filter(organisation=org).count(),
            enjeux=m.Enjeu.objects.filter(organisation=org).count(),
        )
        obj.refresh_from_db()
        data = self.collection.serializer(obj, context=self.get_serializer_context()).data
        log_write(request, self.collection.name, AuditLog.Action.CREATE, obj.uid, data)
        log_act(user, f"a enregistré la version {version} ({self.label})", self.label)
        return Response(data, status=status.HTTP_201_CREATED)


class AnalyseVersionViewSet(VersionViewSet):
    decimals = 1
    label = "Enjeux"


class DomaineVersionViewSet(VersionViewSet):
    decimals = 0
    label = "Domaine d'application"


class PartieInteresseeViewSet(OrgModelViewSet):
    @action(detail=True, methods=["post"], url_path="basculer-plan")
    @transaction.atomic
    def basculer_plan(self, request, uid=None):
        """Déclare le plan d'engagement mis en œuvre, ou le repasse à traiter."""
        p = self.get_object()
        p.plan_mis_en_oeuvre = not p.plan_mis_en_oeuvre
        add_hist(
            p, request.user, "Plan déclaré mis en œuvre" if p.plan_mis_en_oeuvre else "Plan repassé à traiter"
        )
        p.save()
        data = self.get_serializer(p).data
        log_write(request, self.collection.name, AuditLog.Action.UPDATE, p.uid, data)
        log_act(request.user, "a mis à jour l'état du plan d'engagement de " + p.nom, "Parties intéressées")
        return Response(data)
