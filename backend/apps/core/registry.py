"""
Registre des collections métier.

Chaque app déclare ses collections dans `<app>/catalog.py` (importé par
AppConfig.ready) :

    register("processus", Processus, ProcessusSerializer, module="m1")
    register("politique", Politique, PolitiqueSerializer, module="m2", singleton=True)

Le nom est celui de la clé dans `db` côté front. Le registre sert à :
  - générer les routes REST (apps.core.routing.collection_urls) ;
  - construire /api/v1/bootstrap/ (toute la `db` au format du front) ;
  - charger les données de démonstration (manage.py load_demo).
"""

import re
from dataclasses import dataclass, field

from django.db import models
from rest_framework import serializers


@dataclass
class Collection:
    name: str
    model: type[models.Model]
    serializer: type[serializers.Serializer]
    module: str
    singleton: bool = False
    # ViewSet personnalisé (sinon OrgModelViewSet / SingletonView générique).
    viewset: type | None = None
    # URL (défaut : nom en kebab-case : analyseVersions -> analyse-versions).
    url: str = ""
    search_fields: tuple[str, ...] = ()
    filterset_fields: tuple[str, ...] = ()
    # Ordre de chargement de la démo (plus petit d'abord).
    load_order: int = 100
    # False : collection créée à l'usage par le front, absente de demo.json
    # (bootstrap renvoie alors [] tant qu'elle est vide).
    in_demo: bool = True
    app_label: str = field(default="", init=False)

    def __post_init__(self):
        self.app_label = self.model._meta.app_label
        if not self.url:
            self.url = kebab(self.name)


def kebab(name: str) -> str:
    """analyseVersions -> analyse-versions ; sourcesNC -> sources-nc."""
    return re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "-", name).lower()


_REGISTRY: dict[str, Collection] = {}


def register(name: str, model, serializer, module: str, **opts) -> Collection:
    if name in _REGISTRY:
        raise ValueError(f"Collection déjà enregistrée : {name}")
    col = Collection(name=name, model=model, serializer=serializer, module=module, **opts)
    _REGISTRY[name] = col
    return col


def get(name: str) -> Collection:
    return _REGISTRY[name]


def is_registered(name: str) -> bool:
    return name in _REGISTRY


def all_collections() -> list[Collection]:
    return sorted(_REGISTRY.values(), key=lambda c: (c.load_order, c.name))


def for_app(app_label: str) -> list[Collection]:
    return [c for c in all_collections() if c.app_label == app_label]
