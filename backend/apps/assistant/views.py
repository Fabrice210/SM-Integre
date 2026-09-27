"""
POST /api/v1/assistant/ask/

  entrée  {question, contexte?: identifiant de la page courante (ex. m3-risques),
           historique?: [{role: user|assistant, content}]}
  sortie  200 {reponse, sources: [{collection, id, libelle}]}
          503 {detail, fallback: true} : assistant distant non configuré ou indisponible,
              le front utilise alors son moteur local

Réservé aux membres authentifiés de l'organisme (toute méthode) ; limité par utilisateur
(ASSISTANT_RATE, défaut 30/hour) ; chaque question aboutie est tracée dans le journal.
"""

import os

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from apps.core.permissions import IsMemberReadAction
from apps.core.tracing import log_act

from . import service
from .context import build_context

DEFAULT_RATE = "30/hour"


class AssistantThrottle(UserRateThrottle):
    scope = "assistant"

    def get_rate(self):
        return os.environ.get("ASSISTANT_RATE", "").strip() or DEFAULT_RATE


class HistoryItemSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=["user", "assistant"])
    content = serializers.CharField(max_length=20_000, trim_whitespace=True)


class AskSerializer(serializers.Serializer):
    question = serializers.CharField(max_length=2000, trim_whitespace=True)
    contexte = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    historique = HistoryItemSerializer(many=True, required=False, default=list)

    def validate_historique(self, value):
        if len(value) > 50:
            raise serializers.ValidationError("50 messages au plus.")
        return value


class SourceSerializer(serializers.Serializer):
    collection = serializers.CharField()
    id = serializers.CharField()
    libelle = serializers.CharField()


class AnswerSerializer(serializers.Serializer):
    reponse = serializers.CharField()
    sources = SourceSerializer(many=True)


class AskView(APIView):
    permission_classes = [IsMemberReadAction]
    throttle_classes = [AssistantThrottle]

    @extend_schema(request=AskSerializer, responses={200: AnswerSerializer, 503: OpenApiTypes.OBJECT})
    def post(self, request):
        s = AskSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        if not service.config().api_key:
            return Response(
                {"detail": "Assistant IA distant non configuré.", "fallback": True},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        ctx = build_context(request.user.organisation, d["question"], d["contexte"])
        try:
            answer = service.ask(ctx, d["question"], d["contexte"], d["historique"])
        except service.AssistantUnavailable as exc:
            return Response(
                {"detail": str(exc), "fallback": True}, status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        log_act(request.user, "a interrogé l'assistant IA", "Assistant IA")
        return Response(answer)
