"""Conversion des noms de champs : snake_case (Python) <-> camelCase (API, identique au front)."""

import re

_CAMEL = re.compile(r"(?<!^)(?=[A-Z])")


def to_snake(name: str) -> str:
    """planMisEnOeuvre -> plan_mis_en_oeuvre ; preuve1 -> preuve1."""
    return _CAMEL.sub("_", name).lower()


def to_camel(name: str) -> str:
    """plan_mis_en_oeuvre -> planMisEnOeuvre."""
    head, *rest = name.split("_")
    return head + "".join(p[:1].upper() + p[1:] for p in rest)
