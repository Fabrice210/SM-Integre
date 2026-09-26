import pytest

from apps.core.models import JournalEntry
from apps.support.common import today

pytestmark = pytest.mark.django_db

URL = "/api/v1/ressources/"
NEW = {
    "besoin": "Groupe électrogène de secours 250 kVA",
    "type": "Matérielle",
    "processus": "P09",
    "disponible": "Groupe 100 kVA vieillissant",
    "montant": 38000000,
    "justification": "Délestages fréquents",
    "circuit": "Finance",
    "dateDemandee": "2026-12-05",
}


def test_create_defaults(api):
    r = api.post(URL, NEW, format="json")
    assert r.status_code == 201, r.content
    body = r.json()
    assert body["id"].startswith("RS")
    assert body["statut"] == "Brouillon"
    assert body["dateReelle"] == "—"
    assert body["demandeur"] == "Florence DOSSOU-YOVO"
    assert api.get(f"{URL}{body['id']}/").json()["besoin"] == NEW["besoin"]


@pytest.mark.parametrize(
    "patch",
    [
        {"processus": "P99"},
        {"type": "Immatérielle"},
        {"circuit": "Direction"},
        {"montant": -1},
        {"dateReelle": "25/08/2026"},
        {"dateDemandee": "—"},
        {"demandeur": "Personne INCONNUE"},
    ],
)
def test_validation(api, patch):
    assert api.post(URL, {**NEW, **patch}, format="json").status_code == 400


def test_filters(api):
    rows = api.get(URL, {"statut": "Validée"}).json()
    assert {r["id"] for r in rows} == {"RS2", "RS4"}


def test_full_workflow(api, client_for):
    uid = api.post(URL, {**NEW, "demandeur": "Bertin SOSSA"}, format="json").json()["id"]
    bertin = client_for("Bertin SOSSA")
    r = bertin.post(f"{URL}{uid}/soumettre/")
    assert r.status_code == 200, r.content
    assert r.json()["statut"] == "Soumise"
    assert r.json()["hist"][0]["a"] == "Soumise au circuit Finance"
    # Le demandeur ne valide pas sa propre demande ; un pilote hors circuit non plus.
    assert bertin.post(f"{URL}{uid}/valider/").status_code == 403
    assert client_for("Serge KOUTON").post(f"{URL}{uid}/valider/").status_code == 403
    # La direction financière valide le circuit Finance.
    r = client_for("Carine AKPLOGAN").post(f"{URL}{uid}/valider/")
    assert r.status_code == 200, r.content
    assert r.json()["statut"] == "Validée"
    assert JournalEntry.objects.filter(a=f"Validée par le circuit Finance : {NEW['besoin']}").exists()
    r = bertin.post(f"{URL}{uid}/mise-a-disposition/")
    assert r.json()["statut"] == "Mise à disposition"
    assert r.json()["dateReelle"] == today().isoformat()
    assert len(r.json()["hist"]) == 3


def test_refus_then_resubmit(api, client_for):
    rh = client_for("Gildas HOUNKPATIN")  # Direction des Ressources Humaines
    uid = api.post(URL, {**NEW, "circuit": "RH"}, format="json").json()["id"]
    api.post(f"{URL}{uid}/soumettre/")
    r = rh.post(f"{URL}{uid}/refuser/", {"motif": "Budget épuisé"}, format="json")
    assert r.json()["statut"] == "Refusée"
    assert "Budget épuisé" in r.json()["hist"][0]["a"]
    assert api.post(f"{URL}{uid}/soumettre/").json()["statut"] == "Soumise"


def test_invalid_transitions(api):
    assert api.post(f"{URL}RS3/valider/").status_code == 409  # déjà mise à disposition
    assert api.post(f"{URL}RS1/mise-a-disposition/").status_code == 409  # pas encore validée
    assert api.post(f"{URL}RS2/soumettre/").status_code == 409


def test_collaborateur_rights(api, api_collab):
    assert api_collab.post(URL, NEW, format="json").status_code == 403
    mine = api.post(URL, {**NEW, "demandeur": "Prisca ASSOGBA"}, format="json").json()["id"]
    other = api.post(URL, NEW, format="json").json()["id"]
    assert api_collab.post(f"{URL}{mine}/soumettre/").status_code == 200
    assert api_collab.post(f"{URL}{other}/soumettre/").status_code == 403


def test_status_change_by_update_checks_validator(client_for):
    serge = client_for("Serge KOUTON")
    assert serge.patch(f"{URL}RS1/", {"statut": "Validée"}, format="json").status_code == 403
    r = client_for("Carine AKPLOGAN").patch(f"{URL}RS1/", {"statut": "Validée"}, format="json")
    assert r.status_code == 200
    assert serge.post(URL, {**NEW, "statut": "Validée"}, format="json").status_code == 403
