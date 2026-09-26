from django.contrib import admin

from . import models as m


class _OrgAdmin(admin.ModelAdmin):
    list_filter = ["organisation"]
    ordering = ["organisation", "position", "id"]


@admin.register(m.Objectif)
class ObjectifAdmin(_OrgAdmin):
    list_display = ["uid", "code", "libelle", "axe", "delai", "efficacite", "organisation"]
    list_filter = ["organisation", "efficacite"]
    search_fields = ["uid", "code", "libelle", "kpi"]


@admin.register(m.FicheMaitrise)
class FicheMaitriseAdmin(_OrgAdmin):
    list_display = ["uid", "objet", "processus", "responsable", "prochaine_maj", "organisation"]
    search_fields = ["uid", "objet", "responsable"]


@admin.register(m.Texte)
class TexteAdmin(_OrgAdmin):
    list_display = [
        "uid",
        "intitule",
        "categorie",
        "domaine",
        "statut",
        "echeance",
        "diffuse",
        "organisation",
    ]
    list_filter = ["organisation", "categorie", "domaine", "statut"]
    search_fields = ["uid", "intitule", "justificatif"]


@admin.register(m.Declaration)
class DeclarationAdmin(_OrgAdmin):
    list_display = ["uid", "objet", "texte", "statut", "auteur", "date", "organisation"]
    list_filter = ["organisation", "statut"]
    search_fields = ["uid", "objet", "auteur"]


@admin.register(m.RapportConformite)
class RapportConformiteAdmin(_OrgAdmin):
    list_display = ["uid", "ref", "titre", "texte", "statut", "date", "organisation"]
    list_filter = ["organisation", "statut"]
    search_fields = ["uid", "ref", "titre"]


@admin.register(m.Risque)
class RisqueAdmin(_OrgAdmin):
    list_display = [
        "uid",
        "intitule",
        "type",
        "probabilite",
        "criticite",
        "statut_action",
        "realise",
        "organisation",
    ]
    list_filter = ["organisation", "type", "statut_action", "realise"]
    search_fields = ["uid", "intitule", "action", "responsable"]


@admin.register(m.Opportunite)
class OpportuniteAdmin(_OrgAdmin):
    list_display = ["uid", "intitule", "type", "probabilite", "impact", "statut_action", "organisation"]
    list_filter = ["organisation", "type", "statut_action"]
    search_fields = ["uid", "intitule", "action", "responsable"]
