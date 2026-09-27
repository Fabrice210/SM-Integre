"""
Vues génériques des collections : tout est filtré par l'organisme de l'utilisateur,
les identifiants d'URL sont les uid du front (/api/v1/processus/P01/).

Filtres communs :
  ?norme=9001        éléments concernant la norme (champ `normes`)
  ?search=texte      recherche plein texte sur Collection.search_fields
  ?ordering=champ    tri
"""

from collections.abc import Mapping

from django.db import transaction
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import SAFE_METHODS
from rest_framework.response import Response

from .models import NORM_IDS, UID_REGEX, AuditLog
from .validation import contains_nul


def log_write(request, collection: str, action: str, uid: str = "", data=None):
    AuditLog.objects.create(
        organisation=request.user.organisation,
        user=request.user,
        collection=collection,
        uid=uid,
        action=action,
        data=data or {},
    )


CRUD_ACTIONS = ("create", "update", "partial_update", "destroy")


class OrgContextMixin:
    collection = None  # apps.core.registry.Collection
    # Actions métier qui acceptent un tableau JSON comme corps (ex. import d'objectifs).
    list_body_actions: tuple[str, ...] = ()

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        # Corps JSON seulement : un formulaire est toujours un objet, et lire request.data ici
        # pour un type non accepté par l'action donnerait 415 avant le 404 / 403 de la vue.
        if (
            request.method in SAFE_METHODS
            or not (request.content_type or "").startswith("application/json")
            or not any(p.media_type == "application/json" for p in request.parsers)
        ):
            return
        # Actions métier : le corps est un objet. Un tableau ou un scalaire donne une erreur
        # 400 propre au lieu d'une erreur serveur (request.data.get…).
        if (
            self.action not in CRUD_ACTIONS
            and self.action not in self.list_body_actions
            and not isinstance(request.data, Mapping)
        ):
            raise ValidationError({"nonFieldErrors": ["Objet attendu dans le corps de la requête."]})
        if contains_nul(request.data):
            # PostgreSQL refuse le caractère NUL (texte et jsonb) : 400 plutôt qu'une erreur serveur.
            raise ValidationError({"nonFieldErrors": ["Caractère NUL interdit."]})

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.request and self.request.user.is_authenticated:
            ctx["organisation"] = self.request.user.organisation
        return ctx


class OrgModelViewSet(OrgContextMixin, viewsets.ModelViewSet):
    lookup_field = "uid"
    lookup_url_kwarg = "uid"
    # Seuls des uid valides atteignent la base (sinon 404 par le routage).
    lookup_value_regex = UID_REGEX

    def get_queryset(self):
        qs = self.collection.model.objects.filter(organisation=self.request.user.organisation)
        norme = self.request.query_params.get("norme")
        if norme in NORM_IDS and hasattr(self.collection.model, "normes"):
            # Portable SQLite / PostgreSQL : recherche de "9001" dans le JSON.
            qs = qs.filter(normes__icontains=f'"{norme}"')
        return qs

    @transaction.atomic
    def perform_create(self, serializer):
        obj = serializer.save()
        log_write(self.request, self.collection.name, AuditLog.Action.CREATE, obj.uid, serializer.data)

    @transaction.atomic
    def perform_update(self, serializer):
        obj = serializer.save()
        log_write(self.request, self.collection.name, AuditLog.Action.UPDATE, obj.uid, serializer.data)

    @transaction.atomic
    def perform_destroy(self, instance):
        log_write(self.request, self.collection.name, AuditLog.Action.DELETE, instance.uid)
        instance.delete()


class SingletonViewSet(OrgContextMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """GET / PUT / PATCH sur l'objet unique de l'organisme (créé à la volée)."""

    def get_object(self):
        obj, _ = self.collection.model.objects.get_or_create(organisation=self.request.user.organisation)
        self.check_object_permissions(self.request, obj)
        return obj

    @transaction.atomic
    def update(self, request, *args, partial=False, **kwargs):
        obj = self.get_object()
        ser = self.get_serializer(obj, data=request.data, partial=partial)
        ser.is_valid(raise_exception=True)
        ser.save()
        log_write(request, self.collection.name, AuditLog.Action.UPDATE, "", ser.data)
        return Response(ser.data, status=status.HTTP_200_OK)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, partial=True, **kwargs)
