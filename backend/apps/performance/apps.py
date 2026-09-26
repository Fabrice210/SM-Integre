from django.apps import AppConfig


class PerformanceConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.performance"

    def ready(self):
        from . import catalog  # noqa: F401
