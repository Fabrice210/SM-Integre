"""Vues du socle : authentification, profil, organisme, utilisateurs, journal, bootstrap."""

import logging
import re

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import connection, transaction
from django.db.migrations.executor import MigrationExecutor
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiResponse, extend_schema, extend_schema_view, inline_serializer
from rest_framework import generics, mixins, serializers, status, viewsets
from rest_framework.decorators import action, api_view, authentication_classes, permission_classes
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.views import TokenBlacklistView, TokenObtainPairView, TokenRefreshView

from . import registry
from .accounts import DetailSerializer, send_password_email
from .models import NORM_IDS, UID_REGEX, JournalEntry, Organisation, Role
from .permissions import ADMIN_ROLES, IsMemberAnyMethod, IsOrgAdmin
from .validation import contains_nul

logger = logging.getLogger(__name__)
User = get_user_model()


# ---------- Utilisateurs ----------


def is_admin(user) -> bool:
    return user.is_active and user.has_role(*ADMIN_ROLES)


class UserSerializer(serializers.ModelSerializer):
    """
    Forme de USERS côté front : {id, nom, email, poste, direction, roles}.

    Seuls ces champs sont modifiables : l'organisme (celui de l'administrateur connecté),
    is_superuser / is_staff / is_active ne le sont jamais par l'API.
    """

    id = serializers.CharField(source="uid", required=False, max_length=32)
    password = serializers.CharField(write_only=True, required=False, min_length=8, max_length=128)

    class Meta:
        model = User
        fields = ["id", "nom", "email", "poste", "direction", "roles", "password"]

    @property
    def organisation(self):
        return self.context["organisation"]

    def validate_id(self, value):
        if not re.fullmatch(UID_REGEX, value):
            raise serializers.ValidationError("Identifiant invalide.")
        qs = User.objects.filter(organisation=self.organisation, uid=value)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Identifiant déjà utilisé.")
        return value

    def validate_email(self, value):
        # Unicité insensible à la casse, tous organismes confondus (l'e-mail sert à la connexion).
        qs = User.objects.filter(email__iexact=value)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Adresse e-mail déjà utilisée.")
        return value

    def validate_roles(self, value):
        if not isinstance(value, list) or any(r not in Role.values for r in value):
            raise serializers.ValidationError(f"Liste de rôles attendue parmi : {', '.join(Role.values)}.")
        return list(dict.fromkeys(value))

    def validate(self, attrs):
        password = attrs.get("password")
        if password:
            # Validateurs de mot de passe de Django (AUTH_PASSWORD_VALIDATORS).
            candidate = self.instance or User(
                email=attrs.get("email", ""), nom=attrs.get("nom", ""), username=attrs.get("email", "")
            )
            try:
                validate_password(password, user=candidate)
            except DjangoValidationError as exc:
                raise serializers.ValidationError({"password": list(exc.messages)}) from exc
        return attrs

    def _next_uid(self) -> str:
        n = User.objects.filter(organisation=self.organisation).count() + 1
        while User.objects.filter(organisation=self.organisation, uid=f"u{n}").exists():
            n += 1
        return f"u{n}"

    def create(self, validated_data):
        org = self.organisation
        password = validated_data.pop("password", None)
        if not validated_data.get("uid"):
            validated_data["uid"] = self._next_uid()
        user = User.objects.create_user(organisation=org, password=password, **validated_data)
        if not password:
            user.set_unusable_password()
            user.save(update_fields=["password"])
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        if "email" in validated_data:
            # username suit l'e-mail (unique) : sinon une ancienne adresse bloquerait une création.
            validated_data["username"] = validated_data["email"]
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save(update_fields=["password"])
        return user


@extend_schema_view(
    create=extend_schema(
        description="Crée un utilisateur de l'organisme. Sans `password`, le compte est une "
        "invitation : un e-mail lui envoie le lien de définition du mot de passe."
    )
)
class UserViewSet(viewsets.ModelViewSet):
    """
    Utilisateurs de l'organisme de l'administrateur connecté (lecture : tout membre).
    Garde-fous : un compte superutilisateur / staff n'est pas modifiable par un administrateur
    d'organisme, et l'organisme garde toujours au moins un administrateur actif.
    """

    serializer_class = UserSerializer
    permission_classes = [IsOrgAdmin]
    lookup_field = "uid"
    queryset = User.objects.none()  # schéma OpenAPI ; get_queryset filtre par organisme
    lookup_value_regex = UID_REGEX

    def get_queryset(self):
        return User.objects.filter(organisation=self.request.user.organisation).order_by("id")

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.request.user.is_authenticated:
            ctx["organisation"] = self.request.user.organisation
        return ctx

    @transaction.atomic
    def perform_create(self, serializer):
        user = serializer.save()
        if not user.has_usable_password():
            # Invitation envoyée seulement si la création est validée en base.
            inviter = self.request.user
            transaction.on_commit(lambda: send_password_email(user, invitation=True, inviter=inviter))

    @extend_schema(
        request=None,
        responses={200: DetailSerializer, 503: DetailSerializer},
        summary="Renvoyer l'e-mail d'invitation (lien de définition du mot de passe)",
    )
    @action(detail=True, methods=["post"])
    def inviter(self, request, uid=None):
        user = self.get_object()
        if not send_password_email(user, invitation=True, inviter=request.user):
            return Response(
                {"detail": "L'e-mail n'a pas pu être envoyé."}, status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        return Response({"detail": f"Invitation envoyée à {user.email}."})

    def get_object(self):
        obj = super().get_object()
        if self.request.method not in ("GET", "HEAD", "OPTIONS"):
            if (obj.is_superuser or obj.is_staff) and not self.request.user.is_superuser:
                raise PermissionDenied("Compte de la plateforme : non modifiable par un administrateur.")
        return obj

    def _other_admins(self, user) -> int:
        return sum(1 for u in self.get_queryset().exclude(pk=user.pk) if is_admin(u))

    @transaction.atomic
    def perform_update(self, serializer):
        user = serializer.instance
        roles = serializer.validated_data.get("roles", user.roles)
        if is_admin(user) and not any(r in ADMIN_ROLES for r in roles) and not self._other_admins(user):
            raise serializers.ValidationError(
                {"roles": "Dernier administrateur de l'organisme : son rôle d'administration est requis."}
            )
        serializer.save()

    @transaction.atomic
    def perform_destroy(self, instance):
        if is_admin(instance) and not self._other_admins(instance):
            raise serializers.ValidationError(
                {"detail": "Impossible de supprimer le dernier administrateur de l'organisme."}
            )
        instance.delete()


# ---------- Organisme et réglages ----------


class OrganisationSerializer(serializers.ModelSerializer):
    """Fiche organisme (ORG) : nom, sigle + champs libres du profil, à plat."""

    class Meta:
        model = Organisation
        fields = ["nom", "sigle"]

    def to_representation(self, instance):
        return {**(instance.profil or {}), "nom": instance.nom, "sigle": instance.sigle}

    def to_internal_value(self, data):
        if not isinstance(data, dict):
            raise serializers.ValidationError({"nonFieldErrors": ["Objet attendu."]})
        if contains_nul(data):
            raise serializers.ValidationError({"nonFieldErrors": ["Caractère NUL interdit."]})
        value = super().to_internal_value({k: data[k] for k in ("nom", "sigle") if k in data})
        value["profil"] = {k: v for k, v in data.items() if k not in ("nom", "sigle")}
        return value

    def update(self, instance, validated_data):
        profil = validated_data.pop("profil", {})
        instance.profil = {**(instance.profil or {}), **profil}
        return super().update(instance, validated_data)


class SettingsSerializer(serializers.ModelSerializer):
    """Réglages globaux du Persisted : activeNorms, auditorAccess, erpModule, onboarded."""

    activeNorms = serializers.JSONField(source="active_norms")
    auditorAccess = serializers.BooleanField(source="auditor_access")
    erpModule = serializers.BooleanField(source="erp_module")
    uidSeq = serializers.IntegerField(source="uid_seq", read_only=True)

    class Meta:
        model = Organisation
        fields = ["activeNorms", "auditorAccess", "erpModule", "onboarded", "uidSeq"]

    def validate_activeNorms(self, value):
        if not isinstance(value, list) or any(n not in NORM_IDS for n in value):
            raise serializers.ValidationError(f"Liste de normes attendue parmi : {', '.join(NORM_IDS)}.")
        return list(dict.fromkeys(value))


class OrgObjectView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsOrgAdmin]

    def get_object(self):
        return self.request.user.organisation


_ORG_DOC = (
    "Fiche organisme (ORG du front) : `nom`, `sigle` et tous les champs libres du profil "
    "(secteur, effectif, adresse, rccm, ifu…) à plat. PATCH fusionne le profil."
)


@extend_schema_view(
    get=extend_schema(description=_ORG_DOC),
    put=extend_schema(description=_ORG_DOC),
    patch=extend_schema(description=_ORG_DOC),
)
class OrganisationView(OrgObjectView):
    serializer_class = OrganisationSerializer


@extend_schema_view(
    get=extend_schema(description="Réglages globaux : normes actives, accès auditeurs, module ERP…"),
    put=extend_schema(description="Remplace les réglages globaux (Responsable SM / Administrateur)."),
    patch=extend_schema(description="Modifie des réglages globaux (ex. `onboarded` en fin d'onboarding)."),
)
class SettingsView(OrgObjectView):
    serializer_class = SettingsSerializer


# ---------- Journal d'audit (ajout seul) ----------


class JournalSerializer(serializers.ModelSerializer):
    class Meta:
        model = JournalEntry
        fields = ["d", "u", "a", "mod", "statut"]
        read_only_fields = ["u"]


@extend_schema_view(
    list=extend_schema(description="Journal d'audit fonctionnel de l'organisme, le plus récent en tête."),
    create=extend_schema(description="Ajoute une entrée ; `u` est l'utilisateur connecté."),
)
class JournalViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    """Le journal est non modifiable : lecture et ajout uniquement."""

    serializer_class = JournalSerializer
    permission_classes = [IsMemberAnyMethod]
    filterset_fields = ["mod", "u", "statut"]
    queryset = JournalEntry.objects.none()  # schéma OpenAPI ; get_queryset filtre par organisme

    def get_queryset(self):
        return JournalEntry.objects.filter(organisation=self.request.user.organisation)

    def perform_create(self, serializer):
        u = self.request.user
        serializer.save(organisation=u.organisation, user=u, u=u.nom)


# ---------- Authentification ----------


class LoginSerializer(TokenObtainPairSerializer):
    """POST {email, password} -> {access, refresh, user}."""

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"


class RefreshSerializer(TokenRefreshSerializer):
    """Jeton de rafraîchissement d'un utilisateur supprimé : 401 (simplejwt lève DoesNotExist -> 500)."""

    def validate(self, attrs):
        try:
            return super().validate(attrs)
        except User.DoesNotExist as exc:
            raise AuthenticationFailed(self.error_messages["no_active_account"], "no_active_account") from exc


class RefreshView(TokenRefreshView):
    serializer_class = RefreshSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "refresh"


class LogoutView(TokenBlacklistView):
    """POST {refresh} : révoque le jeton de rafraîchissement (déconnexion côté serveur)."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "refresh"


@extend_schema(responses=UserSerializer, summary="Utilisateur connecté")
@api_view(["GET"])
@permission_classes([IsMemberAnyMethod])
def me(request):
    return Response(UserSerializer(request.user).data)


# ---------- Santé (supervision, sondes Docker / Kubernetes) ----------

HealthSerializer = inline_serializer(
    "Health",
    {
        "status": serializers.ChoiceField(choices=["ok", "unavailable"]),
        "checks": serializers.DictField(child=serializers.CharField()),
    },
)


def _check_database() -> str:
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:
        logger.exception("Sonde de santé : base de données injoignable")
        return "error"
    return "ok"


def _check_migrations() -> str:
    try:
        executor = MigrationExecutor(connection)
        plan = executor.migration_plan(executor.loader.graph.leaf_nodes())
    except Exception:
        logger.exception("Sonde de disponibilité : migrations illisibles")
        return "error"
    return "pending" if plan else "ok"


def _health_response(checks: dict) -> Response:
    ok = all(v == "ok" for v in checks.values())
    return Response(
        {"status": "ok" if ok else "unavailable", "checks": checks},
        status=status.HTTP_200_OK if ok else status.HTTP_503_SERVICE_UNAVAILABLE,
    )


@extend_schema(
    summary="Santé (liveness) : le processus répond et joint la base",
    responses={200: HealthSerializer, 503: HealthSerializer},
)
@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def health(request):
    return _health_response({"database": _check_database()})


@extend_schema(
    summary="Disponibilité (readiness) : base jointe et migrations appliquées",
    responses={200: HealthSerializer, 503: HealthSerializer},
)
@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def ready(request):
    checks = {"database": _check_database()}
    if checks["database"] == "ok":
        checks["migrations"] = _check_migrations()
    return _health_response(checks)


# ---------- Bootstrap : tout l'état au format Persisted du front ----------


def build_state(org: Organisation, request=None) -> dict:
    ctx = {"organisation": org, "request": request}
    db = {}
    for col in registry.all_collections():
        if col.singleton:
            obj, _ = col.model.objects.get_or_create(organisation=org)
            db[col.name] = col.serializer(obj, context=ctx).data
        else:
            qs = col.model.objects.filter(organisation=org).order_by("position", "id")
            db[col.name] = col.serializer(qs, many=True, context=ctx).data
    db["journal"] = JournalSerializer(JournalEntry.objects.filter(organisation=org), many=True).data
    users = User.objects.filter(organisation=org).order_by("id")
    return {
        "db": db,
        "org": OrganisationSerializer(org).data,
        "users": UserSerializer(users, many=True).data,
        **SettingsSerializer(org).data,
    }


@extend_schema(
    summary="État complet de l'organisme (forme Persisted du front)",
    responses=OpenApiResponse(
        response=OpenApiTypes.OBJECT,
        description="{db: {<collection>: [...] | {...}, journal: [...]}, org, users, activeNorms, "
        "auditorAccess, erpModule, onboarded, uidSeq}",
    ),
)
@api_view(["GET"])
@permission_classes([IsMemberAnyMethod])
def bootstrap(request):
    """Toute la `db` + org, users et réglages : de quoi hydrater le store du front en un appel."""
    return Response(build_state(request.user.organisation, request))
