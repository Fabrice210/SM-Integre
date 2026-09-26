"""Collections du module 5 — Maîtrise opérationnelle (voir apps/core/registry.py)."""

from apps.core.registry import register

from . import models as m
from . import serializers as s
from . import viewsets as v

register(
    "modeles",
    m.Modele,
    s.ModeleSerializer,
    module="m5",
    search_fields=("nom", "description"),
    filterset_fields=("type", "processus"),
)
register(
    "documents",
    m.Document,
    s.DocumentSerializer,
    module="m5",
    viewset=v.DocumentViewSet,
    search_fields=("ref", "intitule", "proprietaire"),
    filterset_fields=("type", "statut", "processus"),
)
register(
    "plansOps",
    m.PlanOps,
    s.PlanOpsSerializer,
    module="m5",
    search_fields=("plan", "responsable"),
    filterset_fields=("statut", "processus"),
)
register(
    "urgences",
    m.Urgence,
    s.UrgenceSerializer,
    module="m5",
    viewset=v.UrgenceViewSet,
    search_fields=("type", "procedure", "responsables"),
)
