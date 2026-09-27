"""
Contenu des PDF de la plateforme (repris des exports du front) :

  - collection_pdf   exportTable(id, 'pdf')          tableau d'une collection (dont le registre)
  - revue_pdf        printPV(id) (RevuesPage)        rapport d'entrée et PV de revue de direction
  - audit_pdf        fiche / rapport d'un audit      constats, périmètre, auditeur
  - dashboard_pdf    exportDash() + cartes du tableau de bord
"""

import datetime as dt

from django.contrib.auth import get_user_model

from apps.core.models import NORM_IDS
from apps.pilotage import metrics
from apps.pilotage.data import load_db

from .pdf import Document, bullets, h2, key_values, para, table
from .tabular import Table, cell

LVL = {"red": "Critique", "amber": "Attention", "blue": "Information"}


def _norms(v) -> str:
    return cell("normes", v or [])


def _proc_label(db, pid) -> str:
    p = next((x for x in db.get("processus") or [] if x.get("id") == pid), None)
    return f"{pid} · {p.get('intitule', '')}" if p else (pid or "—")


def collection_pdf(t: Table, org, user, stamp: str) -> bytes:
    doc = Document(t.title.replace("_", " "), org, user, stamp, wide=len(t.headers) > 6)
    doc.add(table(t.headers, t.rows, doc.width))
    doc.spacer(2).add(para(f"{len(t.rows)} élément(s).", "meta"))
    return doc.render()


def revue_pdf(r: dict, org, user, stamp: str) -> bytes:
    """printPV() du front, complété de la fiche et du plan d'action de la revue."""
    doc = Document(f"PV {r.get('ref', '')}", org, user, stamp)
    doc.add(
        key_values(
            [
                ("Type / objet", r.get("type") or "—"),
                ("Date de pilotage", metrics.fd(r.get("date"))),
                ("Statut", r.get("statut") or "—"),
                ("Participants", r.get("participants") or "—"),
                ("Normes", _norms(r.get("normes")) or "—"),
            ],
            doc.width,
        )
    )
    doc.add(h2("Ordre du jour"))
    odj = r.get("ordreDuJour") or []
    doc.add(bullets(odj) if odj else para("—"))
    doc.add(h2("Rapport d'entrée"), para(r.get("rapportEntree") or "—"))
    doc.add(h2("Procès-verbal"), para(r.get("pv") or "—"))
    actions = r.get("actions") or []
    doc.add(h2("Actions décidées"))
    if actions:
        doc.add(
            table(
                ["Action décidée", "Responsable", "Échéance", "Statut"],
                [
                    [
                        a.get("libelle", ""),
                        a.get("responsable", ""),
                        metrics.fd(a.get("echeance")),
                        a.get("statut", ""),
                    ]
                    for a in actions
                ],
                doc.width,
                weights=[50, 20, 15, 15],
            )
        )
    else:
        doc.add(para("Aucune action décidée."))
    return doc.render()


def audit_pdf(a: dict, db: dict, org, user, stamp: str) -> bytes:
    doc = Document(f"Rapport d'audit {a.get('ref', '')}", org, user, stamp)
    constats = a.get("constats") or []
    doc.add(
        key_values(
            [
                ("Audit", a.get("titre") or "—"),
                ("Date", metrics.fd(a.get("date"))),
                ("Périmètre", _proc_label(db, a.get("perimetre"))),
                (
                    "Pilote du processus",
                    metrics.proc_owner(db, a.get("perimetre")) if a.get("perimetre") else "—",
                ),
                ("Auditeur", a.get("auditeur") or "—"),
                ("Normes auditées", _norms(a.get("normes")) or "—"),
                ("Statut", a.get("statut") or "—"),
                ("Rapport déposé", a.get("rapport") or "—"),
            ],
            doc.width,
        )
    )
    doc.add(h2("Constats"))
    if constats:
        by_type: dict[str, int] = {}
        for c in constats:
            by_type[c.get("type", "—")] = by_type.get(c.get("type", "—"), 0) + 1
        doc.add(para(" · ".join(f"{k} : {v}" for k, v in by_type.items()), "meta")).spacer(2)
        doc.add(
            table(
                ["Type", "Constat", "Processus"],
                [
                    [c.get("type", ""), c.get("description", ""), _proc_label(db, c.get("processus"))]
                    for c in constats
                ],
                doc.width,
                weights=[18, 60, 22],
            )
        )
    else:
        doc.add(para("Aucun constat enregistré."))
    reg = [
        g
        for g in db.get("registre") or []
        if a.get("ref")
        and a.get("ref") in (g.get("origine") or "")
        and "audit" in (g.get("type") or "").lower()
    ]
    if reg:
        doc.add(h2("Actions enregistrées au registre d'amélioration"))
        doc.add(
            table(
                ["Référence", "Action / constat", "Responsable", "Statut"],
                [
                    [g.get("ref", ""), g.get("intitule", ""), g.get("responsable", ""), g.get("statut", "")]
                    for g in reg
                ],
                doc.width,
                weights=[16, 50, 20, 14],
            )
        )
    return doc.render()


def stat_rows(stats: dict) -> list[tuple[str, list[list]]]:
    """dashStatRows() du front, pour chaque bloc de statistiques."""
    r, g, a, n, d = stats["risques"], stats["reglementaire"], stats["audits"], stats["nc"], stats["ged"]
    return [
        (
            "Statistiques — Risques & opportunités",
            [
                ["Risques ouverts", r["risquesOuverts"]],
                ["Opportunités en cours", r["opportunitesEnCours"]],
                ["Actions clôturées", f"{r['actionsCloturees']} / {r['actionsTotal']}"],
                ["Taux de mise en œuvre des actions", f"{r['tauxMiseEnOeuvre']} %"],
            ],
        ),
        (
            "Statistiques — Conformité réglementaire",
            [
                ["Textes conformes", g["conformes"]],
                ["Textes diffusés", g["diffuses"]],
                ["Textes en attente", g["enAttente"]],
                ["Taux de conformité", f"{g['tauxConformite']} %"],
            ],
        ),
        (
            "Statistiques — Audits & Revues",
            [
                ["Audits planifiés", a["planifies"]],
                ["Plans diffusés", a["plansDiffuses"]],
                ["Rapports déposés", a["rapportsDeposes"]],
                ["Audits clôturés", a["clotures"]],
                ["Clôture des actions (audit/revue)", f"{a['tauxClotureActions']} %"],
            ],
        ),
        (
            "Statistiques — Non-conformités",
            [
                *[[c, v] for c, v in n["parCategorie"].items()],
                ["Déclarées", n["declarees"]],
                ["En cours", n["enCours"]],
                ["Clôturées", n["cloturees"]],
            ],
        ),
        (
            "Statistiques — Documentaire (GED)",
            [
                ["Documents en attente de revue", d["enAttenteRevue"]],
                ["Documents diffusés", d["diffuses"]],
                ["Total documents actifs", d["totalActifs"]],
                ["Taux de diffusion contrôlée", f"{d['tauxDiffusion']} %"],
            ],
        ),
    ]


def dashboard_pdf(org, user, stamp: str, norm: str, today: dt.date) -> bytes:
    db = load_db(org)
    users = list(get_user_model().objects.filter(organisation=org).order_by("id").values("nom", "direction"))
    v = metrics.dashboard(db, org.active_norms or [], users, norm, today)
    label = {"all": "toutes normes", "cross": "exigences communes"}.get(norm, f"ISO {norm}")
    doc = Document(f"Tableau de bord — {label}", org, user, stamp)
    par_norme = [
        f"ISO {n} : {c} %" for n, c in v["couvertureParNorme"].items() if n in NORM_IDS and c is not None
    ]
    doc.add(h2("Indicateurs clés"))
    doc.add(
        key_values(
            [
                (
                    "Couverture normative",
                    f"{v['couverture']} %" + (f" ({', '.join(par_norme)})" if par_norme else ""),
                ),
                ("Actions en cours", f"{v['actions']['enCours']} dont {v['actions']['enRetard']} en retard"),
                ("Alertes actives", f"{v['alertes']['total']} dont {v['alertes']['critiques']} critique(s)"),
                (
                    "Conformité réglementaire",
                    f"{v['conformiteReglementaire']['taux']} % ({v['conformiteReglementaire']['ecarts']} écart(s))",
                ),
                (
                    "Actions d'amélioration clôturées",
                    f"{v['actionsAmelioration']['mois']['totalClotures']} sur la période mensuelle, "
                    f"{v['actionsAmelioration']['an']['totalClotures']} sur l'année",
                ),
            ],
            doc.width,
        )
    )
    doc.add(h2("Tableau de bord — Par processus"))
    doc.add(
        table(
            [
                "Processus",
                "Direction",
                "Objectifs",
                "Atteints",
                "À risque",
                "Actions en cours",
                "Risques ouverts",
            ],
            [
                [r["proc"], r["dir"], r["obj"], r["atteints"], r["risque"], r["act"], r["risk"]]
                for r in v["parProcessus"]
            ],
            doc.width,
            weights=[27, 21, 11, 10, 10, 11, 10],
        )
    )
    for title, rows in stat_rows(v["statistiques"]):
        doc.add(h2(title), table(["Indicateur", "Valeur"], rows, doc.width, weights=[70, 30]))
    doc.add(h2("Échéances des 30 prochains jours"))
    if v["echeances"]:
        doc.add(
            table(
                ["Échéance", "Objet", "Module", "Responsable"],
                [[metrics.fd(e["d"]), e["t"], e["m"], e["r"]] for e in v["echeances"]],
                doc.width,
                weights=[14, 46, 22, 18],
            )
        )
    else:
        doc.add(para("Aucune échéance dans les 30 prochains jours."))
    al = metrics.compute_alerts(db, today)
    doc.add(h2("Alertes actives"))
    if al:
        doc.add(
            table(
                ["Niveau", "Alerte", "Détail", "Responsable"],
                [[LVL.get(x["lvl"], x["lvl"]), x["t"], x["d"], x["resp"]] for x in al],
                doc.width,
                weights=[12, 28, 42, 18],
            )
        )
    else:
        doc.add(para("Aucune alerte active."))
    return doc.render()
