"""Collections du module 2 — Leadership (voir apps/core/registry.py).

Les axes stratégiques (db.axes), édités en 2.1, sont enregistrés par apps.contexte.
db.diffusions n'est pas dans la démo : exposée hors registre (voir urls.py).
"""

from apps.core.registry import register

from . import models as m
from . import serializers as s
from . import views as v

register(
    "planStrat",
    m.PlanStrat,
    s.PlanStratSerializer,
    module="m2",
    viewset=v.PlanStratViewSet,
    load_order=40,
    search_fields=("titre", "version", "valide_par"),
    filterset_fields=("statut",),
)
register(
    "champsPerso",
    m.ChampPerso,
    s.ChampPersoSerializer,
    module="m2",
    load_order=40,
    search_fields=("libelle", "valeur", "commentaire"),
    filterset_fields=("type",),
)
register(
    "politique",
    m.Politique,
    s.PolitiqueSerializer,
    module="m2",
    singleton=True,
    viewset=v.PolitiqueViewSet,
    load_order=40,
)
register(
    "preuvesCom",
    m.PreuveCom,
    s.PreuveComSerializer,
    module="m2",
    load_order=40,
    search_fields=("objet", "lieu", "preuve"),
    filterset_fields=("support", "objet"),
)
register(
    "accuses",
    m.Accuse,
    s.AccuseSerializer,
    module="m2",
    viewset=v.AccuseViewSet,
    load_order=40,
    search_fields=("collaborateur",),
    filterset_fields=("statut", "collaborateur"),
)
register(
    "postes",
    m.Poste,
    s.PosteSerializer,
    module="m2",
    load_order=30,  # après processus
    search_fields=("intitule", "direction", "titulaire", "mission", "responsabilites"),
    filterset_fields=("direction", "titulaire"),
)
register(
    "representants",
    m.Representant,
    s.RepresentantSerializer,
    module="m2",
    viewset=v.RepresentantViewSet,
    load_order=40,
    search_fields=("nom", "prenom", "fonction"),
    filterset_fields=("statut",),
)
register(
    "comite",
    m.MembreComite,
    s.MembreComiteSerializer,
    module="m2",
    load_order=40,
    search_fields=("nom", "prenom", "role"),
)
register(
    "reunions",
    m.Reunion,
    s.ReunionSerializer,
    module="m2",
    viewset=v.ReunionViewSet,
    load_order=40,
    search_fields=("objet", "ordre_du_jour", "compte_rendu", "plan_action"),
    filterset_fields=("statut", "participants"),
)
