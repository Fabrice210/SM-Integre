"""
Lecture des collections au format du front pour les calculs de pilotage.

Chaque collection est relue par son sérialiseur du registre : les formules de
apps.pilotage.metrics s'appliquent donc exactement aux mêmes objets que dans le front,
quel que soit le module qui les implémente. Une collection non enregistrée (lot pas
encore fusionné) est remplacée par une liste vide / un objet vide.
"""

from apps.core import registry

LISTS = (
    "processus",
    "objectifs",
    "risques",
    "opportunites",
    "textes",
    "declarations",
    "ressources",
    "documents",
    "urgences",
    "fichesMaitrise",
    "representants",
    "comite",
    "plansOps",
    "formations",
    "indicateurs",
    "audits",
    "revues",
    "ncs",
    "registre",
    "mapping",
)
SINGLETONS = ("competences", "cloturesMois", "cloturesAn")


def load_collection(org, name: str):
    try:
        col = registry.get(name)
    except KeyError:
        return {} if name in SINGLETONS else []
    ctx = {"organisation": org}
    if col.singleton:
        obj = col.model.objects.filter(organisation=org).first()
        return col.serializer(obj, context=ctx).data if obj is not None else {}
    qs = col.model.objects.filter(organisation=org).order_by("position", "id")
    return list(col.serializer(qs, many=True, context=ctx).data)


def load_db(org, names=LISTS + SINGLETONS) -> dict:
    """Sous-ensemble de `db` (forme du front) nécessaire au tableau de bord et aux alertes."""
    return {name: load_collection(org, name) for name in names}
