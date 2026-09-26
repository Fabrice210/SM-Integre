from django.apps import AppConfig


class LeadershipConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.leadership"

    def ready(self):
        from . import catalog  # noqa: F401
