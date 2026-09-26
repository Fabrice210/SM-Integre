from django.db import models

from apps.core.models import NormesMixin, OrgModel


class Processus(NormesMixin, OrgModel):
    """1.4 Cartographie des processus (db.processus)."""

    UID_PREFIX = "P"

    class Categorie(models.TextChoices):
        PILOTAGE = "Pilotage"
        REALISATION = "Réalisation"
        SUPPORT = "Support"

    code = models.CharField(max_length=32)
    intitule = models.CharField(max_length=255)
    categorie = models.CharField(max_length=32, choices=Categorie.choices)
    proprietaire = models.CharField(max_length=255, blank=True, help_text="Pilote (nom complet)")
    copilote = models.JSONField(default=list, blank=True, help_text="Copilotes (noms complets)")
    finalite = models.TextField(blank=True)
    entrees = models.TextField(blank=True)
    sorties = models.TextField(blank=True)
    indicateurs = models.TextField(blank=True)

    class Meta(OrgModel.Meta):
        verbose_name_plural = "processus"
