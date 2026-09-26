"""Module 5 — Maîtrise opérationnelle : GED, modèles, planification opérationnelle, urgences."""

import os

from django.db import models
from django.utils import timezone

from apps.core.models import NormesMixin, OrgModel


class DocType(models.TextChoices):
    PROCEDURE = "Procédure", "Procédure"
    INSTRUCTION = "Instruction", "Instruction"
    FORMULAIRE = "Formulaire", "Formulaire"
    ENREGISTREMENT = "Enregistrement", "Enregistrement"
    POLITIQUE = "Politique", "Politique"
    MANUEL = "Manuel", "Manuel"
    DOCUMENT_EXTERNE = "Document externe", "Document externe"


class Modele(OrgModel):
    """5.1 Bibliothèque de modèles de documents (db.modeles)."""

    UID_PREFIX = "MD"

    nom = models.CharField(max_length=255, help_text="Nom du modèle")
    type = models.CharField(max_length=32, choices=DocType.choices, help_text="Type de document produit")
    description = models.TextField(blank=True, help_text="Structure du modèle")
    processus = models.CharField(max_length=32, default="Tous", help_text="Processus (id) ou « Tous »")
    # null (et non "") : champ absent de la démo, donc non émis tant qu'il n'est pas renseigné.
    fichier = models.CharField(max_length=255, null=True, blank=True, help_text="Fichier du modèle (nom)")  # noqa: DJ001

    class Meta(OrgModel.Meta):
        verbose_name = "modèle de document"
        verbose_name_plural = "modèles de documents"


def document_upload_to(instance, filename):
    """Pièce jointe GED : MEDIA_ROOT/<organisation>/documents/<id du document>/<fichier>."""
    return f"{instance.organisation_id}/documents/{instance.uid}/{os.path.basename(filename)}"


class Document(NormesMixin, OrgModel):
    """5.1 Fiche documentaire de la GED avec ses versions (db.documents)."""

    UID_PREFIX = "D"

    class Statut(models.TextChoices):
        REDACTION = "Rédaction", "Rédaction"
        VERIFICATION = "Vérification", "Vérification"
        APPROBATION = "Approbation", "Approbation"
        DIFFUSE = "Diffusé", "Diffusé"
        REFUSE = "Refusé", "Refusé"
        OBSOLETE = "Obsolète", "Obsolète"

    ref = models.CharField(max_length=64, help_text="Référence (ex. PR-QSE-01)")
    intitule = models.CharField(max_length=255, help_text="Intitulé")
    type = models.CharField(max_length=32, choices=DocType.choices, default=DocType.PROCEDURE)
    version = models.CharField(
        max_length=16, default="1", help_text="Version en vigueur (dernière approuvée)"
    )
    proprietaire = models.CharField(max_length=255, blank=True, help_text="Propriétaire (nom complet)")
    processus = models.CharField(max_length=32, blank=True, help_text="Processus (id)")
    statut = models.CharField(max_length=16, choices=Statut.choices, default=Statut.REDACTION)
    date_creation = models.DateField(default=timezone.localdate, help_text="Date de création")
    date_revue = models.DateField(help_text="Date de prochaine revue")
    date_version = models.DateField(null=True, blank=True, help_text="Date de la version")
    droits = models.TextField(blank=True, help_text="Droits d'accès (lecture, modification, validation)")
    diffusion = models.TextField(blank=True, help_text="Liste de diffusion")
    versions = models.JSONField(
        default=list,
        blank=True,
        help_text="Historique des versions : [{v, date, auteur, contenu}], la dernière en fin",
    )
    redacteur = models.CharField(max_length=255, blank=True, help_text="Rédacteur (nom complet)")
    approbateur = models.CharField(max_length=255, blank=True, help_text="Approbateur désigné (nom complet)")
    # refus, accuses, modele : absents de la démo -> null (non émis) tant qu'ils ne sont pas renseignés.
    refus = models.TextField(null=True, blank=True, help_text="Motif du dernier refus (renvoyé à l'auteur)")  # noqa: DJ001
    accuses = models.PositiveIntegerField(null=True, blank=True, help_text="Accusés de lecture reçus")
    modele = models.CharField(max_length=255, null=True, blank=True, help_text="Modèle utilisé (nom)")  # noqa: DJ001
    fichier = models.FileField(
        upload_to=document_upload_to,
        max_length=500,
        null=True,
        blank=True,
        help_text="Pièce jointe (fichier)",
    )

    class Meta(OrgModel.Meta):
        verbose_name = "document"
        verbose_name_plural = "documents (GED)"

    @property
    def derniere_version(self) -> dict | None:
        return self.versions[-1] if self.versions else None


class PlanOps(OrgModel):
    """5.2 Plan d'action opérationnel d'un processus (db.plansOps)."""

    UID_PREFIX = "PO"

    class Statut(models.TextChoices):
        PAS_FAIT = "Pas fait", "Pas fait"
        EN_COURS = "En cours", "En cours"
        FAIT = "Fait", "Fait"

    processus = models.CharField(max_length=32, blank=True, help_text="Processus (id)")
    plan = models.TextField(help_text="Plan d'action")
    responsable = models.CharField(max_length=255, blank=True, help_text="Responsable unique (nom complet)")
    echeance = models.DateField(help_text="Échéance")
    statut = models.CharField(max_length=16, choices=Statut.choices, default=Statut.PAS_FAIT)

    class Meta(OrgModel.Meta):
        verbose_name = "plan d'action opérationnel"
        verbose_name_plural = "plans d'action opérationnels"


class Urgence(OrgModel):
    """5.3 Fiche de situation d'urgence et ses exercices de simulation (db.urgences)."""

    UID_PREFIX = "SU"

    class ExerciceStatut(models.TextChoices):
        PLANIFIE = "Planifié", "Planifié"
        REALISE = "Réalisé", "Réalisé"
        EN_RETARD = "En retard", "En retard"

    type = models.CharField(max_length=255, help_text="Type de situation d'urgence")
    procedure = models.CharField(max_length=255, blank=True, help_text="Procédure de référence")
    consignes = models.TextField(blank=True, help_text="Consignes")
    moyens = models.TextField(blank=True, help_text="Moyens de secours")
    responsables = models.CharField(max_length=500, blank=True, help_text="Responsables (texte libre)")
    risques = models.JSONField(default=list, blank=True, help_text="Risques associés (id, module 3)")
    sites = models.JSONField(default=list, blank=True, help_text="Sites d'application (noms, module 1.3)")
    exercices = models.JSONField(
        default=list,
        blank=True,
        help_text="Exercices : [{date, participants, scenario, procedure, statut, compteRendu, actions}]",
    )

    class Meta(OrgModel.Meta):
        verbose_name = "situation d'urgence"
        verbose_name_plural = "situations d'urgence"
