"""Module 4 — Support : ressources, compétences, savoirs critiques, formations, communication."""

from django.db import models

from apps.core.models import NormesMixin, OrgModel, OrgSingleton


class Ressource(OrgModel):
    """4.1 Demande de ressource avec circuit de validation (db.ressources)."""

    UID_PREFIX = "RS"

    class Type(models.TextChoices):
        HUMAINE = "Humaine", "Humaine"
        MATERIELLE = "Matérielle", "Matérielle"
        FINANCIERE = "Financière", "Financière"
        INFRASTRUCTURE = "Infrastructure", "Infrastructure"

    class Circuit(models.TextChoices):
        RH = "RH", "RH"
        FINANCE = "Finance", "Finance"
        ACHATS = "Achats", "Achats"

    class Statut(models.TextChoices):
        BROUILLON = "Brouillon", "Brouillon"
        SOUMISE = "Soumise", "Soumise"
        VALIDEE = "Validée", "Validée"
        REFUSEE = "Refusée", "Refusée"
        MISE_A_DISPOSITION = "Mise à disposition", "Mise à disposition"

    besoin = models.CharField(max_length=255, help_text="Besoin exprimé")
    type = models.CharField(max_length=32, choices=Type.choices, help_text="Nature de la ressource")
    processus = models.CharField(max_length=32, blank=True, help_text="Processus concerné (id)")
    disponible = models.CharField(max_length=255, blank=True, help_text="Bilan : disponible actuellement")
    justification = models.TextField(blank=True, help_text="Justification du besoin")
    montant = models.BigIntegerField(default=0, help_text="Montant estimé (FCFA)")
    circuit = models.CharField(max_length=16, choices=Circuit.choices, help_text="Circuit de validation")
    date_demandee = models.DateField(help_text="Date de mise à disposition souhaitée")
    date_reelle = models.CharField(
        max_length=10, default="—", help_text="Date réelle de mise à disposition (AAAA-MM-JJ) ou « — »"
    )
    statut = models.CharField(max_length=32, choices=Statut.choices, default=Statut.BROUILLON)
    demandeur = models.CharField(max_length=255, blank=True, help_text="Demandeur (nom complet)")

    class Meta(OrgModel.Meta):
        verbose_name = "demande de ressource"
        verbose_name_plural = "demandes de ressources"


class Competences(OrgSingleton):
    """4.2 Matrice des compétences (db.competences, objet unique par organisme)."""

    liste = models.JSONField(default=list, blank=True, help_text="Compétences suivies (libellés)")
    requis = models.JSONField(default=dict, blank=True, help_text="Niveau requis (0 à 4) par compétence")
    collaborateurs = models.JSONField(
        default=list, blank=True, help_text="[{nom, direction, niveaux}] — un niveau (0 à 4) par compétence"
    )

    class Meta:
        verbose_name = "matrice des compétences"
        verbose_name_plural = "matrices des compétences"

    def __str__(self):
        return f"Matrice des compétences ({self.organisation})"


class Savoir(OrgModel):
    """4.2 Savoir critique (db.savoirs)."""

    UID_PREFIX = "SC"

    class Criticite(models.TextChoices):
        CRITIQUE = "Critique", "Critique"
        COUVERT = "Couvert", "Couvert"

    savoir = models.CharField(max_length=255, help_text="Savoir critique")
    detenteurs = models.CharField(
        max_length=500, blank=True, help_text="Détenteurs actuels (noms, séparés par des virgules)"
    )
    couverture = models.CharField(max_length=64, blank=True, help_text="Couverture (ex. « 1 détenteur »)")
    criticite = models.CharField(max_length=16, choices=Criticite.choices, help_text="Situation")
    action = models.TextField(blank=True, help_text="Action du plan de formation thématique")

    class Meta(OrgModel.Meta):
        verbose_name = "savoir critique"
        verbose_name_plural = "savoirs critiques"


class Formation(NormesMixin, OrgModel):
    """4.2 Session du plan de formation et évaluation post-formation (db.formations)."""

    UID_PREFIX = "FO"

    class Statut(models.TextChoices):
        PLANIFIEE = "Planifiée", "Planifiée"
        REALISEE = "Réalisée", "Réalisée"
        REPORTEE = "Reportée", "Reportée"

    theme = models.CharField(max_length=255, help_text="Thème")
    date = models.DateField(help_text="Date de la session")
    formateur = models.CharField(max_length=255, blank=True, help_text="Formateur (interne ou organisme)")
    participants = models.CharField(max_length=255, blank=True, help_text="Participants")
    statut = models.CharField(max_length=16, choices=Statut.choices, default=Statut.PLANIFIEE)
    evaluation_date = models.DateField(help_text="Évaluation post-formation prévue le")
    evaluation_responsable = models.CharField(
        max_length=255, blank=True, help_text="Responsable de l'évaluation (nom complet)"
    )
    resultat = models.TextField(blank=True, help_text="Résultat de l'évaluation (Kirkpatrick 1 à 4) ou « — »")

    class Meta(OrgModel.Meta):
        verbose_name = "session de formation"
        verbose_name_plural = "plan de formation"


class Communication(NormesMixin, OrgModel):
    """4.3 Action de sensibilisation / communication (db.communications)."""

    UID_PREFIX = "CM"

    class Type(models.TextChoices):
        SENSIBILISATION = "Sensibilisation", "Sensibilisation"
        COMMUNICATION = "Communication", "Communication"

    class Portee(models.TextChoices):
        INTERNE = "Interne", "Interne"
        EXTERNE = "Externe", "Externe"

    class Statut(models.TextChoices):
        PAS_FAIT = "Pas fait", "Pas fait"
        FAIT = "Fait", "Fait"

    type = models.CharField(max_length=32, choices=Type.choices, default=Type.SENSIBILISATION)
    objectif = models.CharField(max_length=255, help_text="Objectif")
    qui_fait = models.CharField(max_length=255, blank=True, help_text="Qui fait (nom complet)")
    portee = models.CharField(max_length=16, choices=Portee.choices, default=Portee.INTERNE)
    cible = models.CharField(max_length=255, blank=True, help_text="Cible (interne ou externe)")
    moyen = models.CharField(max_length=255, blank=True, help_text="Moyen")
    date = models.DateField(help_text="Date prévue (délai)")
    statut = models.CharField(max_length=16, choices=Statut.choices, default=Statut.PAS_FAIT)
    date_realisation = models.CharField(
        max_length=10, blank=True, default="", help_text="Date de réalisation effective (AAAA-MM-JJ) ou vide"
    )
    processus = models.CharField(max_length=32, blank=True, help_text="Processus associé (id)")
    preuve = models.CharField(max_length=255, blank=True, help_text="Preuve (nom du fichier) ou « — »")

    class Meta(OrgModel.Meta):
        verbose_name = "action de communication"
        verbose_name_plural = "plan de communication"
