from django.apps import AppConfig


class PilotageConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.pilotage"

    def ready(self):
        from . import catalog  # noqa: F401
