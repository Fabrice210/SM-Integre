"""
Exports côté serveur (Excel, CSV, PDF). Lecture seule : tout membre de l'organisme.

  GET /api/v1/exports/<collection>.xlsx|.csv|.pdf   collection du registre, `journal` ou `users`
                                                    (?norme=9001… filtre les éléments)
  GET /api/v1/exports/registre.pdf                  registre d'amélioration continue
  GET /api/v1/exports/rapport-revue/<id>.pdf        rapport d'entrée et PV d'une revue
  GET /api/v1/exports/rapport-audit/<id>.pdf        rapport d'un audit
  GET /api/v1/exports/tableau-de-bord.pdf           indicateurs clés (?norme=all|cross|9001…, ?today=)

Chaque export est tracé : entrée « a exporté … » au journal (module Export) et AuditLog
(action « export »).
"""

import datetime as dt
import json
from urllib.parse import quote

from django.http import Http404, HttpResponse
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.decorators import api_view, renderer_classes
from rest_framework.renderers import BaseRenderer, JSONRenderer

from apps.core import registry
from apps.core.models import NORM_IDS, AuditLog
from apps.core.tracing import log_act
from apps.pilotage.data import load_collection, load_db
from apps.pilotage.metrics import fd
from apps.pilotage.views import _norm, _today

from . import reports
from .tabular import UnknownCollection, build_table, filters_by_norme, resolve
from .writers import to_csv, to_xlsx

AUDIT_EXPORT = "export"  # AuditLog.action (en plus de create / update / delete)

MIME = {
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "csv": "text/csv; charset=utf-8",
    "pdf": "application/pdf",
}
FORMAT_LABEL = {"xlsx": "Excel", "csv": "CSV"}


class BinaryRenderer(BaseRenderer):
    """Accepte tout en-tête Accept (le fichier est renvoyé par HttpResponse) ; erreurs en JSON."""

    media_type = "*/*"
    format = "bin"
    charset = None

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return json.dumps(data, ensure_ascii=False).encode()


RENDERERS = [JSONRenderer, BinaryRenderer]
NORME_PARAM = OpenApiParameter("norme", str, description="Filtre de norme : 9001, 14001, 45001 ou 27001")


def _stamp() -> str:
    now = timezone.localtime()
    return f"{fd(now.date().isoformat())} à {now:%H:%M}"


def _file(content: bytes, fmt: str, filename: str) -> HttpResponse:
    resp = HttpResponse(content, content_type=MIME[fmt])
    name = f"{filename}.{fmt}"
    ascii_name = name.encode("ascii", "replace").decode().replace("?", "_")
    resp["Content-Disposition"] = f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(name)}"
    resp["Access-Control-Expose-Headers"] = "Content-Disposition"
    return resp


def _trace(request, collection: str, uid: str, fmt: str, title: str, **data):
    user = request.user
    label = title.replace("_", " ") if fmt == "pdf" else title
    if fmt == "pdf":
        log_act(user, f"a généré le PDF « {label} »", "Export")
    else:
        log_act(user, f"a exporté « {label} » ({FORMAT_LABEL[fmt]})", "Export")
    AuditLog.objects.create(
        organisation=user.organisation,
        user=user,
        collection=collection,
        uid=uid,
        action=AUDIT_EXPORT,
        data={"format": fmt, **{k: v for k, v in data.items() if v}},
    )


@extend_schema(parameters=[NORME_PARAM], responses={200: OpenApiTypes.BINARY})
@api_view(["GET"])
@renderer_classes(RENDERERS)
def export_collection(request, collection: str, fmt: str):
    """Export d'une collection : colonnes = clés du front, en-têtes lisibles, listes jointes."""
    try:
        name = resolve(collection)
    except UnknownCollection as exc:
        raise Http404(f"Collection inconnue : {collection}") from exc
    org = request.user.organisation
    norme = request.query_params.get("norme")
    norme = norme if norme in NORM_IDS and filters_by_norme(name) else None
    table = build_table(org, name, norme)
    filename = table.title + (f"_ISO_{norme}" if norme else "")
    if fmt == "xlsx":
        content = to_xlsx(table, org.nom, _stamp())
    elif fmt == "csv":
        content = to_csv(table)
    else:
        content = reports.collection_pdf(table, org, request.user, _stamp())
    _trace(request, name, "", fmt, table.title, norme=norme)
    return _file(content, fmt, filename)


def _find(org, name: str, uid: str) -> dict:
    if not registry.is_registered(name):
        raise Http404
    obj = next((x for x in load_collection(org, name) if x.get("id") == uid), None)
    if obj is None:
        raise Http404(f"{name} {uid} introuvable.")
    return obj


@extend_schema(responses={200: OpenApiTypes.BINARY})
@api_view(["GET"])
@renderer_classes(RENDERERS)
def rapport_revue(request, uid: str):
    """Rapport d'entrée et procès-verbal d'une revue de direction (printPV du front)."""
    org = request.user.organisation
    r = _find(org, "revues", uid)
    content = reports.revue_pdf(r, org, request.user, _stamp())
    title = f"PV {r.get('ref', uid)}"
    _trace(request, "revues", uid, "pdf", title)
    return _file(content, "pdf", title.replace(" ", "_"))


@extend_schema(responses={200: OpenApiTypes.BINARY})
@api_view(["GET"])
@renderer_classes(RENDERERS)
def rapport_audit(request, uid: str):
    """Rapport d'un audit : fiche, constats et actions enregistrées au registre."""
    org = request.user.organisation
    a = _find(org, "audits", uid)
    content = reports.audit_pdf(a, load_db(org, ("processus", "registre")), org, request.user, _stamp())
    title = f"Rapport d'audit {a.get('ref', uid)}"
    _trace(request, "audits", uid, "pdf", title)
    return _file(content, "pdf", f"Rapport_audit_{a.get('ref', uid)}")


@extend_schema(
    parameters=[
        OpenApiParameter("norme", str, description="all (défaut), cross ou 9001 / 14001 / 45001 / 27001"),
        OpenApiParameter("today", OpenApiTypes.DATE, description="Date de référence (défaut : aujourd'hui)"),
    ],
    responses={200: OpenApiTypes.BINARY},
)
@api_view(["GET"])
@renderer_classes(RENDERERS)
def tableau_de_bord(request):
    """Indicateurs clés du tableau de bord, statistiques, échéances et alertes."""
    org = request.user.organisation
    norm = _norm(request)
    today: dt.date = _today(request)
    content = reports.dashboard_pdf(org, request.user, _stamp(), norm, today)
    _trace(request, "dashboard", "", "pdf", "Tableau de bord", norme=norm)
    return _file(content, "pdf", "Tableau_de_bord")
