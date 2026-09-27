"""
Droits d'accès.

  - lecture : tout membre authentifié de l'organisme (les auditeurs externes seulement
    si l'organisme a activé `auditor_access`) ;
  - écriture : rôles de pilotage (WRITE_ROLES) ;
  - administration (utilisateurs, paramètres) : ADMIN_ROLES ;
  - auditeurs externes : lecture seule, quelle que soit la route (même celles ouvertes
    à tout membre : accusé de lecture, déclaration de NC, journal).
"""

from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import Role

WRITE_ROLES = (
    Role.DIRIGEANT,
    Role.RESPONSABLE_SM,
    Role.PILOTE,
    Role.COPILOTE,
    Role.AUDITEUR_INTERNE,
    Role.ADMIN,
)
ADMIN_ROLES = (Role.RESPONSABLE_SM, Role.ADMIN)


def is_member(user) -> bool:
    if not (user and user.is_authenticated and user.organisation_id):
        return False
    if user.has_role(Role.AUDITEUR_EXTERNE) and not user.organisation.auditor_access:
        return False
    return True


def is_read_only(user) -> bool:
    """Auditeur externe : jamais d'écriture, même cumulé avec un autre rôle."""
    return not user.is_superuser and user.has_role(Role.AUDITEUR_EXTERNE)


def can_write(request) -> bool:
    """Méthode d'écriture autorisée par le profil (hors rôles) : pas pour un auditeur externe."""
    return request.method in SAFE_METHODS or not is_read_only(request.user)


class IsOrgMember(BasePermission):
    """Lecture pour les membres ; écriture pour les rôles de pilotage."""

    def has_permission(self, request, view):
        if not is_member(request.user) or not can_write(request):
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.is_superuser or request.user.has_role(*WRITE_ROLES)


class IsOrgAdmin(BasePermission):
    def has_permission(self, request, view):
        if not is_member(request.user) or not can_write(request):
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.is_superuser or request.user.has_role(*ADMIN_ROLES)


class IsMemberAnyMethod(BasePermission):
    """Toute méthode pour les membres (ex. accusé de lecture, déclaration de NC),
    sauf pour les auditeurs externes (lecture seule)."""

    def has_permission(self, request, view):
        return is_member(request.user) and can_write(request)


class IsMemberReadAction(BasePermission):
    """Tout membre, auditeurs externes compris : actions en POST qui ne modifient aucune
    donnée (ex. question à l'assistant IA)."""

    def has_permission(self, request, view):
        return is_member(request.user)
