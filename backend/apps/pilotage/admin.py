from django.contrib import admin

from . import models as m


@admin.register(m.ExigenceNormative)
class ExigenceNormativeAdmin(admin.ModelAdmin):
    list_display = ["uid", "norme", "article", "libelle", "module", "type", "couverture", "organisation"]
    list_filter = ["organisation", "norme", "type"]
    search_fields = ["uid", "article", "libelle"]


@admin.register(m.CloturesMois, m.CloturesAn)
class ClotureSerieAdmin(admin.ModelAdmin):
    list_display = ["organisation", "updated_at"]
