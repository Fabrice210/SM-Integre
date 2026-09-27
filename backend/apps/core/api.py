"""Vues du socle : authentification, profil, organisme, utilisateurs, journal, bootstrap."""

import logging

from django.contrib.auth import get_user_model
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiResponse, extend_schema, extend_schema_view, inline_serializer
from rest_framework import generics, mixins, serializers, status, viewsets
from rest_framework.decorators import action, api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from . import registry
from .accounts import DetailSerializer, send_password_email
from .models import JournalEntry, Organisation
from .permissions import IsMemberAnyMethod, IsOrgAdmin

logger = logging.getLogger(__name__)
User = get_user_model()


# ---------- Utilisateurs ----------


class UserSerializer(serializers.ModelSerializer):
    """Forme de USERS côté front : {id, nom, email, poste, direction, roles}."""

    id = serializers.CharField(source="uid", required=False)
    password = serializers.CharField(write_only=True, required=False, min_length=8)

    class Meta:
        model = User
        fields = ["id", "nom", "email", "poste", "direction", "roles", "password"]

    def create(self, validated_data):
        org = self.context["organisation"]
        password = validated_data.pop("password", None)
        if not validated_data.get("uid"):
            n = User.objects.filter(organisation=org).count() + 1
            validated_data["uid"] = f"u{n}"
        user = User.objects.create_user(organisation=org, password=password, **validated_data)
        if not password:
            user.set_unusable_password()
            user.save(update_fields=["password"])
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
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
    serializer_class = UserSerializer
    permission_classes = [IsOrgAdmin]
    lookup_field = "uid"
    queryset = User.objects.none()  # schéma OpenAPI ; get_queryset filtre par organisme

    def get_queryset(self):
        return User.objects.filter(organisation=self.request.user.organisation).order_by("id")

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.request.user.is_authenticated:
            ctx["organisation"] = self.request.user.organisation
        return ctx

    def perform_create(self, serializer):
        user = serializer.save()
        if not user.has_usable_password():
            send_password_email(user, invitation=True, inviter=self.request.user)

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


# ---------- Organisme et réglages ----------


class OrganisationSerializer(serializers.ModelSerializer):
    """Fiche organisme (ORG) : nom, sigle + champs libres du profil, à plat."""

    class Meta:
        model = Organisation
        fields = ["nom", "sigle"]

    def to_representation(self, instance):
        return {**(instance.profil or {}), "nom": instance.nom, "sigle": instance.sigle}

    def to_internal_value(self, data):
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
