"""Collections du module 1 — Contexte de l'organisme (voir apps/core/registry.py)."""

from apps.core.registry import register

from . import models as m
from . import serializers as s

register(
    "processus",
    m.Processus,
    s.ProcessusSerializer,
    module="m1",
    load_order=10,
    search_fields=("code", "intitule", "proprietaire"),
    filterset_fields=("categorie",),
)
