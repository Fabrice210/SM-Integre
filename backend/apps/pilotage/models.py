"""
Pilotage transverse : couverture normative article par article (db.mapping) et séries
d'ouvertures / clôtures des actions d'amélioration du tableau de bord (db.cloturesMois,
db.cloturesAn).
"""

from django.core.validators import MaxValueValidator
from django.db import models

from apps.core.models import NORM_IDS, OrgModel, OrgSingleton


class ExigenceNormative(OrgModel):
    """Exigence d'une norme reliée au module du noyau qui la traite et à sa preuve (db.mapping)."""

    UID_PREFIX = "MP"

    class Norme(models.TextChoices):
        ISO_9001 = NORM_IDS[0]
        ISO_14001 = NORM_IDS[1]
        ISO_45001 = NORM_IDS[2]
        ISO_27001 = NORM_IDS[3]

    class Type(models.TextChoices):
        COMMUNE = "Commune"
        SPECIFIQUE = "Spécifique"

    norme = models.CharField(max_length=8, choices=Norme.choices)
    version = models.CharField(max_length=16, blank=True, help_text="Version de la norme (2015, 2018…)")
    article = models.CharField(max_length=32, help_text="Article (4.1, A.8…)")
    libelle = models.CharField(max_length=255, help_text="Intitulé de l'exigence")
    module = models.CharField(max_length=128, blank=True, help_text="Module du noyau (1.1 Enjeux…)")
    type = models.CharField(max_length=16, choices=Type.choices, default=Type.COMMUNE)
    preuve = models.TextField(blank=True, help_text="Preuve attendue")
    couverture = models.PositiveSmallIntegerField(
        default=0, validators=[MaxValueValidator(100)], help_text="Couverture démontrée (0 à 100 %)"
    )

    class Meta(OrgModel.Meta):
        verbose_name = "exigence normative"
        verbose_name_plural = "couverture normative"


class ClotureSerie(OrgSingleton):
    """Série {labels, clotures, ouvertures} du graphique « Actions d'amélioration »."""

    labels = models.JSONField(default=list, blank=True, help_text="Libellés des périodes")
    clotures = models.JSONField(default=list, blank=True, help_text="Actions clôturées par période")
    ouvertures = models.JSONField(default=list, blank=True, help_text="Actions ouvertes par période")

    class Meta:
        abstract = True


class CloturesMois(ClotureSerie):
    """Ouvertures / clôtures mensuelles (db.cloturesMois)."""

    class Meta:
        verbose_name = "clôtures mensuelles"
        verbose_name_plural = "clôtures mensuelles"


class CloturesAn(ClotureSerie):
    """Ouvertures / clôtures annuelles (db.cloturesAn)."""

    class Meta:
        verbose_name = "clôtures annuelles"
        verbose_name_plural = "clôtures annuelles"
