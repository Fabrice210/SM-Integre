"""Erreurs de validation renvoyées avec les noms de champs du front (camelCase, `id`)."""

from rest_framework.views import exception_handler

from .naming import to_camel


def _camelize(detail):
    if isinstance(detail, dict):
        # Les erreurs d'une liste imbriquée sont indexées par position (clés entières).
        return {
            ("id" if k == "uid" else to_camel(k) if isinstance(k, str) else k): _camelize(v)
            for k, v in detail.items()
        }
    if isinstance(detail, list):
        return [_camelize(v) for v in detail]
    return detail


def camel_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None and isinstance(response.data, dict):
        response.data = _camelize(response.data)
    return response
