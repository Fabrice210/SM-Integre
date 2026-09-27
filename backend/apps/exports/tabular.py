"""
Lecture d'une collection au format du front et mise en tableau (en-têtes + cellules).

Sources : toute collection du registre (apps.core.registry), plus `journal` et `users`.
Les données sont relues par le sérialiseur de la collection, donc exactement les objets
de `db` côté front, toujours filtrés par l'organisme de l'utilisateur.
"""

from dataclasses import dataclass

from django.contrib.auth import get_user_model

from apps.core import registry
from apps.core.api import JournalSerializer, UserSerializer
from apps.core.models import NORM_IDS, JournalEntry
from apps.pilotage.metrics import fd, js_str, parse_date

from .columns import columns_for

NORM_CODES = {n: f"ISO {n}" for n in NORM_IDS}
EXTRA_SOURCES = ("journal", "users")


class UnknownCollection(LookupError):
    pass


@dataclass
class Table:
    name: str  # collection (clé de db)
    title: str  # nom de fichier / titre (exportName du front)
    headers: list[str]
    rows: list[list]  # cellules : str, int ou float


def resolve(name: str) -> str:
    """Nom de collection à partir de la clé du front (fichesMaitrise) ou de l'URL (fiches-maitrise)."""
    if name in EXTRA_SOURCES or registry.is_registered(name):
        return name
    for col in registry.all_collections():
        if col.url == name:
            return col.name
    raise UnknownCollection(name)


def filters_by_norme(name: str) -> bool:
    """La collection a-t-elle un champ `normes` (ou `norme`) filtrable par ?norme= ?"""
    if not registry.is_registered(name) or registry.get(name).singleton:
        return False
    fields = {f.name for f in registry.get(name).model._meta.get_fields()}
    return bool(fields & {"normes", "norme"})


def _filter_norme(qs, model, norme: str | None):
    if norme not in NORM_IDS:
        return qs
    fields = {f.name for f in model._meta.get_fields()}
    if "normes" in fields:
        return qs.filter(normes__icontains=f'"{norme}"')
    if "norme" in fields:
        return qs.filter(norme=norme)
    return qs


def load_rows(org, name: str, norme: str | None = None):
    """Éléments de la collection (liste d'objets, ou objet unique pour un singleton)."""
    if name == "journal":
        return list(JournalSerializer(JournalEntry.objects.filter(organisation=org), many=True).data)
    if name == "users":
        users = get_user_model().objects.filter(organisation=org).order_by("id")
        return list(UserSerializer(users, many=True).data)
    col = registry.get(name)
    ctx = {"organisation": org}
    if col.singleton:
        obj, _ = col.model.objects.get_or_create(organisation=org)
        return col.serializer(obj, context=ctx).data
    qs = col.model.objects.filter(organisation=org).order_by("position", "id")
    qs = _filter_norme(qs, col.model, norme)
    return list(col.serializer(qs, many=True, context=ctx).data)


def _scalar(v) -> str:
    if v is None:
        return ""
    if isinstance(v, bool):
        return "Oui" if v else "Non"
    if isinstance(v, str) and parse_date(v) and len(v) == 10:
        return fd(v)
    return js_str(v)


def cell(key: str, value):
    """Valeur lisible d'une cellule : dates « 21 sept. 2026 », listes jointes, normes ISO."""
    if value is None:
        return ""
    if key in ("normes", "norme"):
        items = value if isinstance(value, list) else [value]
        return ", ".join(NORM_CODES.get(str(n), str(n)) for n in items)
    if isinstance(value, bool):
        return "Oui" if value else "Non"
    if isinstance(value, int | float):
        return int(value) if isinstance(value, float) and value.is_integer() else value
    if isinstance(value, list):
        if value and all(isinstance(x, dict) for x in value):
            return "\n".join(
                " — ".join(
                    _scalar(v) for v in x.values() if not isinstance(v, list | dict) and v not in ("", None)
                )
                for x in value
            )
        return ", ".join(_scalar(x) for x in value)
    if isinstance(value, dict):
        return "; ".join(
            f"{k} : {_scalar(v) if not isinstance(v, list | dict) else cell(k, v)}" for k, v in value.items()
        )
    return _scalar(value)


def build_table(org, name: str, norme: str | None = None) -> Table:
    data = load_rows(org, name, norme)
    if isinstance(data, dict):  # singleton objet : une ligne par champ
        title, _ = columns_for(name, [])
        rows = [[k, cell(k, v)] for k, v in data.items()]
        return Table(name, title, ["Champ", "Valeur"], rows)
    if data and not isinstance(data[0], dict):  # singleton liste (sourcesNC)
        return Table(name, name, ["Valeur"], [[cell("", v)] for v in data])
    title, cols = columns_for(name, data)
    rows = [[cell(k, r.get(k)) for k, _ in cols] for r in data]
    return Table(name, title, [label for _, label in cols], rows)
