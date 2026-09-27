from django.urls import path, re_path

from . import views

urlpatterns = [
    path("exports/tableau-de-bord.pdf", views.tableau_de_bord, name="export-dashboard"),
    path("exports/rapport-revue/<str:uid>.pdf", views.rapport_revue, name="export-rapport-revue"),
    path("exports/rapport-audit/<str:uid>.pdf", views.rapport_audit, name="export-rapport-audit"),
    re_path(
        r"^exports/(?P<collection>[A-Za-z][A-Za-z0-9-]*)\.(?P<fmt>xlsx|csv|pdf)$",
        views.export_collection,
        name="export-collection",
    ),
]
