from django.contrib import admin

from .models import NotificationLog, NotificationPreference


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = ["user", "actif", "echeances", "validations", "updated_at"]
    list_filter = ["actif", "echeances", "validations"]
    search_fields = ["user__email", "user__nom"]


@admin.register(NotificationLog)
class NotificationLogAdmin(admin.ModelAdmin):
    list_display = ["date", "user", "kind", "titre", "sent_at"]
    list_filter = ["kind", "date", "organisation"]
    search_fields = ["user__email", "titre"]
    readonly_fields = ["organisation", "user", "date", "key", "kind", "titre", "sent_at"]
