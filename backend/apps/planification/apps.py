from django.apps import AppConfig


class PlanificationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.planification"

    def ready(self):
        from . import catalog  # noqa: F401
