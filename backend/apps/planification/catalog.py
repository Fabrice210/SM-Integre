"""Collections du module 3 — Objectifs, conformité et risques (voir apps/core/registry.py)."""

from apps.core.registry import register

from . import models as m
from . import serializers as s
from . import viewsets as v

register(
    "textes",
    m.Texte,
    s.TexteSerializer,
    module="m3",
    viewset=v.TexteViewSet,
    load_order=30,
    search_fields=("intitule", "justificatif", "responsable"),
    filterset_fields=("categorie", "domaine", "statut", "responsable", "diffuse"),
)
register(
    "risques",
    m.Risque,
    s.RisqueSerializer,
    module="m3",
    viewset=v.RisqueViewSet,
    load_order=30,
    search_fields=("intitule", "cause", "consequences", "action", "responsable"),
    filterset_fields=("type", "traitement", "statut_action", "efficacite", "realise", "responsable"),
)
register(
    "opportunites",
    m.Opportunite,
    s.OpportuniteSerializer,
    module="m3",
    viewset=v.OpportuniteViewSet,
    load_order=30,
    search_fields=("intitule", "origine", "benefices", "action", "responsable"),
    filterset_fields=("type", "statut_action", "efficacite", "responsable"),
)
register(
    "objectifs",
    m.Objectif,
    s.ObjectifSerializer,
    module="m3",
    viewset=v.ObjectifViewSet,
    load_order=35,
    search_fields=("code", "libelle", "kpi"),
    filterset_fields=("axe", "efficacite"),
)
register(
    "declarations",
    m.Declaration,
    s.DeclarationSerializer,
    module="m3",
    viewset=v.DeclarationViewSet,
    load_order=40,
    search_fields=("objet", "cause", "auteur"),
    filterset_fields=("statut", "texte", "auteur"),
)
register(
    "rapportsConf",
    m.RapportConformite,
    s.RapportConformiteSerializer,
    module="m3",
    load_order=40,
    search_fields=("ref", "titre", "synthese", "auteur"),
    filterset_fields=("statut", "texte", "auteur"),
)
register(
    "fichesMaitrise",
    m.FicheMaitrise,
    s.FicheMaitriseSerializer,
    module="m3",
    viewset=v.FicheMaitriseViewSet,
    load_order=40,
    search_fields=("objet", "criteres", "responsable"),
    filterset_fields=("processus", "responsable"),
)
