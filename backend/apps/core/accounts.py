"""
Comptes et onboarding multi-organismes.

  POST /auth/signup/            {organisation, sigle?, nom, email, password}
                                crée un organisme vierge (sans données de démo) et son
                                Responsable SM ; renvoie {access, refresh, user}.
                                Désactivé sauf ALLOW_SIGNUP=true (404 sinon).
  POST /auth/password/reset/    {email} -> e-mail contenant le lien de définition du mot
                                de passe (réponse identique que le compte existe ou non).
  POST /auth/password/confirm/  {uid, token, password} -> définit le mot de passe.

Invitation : POST /users/ sans mot de passe crée un compte sans mot de passe utilisable et
envoie le même lien (jetons de django.contrib.auth.tokens, valables PASSWORD_RESET_TIMEOUT
secondes, invalidés dès que le mot de passe change) ; POST /users/{id}/inviter/ le renvoie.
"""

import logging

from django.conf import settings
from django.contrib.auth import get_user_model, password_validation
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.db import transaction
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, serializers, status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Organisation, Role

logger = logging.getLogger(__name__)
User = get_user_model()

DetailSerializer = inline_serializer("Detail", {"detail": serializers.CharField()})


# ---------- Lien de définition du mot de passe ----------


def password_set_link(user) -> str:
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return f"{settings.FRONTEND_URL}{settings.PASSWORD_SET_PATH}?uid={uid}&token={token}"


def send_password_email(user, invitation: bool = False, inviter=None) -> bool:
    """Envoie le lien d'invitation / de réinitialisation. Renvoie False si l'envoi échoue."""
    org = user.organisation.nom if user.organisation_id else "SM Intégré"
    link = password_set_link(user)
    hours = settings.PASSWORD_RESET_TIMEOUT // 3600
    if invitation:
        subject = f"Invitation à rejoindre {org} sur SM Intégré"
        intro = (
            f"{inviter.nom} vous invite" if inviter else "Vous êtes invité(e)"
        ) + f" à rejoindre l'espace de {org} sur la plateforme SM Intégré."
        action = "Pour activer votre compte, choisissez votre mot de passe :"
    else:
        subject = "SM Intégré — définition de votre mot de passe"
        intro = "Une demande de réinitialisation du mot de passe de votre compte SM Intégré a été reçue."
        action = "Pour choisir un nouveau mot de passe :"
    body = (
        f"Bonjour {user.nom or user.email},\n\n{intro}\n\n{action}\n{link}\n\n"
        f"Ce lien est valable {hours} heures et ne sert qu'une fois. Identifiant de connexion : "
        f"{user.email}.\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.\n"
    )
    try:
        send_mail(subject, body, None, [user.email])
    except Exception:
        logger.exception("Échec de l'envoi de l'e-mail de mot de passe", extra={"email": user.email})
        return False
    return True


# ---------- Inscription d'un organisme ----------


class SignupSerializer(serializers.Serializer):
    organisation = serializers.CharField(max_length=255, help_text="Nom de l'organisme")
    sigle = serializers.CharField(max_length=32, required=False, allow_blank=True)
    nom = serializers.CharField(max_length=255, help_text="Nom complet du Responsable SM")
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate_email(self, value):
        value = User.objects.normalize_email(value)
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Un compte existe déjà avec cet e-mail.")
        return value

    def validate(self, attrs):
        candidate = User(email=attrs["email"], nom=attrs["nom"], username=attrs["email"])
        try:
            password_validation.validate_password(attrs["password"], user=candidate)
        except Exception as e:  # django.core.exceptions.ValidationError
            raise serializers.ValidationError({"password": list(getattr(e, "messages", [str(e)]))}) from e
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        org = Organisation.objects.create(
            nom=validated_data["organisation"], sigle=validated_data.get("sigle", "")
        )
        return User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            organisation=org,
            uid="u1",
            nom=validated_data["nom"],
            poste=Role.RESPONSABLE_SM.value,
            roles=[Role.RESPONSABLE_SM.value],
        )


class SignupView(generics.GenericAPIView):
    serializer_class = SignupSerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "signup"

    @extend_schema(
        summary="Créer un organisme et son Responsable SM (si ALLOW_SIGNUP)",
        responses={
            201: inline_serializer(
                "SignupResponse",
                {
                    "access": serializers.CharField(),
                    "refresh": serializers.CharField(),
                    "user": serializers.DictField(),
                },
            ),
            404: DetailSerializer,
        },
    )
    def post(self, request):
        if not settings.ALLOW_SIGNUP:
            raise NotFound("Inscription désactivée.")
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        logger.info(
            "Organisme créé par inscription",
            extra={"organisation": user.organisation_id, "email": user.email},
        )
        from .api import UserSerializer  # import local : api importe ce module

        refresh = RefreshToken.for_user(user)
        return Response(
            {"access": str(refresh.access_token), "refresh": str(refresh), "user": UserSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )


# ---------- Mot de passe oublié / définition par jeton ----------


class PasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetView(generics.GenericAPIView):
    serializer_class = PasswordResetSerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password"

    @extend_schema(
        summary="Demander un lien de (ré)initialisation du mot de passe", responses=DetailSerializer
    )
    def post(self, request):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = User.objects.filter(email__iexact=ser.validated_data["email"], is_active=True).first()
        if user is not None:
            send_password_email(user)
        # Même réponse dans tous les cas : ne révèle pas l'existence d'un compte.
        return Response({"detail": "Si un compte correspond à cet e-mail, un lien vient d'être envoyé."})


class PasswordConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate(self, attrs):
        invalid = serializers.ValidationError({"token": ["Lien invalide ou expiré."]})
        try:
            pk = force_str(urlsafe_base64_decode(attrs["uid"]))
            user = User.objects.get(pk=pk, is_active=True)
        except (ValueError, TypeError, OverflowError, User.DoesNotExist) as e:
            raise invalid from e
        if not default_token_generator.check_token(user, attrs["token"]):
            raise invalid
        try:
            password_validation.validate_password(attrs["password"], user=user)
        except Exception as e:
            raise serializers.ValidationError({"password": list(getattr(e, "messages", [str(e)]))}) from e
        attrs["user"] = user
        return attrs


class PasswordConfirmView(generics.GenericAPIView):
    serializer_class = PasswordConfirmSerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password"

    @extend_schema(
        summary="Définir le mot de passe avec le jeton reçu par e-mail", responses=DetailSerializer
    )
    def post(self, request):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.validated_data["user"]
        user.set_password(ser.validated_data["password"])
        user.save(update_fields=["password"])
        return Response({"detail": "Mot de passe enregistré : vous pouvez vous connecter."})
