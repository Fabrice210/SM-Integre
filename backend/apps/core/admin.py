from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import AuditLog, JournalEntry, Organisation, User


@admin.register(Organisation)
class OrganisationAdmin(admin.ModelAdmin):
    list_display = ["nom", "sigle", "onboarded", "created_at"]


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["email", "nom", "organisation", "poste", "is_active"]
    list_filter = ["organisation", "is_active"]
    search_fields = ["email", "nom"]
    ordering = ["email"]
    fieldsets = BaseUserAdmin.fieldsets + (
        ("SM Intégré", {"fields": ("organisation", "uid", "nom", "poste", "direction", "roles")}),
    )


@admin.register(JournalEntry)
class JournalEntryAdmin(admin.ModelAdmin):
    list_display = ["d", "u", "a", "mod", "statut", "organisation"]
    list_filter = ["organisation", "mod"]

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ["at", "user", "collection", "uid", "action"]
    list_filter = ["organisation", "collection", "action"]

    def has_change_permission(self, request, obj=None):
        return False
