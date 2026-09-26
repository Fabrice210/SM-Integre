"""
Module 1 — Contexte de l'organisme.

1.1 Enjeux (swot, pestel, enjeux, analyseVersions), 1.2 parties intéressées (parties),
1.3 domaine d'application (sites, activites, applicabilite, domaineVersions),
1.4 cartographie des processus (processus). Les axes stratégiques (axes), saisis au
module 2 (2.1 Engagement), sont rangés ici car les enjeux s'y rattachent.
"""

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.core.models import NORM_IDS, NormesMixin, OrgModel

SCALE = [MinValueValidator(1), MaxValueValidator(5)]


class Qualification(models.TextChoices):
    POSITIF = "Positif"
    NEGATIF = "Négatif"


class Perimetre(models.TextChoices):
    INCLUS = "Inclus"
    EXCLU = "Exclu"


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


class Swot(NormesMixin, OrgModel):
    """1.1 Facteur interne de l'analyse SWOT (db.swot)."""

    UID_PREFIX = "SW"

    class Type(models.TextChoices):
        FORCE = "Force"
        FAIBLESSE = "Faiblesse"

    type = models.CharField(max_length=16, choices=Type.choices, help_text="Type de facteur")
    libelle = models.CharField(max_length=255, help_text="Libellé du facteur")
    description = models.TextField(help_text="Description")
    impact = models.PositiveSmallIntegerField(
        validators=SCALE, help_text="Impact sur le SM (1 faible à 5 fort)"
    )

    class Meta(OrgModel.Meta):
        verbose_name = "facteur interne (SWOT)"
        verbose_name_plural = "facteurs internes (SWOT)"


class Pestel(NormesMixin, OrgModel):
    """1.1 Facteur externe de l'analyse PESTEL (db.pestel)."""

    UID_PREFIX = "PE"

    class Dimension(models.TextChoices):
        POLITIQUE = "Politique"
        ECONOMIQUE = "Économique"
        SOCIOCULTUREL = "Socioculturel"
        TECHNOLOGIQUE = "Technologique"
        ENVIRONNEMENTAL = "Environnemental"
        LEGAL = "Légal"

    dimension = models.CharField(max_length=32, choices=Dimension.choices, help_text="Dimension PESTEL")
    facteur = models.CharField(max_length=255, help_text="Facteur")
    qualification = models.CharField(max_length=16, choices=Qualification.choices)
    impact = models.PositiveSmallIntegerField(validators=SCALE, help_text="Impact (1 à 5)")

    class Meta(OrgModel.Meta):
        verbose_name = "facteur externe (PESTEL)"
        verbose_name_plural = "facteurs externes (PESTEL)"


class Axe(OrgModel):
    """2.1 Axe stratégique de la politique (db.axes), auquel se rattachent enjeux et objectifs."""

    UID_PREFIX = "AX"

    code = models.CharField(max_length=32, help_text="Code (AX1…)")
    libelle = models.CharField(max_length=255, help_text="Orientation stratégique")
    avancement = models.PositiveSmallIntegerField(
        validators=[MaxValueValidator(100)], help_text="Avancement de la mise en œuvre (%)"
    )
    evaluation = models.TextField(help_text="Évaluation de la mise en œuvre")

    class Meta(OrgModel.Meta):
        verbose_name = "axe stratégique"
        verbose_name_plural = "axes stratégiques"


class Enjeu(NormesMixin, OrgModel):
    """1.1 Enjeu issu de l'analyse SWOT / PESTEL (db.enjeux)."""

    UID_PREFIX = "EN"

    class Source(models.TextChoices):
        INTERNE = "Interne (SWOT)"
        EXTERNE = "Externe (PESTEL)"

    class Statut(models.TextChoices):
        ACTIF = "Actif"
        OBSOLETE = "Obsolète"

    libelle = models.CharField(max_length=255, help_text="Libellé de l'enjeu")
    source = models.CharField(max_length=32, choices=Source.choices)
    qualification = models.CharField(max_length=16, choices=Qualification.choices)
    axes = models.JSONField(default=list, blank=True, help_text="Axes de la politique associés (id d'axes)")
    origine = models.CharField(  # noqa: DJ001 — null : clé absente comme dans le front
        max_length=32,
        null=True,
        blank=True,
        help_text="Facteur SWOT ou PESTEL d'origine (id) — absent pour un enjeu saisi à la main",
    )
    date = models.DateField(help_text="Date d'identification")
    statut = models.CharField(max_length=16, choices=Statut.choices, default=Statut.ACTIF)

    class Meta(OrgModel.Meta):
        verbose_name_plural = "enjeux"


class AnalyseVersion(OrgModel):
    """1.1 Version figée de l'analyse du contexte (db.analyseVersions)."""

    UID_PREFIX = "AV"

    version = models.CharField(max_length=16, help_text="Numéro de version (v1.0, v2.0…)")
    date = models.DateField()
    auteur = models.CharField(max_length=255, help_text="Auteur (nom complet)")
    commentaire = models.TextField(help_text="Commentaire de version")
    facteurs = models.PositiveIntegerField(default=0, help_text="Nombre de facteurs SWOT + PESTEL figés")
    enjeux = models.PositiveIntegerField(default=0, help_text="Nombre d'enjeux figés")

    class Meta(OrgModel.Meta):
        verbose_name = "version de l'analyse du contexte"
        verbose_name_plural = "versions de l'analyse du contexte"


class PartieInteressee(NormesMixin, OrgModel):
    """1.2 Partie intéressée et son plan d'engagement (db.parties)."""

    UID_PREFIX = "PI"

    class Categorie(models.TextChoices):
        INTERNE = "Interne"
        EXTERNE = "Externe"

    nom = models.CharField(max_length=255, help_text="Nom de la partie intéressée")
    categorie = models.CharField(max_length=16, choices=Categorie.choices)
    exigences = models.TextField(help_text="Exigences et attentes")
    pouvoir = models.PositiveSmallIntegerField(validators=SCALE, help_text="Pouvoir (1 à 5)")
    legitimite = models.PositiveSmallIntegerField(validators=SCALE, help_text="Légitimité (1 à 5)")
    urgence = models.PositiveSmallIntegerField(validators=SCALE, help_text="Urgence (1 à 5)")
    plan = models.TextField(help_text="Plan d'engagement")
    plan_mis_en_oeuvre = models.BooleanField(default=False, help_text="Plan d'engagement mis en œuvre")

    class Meta(OrgModel.Meta):
        verbose_name = "partie intéressée"
        verbose_name_plural = "parties intéressées"


class Site(OrgModel):
    """1.3 Site du domaine d'application (db.sites)."""

    UID_PREFIX = "S"

    class Monnaie(models.TextChoices):
        XOF = "FCFA (XOF)"
        EUR = "EUR"
        USD = "USD"
        NGN = "NGN (Naira)"
        GHS = "GHS (Cedi)"

    nom = models.CharField(max_length=255, help_text="Nom du site (référencé par les activités)")
    adresse = models.CharField(max_length=255)
    activite = models.CharField(max_length=255, help_text="Activité principale")
    monnaie = models.CharField(max_length=16, choices=Monnaie.choices, default=Monnaie.XOF)
    statut = models.CharField(max_length=8, choices=Perimetre.choices, help_text="Inclus ou exclu du domaine")
    justification = models.TextField(help_text="Justification (au moins 10 caractères)")

    class Meta(OrgModel.Meta):
        verbose_name = "site"


class Activite(OrgModel):
    """1.3 Activité, processus, produit ou service couvert (db.activites)."""

    UID_PREFIX = "AC"

    class Type(models.TextChoices):
        ACTIVITE = "Activité"
        PROCESSUS = "Processus"
        PRODUIT = "Produit"
        SERVICE = "Service"

    type = models.CharField(max_length=16, choices=Type.choices)
    libelle = models.CharField(max_length=255)
    site = models.CharField(max_length=255, blank=True, help_text="Nom du site (db.sites[].nom)")
    statut = models.CharField(max_length=8, choices=Perimetre.choices, help_text="Inclus ou exclu du domaine")
    justification = models.TextField(help_text="Justification (au moins 10 caractères)")

    class Meta(OrgModel.Meta):
        verbose_name = "activité couverte"
        verbose_name_plural = "activités couvertes"


class DomaineVersion(OrgModel):
    """1.3 Version figée du domaine d'application (db.domaineVersions)."""

    UID_PREFIX = "DV"

    version = models.CharField(max_length=16, help_text="Numéro de version (v1, v2…)")
    date = models.DateField()
    auteur = models.CharField(max_length=255, help_text="Auteur (nom complet)")
    commentaire = models.TextField(help_text="Commentaire de version")
    # Ajoutés par « Figer une version » (même enregistrement que l'analyse), absents de la démo.
    facteurs = models.PositiveIntegerField(
        null=True, blank=True, help_text="Nombre de facteurs SWOT + PESTEL"
    )
    enjeux = models.PositiveIntegerField(null=True, blank=True, help_text="Nombre d'enjeux")

    class Meta(OrgModel.Meta):
        verbose_name = "version du domaine d'application"
        verbose_name_plural = "versions du domaine d'application"


class Applicabilite(OrgModel):
    """1.3 Applicabilité normative : exigences applicables ou exclues (db.applicabilite)."""

    UID_PREFIX = "AP"

    class Norme(models.TextChoices):
        ISO_9001 = NORM_IDS[0], "ISO 9001"
        ISO_14001 = NORM_IDS[1], "ISO 14001"
        ISO_45001 = NORM_IDS[2], "ISO 45001"
        ISO_27001 = NORM_IDS[3], "ISO 27001"

    class Exclu(models.TextChoices):
        OUI = "Oui"
        NON = "Non"

    norme = models.CharField(max_length=8, choices=Norme.choices)
    article = models.CharField(max_length=255, help_text="Article / exigence")
    exclu = models.CharField(max_length=4, choices=Exclu.choices, default=Exclu.NON)
    justification = models.TextField()
    commentaire = models.TextField(blank=True)

    class Meta(OrgModel.Meta):
        verbose_name = "exigence normative"
        verbose_name_plural = "applicabilité normative"
