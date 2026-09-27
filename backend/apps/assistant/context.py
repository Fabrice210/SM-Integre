"""
Construction du contexte envoyé à l'assistant IA.

Le modèle ne voit QUE les données de l'organisme de l'utilisateur, relues par les
sérialiseurs du registre (même forme que le front), sous forme compacte :

  - bloc stable (mis en cache côté API Claude) : fiche organisme, inventaire des
    collections, alertes et validations en attente (apps.pilotage.metrics), puis les
    enregistrements des collections du module de la page courante ;
  - bloc question : enregistrements des autres modules pertinents pour la question
    (collections nommées dans la question, puis recherche par mots-clés), sous un budget.

Chaque enregistrement est présenté sous la forme `[collection:id] {...}` : c'est la
référence que le modèle doit citer. `index` recense tout ce qui a été fourni, ce qui
permet de ne retenir comme sources que des éléments réellement transmis.
"""

import json
import re
import unicodedata
from dataclasses import dataclass, field

from django.utils import timezone

from apps.core import registry
from apps.core.models import Organisation
from apps.pilotage import metrics
from apps.pilotage.data import load_collection

MODULES = {
    "m1": "Contexte de l'organisme",
    "m2": "Leadership",
    "m3": "Planification : objectifs, conformité et risques",
    "m4": "Support",
    "m5": "Réalisation des activités opérationnelles",
    "m6": "Évaluation des performances et amélioration",
    "pilotage": "Pilotage transverse",
}

# Budgets en caractères (~3,5 caractères par jeton pour du français JSON compact).
MODULE_BUDGET = 45_000
QUESTION_BUDGET = 25_000
MAX_ALERTS = 40
MAX_ITEMS = 8  # éléments conservés par liste imbriquée
STR_MAX = (240, 140)  # longueur max d'une chaîne au premier niveau / en profondeur

LABEL_KEYS = (
    "intitule",
    "libelle",
    "titre",
    "objet",
    "nom",
    "theme",
    "kpi",
    "besoin",
    "facteur",
    "savoir",
    "plan",
    "collaborateur",
    "type",
)
CODE_KEYS = ("ref", "code", "version")

# Fiche de validation (pilotage.pending_validations) -> collection.
DETAIL_COLLECTIONS = {
    "docDetail": "documents",
    "declDetail": "declarations",
    "ncDetail": "ncs",
    "resDetail": "ressources",
}

# Mots de la question (sans accents, par préfixe) -> collections à inclure en entier.
TOPICS = {
    "retard": ("objectifs", "risques", "opportunites", "plansOps", "textes", "ncs", "urgences"),
    "action": ("objectifs", "risques", "opportunites", "plansOps", "ncs"),
    "echean": ("objectifs", "risques", "opportunites", "plansOps", "textes", "representants"),
    "conform": ("textes", "declarations", "ncs", "mapping"),
    "reglement": ("textes", "declarations", "rapportsConf"),
    "exigence": ("mapping", "applicabilite", "parties"),
    "preuve": ("mapping", "preuvesCom", "formations", "documents"),
    "couverture": ("mapping",),
    "norme": ("mapping", "applicabilite"),
    "formation": ("formations", "competences"),
    "competen": ("competences", "savoirs", "formations"),
    "sensibilis": ("communications", "formations"),
    "communic": ("communications", "preuvesCom"),
    "politique": ("politique", "accuses", "diffusions"),
    "lecture": ("accuses", "diffusions"),
    "mandat": ("representants", "comite"),
    "represent": ("representants", "comite", "reunions"),
    "exercice": ("urgences",),
    "urgence": ("urgences",),
    "document": ("documents", "modeles"),
    "procedure": ("documents", "modeles", "urgences"),
    "validation": ("documents", "declarations"),
    "indicateur": ("indicateurs", "objectifs"),
    "objectif": ("objectifs", "indicateurs", "axes"),
    "fournisseur": ("prestataires",),
    "prestataire": ("prestataires",),
    "partie": ("parties",),
    "enjeu": ("enjeux", "swot", "pestel"),
    "swot": ("swot",),
    "pestel": ("pestel",),
    "processus": ("processus",),
    "audit": ("audits", "auditeurs"),
    "revue": ("revues",),
    "ecart": ("ncs",),
    "incident": ("ncs",),
    "accident": ("ncs",),
    "risque": ("risques", "urgences"),
    "opportunit": ("opportunites",),
    "ressource": ("ressources",),
    "amelioration": ("registre", "ncs"),
    "poste": ("postes",),
    "role": ("postes",),
    "site": ("sites", "activites"),
    "maitrise": ("fichesMaitrise",),
}

STOPWORDS = {
    "avec",
    "dans",
    "pour",
    "sont",
    "quels",
    "quelles",
    "quel",
    "quelle",
    "nous",
    "notre",
    "nos",
    "vous",
    "votre",
    "leur",
    "leurs",
    "cette",
    "ces",
    "est-ce",
    "plus",
    "moins",
    "tous",
    "toutes",
    "tout",
    "faire",
    "fait",
    "donne",
    "moi",
    "liste",
    "combien",
    "comment",
    "pourquoi",
    "quand",
    "avant",
    "apres",
    "entre",
    "depuis",
    "etre",
    "avoir",
    "ont",
    "des",
    "les",
    "une",
    "par",
    "sur",
    "pas",
    "qui",
    "que",
    "quoi",
    "resume",
    "resumer",
    "propose",
    "suggere",
}


def normalize(s: str) -> str:
    """Minuscules sans accents (recherche insensible aux diacritiques)."""
    s = unicodedata.normalize("NFKD", str(s))
    return "".join(c for c in s if not unicodedata.combining(c)).lower()


def keywords(question: str) -> list[str]:
    words = re.findall(r"[a-z0-9][a-z0-9-]{2,}", normalize(question))
    seen: list[str] = []
    for w in words:
        if len(w) >= 4 and w not in STOPWORDS and w not in seen:
            seen.append(w)
    return seen


def module_of(contexte: str) -> str | None:
    """« m3-risques » -> « m3 » ; dashboard, journal… -> None."""
    m = (contexte or "").split("-")[0].strip()
    return m if m in MODULES and m != "pilotage" else None


def _trunc(s: str, n: int) -> str:
    s = " ".join(s.split())
    return s if len(s) <= n else s[: n - 1] + "…"


def compact(v, depth: int = 0):
    """Valeur réduite : sans vides, chaînes tronquées, listes limitées, fichiers masqués."""
    if v is None or v == "" or v == [] or v == {}:
        return None
    if isinstance(v, bool | int | float):
        return v
    if isinstance(v, str):
        if v.startswith("data:"):
            return "[fichier joint]"
        return _trunc(v, STR_MAX[0] if depth == 0 else STR_MAX[1])
    if isinstance(v, list | tuple):
        items = [c for c in (compact(x, depth + 1) for x in v[:MAX_ITEMS]) if c is not None]
        if len(v) > MAX_ITEMS:
            items.append(f"… +{len(v) - MAX_ITEMS}")
        return items or None
    if isinstance(v, dict):
        if depth >= 3:
            return None
        out = {}
        for k, x in v.items():
            c = compact(x, depth + 1)
            if c is not None:
                out[k] = c
        return out or None
    return _trunc(str(v), STR_MAX[1])


def label_of(name: str, rec: dict) -> str:
    code = next((str(rec[k]) for k in CODE_KEYS if rec.get(k) not in (None, "")), "")
    lab = next((str(rec[k]) for k in LABEL_KEYS if rec.get(k) not in (None, "") and k != "version"), "")
    if code and lab and code != lab:
        text = f"{code} — {lab}"
    else:
        text = code or lab or name
    return _trunc(text, 120)


@dataclass
class Entry:
    collection: str
    id: str
    libelle: str
    line: str
    search: str  # texte normalisé pour la recherche par mots-clés


@dataclass
class AssistantContext:
    stable: str
    question: str
    module: str | None
    index: dict[tuple[str, str], str] = field(default_factory=dict)

    def source(self, collection: str, id_: str) -> dict | None:
        lib = self.index.get((collection, id_))
        if lib is None:
            return None
        return {"collection": collection, "id": id_, "libelle": lib}


def _entries(name: str, data) -> list[Entry]:
    records = [data] if isinstance(data, dict) else list(data or [])
    out = []
    for rec in records:
        if not isinstance(rec, dict) or not rec:
            continue
        rid = str(rec.get("id") or name) if isinstance(data, list) else name
        body = compact({k: v for k, v in rec.items() if k != "id"}) or {}
        line = f"[{name}:{rid}] " + json.dumps(body, ensure_ascii=False, separators=(",", ":"))
        out.append(Entry(name, rid, label_of(name, rec), line, normalize(line)))
    return out


def load_org_data(org: Organisation) -> dict:
    """Toutes les collections de l'organisme, au format du front (filtrées par organisme)."""
    return {col.name: load_collection(org, col.name) for col in registry.all_collections()}


def _section(title: str, entries: list[Entry], budget: int, index: dict) -> tuple[str, int]:
    """Titre + lignes dans la limite du budget ; renvoie (texte, caractères utilisés)."""
    lines = [f"## {title}"]
    used = len(lines[0])
    kept = 0
    for e in entries:
        if used + len(e.line) + 1 > budget:
            break
        lines.append(e.line)
        used += len(e.line) + 1
        index[(e.collection, e.id)] = e.libelle
        kept += 1
    if kept < len(entries):
        lines.append(f"(… {len(entries) - kept} enregistrement(s) non transmis faute de place)")
    return ("\n".join(lines), used) if kept else ("", 0)


def build_context(org: Organisation, question: str, contexte: str = "", today=None) -> AssistantContext:
    today = today or timezone.localdate()
    data = load_org_data(org)
    module = module_of(contexte)
    cols = {c.name: c for c in registry.all_collections()}
    entries = {name: _entries(name, value) for name, value in data.items()}
    index: dict[tuple[str, str], str] = {}

    # ---------- Bloc stable : organisme, inventaire, pilotage, module courant ----------
    norms = ", ".join(f"ISO {n}" for n in (org.active_norms or [])) or "aucune"
    parts = [
        "<organisme>",
        f"Nom : {org.nom}" + (f" ({org.sigle})" if org.sigle else ""),
        f"Normes actives : {norms}",
        f"Date du jour : {today.isoformat()}",
        "</organisme>",
        "",
        "<inventaire>",
        *(
            f"- {name} (module {cols[name].module}) : {len(entries[name])} enregistrement(s)"
            for name in sorted(entries)
        ),
        "</inventaire>",
    ]

    alerts = metrics.compute_alerts(data, today)
    parts += ["", f'<alertes date="{today.isoformat()}" total="{len(alerts)}">']
    for a in alerts[:MAX_ALERTS]:
        lvl = {"red": "critique", "amber": "attention"}.get(a.get("lvl"), a.get("lvl") or "")
        resp = f" ; responsable : {a['resp']}" if a.get("resp") else ""
        parts.append(f"- [{lvl}] {a.get('t')} — {a.get('d')} (page {a.get('page')}{resp})")
    if len(alerts) > MAX_ALERTS:
        parts.append(f"(… {len(alerts) - MAX_ALERTS} autre(s) alerte(s))")
    parts.append("</alertes>")

    parts += ["", "<validations_en_attente>"]
    by_id = {(e.collection, e.id): e for es in entries.values() for e in es}
    for v in metrics.pending_validations(data):
        detail = v.get("detail") or {}
        col = DETAIL_COLLECTIONS.get(detail.get("fn", ""))
        ref = ""
        if col and (col, str(detail.get("id"))) in by_id:
            e = by_id[(col, str(detail.get("id")))]
            ref = f"[{col}:{e.id}] "
            index[(col, e.id)] = e.libelle
        parts.append(f"- {ref}{v.get('t')} — {v.get('d')}")
    parts.append("</validations_en_attente>")

    module_names = [n for n, c in cols.items() if module and c.module == module]
    if module:
        parts += ["", f'<donnees_module module="{module}" libelle="{MODULES[module]}">']
        budget = MODULE_BUDGET
        for name in sorted(module_names):
            text, used = _section(name, entries[name], budget, index)
            if text:
                parts.append(text)
                budget -= used
        parts.append("</donnees_module>")
    stable = "\n".join(parts)

    # ---------- Bloc question : autres collections pertinentes ----------
    words = keywords(question)
    wanted: list[str] = []
    for w in words:
        for stem, names in TOPICS.items():
            if w.startswith(stem) or (len(w) >= 5 and stem.startswith(w)):
                wanted += [n for n in names if n in entries]
        for name in entries:
            n = normalize(name)
            if len(w) >= 5 and (n.startswith(w[:5]) or w.startswith(n[:5])):
                wanted.append(name)
    wanted = [n for i, n in enumerate(wanted) if n not in wanted[:i] and n not in module_names]

    chosen: dict[str, list[Entry]] = {n: list(entries[n]) for n in wanted}
    # Recherche par mots-clés dans les autres enregistrements.
    scored = []
    for name, es in entries.items():
        if name in module_names or name in chosen:
            continue
        for e in es:
            score = sum(1 for w in words if w in e.search)
            if score:
                scored.append((-score, name, e))
    scored.sort(key=lambda t: (t[0], t[1]))
    for _, name, e in scored:
        chosen.setdefault(name, []).append(e)

    q_parts = []
    budget = QUESTION_BUDGET
    for name, es in chosen.items():
        text, used = _section(f"{name} (module {cols[name].module})", es, budget, index)
        if text:
            q_parts.append(text)
            budget -= used
    question_block = (
        "<donnees_complementaires>\n" + "\n".join(q_parts) + "\n</donnees_complementaires>" if q_parts else ""
    )
    return AssistantContext(stable=stable, question=question_block, module=module, index=index)
