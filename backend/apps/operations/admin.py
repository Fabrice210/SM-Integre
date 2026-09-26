from django.contrib import admin

from .models import Document, Modele, PlanOps, Urgence


class OrgAdmin(admin.ModelAdmin):
    list_filter = ["organisation"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(Modele)
class ModeleAdmin(OrgAdmin):
    list_display = ["uid", "nom", "type", "processus", "organisation"]
    list_filter = ["organisation", "type"]
    search_fields = ["uid", "nom"]


@admin.register(Document)
class DocumentAdmin(OrgAdmin):
    list_display = [
        "uid",
        "ref",
        "intitule",
        "type",
        "version",
        "statut",
        "approbateur",
        "date_revue",
        "organisation",
    ]
    list_filter = ["organisation", "statut", "type"]
    search_fields = ["uid", "ref", "intitule", "proprietaire"]


@admin.register(PlanOps)
class PlanOpsAdmin(OrgAdmin):
    list_display = ["uid", "processus", "plan", "responsable", "echeance", "statut", "organisation"]
    list_filter = ["organisation", "statut"]
    search_fields = ["uid", "plan", "responsable"]


@admin.register(Urgence)
class UrgenceAdmin(OrgAdmin):
    list_display = ["uid", "type", "procedure", "responsables", "organisation"]
    search_fields = ["uid", "type", "procedure"]
