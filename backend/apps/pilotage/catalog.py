"""Collections transverses de pilotage (voir apps/core/registry.py)."""

from apps.core.registry import register

from . import models as m
from . import serializers as s
from . import views as v

register(
    "mapping",
    m.ExigenceNormative,
    s.ExigenceNormativeSerializer,
    module="pilotage",
    load_order=70,
    viewset=v.ExigenceNormativeViewSet,
    search_fields=("libelle", "article", "module", "preuve"),
    filterset_fields=("type", "module", "version"),
)
register(
    "cloturesMois", m.CloturesMois, s.CloturesMoisSerializer, module="pilotage", singleton=True, load_order=70
)
register("cloturesAn", m.CloturesAn, s.CloturesAnSerializer, module="pilotage", singleton=True, load_order=70)
