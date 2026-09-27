from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

api_v1 = [
    path("", include("apps.core.urls")),
    path("", include("apps.contexte.urls")),
    path("", include("apps.leadership.urls")),
    path("", include("apps.planification.urls")),
    path("", include("apps.support.urls")),
    path("", include("apps.operations.urls")),
    path("", include("apps.performance.urls")),
    path("", include("apps.pilotage.urls")),
    path("", include("apps.assistant.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include(api_v1)),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]

# Développement : fichiers déposés servis par runserver (stockage disque uniquement ;
# en production, les pièces jointes passent par l'API, droits vérifiés).
if settings.DEBUG and not settings.USE_S3:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Erreurs en JSON sous /api/ (pages HTML de Django ailleurs).
handler404 = "apps.core.errors.not_found"
handler500 = "apps.core.errors.server_error"
