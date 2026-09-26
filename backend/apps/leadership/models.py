"""
Module 2 — Leadership.

2.1 Engagement de la direction (planStrat, champsPerso ; les axes sont dans contexte),
2.2 politique SM (politique, preuvesCom, accuses, diffusions),
2.3 rôles et responsabilités (postes),
2.4 consultation et participation des travailleurs (representants, comite, reunions).
"""

from django.db import models

from apps.core.models import OrgModel, OrgSingleton


class PlanStrat(OrgModel):
    """2.1 Plan stratégique validé (db.planStrat)."""

    UID_PREFIX = "PS"

    class Statut(models.TextChoices):
        EN_VIGUEUR = "En vigueur"
        OBSOLETE = "Obsolète"

    version = models.CharField(max_length=16)
    titre = models.CharField(max_length=255, help_text="Titre du document")
    fichier = models.CharField(max_length=255, help_text="Document (PDF ou Word) — nom de fichier")
    date_validation = models.DateField(help_text="Date de validation")
    valide_par = models.CharField(max_length=255, help_text="Validé par")
    statut = models.CharField(max_length=16, choices=Statut.choices, default=Statut.EN_VIGUEUR)

    class Meta(OrgModel.Meta):
        verbose_name = "plan stratégique"
        verbose_name_plural = "plans stratégiques"


class ChampPerso(OrgModel):
    """2.1 Champ personnalisé de l'engagement de la direction (db.champsPerso)."""

    UID_PREFIX = "CP"

    class Type(models.TextChoices):
        DOCUMENT = "Document"
        TEXTE = "Texte"
        DATE = "Date"
        NOMBRE = "Nombre"

    libelle = models.CharField(max_length=255)
    type = models.CharField(max_length=16, choices=Type.choices)
    valeur = models.TextField(help_text="Valeur ou nom du document")
    commentaire = models.TextField()

    class Meta(OrgModel.Meta):
        verbose_name = "champ personnalisé"
        verbose_name_plural = "champs personnalisés"


class Politique(OrgSingleton):
    """2.2 Politique du système de management, objet unique par organisme (db.politique)."""

    class Statut(models.TextChoices):
        PUBLIEE = "Publiée"

    version = models.CharField(max_length=16, blank=True, help_text="Version publiée (v1, v2…)")
    statut = models.CharField(max_length=16, choices=Statut.choices, blank=True)
    date = models.DateField(null=True, blank=True, help_text="Date de publication")
    signataire = models.CharField(max_length=255, blank=True)
    resume = models.TextField(blank=True, help_text="Résumé généré à partir des orientations")
    orientations = models.TextField(blank=True, help_text="Orientations, une par ligne")

    class Meta:
        verbose_name = "politique SM"
        verbose_name_plural = "politiques SM"

    def __str__(self):
        return f"Politique SM {self.version} ({self.organisation})"


class PreuveCom(OrgModel):
    """2.2 Preuve de communication de la politique (db.preuvesCom)."""

    UID_PREFIX = "PC"

    class Support(models.TextChoices):
        AFFICHAGE = "Affichage"
        REUNION = "Réunion"
        EMAIL = "Email"
        INTRANET = "Intranet"
        CAUSERIE = "Causerie"

    objet = models.CharField(max_length=255, help_text="Objet communiqué")
    date = models.DateField()
    support = models.CharField(max_length=16, choices=Support.choices)
    lieu = models.CharField(max_length=255, help_text="Lieu ou canal")
    personnes = models.PositiveIntegerField(help_text="Personnes touchées")
    preuve = models.CharField(max_length=255, help_text="Preuve jointe — nom de fichier")

    class Meta(OrgModel.Meta):
        verbose_name = "preuve de communication"
        verbose_name_plural = "preuves de communication"


class Accuse(OrgModel):
    """2.2 Accusé de lecture de la politique par un collaborateur (db.accuses)."""

    UID_PREFIX = "AR"

    class Statut(models.TextChoices):
        LU = "Lu"
        NON_LU = "Non lu"

    collaborateur = models.CharField(max_length=255, help_text="Collaborateur (nom complet)")
    # '—' tant que la politique n'est pas lue : pas un DateField.
    date = models.CharField(max_length=16, default="—", help_text="Date de lecture (AAAA-MM-JJ) ou '—'")
    statut = models.CharField(max_length=8, choices=Statut.choices, default=Statut.NON_LU)

    class Meta(OrgModel.Meta):
        verbose_name = "accusé de lecture"
        verbose_name_plural = "accusés de lecture"


class Diffusion(OrgModel):
    """
    2.2 / 2.3 Diffusion d'un document (politique, organigramme) : db.diffusions,
    créée à la volée par le front ({d, u, doc, canal, destinataires, piece}, sans id).
    """

    UID_PREFIX = "DF"

    class Canal(models.TextChoices):
        INTERNE = "interne", "Interne — dépôt direct dans l'espace du destinataire"
        EXTERNE = "externe", "Externe — envoi par email avec pièce jointe"

    d = models.CharField(max_length=32, help_text="Horodatage (AAAA-MM-JJ HH:MM)")
    u = models.CharField(max_length=255, help_text="Auteur de la diffusion (nom complet)")
    doc = models.CharField(max_length=255, help_text="Document diffusé (ex. « Politique SM v3 »)")
    canal = models.CharField(max_length=8, choices=Canal.choices, default=Canal.INTERNE)
    destinataires = models.CharField(max_length=255)
    piece = models.CharField(max_length=255, default="—", help_text="Pièce jointe (obligatoire en externe)")

    class Meta(OrgModel.Meta):
        # unshift() du front : la plus récente en tête.
        ordering = ["-id"]


class Poste(OrgModel):
    """2.3 Fiche de poste et responsabilités liées au SM (db.postes)."""

    UID_PREFIX = "FP"

    intitule = models.CharField(max_length=255, help_text="Intitulé du poste")
    direction = models.CharField(max_length=255, help_text="Direction ou service")
    titulaire = models.CharField(max_length=255, blank=True, help_text="Titulaire (nom complet)")
    mission = models.TextField()
    responsabilites = models.TextField(help_text="Responsabilités liées au SM")
    processus = models.JSONField(default=list, blank=True, help_text="Processus concernés (id)")
    preuve = models.CharField(max_length=255, help_text="Preuve de communication de l'évolution")

    class Meta(OrgModel.Meta):
        verbose_name = "fiche de poste"
        verbose_name_plural = "fiches de poste"


class Representant(OrgModel):
    """2.4 Représentant des travailleurs (db.representants)."""

    UID_PREFIX = "RP"

    class QualiteLien(models.TextChoices):
        TITULAIRE = "Titulaire"
        SUPPLEANT = "Suppléant"
        SYNDICAL = "Représentant syndical"
        INVITE = "Invité permanent"

    class Statut(models.TextChoices):
        ACTIF = "Actif"
        REVOQUE = "Révoqué"

    nom = models.CharField(max_length=255)
    prenom = models.CharField(max_length=255)
    fonction = models.CharField(max_length=255)
    mandat_debut = models.DateField(help_text="Début de mandat")
    mandat_fin = models.DateField(help_text="Fin de mandat")
    statut = models.CharField(max_length=16, choices=Statut.choices, default=Statut.ACTIF, help_text="État")
    suppleant = models.CharField(max_length=255, blank=True, help_text="Délégué suppléant (le cas échéant)")
    qualite_lien = models.CharField(
        max_length=32, choices=QualiteLien.choices, default=QualiteLien.TITULAIRE, help_text="Qualité du lien"
    )

    class Meta(OrgModel.Meta):
        verbose_name = "représentant des travailleurs"
        verbose_name_plural = "représentants des travailleurs"


class MembreComite(OrgModel):
    """2.4 Membre du comité hygiène et santé (db.comite)."""

    UID_PREFIX = "CH"

    nom = models.CharField(max_length=255)
    prenom = models.CharField(max_length=255)
    date_naissance = models.DateField(help_text="Date de naissance")
    role = models.CharField(max_length=255, help_text="Rôle au sein du comité")
    mandat_fin = models.DateField(help_text="Fin de mandat")

    class Meta(OrgModel.Meta):
        verbose_name = "membre du comité hygiène et santé"
        verbose_name_plural = "comité hygiène et santé"


class Reunion(OrgModel):
    """2.4 Réunion de consultation des travailleurs (db.reunions)."""

    UID_PREFIX = "RC"

    class Participants(models.TextChoices):
        CHSS = "Comité HS (CHSS)"
        DELEGUES = "Délégués du personnel"
        PERSONNEL = "Tout le personnel"

    class Statut(models.TextChoices):
        PLANIFIEE = "Planifiée"
        REALISEE = "Réalisée"

    class StatutPlan(models.TextChoices):
        A_FAIRE = "À faire"
        EN_COURS = "En cours"
        CLOTURE = "Clôturé"

    # Absente d'une réunion créée par le formulaire : posée à la réalisation.
    date = models.DateField(null=True, blank=True, help_text="Date de tenue")
    objet = models.CharField(max_length=255, help_text="Objet de la réunion")
    participants = models.CharField(max_length=32, choices=Participants.choices, default=Participants.CHSS)
    compte_rendu = models.TextField(blank=True)
    plan_action = models.TextField(
        blank=True, help_text="Plan d'action de suivi (action, responsable, échéance)"
    )
    statut_plan = models.CharField(max_length=16, choices=StatutPlan.choices, default=StatutPlan.A_FAIRE)
    date_prevue = models.DateField(help_text="Date prévue")
    statut = models.CharField(max_length=16, choices=Statut.choices, default=Statut.PLANIFIEE)
    ordre_du_jour = models.TextField(help_text="Ordre du jour")
    preuve1 = models.CharField(max_length=255, blank=True, help_text="Preuve 1 (PV, feuille de présence…)")
    preuve2 = models.CharField(max_length=255, blank=True, help_text="Preuve 2")

    class Meta(OrgModel.Meta):
        verbose_name = "réunion de consultation"
        verbose_name_plural = "réunions de consultation"
