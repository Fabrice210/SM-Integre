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
