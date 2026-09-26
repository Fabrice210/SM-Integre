"""Actions métier du module 3 (reprises de src/features/m3-planification)."""

import datetime

import pytest

from apps.core.models import AuditLog, JournalEntry
from apps.planification import services
from apps.planification import viewsets as v
from apps.planification.models import Risque
from apps.planification.services import today

pytestmark = pytest.mark.django_db

ACTION = {
    "libelle": "Installer des compteurs d'eau divisionnaires",
    "responsable": "Bertin SOSSA",
    "echeance": "2026-11-20",
    "statut": "Mise en œuvre",
    "observation": "Devis demandé à deux fournisseurs",
}


def last_journal():
    return JournalEntry.objects.order_by("-id").first()


@pytest.fixture
def linked(monkeypatch):
    """Capture les créations dans les collections d'autres modules (ncs, registre)."""
    calls = []
    monkeypatch.setattr(v, "is_registered", lambda name: True)
    monkeypatch.setattr(v, "count_of", lambda name, org: 7)
    monkeypatch.setattr(
        v, "create_linked", lambda request, name, data, unshift=True: calls.append((name, data))
    )
    monkeypatch.setattr(v, "add_registre", lambda request, *args: calls.append(("registre", args)))
    return calls


# ---------- Objectifs ----------


def test_add_and_update_objective_action(api):
    r = api.post("/api/v1/objectifs/OB3/actions/", ACTION, format="json")
    assert r.status_code == 201, r.content
    body = r.json()
    assert len(body["actions"]) == 3 and body["actions"][-1] == ACTION
    assert body["hist"][0]["a"] == "Action ajoutée : " + ACTION["libelle"]
    assert body["hist"][0]["u"] == "Florence DOSSOU-YOVO"
    assert last_journal().a == "a mis à jour le plan d'action de OB-03"
    assert last_journal().mod == "Objectifs"

    r = api.patch("/api/v1/objectifs/OB3/actions/2/", {"statut": "Clôturé"}, format="json")
    assert r.status_code == 200, r.content
    assert r.json()["actions"][2] == {**ACTION, "statut": "Clôturé"}
    assert r.json()["hist"][0]["a"].startswith("Action modifiée")
    assert len(r.json()["hist"]) == 2

    # PUT remplace l'action : champs obligatoires requis
    assert (
        api.put("/api/v1/objectifs/OB3/actions/2/", {"statut": "Clôturé"}, format="json").status_code == 400
    )
    assert (
        api.patch("/api/v1/objectifs/OB3/actions/9/", {"statut": "Clôturé"}, format="json").status_code == 404
    )
    bad = api.post("/api/v1/objectifs/OB3/actions/", {**ACTION, "statut": "Fini"}, format="json")
    assert bad.status_code == 400
    assert AuditLog.objects.filter(collection="objectifs", uid="OB3", action="update").count() == 2


def test_objective_evaluation(api):
    r = api.post("/api/v1/objectifs/OB2/evaluation/", {"efficacite": "Efficace"}, format="json")
    assert r.status_code == 200
    assert r.json()["efficacite"] == "Efficace"
    assert r.json()["hist"][0]["a"] == "Efficacité évaluée : Efficace"
    assert last_journal().a == "a évalué l'efficacité de OB-02 : Efficace"
    # les valeurs d'un objectif ne sont pas celles d'un traitement de risque
    assert api.post("/api/v1/objectifs/OB2/evaluation/", {"efficacite": "À évaluer"}).status_code == 400
    r = api.post("/api/v1/risques/R02/evaluation/", {"efficacite": "Non efficace"}, format="json")
    assert r.status_code == 200 and r.json()["efficacite"] == "Non efficace"
    r = api.post("/api/v1/opportunites/O01/evaluation/", {"efficacite": "Efficace"}, format="json")
    assert r.status_code == 200 and r.json()["efficacite"] == "Efficace"


def test_objective_follow_up(api):
    rows = {r["id"]: r for r in api.get("/api/v1/objectifs/suivi/").json()}
    assert set(rows) == {"OB1", "OB2", "OB3", "OB4"}
    assert rows["OB1"]["avancement"] == pytest.approx(100 / 3)
    assert rows["OB3"]["avancement"] == 0
    assert isinstance(rows["OB2"]["enRetard"], bool)


def test_objective_progress_rules():
    acts = [
        {"statut": "Clôturé", "echeance": "2026-06-30"},
        {"statut": "En cours", "echeance": "2026-09-15"},
    ]
    assert services.objectif_avancement(acts) == 50
    assert services.objectif_avancement([]) == 0
    assert services.objectif_en_retard(acts, datetime.date(2026, 9, 21)) is True
    assert services.objectif_en_retard(acts, datetime.date(2026, 9, 1)) is False
    assert services.objectif_en_retard([{"statut": "En cours", "echeance": "—"}]) is False


def test_import_objectives(api):
    rows = [
        {
            "code": "OB-06",
            "libelle": "Atteindre 95 % de livraisons à l'heure",
            "kpi": "Taux de livraison à l'heure",
            "cible": "95 %",
            "delai": "2027-03-20",
            "processus": ["P07"],
            "normes": ["9001"],
        },
        {**OBJ_DUP},
    ]
    r = api.post("/api/v1/objectifs/import/", {"objectifs": rows}, format="json")
    assert r.status_code == 201, r.content
    body = r.json()
    assert body["importes"] == 1 and body["ignores"] == ["OB-01"]
    o = body["objectifs"][0]
    assert o["id"].startswith("OB") and o["importe"] is True and o["actions"] == []
    assert o["efficacite"] == "Non évaluée"
    assert last_journal().a == "a importé un tableau de bord des objectifs (1 objectif(s))"
    # ré-import : tout est ignoré
    r = api.post("/api/v1/objectifs/import/", {"objectifs": rows}, format="json")
    assert r.status_code == 200 and r.json()["importes"] == 0


def test_import_objectives_is_atomic(api):
    good = {**OBJ_DUP, "code": "OB-08"}
    bad = {**OBJ_DUP, "code": "OB-09", "processus": ["P99"]}
    r = api.post("/api/v1/objectifs/import/", {"objectifs": [good, bad]}, format="json")
    assert r.status_code == 400 and "1" in r.json()["lignes"]
    assert not api.get("/api/v1/objectifs/?search=OB-08").json()
    assert api.post("/api/v1/objectifs/import/", {"objectifs": []}, format="json").status_code == 400


OBJ_DUP = {
    "code": "OB-01",
    "libelle": "Doublon",
    "kpi": "k",
    "cible": "c",
    "delai": "2027-01-01",
    "processus": ["P05"],
    "normes": ["9001"],
}


# ---------- Fiches de maîtrise ----------


def test_fiche_periodic_update(api):
    r = api.post("/api/v1/fiches-maitrise/FM3/mettre-a-jour/")
    assert r.status_code == 200
    d = today()
    assert r.json()["derniereMaj"] == d.isoformat()
    assert r.json()["prochaineMaj"] == services.add_years(d, 1).isoformat()
    assert r.json()["hist"][0]["a"] == "Mise à jour périodique réalisée"
    assert last_journal().mod == "Maîtrise opérationnelle"


def test_add_years_leap_day():
    assert services.add_years(datetime.date(2028, 2, 29), 1) == datetime.date(2029, 3, 1)
    assert services.add_years(datetime.date(2026, 9, 21), 1) == datetime.date(2027, 9, 21)


# ---------- Veille ----------


def test_diffuse_text_to_process(api):
    r = api.post("/api/v1/textes/TX3/diffuser/", {"mode": "proc", "processus": "P10"}, format="json")
    assert r.status_code == 200, r.content
    body = r.json()
    proc = api.get("/api/v1/processus/P10/").json()
    cible = f"tous les intéressés du processus {proc['code']} · {proc['intitule']}"
    assert body["diffuse"] is True and body["statutDiff"] == "Diffusé"
    assert body["destinataireDiff"] == cible
    assert body["hist"][0]["a"] == "Texte diffusé à : " + cible
    assert last_journal().a.startswith("a diffusé le texte « Loi n°2017-20")


def test_diffuse_text_to_recipient(api):
    r = api.post(
        "/api/v1/textes/TX5/diffuser/", {"mode": "dest", "destinataire": "Agence ABE"}, format="json"
    )
    assert r.json()["destinataireDiff"] == "Agence ABE"
    r = api.post("/api/v1/textes/TX5/diffuser/", {"mode": "proc", "processus": "—"}, format="json")
    assert r.json()["destinataireDiff"] == "destinataire non précisé"
    assert api.post("/api/v1/textes/TX5/diffuser/", {"mode": "proc", "processus": "P99"}).status_code == 400
    assert api.post("/api/v1/textes/TX5/diffuser/", {"mode": "tous"}).status_code == 400


def test_qualify_emergency_creates_risk(api):
    r = api.post("/api/v1/textes/TX5/qualifier-urgence/")
    assert r.status_code == 201, r.content
    risk = r.json()
    assert risk["id"] == "R08"
    assert risk["type"] == "Situation d'urgence"
    assert risk["intitule"].startswith("Situation d'urgence liée à : Décret n°2003-332")
    assert risk["normes"] == ["14001"] and risk["responsable"] == "Arnaud TCHIBOZO"
    assert risk["probabilite"] == 2 and risk["criticite"] == 4 and risk["processus"] == ["P11"]
    assert risk["echeance"] == (today() + datetime.timedelta(days=60)).isoformat()
    assert risk["hist"][0]["a"] == "Qualifié en situation d'urgence depuis le registre de veille"
    assert api.get("/api/v1/risques/").json()[-1]["id"] == "R08"


def test_declaration_workflow(api, api_dg, linked):
    # DC1 est déjà soumise : pas de nouvelle soumission
    assert api.post("/api/v1/declarations/DC1/soumettre/").status_code == 409
    # décision réservée au Dirigeant
    assert api.post("/api/v1/declarations/DC1/decision/", {"decision": "valider"}).status_code == 403
    assert api_dg.post("/api/v1/declarations/DC1/decision/", {"decision": "peut-être"}).status_code == 400

    r = api_dg.post("/api/v1/declarations/DC1/decision/", {"decision": "valider"}, format="json")
    assert r.status_code == 200, r.content
    body = r.json()
    assert body["statut"] == "Validée"
    assert body["commentaireDG"] == (
        f"Validée le {services.fd(today())} — liée au registre des non-conformités"
    )
    assert body["hist"][0] == {**body["hist"][0], "a": "Validée par le DG", "u": "Rodrigue AHOUANSOU"}
    (nc_name, nc), (reg_name, reg) = linked
    assert nc_name == "ncs"
    assert nc["ref"] == f"NC-{today().year}-037"
    assert nc["source"] == "Veille réglementaire" and nc["origine"] == "Déclaration DC1"
    assert nc["normes"] == ["27001"] and nc["declarant"] == "Cédric AGBODJAN"
    assert nc["action"] == "Constituer le dossier de déclaration et le déposer avant le 30/09/2026"
    assert reg_name == "registre"
    assert reg == (
        "Non-conformité",
        "Non-déclaration des traitements de données RH à l'APDP",
        "Veille réglementaire (DC1)",
        "P02",
        ["27001"],
        "Cédric AGBODJAN",
    )
    assert api_dg.post("/api/v1/declarations/DC1/decision/", {"decision": "refuser"}).status_code == 409


def test_declaration_refusal_and_resubmission(api, api_dg):
    r = api.post(
        "/api/v1/declarations/",
        {"texte": "TX5", "objet": "Bordereaux", "cause": "c", "impact": "i", "planAction": "p"},
        format="json",
    )
    uid = r.json()["id"]
    r = api.post(f"/api/v1/declarations/{uid}/soumettre/")
    assert r.status_code == 200
    assert r.json()["statut"] == "Soumise"
    assert r.json()["commentaireDG"] == "En attente de décision du Directeur Général"
    assert last_journal().statut == "En attente"
    r = api_dg.post(f"/api/v1/declarations/{uid}/decision/", {"decision": "refuser"}, format="json")
    assert r.json()["statut"] == "Refusée"
    assert r.json()["commentaireDG"] == "Refusée — complément demandé sur le plan d'action"
    assert last_journal().statut == "Refusé"
    # une déclaration refusée peut être resoumise, puis validée avec un commentaire du DG
    assert api.post(f"/api/v1/declarations/{uid}/soumettre/").json()["statut"] == "Soumise"
    r = api_dg.post(
        f"/api/v1/declarations/{uid}/decision/",
        {"decision": "valider", "commentaire": "Validée — priorité T4"},
        format="json",
    )
    assert r.json()["commentaireDG"] == "Validée — priorité T4"
    assert [h["a"] for h in r.json()["hist"]] == [
        "Validée par le DG",
        "Soumise au Directeur Général",
        "Refusée par le DG, retour à l'auteur",
        "Soumise au Directeur Général",
    ]


def test_declaration_validation_without_linked_collections(api_dg, monkeypatch):
    """Sans les collections ncs / registre (autre lot), la décision reste possible."""
    monkeypatch.setattr(v, "is_registered", lambda name: False)
    monkeypatch.setattr(services, "is_registered", lambda name: False)
    r = api_dg.post("/api/v1/declarations/DC1/decision/", {"decision": "valider"}, format="json")
    assert r.status_code == 200 and r.json()["statut"] == "Validée"


# ---------- Risques et opportunités ----------


def test_risk_realised(api, linked):
    r = api.post("/api/v1/risques/R03/realise/")
    assert r.status_code == 200
    assert r.json()["realise"] is True
    assert r.json()["hist"][0]["a"] == "Risque déclaré réalisé"
    assert linked == [
        (
            "registre",
            (
                "Risque réalisé",
                "Rançongiciel sur l'ERP de production (R03)",
                "Risque R03",
                "P10",
                ["27001"],
                "Cédric AGBODJAN",
            ),
        )
    ]
    assert last_journal().a == "a déclaré le risque R03 réalisé — entrée créée dans le registre"
    assert api.post("/api/v1/risques/R03/realise/").status_code == 409


def test_risk_map(api):
    rows = {r["id"]: r for r in api.get("/api/v1/risques/cartographie/").json()}
    assert rows["R01"] == {
        "id": "R01",
        "intitule": "Coupure de doigt au poste de décorticage",
        "probabilite": 4,
        "criticite": 3,
        "niveau": 12,
        "classe": "Très élevé",
    }
    for r in Risque.objects.filter(organisation=api.user.organisation):
        n = r.probabilite * r.criticite
        assert rows[r.uid]["niveau"] == n
    opp = {o["id"]: o for o in api.get("/api/v1/opportunites/cartographie/").json()}
    assert opp["O01"]["niveau"] == 12 and "classe" not in opp["O01"]
    assert [r["id"] for r in api.get("/api/v1/risques/cartographie/?norme=27001").json()] == ["R03"]


@pytest.mark.parametrize(
    "score,label",
    [
        (16, "Très élevé"),
        (12, "Très élevé"),
        (9, "Élevé"),
        (8, "Élevé"),
        (6, "Moyen"),
        (4, "Moyen"),
        (3, "Faible"),
        (1, "Faible"),
    ],
)
def test_risk_level_labels(score, label):
    assert services.niveau_label(score) == label


def test_niveau_uses_impact_for_opportunities():
    assert services.niveau({"probabilite": 3, "criticite": 2}) == 6
    assert services.niveau({"probabilite": 3, "impact": 4}) == 12


# ---------- Droits ----------


def test_actions_require_write_role(api_collab):
    assert api_collab.post("/api/v1/objectifs/OB1/actions/", ACTION, format="json").status_code == 403
    assert api_collab.post("/api/v1/textes/TX1/diffuser/", {"mode": "dest"}).status_code == 403
    assert api_collab.post("/api/v1/risques/R01/realise/").status_code == 403
    assert api_collab.post("/api/v1/fiches-maitrise/FM1/mettre-a-jour/").status_code == 403
    assert api_collab.get("/api/v1/objectifs/suivi/").status_code == 200
    assert api_collab.get("/api/v1/risques/cartographie/").status_code == 200
