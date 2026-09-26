import pytest

from apps.core.models import JournalEntry
from apps.support.common import today

pytestmark = pytest.mark.django_db

FORMATION = {
    "theme": "Conduite de chariot élévateur (CACES)",
    "date": "2026-10-21",
    "formateur": "Centre de formation professionnelle de Cotonou",
    "participants": "Magasiniers (8 pers.)",
    "statut": "Planifiée",
    "evaluationDate": "2026-11-20",
    "evaluationResponsable": "Nadège ZINSOU",
    "resultat": "À évaluer",
    "normes": ["45001"],
}
COMM = {
    "type": "Sensibilisation",
    "objectif": "Présenter le plan d'urgence incendie",
    "quiFait": "Arnaud TCHIBOZO",
    "portee": "Interne",
    "cible": "Nouveaux embauchés",
    "moyen": "Session d'accueil sécurité",
    "date": "2026-10-05",
    "statut": "Pas fait",
    "dateRealisation": "",
    "processus": "P11",
    "preuve": "Feuille_presence.pdf",
    "normes": ["45001", "14001"],
}


# ---------- Savoirs critiques ----------


def test_savoir_crud(api):
    r = api.post(
        "/api/v1/savoirs/",
        {
            "savoir": "Étalonnage",
            "detenteurs": "Nadège ZINSOU",
            "couverture": "1 détenteur",
            "criticite": "Critique",
        },
        format="json",
    )
    assert r.status_code == 201 and r.json()["id"].startswith("SC")
    assert (
        api.patch(f"/api/v1/savoirs/{r.json()['id']}/", {"criticite": "Moyen"}, format="json").status_code
        == 400
    )


def test_planifier_formation_from_savoir(api):
    r = api.post("/api/v1/savoirs/SC1/planifier-formation/", {"normes": ["9001", "45001"]}, format="json")
    assert r.status_code == 201, r.content
    f = r.json()
    assert f["id"].startswith("FO") and f["statut"] == "Planifiée"
    assert f["theme"] == "Réglage des décortiqueuses automatiques"
    assert f["participants"].startswith("À désigner — transfert de savoir depuis")
    assert f["normes"] == ["9001", "45001"]
    assert api.get(f"/api/v1/formations/{f['id']}/").status_code == 200
    assert api.post("/api/v1/savoirs/SC3/planifier-formation/").status_code == 400  # savoir couvert


# ---------- Formations ----------


def test_formation_crud_and_validation(api):
    r = api.post("/api/v1/formations/", FORMATION, format="json")
    assert r.status_code == 201, r.content
    assert r.json()["id"].startswith("FO")
    bad = {**FORMATION, "evaluationDate": "2026-10-01"}
    assert api.post("/api/v1/formations/", bad, format="json").status_code == 400
    assert (
        api.post("/api/v1/formations/", {**FORMATION, "normes": ["9999"]}, format="json").status_code == 400
    )
    assert (
        api.post("/api/v1/formations/", {**FORMATION, "statut": "Annulée"}, format="json").status_code == 400
    )
    rows = api.get("/api/v1/formations/", {"norme": "27001"}).json()
    assert [x["id"] for x in rows] == ["FO2"]


def test_evaluer(api, client_for):
    r = client_for("Nadège ZINSOU").post(
        "/api/v1/formations/FO2/evaluer/", {"resultat": "taux de clic 9 %", "niveau": 3}, format="json"
    )
    assert r.status_code == 200, r.content
    assert r.json()["resultat"] == "Niveau 3 Kirkpatrick : taux de clic 9 %"
    assert r.json()["hist"][0]["a"] == "Évaluation post-formation enregistrée"
    # Session pas encore réalisée
    assert api.post("/api/v1/formations/FO1/evaluer/", {"resultat": "x"}, format="json").status_code == 409
    # Évaluation avant la session
    r = api.post(
        "/api/v1/formations/FO2/evaluer/", {"resultat": "x", "evaluationDate": "2026-01-01"}, format="json"
    )
    assert r.status_code == 400


def test_evaluer_rights(api, api_collab):
    assert (
        api_collab.post("/api/v1/formations/FO2/evaluer/", {"resultat": "x"}, format="json").status_code
        == 403
    )
    api.patch("/api/v1/formations/FO2/", {"evaluationResponsable": "Prisca ASSOGBA"}, format="json")
    assert (
        api_collab.post("/api/v1/formations/FO2/evaluer/", {"resultat": "x"}, format="json").status_code
        == 200
    )


# ---------- Communication ----------


def test_communication_create_fait_sets_date(api):
    r = api.post("/api/v1/communications/", {**COMM, "statut": "Fait"}, format="json")
    assert r.status_code == 201, r.content
    assert r.json()["id"].startswith("CM")
    assert r.json()["dateRealisation"] == today().isoformat()


@pytest.mark.parametrize(
    "patch",
    [{"dateRealisation": "—"}, {"portee": "Mondiale"}, {"processus": "P99"}, {"quiFait": "Inconnu"}],
)
def test_communication_validation(api, patch):
    assert api.post("/api/v1/communications/", {**COMM, **patch}, format="json").status_code == 400


def test_realiser(api, client_for):
    r = client_for("Arnaud TCHIBOZO").post(
        "/api/v1/communications/CM3/realiser/",
        {"preuve": "Photo_CM3.jpg", "dateRealisation": "2026-09-20"},
        format="json",
    )
    assert r.status_code == 200, r.content
    body = r.json()
    assert (body["statut"], body["preuve"], body["dateRealisation"]) == (
        "Fait",
        "Photo_CM3.jpg",
        "2026-09-20",
    )
    assert body["hist"][0]["a"] == "Réalisée le 20 sept. 2026 — preuve jointe"
    assert JournalEntry.objects.filter(mod="Communication", a__startswith="a joint la preuve").exists()
    assert (
        api.post("/api/v1/communications/CM5/realiser/", {"preuve": "x.pdf"}, format="json").status_code
        == 400
    )


def test_realiser_rights(api_collab):
    r = api_collab.post(
        "/api/v1/communications/CM3/realiser/",
        {"preuve": "x.pdf", "dateRealisation": "2026-09-20"},
        format="json",
    )
    assert r.status_code == 403
