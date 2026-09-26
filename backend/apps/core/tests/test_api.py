import pytest
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


def test_login_by_email(demo_org):
    c = APIClient()
    r = c.post("/api/v1/auth/login/", {"email": "f.dossou-yovo@agrobenin.bj", "password": "Test-pass-123!"})
    assert r.status_code == 200, r.content
    body = r.json()
    assert body["access"] and body["refresh"]
    assert body["user"]["id"] == "u1"
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {body['access']}")
    assert c.get("/api/v1/auth/me/").json()["nom"] == "Florence DOSSOU-YOVO"


def test_anonymous_denied():
    assert APIClient().get("/api/v1/bootstrap/").status_code == 401


def test_crud_generates_uid_and_logs(api):
    r = api.post(
        "/api/v1/processus/",
        {"code": "P13", "intitule": "Test", "categorie": "Support", "normes": ["9001"]},
        format="json",
    )
    assert r.status_code == 201, r.content
    uid = r.json()["id"]
    assert uid.startswith("P")
    r = api.patch(f"/api/v1/processus/{uid}/", {"intitule": "Renommé", "hist": [{"a": "x"}]}, format="json")
    assert r.json()["intitule"] == "Renommé"
    assert r.json()["hist"] == [{"a": "x"}]  # clé inconnue conservée dans extra
    assert api.delete(f"/api/v1/processus/{uid}/").status_code == 204
    from apps.core.models import AuditLog

    assert AuditLog.objects.filter(uid=uid).count() == 3


def test_norme_filter(api):
    rows = api.get("/api/v1/processus/?norme=27001").json()
    assert rows and all("27001" in r["normes"] for r in rows)


def test_invalid_norme_rejected(api):
    r = api.post(
        "/api/v1/processus/",
        {"code": "X", "intitule": "X", "categorie": "Support", "normes": ["9999"]},
        format="json",
    )
    assert r.status_code == 400


def test_collaborateur_read_only(api_collab):
    assert api_collab.get("/api/v1/processus/").status_code == 200
    r = api_collab.post(
        "/api/v1/processus/", {"code": "X", "intitule": "X", "categorie": "Support"}, format="json"
    )
    assert r.status_code == 403


def test_org_isolation(api, demo_data):
    from apps.core.demo import load_demo

    demo_data = {
        **demo_data,
        "org": {**demo_data["org"], "nom": "Autre"},
        "users": [{**u, "email": "autre." + u["email"]} for u in demo_data["users"]],
    }
    other = load_demo(demo_data, password="Test-pass-123!")
    assert other.pk != api.user.organisation_id
    assert len(api.get("/api/v1/processus/").json()) == 12


def test_journal_append_only(api):
    r = api.post(
        "/api/v1/journal/",
        {"d": "2026-09-26 10:00", "a": "test", "mod": "GED", "statut": "Terminé"},
        format="json",
    )
    assert r.status_code == 201
    assert r.json()["u"] == "Florence DOSSOU-YOVO"
    assert api.get("/api/v1/journal/").json()[0]["a"] == "test"


def test_validation_errors_use_front_field_names(api):
    r = api.post("/api/v1/processus/", {"id": "P01", "code": "X", "intitule": "X"}, format="json")
    assert r.status_code == 400
    assert set(r.json()) == {"id", "categorie"}
