"""
Pilotage : collections (mapping, clôtures) et calculs du tableau de bord / des alertes.

Les valeurs attendues (front_values.json) sont calculées par le code TS du front sur la
démo au 2026-09-21 (voir oracle/front_values.mjs) : les formules du serveur doivent
donner exactement les mêmes résultats.
"""

import datetime as dt
import json
from pathlib import Path

import pytest
from django.utils import timezone

from apps.core import registry
from apps.pilotage import metrics
from apps.pilotage.data import LISTS, SINGLETONS

pytestmark = pytest.mark.django_db

FRONT = json.loads((Path(__file__).parent / "front_values.json").read_text(encoding="utf-8"))
TODAY = dt.date(2026, 9, 21)
NORM_FILTERS = ("all", "cross", "9001", "14001", "45001", "27001")


def registered(name: str) -> bool:
    try:
        registry.get(name)
    except KeyError:
        return False
    return True


def available_db(demo_db) -> dict:
    """La démo réduite aux collections enregistrées (les autres lots peuvent manquer)."""
    return {n: (demo_db[n] if registered(n) else ({} if n in SINGLETONS else [])) for n in LISTS + SINGLETONS}


def all_registered() -> bool:
    return all(registered(n) for n in LISTS + SINGLETONS)


# ---------- Formules : comparaison au front sur la démo complète ----------


def test_taux_and_coverage(demo_data):
    db, active = demo_data["db"], list(demo_data["norms"])
    assert [[k["id"], metrics.taux(k)] for k in db["indicateurs"]] == FRONT["taux"]
    assert {n: metrics.coverage(db, active, n) for n in FRONT["covByNorm"]} == FRONT["covByNorm"]
    for norm in NORM_FILTERS:
        assert metrics.coverage(db, active, norm) == FRONT[norm]["cov"], norm
    assert metrics.coverage(db, ["9001"], "14001") == 0  # norme inactive


def test_taux_edge_cases():
    assert metrics.taux({"cible": 8, "sens": "baisse"}) == 0  # pas de mesure
    assert metrics.taux({"valeur": 0, "cible": 8, "sens": "baisse"}) == 100
    assert metrics.taux({"valeur": 0, "cible": 8, "sens": "hausse"}) == 0
    assert metrics.taux({"valeur": 3, "cible": 0, "sens": "hausse"}) == 100
    assert metrics.js_round(70.5) == 71 and metrics.js_round(71.5) == 72  # Math.round, pas round()


def test_dashboard_cards(demo_data):
    db = demo_data["db"]
    for norm in NORM_FILTERS:
        acts = metrics.open_actions(db, norm)
        late = sum(1 for a in acts if (metrics.days(a["echeance"], TODAY) or 0) < 0)
        d = metrics.dashboard(db, list(demo_data["norms"]), demo_data["users"], norm, TODAY)
        f = FRONT[norm]
        assert (len(acts), late) == (f["acts"], f["late"]), norm
        assert d["actions"] == {"enCours": f["acts"], "enRetard": f["late"]}
        assert d["conformiteReglementaire"] == {"taux": f["txOk"], "ecarts": f["txEcarts"]}
        assert d["couverture"] == f["cov"]


@pytest.mark.parametrize("norm", NORM_FILTERS)
def test_dash_stat_sets(demo_data, norm):
    s = metrics.dash_stat_sets(demo_data["db"], norm, TODAY)
    f = FRONT[norm]["stats"]
    assert s["risques"]["risquesOuverts"] == f["risquesOuverts"]
    assert s["risques"]["opportunitesEnCours"] == f["oppEnCours"]
    assert (s["risques"]["actionsCloturees"], s["risques"]["actionsTotal"]) == (f["roClos"], f["roTot"])
    assert s["risques"]["tauxMiseEnOeuvre"] == f["roMEO"]
    assert s["reglementaire"] == {
        "conformes": f["tOk"],
        "diffuses": f["tDiff"],
        "enAttente": f["tWait"],
        "total": f["tTot"],
        "tauxConformite": FRONT[norm]["txOk"],  # même formule que la carte « Conformité réglementaire »
    }
    a = s["audits"]
    assert (a["planifies"], a["plansDiffuses"], a["rapportsDeposes"], a["clotures"]) == (
        f["camp"]["plan"],
        f["camp"]["diff"],
        f["camp"]["dep"],
        f["camp"]["clos"],
    )
    assert (a["tauxClotureActions"], a["actionsCloturees"], a["actionsTotal"]) == (
        f["regRate"],
        f["regClos"],
        f["regTot"],
    )
    assert s["nc"] == {
        "parCategorie": f["ncCat"],
        "declarees": f["ncDecl"],
        "enCours": f["ncCours"],
        "cloturees": f["ncClos"],
    }
    assert s["ged"] == {
        "enAttenteRevue": f["dWait"],
        "diffuses": f["dDiff"],
        "totalActifs": f["dTot"],
        "tauxDiffusion": f["dRate"],
    }


@pytest.mark.parametrize("norm", ["all", "45001"])
def test_risk_matrix(demo_data, norm):
    cells = metrics.dash_stat_sets(demo_data["db"], norm, TODAY)["risques"]["matrice"]
    got = [[c["probabilite"], c["impact"], c["risques"], c["opportunites"]] for c in cells]
    assert [c for c in got if c[2] or c[3]] == FRONT["matrix"][norm]
    assert len(cells) == 16


@pytest.mark.parametrize("norm", NORM_FILTERS)
def test_dash_proc_data(demo_data, norm):
    assert metrics.dash_proc_data(demo_data["db"], demo_data["users"], norm, TODAY) == FRONT[norm]["proc"]


def test_dash_proc_filters(demo_data):
    db, users = demo_data["db"], demo_data["users"]
    rows = metrics.dash_proc_data(db, users, "all", TODAY, proc="P05")
    assert [r["id"] for r in rows] == ["P05"]
    rows = metrics.dash_proc_data(db, users, "all", TODAY, direction="Direction Industrielle")
    assert [r["id"] for r in rows] == ["P04", "P05", "P09"]


def test_alerts_pending_upcoming(demo_data):
    db = demo_data["db"]
    assert metrics.compute_alerts(db, TODAY) == FRONT["alerts"]
    assert metrics.pending_validations(db) == FRONT["pending"]
    assert metrics.upcoming(db, TODAY) == FRONT["upcoming"]


def test_dates_like_front():
    assert metrics.fd("2026-09-21") == "21 sept. 2026" and metrics.fd("2026-08-01") == "1 août 2026"
    assert metrics.fd("—") == "—" and metrics.fd("à définir") == "à définir"
    assert metrics.days("2026-10-01", TODAY) == 10 and metrics.days("—", TODAY) is None
    assert metrics.js_str(60.0) == "60" and metrics.js_str(11.2) == "11.2"


# ---------- Endpoints ----------


def test_dashboard_endpoint(api, demo_data):
    r = api.get("/api/v1/dashboard/?today=2026-09-21")
    assert r.status_code == 200, r.content
    body = r.json()
    expected = metrics.dashboard(
        available_db(demo_data["db"]), list(demo_data["norms"]), demo_data["users"], "all", TODAY
    )
    assert body == json.loads(json.dumps(expected))
    # Valeurs qui ne dépendent que des collections du lot D : identiques au front.
    assert body["couverture"] == FRONT["all"]["cov"] == 81
    assert body["couvertureParNorme"] == FRONT["covByNorm"]
    assert body["statistiques"]["nc"]["parCategorie"] == FRONT["all"]["stats"]["ncCat"]
    assert body["statistiques"]["audits"]["tauxClotureActions"] == FRONT["all"]["stats"]["regRate"]
    assert body["actionsAmelioration"]["mois"]["totalClotures"] == 66
    assert body["actionsAmelioration"]["an"]["totalClotures"] == 407
    assert body["actionsAmelioration"]["mois"]["labels"] == demo_data["db"]["cloturesMois"]["labels"]
    if all_registered():
        assert body["actions"] == {"enCours": FRONT["all"]["acts"], "enRetard": FRONT["all"]["late"]}
        assert body["alertes"]["total"] == len(FRONT["alerts"])
        assert body["parProcessus"] == FRONT["all"]["proc"]
        assert body["echeances"] == FRONT["upcoming"]


def test_dashboard_endpoint_filters(api, demo_data):
    body = api.get("/api/v1/dashboard/?today=2026-09-21&norme=45001&dir=Direction Industrielle").json()
    expected = metrics.dashboard(
        available_db(demo_data["db"]),
        list(demo_data["norms"]),
        demo_data["users"],
        "45001",
        TODAY,
        direction="Direction Industrielle",
    )
    assert body == json.loads(json.dumps(expected))
    assert body["norme"] == "45001" and body["couverture"] == FRONT["45001"]["cov"]
    assert {r["dir"] for r in body["parProcessus"]} <= {"Direction Industrielle"}


def test_dashboard_bad_params(api):
    assert api.get("/api/v1/dashboard/?norme=9999").status_code == 400
    assert api.get("/api/v1/dashboard/?today=21/09/2026").status_code == 400


def test_dashboard_defaults_to_real_today(api, api_collab):
    body = api_collab.get("/api/v1/dashboard/").json()
    assert body["date"] == timezone.localdate().isoformat() and body["norme"] == "all"


def test_alerts_endpoint(api, api_collab, demo_data):
    r = api_collab.get("/api/v1/alerts/?today=2026-09-21")
    assert r.status_code == 200
    body = r.json()
    db = available_db(demo_data["db"])
    assert body["alertes"] == metrics.compute_alerts(db, TODAY)
    assert body["validations"] == metrics.pending_validations(db)
    assert body["total"] == len(body["alertes"])
    assert body["critiques"] == sum(1 for a in body["alertes"] if a["lvl"] == "red")
    # Alertes du module 6 : identiques au front.
    m6 = [a for a in FRONT["alerts"] if a["page"].startswith("m6-")]
    assert [a for a in body["alertes"] if a["page"].startswith("m6-")] == m6
    assert len(m6) == 7
    if all_registered():
        assert body["alertes"] == FRONT["alerts"] and body["validations"] == FRONT["pending"]
    # Une semaine plus tard, l'audit AUD-2026-04 reste à venir mais la NC validée disparaît.
    api.post("/api/v1/ncs/NC4/valider-pilote/")
    later = api.get("/api/v1/alerts/?today=2026-09-28").json()["alertes"]
    assert [a["d"][:11] for a in later if a["t"] == "Non-conformité à valider"] == ["NC-2026-024"]


def test_alerts_anonymous():
    from rest_framework.test import APIClient

    assert APIClient().get("/api/v1/alerts/").status_code == 401


# ---------- Collections ----------


def test_mapping_crud_and_filters(api, api_collab, demo_data):
    rows = api.get("/api/v1/mapping/?norme=27001").json()
    assert rows and {r["norme"] for r in rows} == {"27001"}
    assert len(rows) == sum(1 for m in demo_data["db"]["mapping"] if m["norme"] == "27001")
    assert [r["id"] for r in api.get("/api/v1/mapping/?type=Spécifique").json()] == [
        m["id"] for m in demo_data["db"]["mapping"] if m["type"] == "Spécifique"
    ]
    row = {
        "norme": "27001",
        "version": "2022",
        "article": "A.5.7",
        "libelle": "Renseignements sur les menaces",
        "module": "3.4 Risques et opportunités",
        "type": "Spécifique",
        "preuve": "Veille sur les menaces",
        "couverture": 40,
    }
    r = api.post("/api/v1/mapping/", row, format="json")
    assert r.status_code == 201 and r.json()["id"].startswith("MP")
    assert api.post("/api/v1/mapping/", {**row, "couverture": 120}, format="json").status_code == 400
    assert api.post("/api/v1/mapping/", {**row, "norme": "50001"}, format="json").status_code == 400
    assert api.post("/api/v1/mapping/", {**row, "type": "Autre"}, format="json").status_code == 400
    assert api_collab.post("/api/v1/mapping/", row, format="json").status_code == 403
    # La couverture du tableau de bord suit la nouvelle exigence.
    assert api.get("/api/v1/dashboard/?norme=27001").json()["couverture"] != FRONT["27001"]["cov"]


@pytest.mark.parametrize("url,name", [("clotures-mois", "cloturesMois"), ("clotures-an", "cloturesAn")])
def test_clotures_singletons(api, api_collab, demo_data, url, name):
    r = api.get(f"/api/v1/{url}/")
    assert r.status_code == 200 and r.json() == demo_data["db"][name]
    ok = {"labels": ["Oct", "Nov"], "clotures": [3, 4], "ouvertures": [5, 6]}
    assert api.put(f"/api/v1/{url}/", ok, format="json").json() == ok
    assert api.patch(f"/api/v1/{url}/", {"clotures": [1]}, format="json").status_code == 400
    assert api.patch(f"/api/v1/{url}/", {"clotures": [1, -2]}, format="json").status_code == 400
    assert api.patch(f"/api/v1/{url}/", {"labels": [1, 2]}, format="json").status_code == 400
    assert api_collab.put(f"/api/v1/{url}/", ok, format="json").status_code == 403
