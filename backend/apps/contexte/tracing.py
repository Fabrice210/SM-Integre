"""
Traçabilité des modules 1 et 2 : reprend apps.core.tracing ; `today()` renvoie ici la
date ISO en texte (iso(TODAY) du front), attendue par les champs date textuels.
"""

from apps.core.tracing import add_hist, log_act, now_stamp
from apps.core.tracing import today as _today

__all__ = ["add_hist", "log_act", "now_stamp", "today"]


def today() -> str:
    """iso(TODAY) du front : date du jour AAAA-MM-JJ."""
    return _today().isoformat()
