"""Collections du module 4 — Support (voir apps/core/registry.py)."""

from apps.core.registry import register

from . import models as m
from . import serializers as s
from . import viewsets as v

register(
    "ressources",
    m.Ressource,
    s.RessourceSerializer,
    module="m4",
    viewset=v.RessourceViewSet,
    search_fields=("besoin", "justification"),
    filterset_fields=("type", "statut", "circuit", "processus"),
)
register(
    "competences",
    m.Competences,
    s.CompetencesSerializer,
    module="m4",
    singleton=True,
    viewset=v.CompetencesViewSet,
)
register(
    "savoirs",
    m.Savoir,
    s.SavoirSerializer,
    module="m4",
    viewset=v.SavoirViewSet,
    search_fields=("savoir", "detenteurs"),
    filterset_fields=("criticite",),
)
register(
    "formations",
    m.Formation,
    s.FormationSerializer,
    module="m4",
    viewset=v.FormationViewSet,
    search_fields=("theme", "participants", "formateur"),
    filterset_fields=("statut",),
)
register(
    "communications",
    m.Communication,
    s.CommunicationSerializer,
    module="m4",
    viewset=v.CommunicationViewSet,
    search_fields=("objectif", "cible"),
    filterset_fields=("type", "portee", "statut", "processus"),
)
