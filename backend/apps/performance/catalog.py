"""Collections du module 6 — Performance et amélioration (voir apps/core/registry.py)."""

from apps.core.registry import register

from . import models as m
from . import serializers as s
from . import views as v

register(
    "indicateurs",
    m.Indicateur,
    s.IndicateurSerializer,
    module="m6",
    load_order=60,
    search_fields=("kpi", "responsable", "moyen"),
    filterset_fields=("processus", "objectif", "sens"),
)
register(
    "prestataires",
    m.Prestataire,
    s.PrestataireSerializer,
    module="m6",
    load_order=60,
    viewset=v.PrestataireViewSet,
    search_fields=("nom", "champ", "responsable"),
    filterset_fields=("categorie", "frequence", "processus"),
)
register(
    "statsSurv",
    m.StatsSurveillance,
    s.StatsSurveillanceSerializer,
    module="m6",
    singleton=True,
    load_order=60,
)
register(
    "auditeurs",
    m.Auditeur,
    s.AuditeurSerializer,
    module="m6",
    load_order=60,
    search_fields=("nom", "qualification"),
)
register(
    "audits",
    m.Audit,
    s.AuditSerializer,
    module="m6",
    load_order=61,
    viewset=v.AuditViewSet,
    search_fields=("ref", "titre", "auditeur"),
    filterset_fields=("statut", "auditeur", "perimetre"),
)
register(
    "revues",
    m.Revue,
    s.RevueSerializer,
    module="m6",
    load_order=61,
    viewset=v.RevueViewSet,
    search_fields=("ref", "type", "pv"),
    filterset_fields=("statut", "type"),
)
# Sources avant les NC : la source d'une NC est validée contre cette liste.
register(
    "sourcesNC",
    m.SourcesNC,
    s.SourcesNCSerializer,
    module="m6",
    singleton=True,
    load_order=60,
)
register(
    "ncs",
    m.NonConformite,
    s.NonConformiteSerializer,
    module="m6",
    load_order=61,
    viewset=v.NonConformiteViewSet,
    search_fields=("ref", "description", "lieu"),
    filterset_fields=("categorie", "source", "statut", "processus", "type_acte"),
)
register(
    "registre",
    m.RegistreEntree,
    s.RegistreEntreeSerializer,
    module="m6",
    load_order=62,
    viewset=v.RegistreViewSet,
    search_fields=("ref", "intitule", "origine", "responsable"),
    filterset_fields=("type", "statut", "processus"),
)
