"""
Socle commun : organisme (locataire), utilisateurs, journal d'audit et modèles abstraits
dont héritent toutes les collections métier des modules 1 à 6.

Conventions (voir backend/README.md) :
  - chaque enregistrement métier appartient à un Organisation (multi-organisme) ;
  - `uid` est l'identifiant exposé en API sous le nom `id` (P01, EN3, R101…),
    unique par organisme — ce sont les identifiants du front ;
  - les références entre collections sont des uid (CharField / JSON de uid),
    validées par apps.core.refs, pas des ForeignKey : pas de dépendance de
    migration entre modules, et même forme que le front.
"""

from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models, transaction
from django.db.models import F

NORM_IDS = ("9001", "14001", "45001", "27001")


class Organisation(models.Model):
    """Organisme client (ORG de l'original) + réglages globaux du Persisted du front."""

    nom = models.CharField(max_length=255)
    sigle = models.CharField(max_length=32, blank=True)
    # Reste de la fiche organisme (secteur, taille, effectif, adresse, rccm, ifu…),
    # stockée telle quelle : la forme évolue avec l'onboarding.
    profil = models.JSONField(default=dict, blank=True)
    active_norms = models.JSONField(default=list, blank=True)
    auditor_access = models.BooleanField(default=True)
    erp_module = models.BooleanField(default=False)
    onboarded = models.BooleanField(default=False)
    # Compteur de uid() du front : R101, R102…
    uid_seq = models.PositiveIntegerField(default=100)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.nom

    def next_uid(self, prefix: str = "R") -> str:
        """Identifiant suivant, équivalent de uid() du front (atomique)."""
        with transaction.atomic():
            Organisation.objects.filter(pk=self.pk).update(uid_seq=F("uid_seq") + 1)
            self.refresh_from_db(fields=["uid_seq"])
        return f"{prefix}{self.uid_seq}"


class Role(models.TextChoices):
    DIRIGEANT = "Dirigeant"
    RESPONSABLE_SM = "Responsable SM"
    PILOTE = "Pilote de processus"
    COPILOTE = "Copilote de processus"
    AUDITEUR_INTERNE = "Auditeur interne"
    COLLABORATEUR = "Collaborateur"
    ADMIN = "Administrateur système"
    AUDITEUR_EXTERNE = "Auditeur externe"


class SMUserManager(UserManager):
    def create_user(self, email, password=None, **extra):
        extra.setdefault("username", email)
        return super().create_user(email=email, password=password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("username", email)
        return super().create_superuser(email=email, password=password, **extra)


class User(AbstractUser):
    """Utilisateur de la plateforme (USERS de l'original). Connexion par e-mail."""

    email = models.EmailField(unique=True)
    organisation = models.ForeignKey(
        Organisation, on_delete=models.CASCADE, related_name="users", null=True, blank=True
    )
    uid = models.CharField(max_length=32, blank=True, help_text="Identifiant front (u1, u2…)")
    nom = models.CharField(max_length=255, help_text="Nom complet affiché (Prénom NOM)")
    poste = models.CharField(max_length=255, blank=True)
    direction = models.CharField(max_length=255, blank=True)
    roles = models.JSONField(default=list, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    objects = SMUserManager()

    def has_role(self, *roles: str) -> bool:
        return any(r in (self.roles or []) for r in roles)

    def __str__(self):
        return self.nom or self.email


class OrgModel(models.Model):
    """Base de toute collection métier : organisme + identifiant front + horodatage."""

    organisation = models.ForeignKey(Organisation, on_delete=models.CASCADE, related_name="+")
    uid = models.CharField(max_length=32, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # Ordre d'affichage (le front conserve l'ordre des tableaux).
    position = models.PositiveIntegerField(default=0)
    # Champs envoyés par le client sans colonne dédiée (hist, champs ajoutés par
    # une nouvelle version de l'interface…) : conservés et renvoyés tels quels.
    extra = models.JSONField(default=dict, blank=True)

    # Préfixe des uid générés quand le client n'en fournit pas.
    UID_PREFIX = "R"

    class Meta:
        abstract = True
        ordering = ["position", "id"]
        constraints = [
            models.UniqueConstraint(fields=["organisation", "uid"], name="%(app_label)s_%(class)s_uid_uniq")
        ]

    def __str__(self):
        return f"{self.__class__.__name__} {self.uid}"


class NormesMixin(models.Model):
    """Normes ISO concernées (['9001', '45001']…), filtrables par ?norme=."""

    normes = models.JSONField(default=list, blank=True)

    class Meta:
        abstract = True


class OrgSingleton(models.Model):
    """Objet unique par organisme (politique, competences, statsSurv…)."""

    organisation = models.OneToOneField(Organisation, on_delete=models.CASCADE, related_name="+")
    updated_at = models.DateTimeField(auto_now=True)
    extra = models.JSONField(default=dict, blank=True)

    class Meta:
        abstract = True


class JournalEntry(models.Model):
    """Journal d'audit non modifiable (db.journal : {d, u, a, mod, statut})."""

    organisation = models.ForeignKey(Organisation, on_delete=models.CASCADE, related_name="journal")
    d = models.CharField(max_length=32, help_text="Horodatage affiché (AAAA-MM-JJ HH:MM)")
    u = models.CharField(max_length=255, help_text="Nom de l'utilisateur")
    a = models.TextField(help_text="Action")
    mod = models.CharField(max_length=64, help_text="Module")
    statut = models.CharField(max_length=64, blank=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]
        verbose_name = "entrée du journal"
        verbose_name_plural = "journal d'audit"

    def __str__(self):
        return f"{self.d} {self.u} : {self.a}"


class AuditLog(models.Model):
    """Trace technique automatique de chaque écriture via l'API (non exposée au front)."""

    class Action(models.TextChoices):
        CREATE = "create"
        UPDATE = "update"
        DELETE = "delete"

    organisation = models.ForeignKey(Organisation, on_delete=models.CASCADE, related_name="+")
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    collection = models.CharField(max_length=64)
    uid = models.CharField(max_length=32, blank=True)
    action = models.CharField(max_length=8, choices=Action.choices)
    data = models.JSONField(default=dict, blank=True)
    at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-at", "-id"]

    def __str__(self):
        return f"{self.action} {self.collection} {self.uid}"
