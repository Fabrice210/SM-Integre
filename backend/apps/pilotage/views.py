"""
Pilotage calculé côté serveur :

  GET /api/v1/dashboard/   valeurs du tableau de bord (?norme=all|cross|9001|14001|45001|27001,
                           ?proc=P05, ?dir=Direction…, ?today=AAAA-MM-JJ)
  GET /api/v1/alerts/      alertes (computeAlerts) et validations en attente (?today=AAAA-MM-JJ)

La date de référence est la date du jour réelle ; `today` permet de rejouer un calcul
à une date donnée (la démo est figée au 2026-09-21).
"""

import datetime as dt

from django.contrib.auth import get_user_model
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.core.models import NORM_IDS
from apps.core.viewsets import OrgModelViewSet

from . import metrics
from .data import load_db

User = get_user_model()

TODAY_PARAM = OpenApiParameter(
    "today", OpenApiTypes.DATE, description="Date de référence (défaut : aujourd'hui)"
)


def _today(request) -> dt.date:
    raw = request.query_params.get("today")
    if not raw:
        return timezone.localdate()
    try:
        return dt.date.fromisoformat(raw)
    except ValueError as exc:
        raise serializers.ValidationError({"today": "Date AAAA-MM-JJ attendue."}) from exc


def _norm(request) -> str:
    norm = request.query_params.get("norme") or "all"
    if norm not in ("all", "cross", *NORM_IDS):
        raise serializers.ValidationError(
            {"norme": f"Valeurs possibles : all, cross, {', '.join(NORM_IDS)}."}
        )
    return norm


class ExigenceNormativeViewSet(OrgModelViewSet):
    """Couverture normative : ?norme= filtre sur le champ `norme` (et non `normes`)."""

    def get_queryset(self):
        qs = super().get_queryset()
        norme = self.request.query_params.get("norme")
        if norme in NORM_IDS:
            qs = qs.filter(norme=norme)
        return qs


@extend_schema(
    parameters=[
        OpenApiParameter("norme", str, description="all (défaut), cross ou 9001 / 14001 / 45001 / 27001"),
        OpenApiParameter("proc", str, description="Bloc « Par processus » : id du processus"),
        OpenApiParameter("dir", str, description="Bloc « Par processus » : direction du pilote"),
        TODAY_PARAM,
    ],
    responses=OpenApiTypes.OBJECT,
)
@api_view(["GET"])
def dashboard(request):
    """Tableau de bord : couverture, actions, alertes, conformité, graphiques, blocs et échéances."""
    org = request.user.organisation
    users = list(User.objects.filter(organisation=org).order_by("id").values("nom", "direction"))
    return Response(
        metrics.dashboard(
            load_db(org),
            org.active_norms or [],
            users,
            _norm(request),
            _today(request),
            proc=request.query_params.get("proc", ""),
            direction=request.query_params.get("dir", ""),
        )
    )


@extend_schema(parameters=[TODAY_PARAM], responses=OpenApiTypes.OBJECT)
@api_view(["GET"])
def alerts(request):
    """Alertes actives (échéances dépassées ou proches, écarts) et validations en attente."""
    today = _today(request)
    db = load_db(request.user.organisation)
    al = metrics.compute_alerts(db, today)
    return Response(
        {
            "date": today.isoformat(),
            "total": len(al),
            "critiques": sum(1 for a in al if a["lvl"] == "red"),
            "alertes": al,
            "validations": metrics.pending_validations(db),
        }
    )
