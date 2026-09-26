from django.urls import path

from apps.core.routing import collection_urls

from . import views

urlpatterns = [
    path("dashboard/", views.dashboard, name="dashboard"),
    path("alerts/", views.alerts, name="alerts"),
    *collection_urls("pilotage"),
]
