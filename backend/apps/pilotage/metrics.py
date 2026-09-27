"""
Calculs du tableau de bord et des alertes, portés à l'identique du front :

  src/services/metrics.ts                taux, coverage, competenceGaps, openActions, procOwner
  src/services/alerts.ts                 computeAlerts, pendingValidations
  src/features/general/dashStats.ts      dashStatSets, dashProcData
  src/features/general/dashboardData.ts  upcoming
  src/features/general/DashboardPage.tsx cartes de synthèse

Les fonctions sont pures : elles prennent `db` au format du front (voir data.load_db)
et la date du jour (la démo est figée au 2026-09-21). Les arrondis suivent Math.round
(demi vers le haut) et non l'arrondi bancaire de Python.
"""

import datetime as dt
import math
import re

NORMS = ("9001", "14001", "45001", "27001")  # ALL_N du front
NC_CAT = ("Non-conformité", "Accident / incident", "Piste d'amélioration", "Observation")
MOIS = ("janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc.")
# Destinataires codés en dur dans le front (alerts.ts, metrics.ts).
RESP_RH = "Gildas HOUNKPATIN"
RESP_DG = "Rodrigue AHOUANSOU"
DEFAULT_OWNER = "Florence DOSSOU-YOVO"

_ISO = re.compile(r"^(\d{4})-(\d{2})-(\d{2})")


# ---------- Outils JavaScript ----------


def js_round(x: float) -> int:
    """Math.round : demi vers le haut."""
    return math.floor(x + 0.5)


def pct(a: int, b: int) -> int:
    return js_round(a / b * 100) if b else 0


def js_str(v) -> str:
    """Conversion d'une valeur dans un gabarit `${v}` (11.2 -> '11.2', 60.0 -> '60')."""
    if v is None:
        return ""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)


def parse_date(s) -> dt.date | None:
    if not isinstance(s, str) or not s or s == "—":
        return None
    m = _ISO.match(s)
    if not m:
        return None
    try:
        return dt.date(int(m[1]), int(m[2]), int(m[3]))
    except ValueError:
        return None


def days(s, today: dt.date) -> int | None:
    """days(s) : nombre de jours entre aujourd'hui et la date (négatif si passée), None si pas une date."""
    d = parse_date(s)
    return None if d is None else (d - today).days


def fd(s) -> str:
    """fd(s) : « 21 sept. 2026 », la valeur telle quelle si ce n'est pas une date."""
    if not s or s == "—":
        return "—"
    d = parse_date(s)
    if d is None:
        return str(s)
    return f"{d.day} {MOIS[d.month - 1]} {d.year}"


def in_norm(r, norm: str) -> bool:
    """inNorm(r, norm) : visible avec le filtre de norme courant ?"""
    if norm in ("all", "cross"):
        return True
    if not r or r.get("normes") is None:
        return True
    return norm in r["normes"]


def _list(db, name) -> list:
    return db.get(name) or []


# ---------- services/metrics.ts ----------


def proc_owner(db, pid) -> str:
    p = next((x for x in _list(db, "processus") if x.get("id") == pid), None)
    return p.get("proprietaire", "") if p else DEFAULT_OWNER


def taux(k) -> int:
    """taux(k) : atteinte de la cible d'un indicateur (0–100)."""
    v, c = k.get("valeur"), k.get("cible")
    if v is None or v == "" or v is False:
        return 0
    v, c = float(v), float(c or 0)
    if k.get("sens") == "baisse":
        t = 100 if v <= c else c / v * 100
    elif c == 0:
        t = math.inf if v > 0 else 0
    else:
        t = v / c * 100
    return 100 if t == math.inf else min(100, js_round(t))


def competence_gaps(db) -> list[dict]:
    C = db.get("competences") or {}
    requis = C.get("requis") or {}
    collab = C.get("collaborateurs") or []
    out = []
    for i, c in enumerate(C.get("liste") or []):
        req = requis.get(c)

        def lvl(p, i=i):
            niv = p.get("niveaux") or []
            return niv[i] if i < len(niv) else None

        levels = [lvl(p) for p in collab]
        nb = sum(1 for n in levels if n is not None and req is not None and 0 < n < req)
        zero = sum(1 for n in levels if n is not None and req is not None and n >= req)
        out.append({"comp": c, "nb": nb, "couverts": zero, "critique": zero < 2})
    return out


def coverage(db, active_norms, n: str | None = None) -> int:
    """coverage(n) : couverture moyenne des exigences des normes actives."""
    L = [
        m
        for m in _list(db, "mapping")
        if m.get("norme") in active_norms and (not n or n in ("all", "cross") or m.get("norme") == n)
    ]
    return js_round(sum(m.get("couverture", 0) for m in L) / len(L)) if L else 0


def open_actions(db, norm: str) -> list[dict]:
    """openActions(norm) : actions d'objectifs et traitements de risques non clôturés."""
    a = []
    for o in _list(db, "objectifs"):
        for x in o.get("actions") or []:
            if x.get("statut") != "Clôturé":
                a.append({**x, "src": o.get("code"), "normes": o.get("normes")})
    for r in _list(db, "risques"):
        if r.get("statutAction") != "Clôturé":
            a.append(
                {
                    "libelle": r.get("action"),
                    "responsable": r.get("responsable"),
                    "echeance": r.get("echeance"),
                    "statut": r.get("statutAction"),
                    "src": r.get("id"),
                    "normes": r.get("normes"),
                }
            )
    return [x for x in a if in_norm(x, norm)]


# ---------- services/alerts.ts ----------


def compute_alerts(db, today: dt.date) -> list[dict]:
    """computeAlerts(db) : surveillance automatique des échéances (sans alertes masquées)."""
    A: list[dict] = []
    S = js_str

    def push(lvl, t, d, page, resp):
        A.append({"lvl": lvl, "t": t, "d": d, "page": page, "resp": resp or "", "key": t})

    for o in _list(db, "objectifs"):
        for a in o.get("actions") or []:
            d = days(a.get("echeance"), today)
            if a.get("statut") != "Clôturé" and d is not None and d < 0:
                push(
                    "red",
                    f"Action en retard — {S(o.get('code'))}",
                    f"{S(a.get('libelle'))} ({S(a.get('responsable'))}) — échéance {fd(a.get('echeance'))}",
                    "m3-objectifs",
                    a.get("responsable"),
                )
    for r in _list(db, "risques"):
        d = days(r.get("echeance"), today)
        if r.get("statutAction") != "Clôturé" and d is not None and d < 0:
            push(
                "red",
                f"Traitement du risque {S(r.get('id'))} en retard",
                f"{S(r.get('action'))} — {S(r.get('responsable'))}",
                "m3-risques",
                r.get("responsable"),
            )
    mandats = [{**x, "q": "Représentant"} for x in _list(db, "representants")] + [
        {**x, "q": "Comité HS"} for x in _list(db, "comite")
    ]
    for m in mandats:
        d = days(m.get("mandatFin"), today)
        if d is not None and 0 <= d <= 60:
            push(
                "amber",
                f"Mandat arrivant à échéance ({m['q']})",
                f"{S(m.get('prenom'))} {S(m.get('nom'))} — fin le {fd(m.get('mandatFin'))} (J-{d})",
                "m2-consultation",
                RESP_RH,
            )
    for t in _list(db, "textes"):
        d = days(t.get("echeance"), today)
        if t.get("statut") == "Pas fait" and d is not None and d <= 15:
            push(
                "red" if d < 0 else "amber",
                "Texte réglementaire non conforme",
                f"{(t.get('intitule') or '')[:70]}… — {'délai dépassé' if d < 0 else f'J-{d}'}",
                "m3-veille",
                t.get("responsable"),
            )
    for x in _list(db, "declarations"):
        if x.get("statut") == "Soumise":
            push(
                "blue", "Déclaration en attente de validation du DG", S(x.get("objet")), "m3-veille", RESP_DG
            )
    for r in _list(db, "ressources"):
        d = days(r.get("dateDemandee"), today)
        if r.get("statut") != "Mise à disposition" and d is not None and d < 0:
            push(
                "red",
                "Retard de mise à disposition",
                f"{S(r.get('besoin'))} — demandée pour le {fd(r.get('dateDemandee'))}",
                "m4-ressources",
                r.get("demandeur"),
            )
    for x in _list(db, "documents"):
        d = days(x.get("dateRevue"), today)
        if x.get("statut") != "Obsolète" and d is not None and d <= 30:
            push(
                "red" if d < 0 else "amber",
                "Revue documentaire proche",
                f"{S(x.get('ref'))} {S(x.get('intitule'))} — {fd(x.get('dateRevue'))}",
                "m5-ged",
                x.get("proprietaire"),
            )
    for u in _list(db, "urgences"):
        for e in u.get("exercices") or []:
            late = (days(e.get("date"), today) or 0) < 0
            if e.get("statut") == "En retard" or (e.get("statut") == "Planifié" and late):
                push(
                    "red",
                    "Exercice d'urgence non réalisé",
                    f"{S(u.get('type'))} — prévu le {fd(e.get('date'))}",
                    "m5-urgences",
                    (u.get("responsables") or "").split(" (")[0],
                )
    for f in _list(db, "fichesMaitrise"):
        d = days(f.get("prochaineMaj"), today)
        if d is not None and d <= 30:
            push(
                "red" if d < 0 else "amber",
                "Mise à jour de fiche de maîtrise",
                f"{S(f.get('objet'))} — {f'échue depuis {-d} j' if d < 0 else f'J-{d}'}",
                "m3-fiches",
                f.get("responsable"),
            )
    for k in _list(db, "indicateurs"):
        t = taux(k)
        if t < 80:
            u = S(k.get("unite"))
            push(
                "amber",
                "Écart significatif sur un indicateur",
                f"{S(k.get('kpi'))} : {S(k.get('valeur'))}{u} pour une cible de {S(k.get('cible'))}{u} (taux {t} %)",
                "m6-surveillance",
                k.get("responsable"),
            )
    for a in _list(db, "audits"):
        d = days(a.get("date"), today)
        if a.get("statut") != "Clôturé" and d is not None and 0 <= d <= 60:
            push(
                "blue",
                "Audit à venir — auditeur alerté",
                f"{S(a.get('ref'))} {S(a.get('titre'))} — {fd(a.get('date'))} ({S(a.get('auditeur'))})",
                "m6-audits",
                a.get("auditeur"),
            )
    for g in [g for g in competence_gaps(db) if g["critique"]][:2]:
        push(
            "amber",
            "Compétence critique non couverte",
            f"{g['comp']} — {g['nb']} collaborateur(s) sous le niveau requis",
            "m4-competences",
            RESP_RH,
        )
    for n in _list(db, "ncs"):
        if n.get("statut") == "Déclarée":
            push(
                "blue",
                "Non-conformité à valider",
                f"{S(n.get('ref'))} — {S(n.get('description'))}",
                "m6-nc",
                proc_owner(db, n.get("processus")),
            )
    return A


def pending_validations(db) -> list[dict]:
    """pendingValidations(db) : éléments en attente d'une validation."""
    L = []
    for d in _list(db, "documents"):
        if d.get("statut") in ("Vérification", "Approbation"):
            L.append(
                {
                    "t": f"{js_str(d.get('ref'))} — {js_str(d.get('intitule'))}",
                    "d": f"Document en {d['statut'].lower()}",
                    "page": "m5-ged",
                    "detail": {"fn": "docDetail", "id": d.get("id")},
                }
            )
    for d in _list(db, "declarations"):
        if d.get("statut") == "Soumise":
            L.append(
                {
                    "t": js_str(d.get("objet")),
                    "d": "Déclaration à valider par le Directeur Général",
                    "page": "m3-veille",
                    "detail": {"fn": "declDetail", "id": d.get("id")},
                }
            )
    for n in _list(db, "ncs"):
        if n.get("n1") == "En attente" or (n.get("n1") == "Validé" and n.get("n2") == "En attente"):
            L.append(
                {
                    "t": f"{js_str(n.get('ref'))} — {js_str(n.get('description'))}",
                    "d": "Validation par le pilote"
                    if n.get("n1") == "En attente"
                    else "Approbation par le responsable du système",
                    "page": "m6-nc",
                    "detail": {"fn": "ncDetail", "id": n.get("id")},
                }
            )
    for r in _list(db, "ressources"):
        if r.get("statut") == "Soumise":
            L.append(
                {
                    "t": js_str(r.get("besoin")),
                    "d": f"Demande de ressource — circuit {js_str(r.get('circuit'))}",
                    "page": "m4-ressources",
                    "detail": {"fn": "resDetail", "id": r.get("id")},
                }
            )
    return L


# Rôles appelés à valider quand l'objet ne désigne personne.
ROLE_SM = "Responsable SM"
ROLE_DG = "Dirigeant"
_DETAIL_COLL = {
    "docDetail": "documents",
    "declDetail": "declarations",
    "ncDetail": "ncs",
    "resDetail": "ressources",
}


def validation_owner(db, v: dict) -> tuple[str, tuple[str, ...]]:
    """
    Qui doit agir sur une validation en attente (élément de pending_validations) :
    (nom complet désigné par les données, ou "" ; rôles appelés à défaut de nom).
    Sert aux notifications e-mail ; absent de la forme du front.

      document en vérification      -> Responsable SM
      document en approbation       -> approbateur désigné (sinon Responsable SM)
      déclaration soumise           -> Dirigeant
      NC, validation pilote (n1)    -> pilote du processus (procOwner)
      NC, approbation système (n2)  -> Responsable SM
      demande de ressource soumise  -> Dirigeant
    """
    detail = v.get("detail") or {}
    coll = _DETAIL_COLL.get(detail.get("fn"))
    obj = next((x for x in _list(db, coll) if x.get("id") == detail.get("id")), None) if coll else None
    if obj is None:
        return "", (ROLE_SM,)
    if coll == "documents":
        resp = obj.get("approbateur") if obj.get("statut") == "Approbation" else ""
        return (resp, ()) if resp else ("", (ROLE_SM,))
    if coll == "ncs":
        if obj.get("n1") == "En attente":
            return proc_owner(db, obj.get("processus")), ()
        return "", (ROLE_SM,)
    return "", (ROLE_DG,)


# ---------- features/general/dashboardData.ts ----------


def upcoming(db, today: dt.date) -> list[dict]:
    """upcoming() : échéances des 30 prochains jours, triées par date."""
    L = []

    def add(t, d, m, r):
        x = days(d, today)
        if x is not None and 0 <= x <= 30:
            L.append({"t": t, "d": d, "m": m, "r": r if r is not None else ""})

    for o in _list(db, "objectifs"):
        for a in o.get("actions") or []:
            if a.get("statut") != "Clôturé":
                add(
                    a.get("libelle"),
                    a.get("echeance"),
                    f"Plan d'action {js_str(o.get('code'))}",
                    a.get("responsable"),
                )
    for a in _list(db, "audits"):
        add(a.get("titre"), a.get("date"), f"Audit {js_str(a.get('ref'))}", a.get("auditeur"))
    for t in _list(db, "textes"):
        add(
            f"Évaluation : {(t.get('intitule') or '')[:50]}…",
            t.get("echeance"),
            "Veille réglementaire",
            t.get("responsable"),
        )
    for u in _list(db, "urgences"):
        for e in u.get("exercices") or []:
            add(
                f"Exercice : {js_str(u.get('type'))}",
                e.get("date"),
                "Situations d'urgence",
                (u.get("responsables") or "").split(" (")[0],
            )
    for p in _list(db, "plansOps"):
        if p.get("statut") != "Fait":
            add(p.get("plan"), p.get("echeance"), "Planification opérationnelle", p.get("responsable"))
    for f in _list(db, "formations"):
        if f.get("statut") == "Planifiée":
            add(f"Formation : {js_str(f.get('theme'))}", f.get("date"), "Compétences", f.get("formateur"))
    for f in _list(db, "fichesMaitrise"):
        add(
            f"Mise à jour : {js_str(f.get('objet'))}",
            f.get("prochaineMaj"),
            "Fiche de maîtrise",
            f.get("responsable"),
        )
    for d in _list(db, "documents"):
        if d.get("statut") != "Obsolète":
            add(f"Revue {js_str(d.get('ref'))}", d.get("dateRevue"), "GED", d.get("proprietaire"))
    for r in _list(db, "revues"):
        if r.get("statut") != "Clôturée":
            add(f"Revue : {js_str(r.get('type') or r.get('ref'))}", r.get("date"), "Revues", r.get("ref"))
    for r in _list(db, "representants"):
        add(
            f"Fin de mandat : {js_str(r.get('prenom'))} {js_str(r.get('nom'))}",
            r.get("mandatFin"),
            "Consultation",
            r.get("fonction"),
        )
    return sorted(L, key=lambda x: parse_date(x["d"]))


# ---------- features/general/dashStats.ts ----------


def dash_stat_sets(db, norm: str, today: dt.date) -> dict:
    """dashStatSets(norm) : statistiques structurées (risques, veille, audits, NC, GED)."""
    R = [r for r in _list(db, "risques") if in_norm(r, norm)]
    OP = [o for o in _list(db, "opportunites") if in_norm(o, norm)]
    ro = [r.get("statutAction") for r in R] + [o.get("statutAction") for o in OP]
    ro_clos = sum(1 for x in ro if x == "Clôturé")
    T = [t for t in _list(db, "textes") if in_norm(t, norm)]
    t_ok = sum(1 for t in T if t.get("statut") == "Fait")
    A = [a for a in _list(db, "audits") if in_norm(a, norm)]
    reg_ar = [r for r in _list(db, "registre") if re.search("audit|revue", r.get("type") or "", re.I)]
    reg_clos = sum(1 for r in reg_ar if r.get("statut") == "Clôturé")
    N = [n for n in _list(db, "ncs") if in_norm(n, norm)]
    Dc = [d for d in _list(db, "documents") if d.get("statut") != "Obsolète"]
    d_wait = sum(
        1
        for d in Dc
        if d.get("statut") in ("Rédaction", "Vérification", "Approbation")
        or (days(d.get("dateRevue"), today) or 0) < 60
    )
    d_diff = sum(1 for d in Dc if d.get("statut") == "Diffusé")
    matrice = [
        {
            "probabilite": p,
            "impact": i,
            "risques": sum(1 for r in R if r.get("probabilite") == p and r.get("criticite") == i),
            "opportunites": sum(1 for o in OP if o.get("probabilite") == p and o.get("impact") == i),
        }
        for p in (4, 3, 2, 1)
        for i in (1, 2, 3, 4)
    ]
    return {
        "risques": {
            "risquesOuverts": sum(1 for r in R if r.get("statutAction") != "Clôturé"),
            "opportunitesEnCours": sum(1 for o in OP if o.get("statutAction") != "Clôturé"),
            "actionsCloturees": ro_clos,
            "actionsTotal": len(ro),
            "tauxMiseEnOeuvre": pct(ro_clos, len(ro)),
            "matrice": matrice,
        },
        "reglementaire": {
            "conformes": t_ok,
            "diffuses": sum(1 for t in T if t.get("diffuse")),
            "enAttente": sum(1 for t in T if t.get("statut") != "Fait"),
            "total": len(T),
            "tauxConformite": pct(t_ok, len(T)),
        },
        "audits": {
            "planifies": sum(1 for a in A if a.get("statut") == "Planifié"),
            "plansDiffuses": sum(1 for a in A if re.search("diffus", a.get("statut") or "", re.I)),
            "rapportsDeposes": sum(1 for a in A if re.search("déposé", a.get("statut") or "", re.I)),
            "clotures": sum(1 for a in A if a.get("statut") == "Clôturé"),
            "actionsCloturees": reg_clos,
            "actionsTotal": len(reg_ar),
            "tauxClotureActions": pct(reg_clos, len(reg_ar)),
        },
        "nc": {
            "parCategorie": {c: sum(1 for n in N if n.get("categorie") == c) for c in NC_CAT},
            "declarees": sum(1 for n in N if n.get("statut") == "Déclarée"),
            "enCours": sum(1 for n in N if n.get("statut") in ("En traitement", "Validée pilote")),
            "cloturees": sum(1 for n in N if n.get("statut") == "Clôturée"),
        },
        "ged": {
            "enAttenteRevue": d_wait,
            "diffuses": d_diff,
            "totalActifs": len(Dc),
            "tauxDiffusion": pct(d_diff, len(Dc)),
        },
    }


def dash_proc_data(db, users, norm: str, today: dt.date, proc: str = "", direction: str = "") -> list[dict]:
    """dashProcData(norm, filtres) : objectifs, actions et risques par processus."""
    dirs = {u.get("nom"): u.get("direction") for u in reversed(users)}  # users.find : premier trouvé

    def proc_dir(p):
        return dirs[p.get("proprietaire")] if p.get("proprietaire") in dirs else "—"

    P = [p for p in _list(db, "processus") if in_norm(p, norm)]
    if proc:
        P = [p for p in P if p.get("id") == proc]
    if direction:
        P = [p for p in P if proc_dir(p) == direction]

    def late(o):
        return any(
            a.get("statut") != "Clôturé" and (days(a.get("echeance"), today) or 0) < 0
            for a in o.get("actions") or []
        )

    rows = []
    for p in P:
        pid = p.get("id")
        OB = [o for o in _list(db, "objectifs") if in_norm(o, norm) and pid in (o.get("processus") or [])]
        act = sum(1 for o in OB for a in o.get("actions") or [] if a.get("statut") != "Clôturé")
        RO = [
            r
            for r in _list(db, "risques")
            if in_norm(r, norm) and pid in (r.get("processus") or []) and r.get("statutAction") != "Clôturé"
        ]
        rows.append(
            {
                "id": pid,
                "proc": f"{js_str(p.get('code'))} · {js_str(p.get('intitule'))}",
                "dir": proc_dir(p),
                "obj": len(OB),
                "atteints": sum(1 for o in OB if o.get("efficacite") == "Efficace"),
                "risque": sum(
                    1
                    for o in OB
                    if o.get("efficacite") in ("Non efficace", "Partiellement efficace") or late(o)
                ),
                "act": act + len(RO),
                "risk": len(RO),
            }
        )
    return rows


# ---------- DashboardPage.tsx ----------


def _chart(serie) -> dict:
    serie = serie or {}
    return {
        "labels": serie.get("labels") or [],
        "clotures": serie.get("clotures") or [],
        "ouvertures": serie.get("ouvertures") or [],
        "totalClotures": sum(serie.get("clotures") or []),
    }


def dashboard(
    db, active_norms, users, norm: str, today: dt.date, proc: str = "", direction: str = ""
) -> dict:
    """Toutes les valeurs de la page Tableau de bord pour le filtre de norme `norm`."""
    acts = open_actions(db, norm)
    tx = [t for t in _list(db, "textes") if in_norm(t, norm)]
    tx_ok = sum(1 for t in tx if t.get("statut") == "Fait")
    alerts = compute_alerts(db, today)
    return {
        "date": today.isoformat(),
        "norme": norm,
        "normesActives": list(active_norms),
        "couverture": coverage(db, active_norms, norm),
        "couvertureParNorme": {
            n: coverage(db, active_norms, n) if n in active_norms else None for n in NORMS
        },
        "actions": {
            "enCours": len(acts),
            "enRetard": sum(1 for a in acts if (days(a.get("echeance"), today) or 0) < 0),
        },
        "alertes": {"total": len(alerts), "critiques": sum(1 for a in alerts if a["lvl"] == "red")},
        "conformiteReglementaire": {"taux": pct(tx_ok, len(tx)), "ecarts": len(tx) - tx_ok},
        "actionsAmelioration": {"mois": _chart(db.get("cloturesMois")), "an": _chart(db.get("cloturesAn"))},
        "parProcessus": dash_proc_data(db, users, norm, today, proc, direction),
        "statistiques": dash_stat_sets(db, norm, today),
        "echeances": upcoming(db, today),
    }
