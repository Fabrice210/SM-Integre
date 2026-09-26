from django.contrib import admin

from . import models as m


class OrgAdmin(admin.ModelAdmin):
    list_filter = ["organisation"]


@admin.register(m.Indicateur)
class IndicateurAdmin(OrgAdmin):
    list_display = ["uid", "kpi", "cible", "valeur", "unite", "processus", "organisation"]
    search_fields = ["uid", "kpi"]


@admin.register(m.Prestataire)
class PrestataireAdmin(OrgAdmin):
    list_display = ["uid", "nom", "categorie", "frequence", "processus", "organisation"]
    search_fields = ["uid", "nom"]


@admin.register(m.StatsSurveillance)
class StatsSurveillanceAdmin(OrgAdmin):
    list_display = ["organisation", "updated_at"]


@admin.register(m.Auditeur)
class AuditeurAdmin(OrgAdmin):
    list_display = ["uid", "nom", "qualification", "organisation"]
    search_fields = ["uid", "nom"]


@admin.register(m.Audit)
class AuditAdmin(OrgAdmin):
    list_display = ["uid", "ref", "titre", "date", "auditeur", "statut", "organisation"]
    list_filter = ["organisation", "statut"]
    search_fields = ["uid", "ref", "titre"]


@admin.register(m.Revue)
class RevueAdmin(OrgAdmin):
    list_display = ["uid", "ref", "type", "date", "statut", "organisation"]
    list_filter = ["organisation", "statut"]
    search_fields = ["uid", "ref"]


@admin.register(m.NonConformite)
class NonConformiteAdmin(OrgAdmin):
    list_display = ["uid", "ref", "categorie", "statut", "processus", "date", "organisation"]
    list_filter = ["organisation", "categorie", "statut"]
    search_fields = ["uid", "ref", "description"]


@admin.register(m.SourcesNC)
class SourcesNCAdmin(OrgAdmin):
    list_display = ["organisation", "updated_at"]


@admin.register(m.RegistreEntree)
class RegistreEntreeAdmin(OrgAdmin):
    list_display = ["uid", "ref", "type", "statut", "responsable", "date", "organisation"]
    list_filter = ["organisation", "type", "statut"]
    search_fields = ["uid", "ref", "intitule"]
