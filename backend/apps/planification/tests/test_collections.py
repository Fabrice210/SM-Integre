"""CRUD et validations des collections du module 3."""

import pytest

from apps.core import registry

pytestmark = pytest.mark.django_db

OBJ = {
    "code": "OB-05",
    "axe": "AX3",
    "libelle": "Réduire de 15 % la consommation d'eau par tonne produite",
    "kpi": "m³ d'eau par tonne de produit fini",
    "cible": "-15 % vs 2025",
    "delai": "2027-06-30",
    "efficacite": "Non évaluée",
    "processus": ["P05", "P09"],
    "normes": ["14001"],
    "actions": [],
}

RISQUE = {
    "intitule": "Électrisation lors d'interventions sur les armoires électriques",
    "type": "SST",
    "normes": ["45001"],
    "cause": "Consignation non systématique",
    "consequences": "Brûlures graves, décès",
    "probabilite": 2,
    "criticite": 4,
    "traitement": "Réduire",
    "processus": ["P09"],
    "action": "Former aux habilitations électriques et imposer la consignation",
    "responsable": "Bertin SOSSA",
    "echeance": "2026-11-05",
    "statutAction": "Mise en œuvre",
    "efficacite": "À évaluer",
    "realise": False,
}


def test_lists_match_demo(api, demo_data):
    for url, name in [
        ("objectifs", "objectifs"),
        ("textes", "textes"),
        ("declarations", "declarations"),
        ("risques", "risques"),
        ("opportunites", "opportunites"),
        ("fiches-maitrise", "fichesMaitrise"),
        ("rapports-conf", "rapportsConf"),
    ]:
        r = api.get(f"/api/v1/{url}/")
        assert r.status_code == 200, url
        assert r.json() == demo_data["db"][name], url


def test_detail_by_front_id(api):
    r = api.get("/api/v1/declarations/DC1/")
    assert r.status_code == 200
    assert r.json()["commentaireDG"] == "En attente de décision du Directeur Général"


# ---------- Objectifs ----------


def test_objectif_crud(api):
    r = api.post("/api/v1/objectifs/", OBJ, format="json")
    assert r.status_code == 201, r.content
    body = r.json()
    assert body["id"].startswith("OB") and body["actions"] == []
    r = api.patch(f"/api/v1/objectifs/{body['id']}/", {"efficacite": "Efficace"}, format="json")
    assert r.json()["efficacite"] == "Efficace"
    assert api.delete(f"/api/v1/objectifs/{body['id']}/").status_code == 204


def test_objectif_axe_ref(api):
    """axe -> db.axes (Lot A) : validée quand la collection est enregistrée, ignorée sinon."""
    registered = "axes" in {c.name for c in registry.all_collections()}
    r = api.post("/api/v1/objectifs/", {**OBJ, "axe": "AX99"}, format="json")
    if registered:
        assert r.status_code == 400 and "axe" in r.json()
        assert api.post("/api/v1/objectifs/", OBJ, format="json").status_code == 201
    else:
        assert r.status_code == 201, r.content


@pytest.mark.parametrize(
    "patch,field",
    [
        ({"processus": ["P99"]}, "processus"),
        ({"processus": []}, "processus"),
        ({"normes": []}, "normes"),
        ({"normes": ["9999"]}, "normes"),
        ({"efficacite": "Bof"}, "efficacite"),
        ({"delai": "—"}, "delai"),
        ({"actions": [{"libelle": "X", "echeance": "2026-10-01", "statut": "Fini"}]}, "actions"),
        ({"actions": [{"libelle": "X", "echeance": "2026-10-01", "statut": "En cours", "z": 1}]}, "actions"),
        ({"actions": [{"libelle": "X", "statut": "En cours"}]}, "actions"),
        ({"actions": [{"libelle": "X", "echeance": "31/12/2026", "statut": "En cours"}]}, "actions"),
        ({"actions": "x"}, "actions"),
    ],
)
def test_objectif_validation(api, patch, field):
    r = api.post("/api/v1/objectifs/", {**OBJ, "axe": "", **patch}, format="json")
    assert r.status_code == 400
    assert field in r.json()


def test_objectif_valid_actions(api):
    actions = [
        {
            "libelle": "Installer des compteurs",
            "responsable": "Bertin SOSSA",
            "echeance": "2026-11-20",
            "statut": "Mise en œuvre",
            "pieces": "Devis.pdf",
            "observation": "Devis demandé",
        }
    ]
    r = api.post("/api/v1/objectifs/", {**OBJ, "axe": "", "actions": actions}, format="json")
    assert r.status_code == 201, r.content
    assert r.json()["actions"] == actions


def test_objectif_action_linked_to_partie(api):
    """planEngagementAction() : l'action porte l'id de la partie intéressée suivie (`pi`)."""
    action = {
        "libelle": "Plan d'engagement — Clients export",
        "responsable": "Florence DOSSOU-YOVO",
        "echeance": "2026-12-26",
        "statut": "En cours",
        "observation": "Revue trimestrielle",
        "pi": "PI2",
    }
    obj = {**OBJ, "id": "OB-PI", "code": "OB-PI", "axe": "AX1", "actions": [action]}
    r = api.post("/api/v1/objectifs/", obj, format="json")
    assert r.status_code == 201, r.content
    assert r.json()["actions"] == [action]
    bad = {**action, "pi": 2}
    r = api.put("/api/v1/objectifs/OB-PI/", {**obj, "actions": [bad]}, format="json")
    assert r.status_code == 400


def test_norme_filter(api):
    rows = api.get("/api/v1/objectifs/?norme=27001").json()
    assert [r["id"] for r in rows] == ["OB4"]


# ---------- Veille ----------


def test_texte_validation_and_search(api):
    r = api.post(
        "/api/v1/textes/",
        {
            "intitule": "Arrêté fixant les normes de rejet",
            "categorie": "Arrêté",
            "domaine": "Environnement",
            "datePublication": "2021-06-15",
            "lien": "https://sgg.gouv.bj",
            "statut": "Pas fait",
            "justificatif": "Analyse à programmer",
            "pieces": "Devis.pdf",
            "echeance": "2026-11-05",
            "responsable": "Arnaud TCHIBOZO",
            "normes": ["14001"],
        },
        format="json",
    )
    assert r.status_code == 201, r.content
    body = r.json()
    assert body["id"].startswith("TX")
    assert "diffuse" not in body and "statutDiff" not in body  # absents tant que non diffusé
    bad = api.patch(f"/api/v1/textes/{body['id']}/", {"statut": "Conforme"}, format="json")
    assert bad.status_code == 400
    assert [t["id"] for t in api.get("/api/v1/textes/?statut=Pas+fait").json()] == ["TX3", "TX5", body["id"]]
    assert [t["id"] for t in api.get("/api/v1/textes/?search=numérique").json()] == ["TX3"]


def test_declaration_defaults_and_refs(api):
    r = api.post(
        "/api/v1/declarations/",
        {"texte": "TX3", "objet": "Registre incomplet", "cause": "c", "impact": "i", "planAction": "p"},
        format="json",
    )
    assert r.status_code == 201, r.content
    body = r.json()
    assert body["id"].startswith("DC")
    assert body["statut"] == "Brouillon"
    assert body["auteur"] == "Florence DOSSOU-YOVO"
    assert body["commentaireDG"] == "Non soumise"
    assert len(body["date"]) == 10
    r = api.post(
        "/api/v1/declarations/",
        {"texte": "TX99", "objet": "x", "cause": "c", "impact": "i", "planAction": "p"},
        format="json",
    )
    assert r.status_code == 400 and "texte" in r.json()


def test_declaration_decision_reserved_to_dg(api, api_dg):
    r = api.patch("/api/v1/declarations/DC1/", {"statut": "Validée"}, format="json")
    assert r.status_code == 403
    r = api.patch("/api/v1/declarations/DC1/", {"commentaireDG": "Relancé"}, format="json")
    assert r.status_code == 200 and r.json()["commentaireDG"] == "Relancé"
    r = api_dg.patch("/api/v1/declarations/DC1/", {"statut": "Validée"}, format="json")
    assert r.status_code == 200 and r.json()["statut"] == "Validée"


def test_rapport_defaults_from_texte(api):
    r = api.post("/api/v1/rapports-conf/", {"texte": "TX5", "date": "2026-10-01"}, format="json")
    assert r.status_code == 201, r.content
    body = r.json()
    assert body["ref"] == "RC-2026-003"
    assert body["statut"] == "Non conforme"
    assert body["titre"].startswith("Rapport de conformité — Décret n°2003-332")
    assert body["synthese"] == "Bordereaux de suivi des déchets incomplets pour le 2e trimestre"
    assert body["pieces"] == "Bordereaux_dechets_T2.pdf"
    assert body["auteur"] == "Florence DOSSOU-YOVO"
    r = api.post(
        "/api/v1/rapports-conf/",
        {
            "texte": "TX1",
            "titre": "Mon rapport",
            "statut": "En cours",
            "date": "2026-10-02",
            "synthese": "s",
            "pieces": "p.pdf",
        },
        format="json",
    )
    assert r.json()["statut"] == "En cours" and r.json()["titre"] == "Mon rapport"
    assert r.json()["ref"] == "RC-2026-004"
    r = api.post("/api/v1/rapports-conf/", {"texte": "TX99", "titre": "x"}, format="json")
    assert r.status_code == 400 and "texte" in r.json()


# ---------- Risques et opportunités ----------


def test_risque_sequential_id_and_validation(api):
    r = api.post("/api/v1/risques/", RISQUE, format="json")
    assert r.status_code == 201, r.content
    assert r.json()["id"] == "R08"
    for patch, field in [
        ({"probabilite": 5}, "probabilite"),
        ({"criticite": 0}, "criticite"),
        ({"processus": ["P99"]}, "processus"),
        ({"type": "Financier"}, "type"),
        ({"statutAction": "Terminé"}, "statutAction"),
        ({"echeance": "—"}, "echeance"),
    ]:
        bad = api.post("/api/v1/risques/", {**RISQUE, **patch}, format="json")
        assert bad.status_code == 400 and field in bad.json(), patch
    rows = api.get("/api/v1/risques/?type=SST").json()
    assert [x["id"] for x in rows] == ["R01", "R08"]


def test_opportunite_sequential_id_and_type(api):
    data = {
        "intitule": "Panneaux solaires",
        "type": "Environnement",
        "normes": ["14001"],
        "origine": "Programme national",
        "benefices": "-20 % facture",
        "probabilite": 3,
        "impact": 3,
        "exploitation": "Subvention",
        "processus": ["P09"],
        "action": "Étude",
        "responsable": "Bertin SOSSA",
        "echeance": "2026-12-20",
        "statutAction": "Mise en œuvre",
        "efficacite": "À évaluer",
    }
    r = api.post("/api/v1/opportunites/", data, format="json")
    assert r.status_code == 201, r.content
    assert r.json()["id"] == "O04"
    assert "realise" not in r.json()
    bad = api.post("/api/v1/opportunites/", {**data, "type": "Situation d'urgence"}, format="json")
    assert bad.status_code == 400 and "type" in bad.json()
    bad = api.post("/api/v1/opportunites/", {**data, "impact": 7}, format="json")
    assert bad.status_code == 400 and "impact" in bad.json()


def test_fiche_maitrise_refs(api):
    data = {
        "objet": "Pasteurisation du jus d'ananas",
        "processus": "P05",
        "responsable": "Serge KOUTON",
        "criteres": "≥ 85 °C",
        "moyens": "Thermographe",
        "ressources": "Pasteurisateur",
        "risques": ["R02"],
        "derniereMaj": "2026-09-21",
        "prochaineMaj": "2027-09-21",
    }
    r = api.post("/api/v1/fiches-maitrise/", data, format="json")
    assert r.status_code == 201, r.content
    assert r.json()["id"].startswith("FM")
    for patch, field in [
        ({"risques": ["R99"]}, "risques"),
        ({"processus": "P99"}, "processus"),
        ({"risques": []}, "risques"),
    ]:
        bad = api.post("/api/v1/fiches-maitrise/", {**data, **patch}, format="json")
        assert bad.status_code == 400 and field in bad.json(), patch


# ---------- Droits ----------


def test_collaborateur_read_only(api_collab):
    assert api_collab.get("/api/v1/risques/").status_code == 200
    assert api_collab.post("/api/v1/risques/", RISQUE, format="json").status_code == 403
    assert api_collab.patch("/api/v1/textes/TX1/", {"statut": "Pas fait"}, format="json").status_code == 403
    assert api_collab.delete("/api/v1/objectifs/OB1/").status_code == 403
