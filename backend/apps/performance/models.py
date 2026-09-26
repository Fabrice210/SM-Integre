"""
Module 6 — Performance et amélioration (db.indicateurs, prestataires, statsSurv, auditeurs,
audits, revues, ncs, sourcesNC, registre).

Les références (processus, objectif, auditeur) sont des identifiants / noms du front,
validés par les sérialiseurs ; les tableaux imbriqués (constats, actions, ordre du jour,
notes) sont des JSONField dont la structure est vérifiée à l'écriture.

Les TextField `null=True` (noqa DJ001) sont des champs absents de l'objet du front tant
qu'ils ne sont pas saisis (efficacite, compteRendu, miseEnOeuvre) : None n'est pas émis.
"""

from django.db import models

from apps.core.models import NormesMixin, OrgModel, OrgSingleton

# ---------- 6.1 Surveillance et mesures ----------


class Indicateur(OrgModel):
    """6.1 Indicateur de performance (KPI) rattaché à un processus et, éventuellement, à un objectif."""

    UID_PREFIX = "KP"

    class Sens(models.TextChoices):
        HAUSSE = "hausse", "Plus haut = mieux"
        BAISSE = "baisse", "Plus bas = mieux"

    kpi = models.CharField(max_length=255, help_text="Intitulé de l'indicateur")
    objectif = models.CharField(
        max_length=32, blank=True, default="—", help_text="Code de l'objectif rattaché (OB-01…) ou « — »"
    )
    cible = models.FloatField(help_text="Valeur cible")
    unite = models.CharField(max_length=32, blank=True, help_text="Unité (%, m³/t…), vide si sans unité")
    sens = models.CharField(
        max_length=8, choices=Sens.choices, default=Sens.HAUSSE, help_text="Sens d'amélioration"
    )
    valeur = models.FloatField(null=True, blank=True, help_text="Dernière valeur mesurée")
    moyen = models.CharField(max_length=255, blank=True, help_text="Moyen de mesure")
    echeance = models.DateField(help_text="Échéance")
    processus = models.CharField(max_length=32, blank=True, help_text="Processus (id P01…)")
    responsable = models.CharField(max_length=255, blank=True, help_text="Responsable (nom complet)")
    action = models.TextField(blank=True, help_text="Action associée")

    class Meta(OrgModel.Meta):
        verbose_name = "indicateur"


class Prestataire(OrgModel):
    """6.1 Intervenant externe (fournisseur, prestataire) et son évaluation."""

    UID_PREFIX = "EX"

    class Categorie(models.TextChoices):
        CRITIQUE = "Critique"
        CLASSIQUE = "Classique"

    class Frequence(models.TextChoices):
        TRIMESTRIELLE = "Trimestrielle"
        SEMESTRIELLE = "Semestrielle"
        ANNUELLE = "Annuelle"

    nom = models.CharField(max_length=255)
    categorie = models.CharField(max_length=16, choices=Categorie.choices, default=Categorie.CLASSIQUE)
    debut = models.DateField(help_text="Début de la collaboration")
    frequence = models.CharField(
        max_length=16,
        choices=Frequence.choices,
        default=Frequence.ANNUELLE,
        help_text="Fréquence d'évaluation",
    )
    champ = models.TextField(blank=True, help_text="Champ d'évaluation")
    processus = models.CharField(max_length=32, blank=True, help_text="Processus (id P01…)")
    responsable = models.CharField(max_length=255, blank=True, help_text="Responsable de l'évaluation")
    notes = models.JSONField(
        default=dict,
        blank=True,
        help_text="Dernière évaluation {qualite, delai, securite, environnement}, notes de 1 à 5",
    )

    class Meta(OrgModel.Meta):
        verbose_name = "intervenant externe"
        verbose_name_plural = "intervenants externes"


class StatsSurveillance(OrgSingleton):
    """6.1 Statistiques de surveillance mensuelles (db.statsSurv) : séries alignées sur `mois`."""

    mois = models.JSONField(default=list, blank=True, help_text="Libellés des mois (Mar, Avr…)")
    incidents = models.JSONField(default=list, blank=True, help_text="Nombre d'incidents par mois")
    dysfonctionnements = models.JSONField(default=list, blank=True, help_text="Dysfonctionnements par mois")
    dechets = models.JSONField(default=list, blank=True, help_text="Déchets produits par mois (t)")

    class Meta:
        verbose_name = "statistiques de surveillance"
        verbose_name_plural = "statistiques de surveillance"


# ---------- 6.2 Audits ----------


class Auditeur(NormesMixin, OrgModel):
    """6.2 Auditeur (interne ou externe), ses normes et sa restriction d'indépendance."""

    UID_PREFIX = "AU"

    nom = models.CharField(max_length=255, help_text="Nom de l'auditeur ou du cabinet")
    qualification = models.CharField(max_length=255, blank=True)
    disponibilite = models.CharField(max_length=255, blank=True)
    independance = models.CharField(
        max_length=255, blank=True, help_text="Restriction d'indépendance (« Ne peut pas auditer P02 »)"
    )

    class Meta(OrgModel.Meta):
        verbose_name = "auditeur"


class Audit(NormesMixin, OrgModel):
    """6.2 Audit du programme annuel : planifié → plan diffusé → en cours → rapport déposé → clôturé."""

    UID_PREFIX = "A"

    class Statut(models.TextChoices):
        PLANIFIE = "Planifié"
        PLAN_DIFFUSE = "Plan diffusé"
        EN_COURS = "En cours"
        RAPPORT_DEPOSE = "Rapport déposé"
        CLOTURE = "Clôturé"

    class TypeConstat(models.TextChoices):
        NC_MAJEURE = "NC majeure"
        NC_MINEURE = "NC mineure"
        OBSERVATION = "Observation"
        POINT_FORT = "Point fort"

    ref = models.CharField(max_length=64, help_text="Référence (AUD-2026-01)")
    titre = models.CharField(max_length=255)
    date = models.DateField()
    perimetre = models.CharField(max_length=32, blank=True, help_text="Processus audité (id P01…)")
    auditeur = models.CharField(max_length=255, blank=True, help_text="Nom de l'auditeur (db.auditeurs)")
    statut = models.CharField(max_length=16, choices=Statut.choices, default=Statut.PLANIFIE)
    rapport = models.CharField(
        max_length=255, blank=True, default="—", help_text="Fichier du rapport ou « — »"
    )
    constats = models.JSONField(
        default=list, blank=True, help_text="Constats [{type, description, processus}]"
    )
    compte_rendu = models.TextField(null=True, blank=True, help_text="Compte-rendu de la réunion de clôture")  # noqa: DJ001

    class Meta(OrgModel.Meta):
        verbose_name = "audit"


# ---------- 6.3 Revues ----------


class Revue(NormesMixin, OrgModel):
    """6.3 Revue de direction / de processus, son ordre du jour et son plan d'action."""

    UID_PREFIX = "RV"

    class Type(models.TextChoices):
        SEMESTRIELLE = "Revue de direction semestrielle"
        ANNUELLE = "Revue de direction annuelle"
        PROCESSUS = "Revue de processus"
        SECURITE = "Revue de sécurité de l'information"

    class Statut(models.TextChoices):
        PREPAREE = "Préparée"
        CLOTUREE = "Clôturée"

    class StatutAction(models.TextChoices):
        MISE_EN_OEUVRE = "Mise en œuvre"
        EN_COURS = "En cours"
        CLOTURE = "Clôturé"

    ref = models.CharField(max_length=64, help_text="Référence (RD-2026-S1)")
    date = models.DateField(help_text="Date de la réunion de pilotage")
    type = models.CharField(max_length=64, choices=Type.choices, default=Type.SEMESTRIELLE)
    statut = models.CharField(max_length=16, choices=Statut.choices, default=Statut.PREPAREE)
    participants = models.TextField(blank=True)
    ordre_du_jour = models.JSONField(default=list, blank=True, help_text="Points de l'ordre du jour")
    rapport_entree = models.TextField(blank=True, help_text="Rapport d'entrée")
    pv = models.TextField(blank=True, help_text="Procès-verbal")
    actions = models.JSONField(
        default=list, blank=True, help_text="Plan d'action [{libelle, responsable, echeance, statut}]"
    )

    class Meta(OrgModel.Meta):
        verbose_name = "revue"


# ---------- 6.4 Non-conformités ----------


class NonConformite(NormesMixin, OrgModel):
    """
    6.4 Non-conformité, accident / incident, piste d'amélioration ou observation.

    Circuit : Déclarée → Validée pilote (n1) → En traitement (n2, entrée au registre)
    → Clôturée (efficacité évaluée) ; Refusée possible aux deux niveaux.
    """

    UID_PREFIX = "NC"

    class Categorie(models.TextChoices):
        NON_CONFORMITE = "Non-conformité"
        ACCIDENT = "Accident / incident"
        AMELIORATION = "Piste d'amélioration"
        OBSERVATION = "Observation"

    class TypeActe(models.TextChoices):
        CONFORMITE = "Conformité"
        DYSFONCTIONNEMENT = "Dysfonctionnement"

    class Statut(models.TextChoices):
        DECLAREE = "Déclarée"
        VALIDEE_PILOTE = "Validée pilote"
        EN_TRAITEMENT = "En traitement"
        CLOTUREE = "Clôturée"
        REFUSEE = "Refusée"

    class Niveau1(models.TextChoices):
        EN_ATTENTE = "En attente"
        VALIDE = "Validé"
        REFUSE = "Refusé"

    class Niveau2(models.TextChoices):
        EN_ATTENTE = "En attente"
        APPROUVE = "Approuvé"
        REFUSE = "Refusé"

    ref = models.CharField(max_length=64, blank=True, help_text="Référence (NC-2026-014), générée si absente")
    categorie = models.CharField(max_length=32, choices=Categorie.choices, default=Categorie.NON_CONFORMITE)
    source = models.CharField(max_length=128, blank=True, help_text="Source (liste db.sourcesNC)")
    description = models.TextField()
    type_acte = models.CharField(
        max_length=32, choices=TypeActe.choices, default=TypeActe.CONFORMITE, help_text="Type d'acte"
    )
    cause = models.TextField(blank=True, help_text="Analyse des causes (5 Pourquoi / Ishikawa)")
    action = models.TextField(blank=True, help_text="Action corrective / acte / plan d'action")
    mise_en_oeuvre = models.TextField(null=True, blank=True, help_text="Mise en œuvre (accidents)")  # noqa: DJ001
    lieu = models.CharField(max_length=255, blank=True)
    processus = models.CharField(max_length=32, blank=True, help_text="Processus (id P01…)")
    statut = models.CharField(max_length=16, choices=Statut.choices, default=Statut.DECLAREE)
    n1 = models.CharField(
        max_length=16,
        choices=Niveau1.choices,
        default=Niveau1.EN_ATTENTE,
        help_text="Validation par le pilote",
    )
    n2 = models.CharField(
        max_length=16,
        choices=Niveau2.choices,
        default=Niveau2.EN_ATTENTE,
        help_text="Approbation par le responsable du système",
    )
    date = models.DateField()
    declarant = models.CharField(max_length=255, blank=True, help_text="Déclarant (nom complet)")
    origine = models.CharField(max_length=255, blank=True, help_text="Origine (AUD-2026-02, Terrain…)")
    efficacite = models.TextField(null=True, blank=True, help_text="Évaluation de l'efficacité à la clôture")  # noqa: DJ001

    class Meta(OrgModel.Meta):
        verbose_name = "non-conformité"
        verbose_name_plural = "non-conformités"


class SourcesNC(OrgSingleton):
    """6.4 Liste des sources de déclaration (db.sourcesNC : simple liste de libellés)."""

    valeurs = models.JSONField(default=list, blank=True, help_text="Libellés des sources")

    class Meta:
        verbose_name = "sources des non-conformités"
        verbose_name_plural = "sources des non-conformités"


# ---------- 6.5 Registre d'amélioration continue ----------


class RegistreEntree(NormesMixin, OrgModel):
    """6.5 Entrée du registre d'amélioration continue (alimenté par NC, audits, revues, risques…)."""

    UID_PREFIX = "RG"

    class Type(models.TextChoices):
        NON_CONFORMITE = "Non-conformité"
        INCIDENT = "Incident"
        AMELIORATION = "Piste d'amélioration"
        OBSERVATION = "Observation"
        ACTION_AUDIT = "Action d'audit"
        ACTION_REVUE = "Action de revue"
        ACTION_CORRECTIVE = "Action corrective"
        RISQUE_REALISE = "Risque réalisé"

    class Statut(models.TextChoices):
        EN_COURS = "En cours"
        CLOTURE = "Clôturé"

    ref = models.CharField(max_length=64, help_text="Référence (RG-2026-031)")
    type = models.CharField(max_length=32, choices=Type.choices)
    intitule = models.TextField()
    origine = models.CharField(
        max_length=255, blank=True, help_text="Origine (Audit AUD-2026-02, Risque R07…)"
    )
    processus = models.CharField(max_length=32, blank=True, help_text="Processus (id P01…)")
    statut = models.CharField(max_length=16, choices=Statut.choices, default=Statut.EN_COURS)
    date = models.DateField()
    responsable = models.CharField(max_length=255, blank=True, help_text="Responsable (nom complet)")

    class Meta(OrgModel.Meta):
        verbose_name = "entrée du registre d'amélioration"
        verbose_name_plural = "registre d'amélioration continue"
