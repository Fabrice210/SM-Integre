from django.apps import AppConfig


class ContexteConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.contexte"

    def ready(self):
        from . import catalog  # noqa: F401
