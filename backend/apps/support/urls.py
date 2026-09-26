from django.urls import path

from apps.core import registry
from apps.core.routing import collection_urls, viewset_for


def singleton_actions(name: str, actions: dict[str, dict[str, str]]) -> list:
    """Routes des actions d'une collection unique (collection_urls ne route que GET/PUT/PATCH)."""
    col = registry.get(name)
    vs = viewset_for(col)
    urls = []
    for url_path, mapping in actions.items():
        method = getattr(vs, next(iter(mapping.values())))
        view = vs.as_view(mapping, basename=name, detail=False, **getattr(method, "kwargs", {}))
        urls.append(path(f"{col.url}/{url_path}/", view, name=f"{name}-{url_path}"))
    return urls


urlpatterns = [
    *singleton_actions(
        "competences",
        {
            "ecarts": {"get": "ecarts"},
            "niveau": {"post": "niveau"},
            "collaborateurs": {"post": "collaborateurs"},
            "import": {"post": "importer"},
        },
    ),
    *collection_urls("support"),
]
