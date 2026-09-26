from django.contrib import admin

from . import models as m


class OrgAdmin(admin.ModelAdmin):
    list_filter = ("organisation",)
    ordering = ("organisation", "position", "id")


@admin.register(m.Processus)
class ProcessusAdmin(OrgAdmin):
    list_display = ("uid", "code", "intitule", "categorie", "proprietaire", "organisation")
    list_filter = ("organisation", "categorie")
    search_fields = ("uid", "code", "intitule")


@admin.register(m.Swot)
class SwotAdmin(OrgAdmin):
    list_display = ("uid", "type", "libelle", "impact", "organisation")
    list_filter = ("organisation", "type")
    search_fields = ("uid", "libelle")


@admin.register(m.Pestel)
class PestelAdmin(OrgAdmin):
    list_display = ("uid", "dimension", "facteur", "qualification", "impact", "organisation")
    list_filter = ("organisation", "dimension", "qualification")
    search_fields = ("uid", "facteur")


@admin.register(m.Axe)
class AxeAdmin(OrgAdmin):
    list_display = ("uid", "code", "libelle", "avancement", "organisation")
    search_fields = ("uid", "code", "libelle")


@admin.register(m.Enjeu)
class EnjeuAdmin(OrgAdmin):
    list_display = ("uid", "libelle", "source", "qualification", "origine", "date", "statut", "organisation")
    list_filter = ("organisation", "source", "qualification", "statut")
    search_fields = ("uid", "libelle")


@admin.register(m.AnalyseVersion)
class AnalyseVersionAdmin(OrgAdmin):
    list_display = ("uid", "version", "date", "auteur", "facteurs", "enjeux", "organisation")


@admin.register(m.PartieInteressee)
class PartieInteresseeAdmin(OrgAdmin):
    list_display = ("uid", "nom", "categorie", "pouvoir", "legitimite", "urgence", "plan_mis_en_oeuvre")
    list_filter = ("organisation", "categorie", "plan_mis_en_oeuvre")
    search_fields = ("uid", "nom")


@admin.register(m.Site)
class SiteAdmin(OrgAdmin):
    list_display = ("uid", "nom", "adresse", "statut", "monnaie", "organisation")
    list_filter = ("organisation", "statut")
    search_fields = ("uid", "nom")


@admin.register(m.Activite)
class ActiviteAdmin(OrgAdmin):
    list_display = ("uid", "type", "libelle", "site", "statut", "organisation")
    list_filter = ("organisation", "type", "statut")
    search_fields = ("uid", "libelle", "site")


@admin.register(m.DomaineVersion)
class DomaineVersionAdmin(OrgAdmin):
    list_display = ("uid", "version", "date", "auteur", "organisation")


@admin.register(m.Applicabilite)
class ApplicabiliteAdmin(OrgAdmin):
    list_display = ("uid", "norme", "article", "exclu", "organisation")
    list_filter = ("organisation", "norme", "exclu")
    search_fields = ("uid", "article")
