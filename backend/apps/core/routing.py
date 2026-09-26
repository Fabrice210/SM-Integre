"""Génération des routes REST d'une app à partir du registre des collections."""

from django.urls import path
from rest_framework.routers import DefaultRouter

from . import registry
from .viewsets import OrgModelViewSet, SingletonViewSet


def viewset_for(col: registry.Collection):
    base = col.viewset or (SingletonViewSet if col.singleton else OrgModelViewSet)
    attrs = {
        "collection": col,
        "serializer_class": col.serializer,
        "queryset": col.model.objects.none(),  # pour drf-spectacular ; get_queryset filtre
        "search_fields": col.search_fields,
        "filterset_fields": col.filterset_fields,
    }
    return type(f"{col.model.__name__}ViewSet", (base,), attrs)


def collection_urls(app_label: str) -> list:
    """urlpatterns de toutes les collections enregistrées par l'app."""
    router = DefaultRouter(trailing_slash=True)
    router.include_root_view = False
    urls = []
    for col in registry.for_app(app_label):
        vs = viewset_for(col)
        if col.singleton:
            view = vs.as_view({"get": "retrieve", "put": "update", "patch": "partial_update"})
            urls.append(path(f"{col.url}/", view, name=f"{col.name}-singleton"))
        else:
            router.register(col.url, vs, basename=col.name)
    return urls + router.urls
