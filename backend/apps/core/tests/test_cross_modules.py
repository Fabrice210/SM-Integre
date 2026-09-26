"""
Workflows qui écrivent dans les collections d'autres modules, testés avec les vrais
modèles (les tests de chaque lot les simulent) : veille -> NC + registre, risque
réalisé -> registre, NC approuvée -> registre.
"""

import pytest
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_dg(demo_org):
    c = APIClient()
    c.force_authenticate(demo_org.users.get(email="r.ahouansou@agrobenin.bj"))
    return c


def _ids(api, url):
    return [r["id"] for r in api.get(url).json()]


def test_declaration_validated_creates_nc_and_registre(api, api_dg):
    ncs, reg = _ids(api, "/api/v1/ncs/"), _ids(api, "/api/v1/registre/")
    r = api_dg.post("/api/v1/declarations/DC1/decision/", {"decision": "valider"}, format="json")
    assert r.status_code == 200, r.content
    new_ncs = [x for x in api.get("/api/v1/ncs/").json() if x["id"] not in ncs]
    new_reg = [x for x in api.get("/api/v1/registre/").json() if x["id"] not in reg]
    assert len(new_ncs) == 1 and len(new_reg) == 1
    assert new_ncs[0]["ref"].startswith("NC-")
    # l'état complet reste lisible par le front
    assert api.get("/api/v1/bootstrap/").status_code == 200


def test_risk_realised_creates_registre(api):
    before = _ids(api, "/api/v1/registre/")
    assert api.post("/api/v1/risques/R03/realise/").status_code == 200
    rows = api.get("/api/v1/registre/").json()
    new = [x for x in rows if x["id"] not in before]
    assert len(new) == 1
    assert new[0]["origine"] == "Risque R03"
    assert rows[0]["id"] == new[0]["id"]  # en tête, comme unshift() du front


def test_dashboard_and_alerts_on_full_demo(api):
    d = api.get("/api/v1/dashboard/?today=2026-09-21")
    a = api.get("/api/v1/alerts/?today=2026-09-21")
    assert d.status_code == 200 and a.status_code == 200
