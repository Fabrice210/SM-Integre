"""Module 6 : CRUD, format du front et validations des collections."""

import pytest

from apps.core import registry
from apps.performance.models import SourcesNC

pytestmark = pytest.mark.django_db

KPI = {
    "kpi": "Consommation d'eau par tonne produite",
    "objectif": "—",
    "sens": "baisse",
    "cible": 4.5,
    "unite": "m³/t",
    "valeur": 5.2,
    "moyen": "Relevé mensuel des compteurs",
    "echeance": "2027-06-30",
    "processus": "P05",
    "responsable": "Serge KOUTON",
    "action": "Installer des compteurs divisionnaires",
}


def test_bootstrap_shapes(api, demo_data):
    db = api.get("/api/v1/bootstrap/").json()["db"]
    # sourcesNC est une simple liste de chaînes, comme dans le front.
    assert db["sourcesNC"] == demo_data["db"]["sourcesNC"]
    assert isinstance(db["sourcesNC"], list)
    assert db["statsSurv"] == demo_data["db"]["statsSurv"]
    # Nombres rendus comme le front (90 et non 90.0) ; champs absents non émis.
    assert db["indicateurs"][0]["cible"] == 90 and isinstance(db["indicateurs"][0]["cible"], int)
    assert "efficacite" not in db["ncs"][0] and "compteRendu" not in db["audits"][0]


def test_indicateur_crud(api):
    r = api.post("/api/v1/indicateurs/", KPI, format="json")
    assert r.status_code == 201, r.content
    body = r.json()
    assert body["id"].startswith("KP") and body["cible"] == 4.5 and body["valeur"] == 5.2
    uid = body["id"]
    r = api.patch(f"/api/v1/indicateurs/{uid}/", {"valeur": 4}, format="json")
    assert r.json()["valeur"] == 4
    assert api.get("/api/v1/indicateurs/?processus=P05").json()[-1]["id"] == uid
    assert api.delete(f"/api/v1/indicateurs/{uid}/").status_code == 204


@pytest.mark.parametrize(
    "patch",
    [{"processus": "P99"}, {"sens": "stable"}, {"echeance": "—"}, {"cible": "beaucoup"}],
)
def test_indicateur_validation(api, patch):
    assert api.post("/api/v1/indicateurs/", {**KPI, **patch}, format="json").status_code == 400


def test_indicateur_objectif_reference(api):
    r = api.post("/api/v1/indicateurs/", {**KPI, "objectif": "OB-99"}, format="json")
    try:
        registry.get("objectifs")
    except KeyError:
        assert r.status_code == 201  # collection objectifs pas encore disponible : non vérifié
    else:
        assert r.status_code == 400


def test_prestataire_notes_validation(api):
    base = {
        "nom": "SOBEPRAN Emballages",
        "categorie": "Critique",
        "debut": "2024-05-01",
        "frequence": "Semestrielle",
        "processus": "P05",
        "responsable": "Aïcha BIO SIKA",
        "champ": "Conformité des sachets sous vide",
        "notes": {"qualite": 3, "delai": 3, "securite": 3, "environnement": 3},
    }
    r = api.post("/api/v1/prestataires/", base, format="json")
    assert r.status_code == 201 and r.json()["id"].startswith("EX")
    for notes in ({"qualite": 6, "delai": 3, "securite": 3, "environnement": 3}, {"qualite": 3}, {"prix": 3}):
        assert api.post("/api/v1/prestataires/", {**base, "notes": notes}, format="json").status_code == 400
    assert api.post("/api/v1/prestataires/", {**base, "categorie": "Autre"}, format="json").status_code == 400


def test_stats_surv_singleton(api):
    r = api.patch("/api/v1/stats-surv/", {"incidents": [1, 2]}, format="json")
    assert r.status_code == 400  # longueur différente des mois
    series = {"mois": ["Oct"], "incidents": [0], "dysfonctionnements": [2], "dechets": [12.5]}
    r = api.put("/api/v1/stats-surv/", series, format="json")
    assert r.status_code == 200 and r.json() == series


def test_sources_nc_list(api, api_collab, demo_data):
    r = api.get("/api/v1/sources-nc/")
    assert r.status_code == 200 and r.json() == demo_data["db"]["sourcesNC"]
    nouvelles = [*demo_data["db"]["sourcesNC"], "Inspection de l'ABE"]
    r = api.put("/api/v1/sources-nc/", nouvelles, format="json")
    assert r.status_code == 200 and r.json() == nouvelles
    assert api.get("/api/v1/bootstrap/").json()["db"]["sourcesNC"] == nouvelles
    for bad in ({"a": 1}, ["Audit", ""], ["Audit", "Audit"], [1]):
        assert api.put("/api/v1/sources-nc/", bad, format="json").status_code == 400
    assert api_collab.put("/api/v1/sources-nc/", nouvelles, format="json").status_code == 403


def test_auditeur_and_audit_validation(api):
    r = api.post(
        "/api/v1/auditeurs/",
        {
            "nom": "Hervé DJOSSOU",
            "qualification": "Auditeur interne ISO 27001",
            "normes": ["27001"],
            "disponibilite": "Disponible au 1er semestre 2027",
            "independance": "Ne peut pas auditer P10",
        },
        format="json",
    )
    assert r.status_code == 201 and r.json()["id"].startswith("AU")
    audit = {
        "ref": "AUD-2027-01",
        "titre": "Audit processus Commercialisation & export",
        "date": "2027-02-10",
        "perimetre": "P06",
        "auditeur": "Nadège ZINSOU",
        "normes": ["9001", "27001"],
    }
    r = api.post("/api/v1/audits/", audit, format="json")
    assert r.status_code == 201, r.content
    body = r.json()
    assert body["id"].startswith("A") and body["statut"] == "Planifié"
    assert body["rapport"] == "—" and body["constats"] == []
    # Indépendance : Nadège ZINSOU « Ne peut pas auditer P02 ».
    r = api.post("/api/v1/audits/", {**audit, "perimetre": "P02"}, format="json")
    assert r.status_code == 400 and "indépendant" in r.json()["auditeur"][0]
    assert api.post("/api/v1/audits/", {**audit, "auditeur": "Inconnu"}, format="json").status_code == 400
    assert api.post("/api/v1/audits/", {**audit, "normes": ["9999"]}, format="json").status_code == 400
    bad = {**audit, "constats": [{"type": "Remarque", "description": "x", "processus": "P06"}]}
    assert api.post("/api/v1/audits/", bad, format="json").status_code == 400
    bad = {**audit, "constats": [{"type": "Observation", "description": "x", "processus": "P99"}]}
    assert api.post("/api/v1/audits/", bad, format="json").status_code == 400
    # Modification sans changer l'auditeur ni le périmètre : pas de nouveau contrôle.
    r = api.patch(f"/api/v1/audits/{body['id']}/", {"titre": "Renommé"}, format="json")
    assert r.status_code == 200


def test_revue_validation(api):
    revue = {
        "ref": "RP-2026-P05",
        "date": "2026-10-12",
        "type": "Revue de processus",
        "participants": "Direction, pilotes de processus, responsable SM",
        "normes": ["9001", "45001"],
        "ordreDuJour": "Performance du processus\nRésultats des audits\n",
        "rapportEntree": "TF1 = 11,2",
        "pv": "À rédiger en séance",
    }
    r = api.post("/api/v1/revues/", revue, format="json")
    assert r.status_code == 201, r.content
    body = r.json()
    assert body["ordreDuJour"] == ["Performance du processus", "Résultats des audits"]
    assert body["statut"] == "Préparée" and body["actions"] == []
    bad = {
        **revue,
        "actions": [{"libelle": "x", "responsable": "y", "echeance": "bientôt", "statut": "En cours"}],
    }
    assert api.post("/api/v1/revues/", bad, format="json").status_code == 400
    bad = {**revue, "actions": [{"libelle": "x", "echeance": "2026-12-01", "statut": "Fini"}]}
    assert api.post("/api/v1/revues/", bad, format="json").status_code == 400
    assert api.post("/api/v1/revues/", {**revue, "type": "Réunion"}, format="json").status_code == 400


def test_nc_validation(api):
    nc = {
        "categorie": "Non-conformité",
        "source": "Terrain",
        "description": "Palettes stockées au sol",
        "typeActe": "Conformité",
        "processus": "P04",
        "lieu": "Magasin — zone B",
        "date": "2026-09-21",
        "normes": ["9001"],
        "cause": "Manque de palettes",
        "action": "Commander 150 palettes",
    }
    assert api.post("/api/v1/ncs/", {**nc, "source": "Rumeur"}, format="json").status_code == 400
    assert api.post("/api/v1/ncs/", {**nc, "processus": "P99"}, format="json").status_code == 400
    assert api.post("/api/v1/ncs/", {**nc, "statut": "Ouverte"}, format="json").status_code == 400
    r = api.post("/api/v1/ncs/", {**nc, "categorie": "Accident / incident"}, format="json")
    assert r.status_code == 201
    assert r.json()["ref"].endswith("-033") and r.json()["ref"].startswith("INC-")


def test_registre_filters(api):
    rows = api.get("/api/v1/registre/?statut=Clôturé").json()
    assert [r["id"] for r in rows] == ["RG3", "RG5", "RG6", "RG7"]
    rows = api.get("/api/v1/registre/?norme=27001").json()
    assert [r["id"] for r in rows] == ["RG4"]


def test_collaborateur_read_only(api_collab):
    assert api_collab.get("/api/v1/audits/").status_code == 200
    assert api_collab.post("/api/v1/indicateurs/", KPI, format="json").status_code == 403
    assert api_collab.patch("/api/v1/ncs/NC4/", {"lieu": "x"}, format="json").status_code == 403
    assert api_collab.delete("/api/v1/registre/RG1/").status_code == 403


def test_sources_nc_default_is_empty(demo_org):
    from apps.core.models import Organisation

    org = Organisation.objects.create(nom="Vide")
    obj, _ = SourcesNC.objects.get_or_create(organisation=org)
    assert registry.get("sourcesNC").serializer(obj, context={"organisation": org}).data == []
