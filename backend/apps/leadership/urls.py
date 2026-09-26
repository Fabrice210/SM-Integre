from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.core import registry
from apps.core.routing import collection_urls, viewset_for

from .views import DiffusionViewSet

# Le routage générique d'un objet unique ne sert que GET / PUT / PATCH : les actions
# de la politique sont routées ici.
_politique = viewset_for(registry.get("politique"))

router = DefaultRouter(trailing_slash=True)
router.include_root_view = False
router.register("diffusions", DiffusionViewSet, basename="diffusions")

urlpatterns = [
    path("politique/publier/", _politique.as_view({"post": "publier"}), name="politique-publier"),
    path(
        "politique/regenerer-resume/",
        _politique.as_view({"post": "regenerer_resume"}),
        name="politique-regenerer-resume",
    ),
    *collection_urls("leadership"),
    *router.urls,
]
