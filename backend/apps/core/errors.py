"""
Pages d'erreur : JSON pour l'API (/api/…), pages HTML de Django ailleurs (admin).

L'exception elle-même est journalisée par Django (logger `django.request`, niveau ERROR,
avec la trace) : la réponse ne contient aucun détail interne.
"""

from django.http import JsonResponse
from django.views import defaults


def _is_api(request) -> bool:
    return request.path.startswith("/api/")


def server_error(request, *args, **kwargs):
    if _is_api(request):
        return JsonResponse({"detail": "Erreur interne du serveur.", "status": 500}, status=500)
    return defaults.server_error(request, *args, **kwargs)


def not_found(request, exception=None, *args, **kwargs):
    if _is_api(request):
        return JsonResponse({"detail": "Ressource introuvable.", "status": 404}, status=404)
    return defaults.page_not_found(request, exception, *args, **kwargs)
