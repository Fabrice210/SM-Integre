from django.contrib import admin

from . import models as m


class OrgAdmin(admin.ModelAdmin):
    list_filter = ("organisation",)
    ordering = ("organisation", "position", "id")


@admin.register(m.PlanStrat)
class PlanStratAdmin(OrgAdmin):
    list_display = ("uid", "version", "titre", "date_validation", "statut", "organisation")
    list_filter = ("organisation", "statut")
    search_fields = ("uid", "titre")


@admin.register(m.ChampPerso)
class ChampPersoAdmin(OrgAdmin):
    list_display = ("uid", "libelle", "type", "valeur", "organisation")
    list_filter = ("organisation", "type")
    search_fields = ("uid", "libelle")


@admin.register(m.Politique)
class PolitiqueAdmin(admin.ModelAdmin):
    list_display = ("organisation", "version", "statut", "date", "signataire")
    list_filter = ("organisation", "statut")


@admin.register(m.PreuveCom)
class PreuveComAdmin(OrgAdmin):
    list_display = ("uid", "objet", "date", "support", "personnes", "organisation")
    list_filter = ("organisation", "support")


@admin.register(m.Accuse)
class AccuseAdmin(OrgAdmin):
    list_display = ("uid", "collaborateur", "statut", "date", "organisation")
    list_filter = ("organisation", "statut")
    search_fields = ("uid", "collaborateur")


@admin.register(m.Diffusion)
class DiffusionAdmin(admin.ModelAdmin):
    list_display = ("d", "u", "doc", "canal", "destinataires", "piece", "organisation")
    list_filter = ("organisation", "canal")

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(m.Poste)
class PosteAdmin(OrgAdmin):
    list_display = ("uid", "intitule", "direction", "titulaire", "organisation")
    list_filter = ("organisation", "direction")
    search_fields = ("uid", "intitule", "titulaire")


@admin.register(m.Representant)
class RepresentantAdmin(OrgAdmin):
    list_display = ("uid", "nom", "prenom", "qualite_lien", "mandat_debut", "mandat_fin", "statut")
    list_filter = ("organisation", "statut", "qualite_lien")
    search_fields = ("uid", "nom", "prenom")


@admin.register(m.MembreComite)
class MembreComiteAdmin(OrgAdmin):
    list_display = ("uid", "nom", "prenom", "role", "mandat_fin", "organisation")
    search_fields = ("uid", "nom", "prenom")


@admin.register(m.Reunion)
class ReunionAdmin(OrgAdmin):
    list_display = ("uid", "objet", "date_prevue", "participants", "statut", "statut_plan", "organisation")
    list_filter = ("organisation", "statut", "participants", "statut_plan")
    search_fields = ("uid", "objet")
