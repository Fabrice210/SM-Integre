"""Collections du module 1 — Contexte de l'organisme (voir apps/core/registry.py)."""

from apps.core.registry import register

from . import models as m
from . import serializers as s
from . import views as v

# Référentiels d'abord (processus, facteurs, axes, sites), puis ce qui les référence.
register(
    "processus",
    m.Processus,
    s.ProcessusSerializer,
    module="m1",
    load_order=10,
    search_fields=("code", "intitule", "proprietaire"),
    filterset_fields=("categorie",),
)
register(
    "swot",
    m.Swot,
    s.SwotSerializer,
    module="m1",
    load_order=20,
    search_fields=("libelle", "description"),
    filterset_fields=("type", "impact"),
)
register(
    "pestel",
    m.Pestel,
    s.PestelSerializer,
    module="m1",
    load_order=20,
    search_fields=("facteur",),
    filterset_fields=("dimension", "qualification", "impact"),
)
register(
    "axes",
    m.Axe,
    s.AxeSerializer,
    module="m2",
    load_order=20,
    search_fields=("code", "libelle", "evaluation"),
)
register(
    "sites",
    m.Site,
    s.SiteSerializer,
    module="m1",
    load_order=20,
    search_fields=("nom", "adresse", "activite"),
    filterset_fields=("statut", "monnaie"),
)
register(
    "enjeux",
    m.Enjeu,
    s.EnjeuSerializer,
    module="m1",
    viewset=v.EnjeuViewSet,
    load_order=30,
    search_fields=("libelle",),
    filterset_fields=("source", "qualification", "statut", "origine"),
)
register(
    "analyseVersions",
    m.AnalyseVersion,
    s.AnalyseVersionSerializer,
    module="m1",
    viewset=v.AnalyseVersionViewSet,
    load_order=40,
    search_fields=("version", "commentaire", "auteur"),
)
register(
    "parties",
    m.PartieInteressee,
    s.PartieInteresseeSerializer,
    module="m1",
    viewset=v.PartieInteresseeViewSet,
    load_order=20,
    search_fields=("nom", "exigences", "plan"),
    filterset_fields=("categorie", "plan_mis_en_oeuvre"),
)
register(
    "activites",
    m.Activite,
    s.ActiviteSerializer,
    module="m1",
    load_order=30,
    search_fields=("libelle", "site", "justification"),
    filterset_fields=("type", "statut", "site"),
)
register(
    "domaineVersions",
    m.DomaineVersion,
    s.DomaineVersionSerializer,
    module="m1",
    viewset=v.DomaineVersionViewSet,
    load_order=40,
    search_fields=("version", "commentaire", "auteur"),
)
register(
    "applicabilite",
    m.Applicabilite,
    s.ApplicabiliteSerializer,
    module="m1",
    load_order=20,
    search_fields=("article", "justification", "commentaire"),
    filterset_fields=("norme", "exclu"),
)
