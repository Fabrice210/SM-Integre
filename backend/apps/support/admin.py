from django.contrib import admin

from .models import Communication, Competences, Formation, Ressource, Savoir


class OrgAdmin(admin.ModelAdmin):
    list_filter = ["organisation"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(Ressource)
class RessourceAdmin(OrgAdmin):
    list_display = ["uid", "besoin", "type", "circuit", "statut", "montant", "date_demandee", "organisation"]
    list_filter = ["organisation", "statut", "type", "circuit"]
    search_fields = ["uid", "besoin", "demandeur"]


@admin.register(Competences)
class CompetencesAdmin(admin.ModelAdmin):
    list_display = ["organisation", "updated_at"]
    readonly_fields = ["updated_at"]


@admin.register(Savoir)
class SavoirAdmin(OrgAdmin):
    list_display = ["uid", "savoir", "criticite", "couverture", "organisation"]
    list_filter = ["organisation", "criticite"]
    search_fields = ["uid", "savoir", "detenteurs"]


@admin.register(Formation)
class FormationAdmin(OrgAdmin):
    list_display = ["uid", "theme", "date", "statut", "evaluation_date", "organisation"]
    list_filter = ["organisation", "statut"]
    search_fields = ["uid", "theme", "formateur"]


@admin.register(Communication)
class CommunicationAdmin(OrgAdmin):
    list_display = ["uid", "objectif", "type", "portee", "date", "statut", "organisation"]
    list_filter = ["organisation", "type", "portee", "statut"]
    search_fields = ["uid", "objectif", "cible"]
