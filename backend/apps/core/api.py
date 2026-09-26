"""Vues du socle : authentification, profil, organisme, utilisateurs, journal, bootstrap."""

from django.contrib.auth import get_user_model
from rest_framework import generics, mixins, serializers, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from . import registry
from .models import JournalEntry, Organisation
from .permissions import IsMemberAnyMethod, IsOrgAdmin

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


class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [IsOrgAdmin]
    lookup_field = "uid"

    def get_queryset(self):
        return User.objects.filter(organisation=self.request.user.organisation).order_by("id")

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "organisation": self.request.user.organisation}


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


class OrganisationView(OrgObjectView):
    serializer_class = OrganisationSerializer


class SettingsView(OrgObjectView):
    serializer_class = SettingsSerializer


# ---------- Journal d'audit (ajout seul) ----------


class JournalSerializer(serializers.ModelSerializer):
    class Meta:
        model = JournalEntry
        fields = ["d", "u", "a", "mod", "statut"]
        read_only_fields = ["u"]


class JournalViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    """Le journal est non modifiable : lecture et ajout uniquement."""

    serializer_class = JournalSerializer
    permission_classes = [IsMemberAnyMethod]
    filterset_fields = ["mod", "u", "statut"]

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


@api_view(["GET"])
@permission_classes([IsMemberAnyMethod])
def me(request):
    return Response(UserSerializer(request.user).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"status": "ok"}, status=status.HTTP_200_OK)


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


@api_view(["GET"])
@permission_classes([IsMemberAnyMethod])
def bootstrap(request):
    """Toute la `db` + org, users et réglages : de quoi hydrater le store du front en un appel."""
    return Response(build_state(request.user.organisation, request))
