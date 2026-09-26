"""
Module 3 — Objectifs, conformité et risques (src/features/m3-planification).

Collections : objectifs (3.1, avec leur plan d'action imbriqué), fichesMaitrise (3.2),
textes, declarations et rapportsConf (veille réglementaire), risques et opportunites (3.3).
Les personnes sont référencées par leur nom complet et les autres collections par leur
id front (voir backend/README.md).
"""

from django.db import models

from apps.core.models import NormesMixin, OrgModel

# ---------- Listes fermées partagées (src/features/m3-planification/helpers.ts) ----------


class StatutAction(models.TextChoices):
    """ACT_ST : statut d'une action (objectif, traitement de risque ou d'opportunité)."""

    MISE_EN_OEUVRE = "Mise en œuvre"
    EN_COURS = "En cours"
    CLOTURE = "Clôturé"


class TypeRisque(models.TextChoices):
    """RTYPES : types de risque (les opportunités n'ont pas « Situation d'urgence »)."""

    QUALITE = "Qualité"
    ENVIRONNEMENT = "Environnement"
    SST = "SST"
    SECURITE_INFO = "Sécurité de l'information"
    URGENCE = "Situation d'urgence"


class EfficaciteTraitement(models.TextChoices):
    """Efficacité d'un traitement de risque ou d'opportunité."""

    A_EVALUER = "À évaluer"
    EFFICACE = "Efficace"
    PARTIELLEMENT = "Partiellement efficace"
    NON_EFFICACE = "Non efficace"


# ---------- 3.1 Objectifs ----------


class Objectif(NormesMixin, OrgModel):
    """3.1 Objectifs et plans d'action (db.objectifs)."""

    UID_PREFIX = "OB"

    class Efficacite(models.TextChoices):
        NON_EVALUEE = "Non évaluée"
        EN_COURS = "En cours d'évaluation"
        PARTIELLEMENT = "Partiellement efficace"
        EFFICACE = "Efficace"
        NON_EFFICACE = "Non efficace"

    code = models.CharField(max_length=32, help_text="Code de l'objectif (OB-01…)")
    libelle = models.CharField(max_length=500, help_text="Énoncé de l'objectif")
    axe = models.CharField(
        max_length=32, blank=True, help_text="Orientation stratégique du module 2 (id de db.axes)"
    )
    kpi = models.CharField(max_length=255, help_text="Indicateur de mesure (KPI)")
    cible = models.CharField(max_length=255, help_text="Valeur cible de l'indicateur")
    delai = models.DateField(help_text="Délai d'atteinte de l'objectif")
    processus = models.JSONField(default=list, help_text="Processus concernés (id de db.processus)")
    efficacite = models.CharField(
        max_length=32,
        choices=Efficacite.choices,
        default=Efficacite.NON_EVALUEE,
        help_text="Évaluation de l'efficacité",
    )
    actions = models.JSONField(
        default=list,
        blank=True,
        help_text="Plan d'action : [{libelle, responsable, echeance, statut, pieces?, observation}]",
    )

    class Meta(OrgModel.Meta):
        verbose_name = "objectif"


# ---------- 3.2 Fiches de maîtrise opérationnelle ----------


class FicheMaitrise(OrgModel):
    """3.2 Fiche de maîtrise opérationnelle (db.fichesMaitrise)."""

    UID_PREFIX = "FM"

    objet = models.CharField(max_length=255, help_text="Processus ou activité à risque")
    processus = models.CharField(max_length=32, blank=True, help_text="Processus lié (id de db.processus)")
    responsable = models.CharField(max_length=255, blank=True, help_text="Responsable (nom complet)")
    criteres = models.TextField(help_text="Critères opérationnels")
    moyens = models.TextField(help_text="Moyens de maîtrise")
    ressources = models.CharField(max_length=500, help_text="Ressources associées")
    risques = models.JSONField(default=list, help_text="Risques identifiés (id de db.risques)")
    derniere_maj = models.DateField(help_text="Date de la dernière mise à jour")
    prochaine_maj = models.DateField(help_text="Date de la prochaine mise à jour")

    class Meta(OrgModel.Meta):
        verbose_name = "fiche de maîtrise opérationnelle"
        verbose_name_plural = "fiches de maîtrise opérationnelle"


# ---------- Veille réglementaire ----------


class Texte(NormesMixin, OrgModel):
    """Registre de veille réglementaire : texte légal et statut de conformité (db.textes)."""

    UID_PREFIX = "TX"

    class Categorie(models.TextChoices):
        LOI = "Loi"
        DECRET = "Décret"
        ARRETE = "Arrêté"
        ORDONNANCE = "Ordonnance"
        CONVENTION = "Convention"
        NORME = "Norme"
        AUTRE = "Autre"

    class Domaine(models.TextChoices):
        SST = "Santé et sécurité au travail"
        ENVIRONNEMENT = "Environnement"
        DECHETS = "Déchets"
        DONNEES = "Protection des données"
        SOCIAL = "Social"
        QUALITE = "Qualité et consommation"
        FISCAL = "Fiscal"

    class Statut(models.TextChoices):
        FAIT = "Fait"
        PAS_FAIT = "Pas fait"

    intitule = models.CharField(max_length=500, help_text="Intitulé du texte")
    categorie = models.CharField(max_length=32, choices=Categorie.choices, blank=True)
    domaine = models.CharField(max_length=64, choices=Domaine.choices, blank=True)
    date_publication = models.DateField(help_text="Date de publication")
    lien = models.CharField(max_length=500, help_text="Lien vers la source officielle")
    statut = models.CharField(
        max_length=16, choices=Statut.choices, default=Statut.PAS_FAIT, help_text="Statut de conformité"
    )
    justificatif = models.TextField(help_text="Justificatif du statut de conformité")
    pieces = models.CharField(max_length=255, help_text="Pièces justificatives (preuves d'audit)")
    echeance = models.DateField(help_text="Date de la prochaine évaluation de conformité")
    responsable = models.CharField(max_length=255, blank=True, help_text="Responsable (nom complet)")
    # Diffusion tracée (v2) : champs absents tant que le texte n'a pas été diffusé ;
    # null (None non émis) plutôt que "" pour rester absents comme dans le front.
    diffuse = models.BooleanField(null=True, blank=True, help_text="Texte diffusé aux intéressés")
    statut_diff = models.CharField(
        max_length=32, null=True, blank=True, help_text="Statut de diffusion (Diffusé)"
    )
    destinataire_diff = models.CharField(
        max_length=500, null=True, blank=True, help_text="Cible de la dernière diffusion"
    )

    class Meta(OrgModel.Meta):
        verbose_name = "texte réglementaire"
        verbose_name_plural = "textes réglementaires"


class Declaration(OrgModel):
    """Déclaration d'écart réglementaire soumise au Directeur Général (db.declarations)."""

    UID_PREFIX = "DC"

    class Statut(models.TextChoices):
        BROUILLON = "Brouillon"
        SOUMISE = "Soumise"
        VALIDEE = "Validée"
        REFUSEE = "Refusée"

    texte = models.CharField(max_length=32, blank=True, help_text="Texte concerné (id de db.textes)")
    objet = models.CharField(max_length=500, help_text="Objet de l'écart")
    cause = models.TextField(help_text="Cause de l'écart")
    impact = models.TextField(help_text="Impact de l'écart")
    plan_action = models.TextField(help_text="Plan d'action de mise en conformité")
    statut = models.CharField(max_length=16, choices=Statut.choices, default=Statut.BROUILLON)
    auteur = models.CharField(max_length=255, blank=True, help_text="Auteur (nom complet)")
    date = models.DateField(help_text="Date de la déclaration")
    commentaire_dg = models.CharField(
        max_length=500, blank=True, help_text="Décision ou commentaire du Directeur Général"
    )

    class Meta(OrgModel.Meta):
        verbose_name = "déclaration d'écart réglementaire"
        verbose_name_plural = "déclarations d'écart réglementaire"


class RapportConformite(OrgModel):
    """Rapport de conformité lié à un texte réglementaire (db.rapportsConf)."""

    UID_PREFIX = "RC"

    class Statut(models.TextChoices):
        CONFORME = "Conforme"
        NON_CONFORME = "Non conforme"
        EN_COURS = "En cours"

    ref = models.CharField(max_length=32, blank=True, help_text="Référence séquentielle (RC-2026-001…)")
    texte = models.CharField(max_length=32, blank=True, help_text="Texte concerné (id de db.textes)")
    titre = models.CharField(max_length=500, help_text="Intitulé du rapport")
    statut = models.CharField(max_length=16, choices=Statut.choices, help_text="Conclusion")
    date = models.DateField(help_text="Date du rapport")
    auteur = models.CharField(max_length=255, blank=True, help_text="Auteur (nom complet)")
    synthese = models.TextField(help_text="Synthèse")
    pieces = models.CharField(max_length=255, help_text="Pièces jointes")

    class Meta(OrgModel.Meta):
        verbose_name = "rapport de conformité"
        verbose_name_plural = "rapports de conformité"


# ---------- 3.3 Risques et opportunités ----------


class Risque(NormesMixin, OrgModel):
    """3.3 Fiche risque et action de traitement générée (db.risques)."""

    UID_PREFIX = "R"

    class Traitement(models.TextChoices):
        EVITER = "Éviter"
        REDUIRE = "Réduire"
        TRANSFERER = "Transférer"
        ACCEPTER = "Accepter"

    intitule = models.CharField(max_length=500, help_text="Intitulé du risque")
    type = models.CharField(max_length=32, choices=TypeRisque.choices, blank=True)
    cause = models.TextField(help_text="Cause")
    consequences = models.TextField(help_text="Conséquences")
    probabilite = models.PositiveSmallIntegerField(help_text="Probabilité (1 rare à 4 fréquent)")
    criticite = models.PositiveSmallIntegerField(
        help_text="Criticité / gravité (1 mineure à 4 grave) ; niveau = probabilité × criticité"
    )
    traitement = models.CharField(max_length=16, choices=Traitement.choices, blank=True)
    processus = models.JSONField(default=list, help_text="Processus associés (id de db.processus)")
    action = models.CharField(max_length=500, help_text="Action de traitement générée")
    responsable = models.CharField(max_length=255, blank=True, help_text="Responsable (nom complet)")
    echeance = models.DateField(help_text="Échéance de l'action (ajoutée au planning)")
    statut_action = models.CharField(
        max_length=16, choices=StatutAction.choices, default=StatutAction.MISE_EN_OEUVRE
    )
    efficacite = models.CharField(
        max_length=32, choices=EfficaciteTraitement.choices, default=EfficaciteTraitement.A_EVALUER
    )
    realise = models.BooleanField(default=False, help_text="Risque survenu (inscrit au registre)")

    class Meta(OrgModel.Meta):
        verbose_name = "risque"


class Opportunite(NormesMixin, OrgModel):
    """3.3 Fiche opportunité et action d'exploitation (db.opportunites)."""

    UID_PREFIX = "O"

    intitule = models.CharField(max_length=500, help_text="Intitulé de l'opportunité")
    type = models.CharField(max_length=32, choices=TypeRisque.choices[:4], blank=True)
    origine = models.CharField(max_length=500, help_text="Origine (analyse PESTEL, enjeu…)")
    benefices = models.TextField(help_text="Bénéfices attendus")
    probabilite = models.PositiveSmallIntegerField(help_text="Probabilité de réalisation (1 à 4)")
    impact = models.PositiveSmallIntegerField(
        help_text="Niveau d'impact (1 à 4) ; niveau = probabilité × impact"
    )
    exploitation = models.CharField(max_length=500, help_text="Moyen d'exploitation ou de valorisation")
    processus = models.JSONField(default=list, help_text="Processus associés (id de db.processus)")
    action = models.CharField(max_length=500, help_text="Action générée")
    responsable = models.CharField(max_length=255, blank=True, help_text="Responsable (nom complet)")
    echeance = models.DateField(help_text="Échéance de l'action")
    statut_action = models.CharField(
        max_length=16, choices=StatutAction.choices, default=StatutAction.MISE_EN_OEUVRE
    )
    efficacite = models.CharField(
        max_length=32, choices=EfficaciteTraitement.choices, default=EfficaciteTraitement.A_EVALUER
    )

    class Meta(OrgModel.Meta):
        verbose_name = "opportunité"
