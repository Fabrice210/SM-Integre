"""Préférences de notification des utilisateurs et journal des envois (anti-doublon)."""

from django.conf import settings
from django.db import models

from apps.core.models import Organisation


class NotificationPreference(models.Model):
    """Abonnement d'un utilisateur au récapitulatif e-mail (abonné par défaut)."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notification_preference"
    )
    actif = models.BooleanField(default=True, help_text="Recevoir le récapitulatif quotidien par e-mail")
    echeances = models.BooleanField(default=True, help_text="Inclure les échéances dépassées ou proches")
    validations = models.BooleanField(default=True, help_text="Inclure les validations en attente")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "préférence de notification"
        verbose_name_plural = "préférences de notification"

    def __str__(self):
        return f"{self.user} : {'abonné' if self.actif else 'désabonné'}"

    @classmethod
    def for_user(cls, user) -> "NotificationPreference":
        """Préférences enregistrées, ou valeurs par défaut (non sauvegardées)."""
        try:
            return user.notification_preference
        except cls.DoesNotExist:
            return cls(user=user)


class NotificationLog(models.Model):
    """Alerte notifiée à un utilisateur un jour donné : jamais deux fois le même jour."""

    class Kind(models.TextChoices):
        ALERTE = "alerte"
        VALIDATION = "validation"

    organisation = models.ForeignKey(Organisation, on_delete=models.CASCADE, related_name="+")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    date = models.DateField(help_text="Jour de référence de l'envoi")
    key = models.CharField(max_length=64, help_text="Empreinte de l'alerte (type, titre, détail)")
    kind = models.CharField(max_length=16, choices=Kind.choices)
    titre = models.CharField(max_length=255, blank=True)
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-sent_at", "-id"]
        verbose_name = "notification envoyée"
        verbose_name_plural = "notifications envoyées"
        constraints = [
            models.UniqueConstraint(fields=["user", "date", "key"], name="notifications_log_uniq_per_day")
        ]

    def __str__(self):
        return f"{self.date} {self.user} : {self.titre}"
