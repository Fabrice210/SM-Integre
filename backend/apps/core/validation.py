"""Contrôles d'entrée communs à toutes les vues (indépendants du sérialiseur)."""

from django.http import QueryDict


def contains_nul(value) -> bool:
    """Vrai si une chaîne (clé ou valeur, à toute profondeur) contient le caractère NUL."""
    if isinstance(value, str):
        return "\x00" in value
    if isinstance(value, QueryDict):
        return any(contains_nul(k) or contains_nul(v) for k, vs in value.lists() for v in vs)
    if isinstance(value, dict):
        return any(contains_nul(k) or contains_nul(v) for k, v in value.items())
    if isinstance(value, list | tuple):
        return any(contains_nul(v) for v in value)
    return False
