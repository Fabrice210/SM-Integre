from datetime import timedelta

import pytest
from django.utils import timezone

from apps.core.models import JournalEntry

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    "url,count",
    [
        ("plan-strat", 2),
        ("champs-perso", 3),
        ("preuves-com", 3),
        ("accuses", 7),
        ("postes", 9),
        ("representants", 3),
        ("comite", 4),
        ("reunions", 2),
    ],
)
def test_list(api, url, count):
    r = api.get(f"/api/v1/{url}/")
    assert r.status_code == 200, r.content
    assert len(r.json()) == count


def test_politique_singleton(api, demo_data):
    assert api.get("/api/v1/politique/").json() == demo_data["db"]["politique"]
    r = api.patch("/api/v1/politique/", {"signataire": "Rodrigue AHOUANSOU"}, format="json")
    assert r.status_code == 200 and r.json()["signataire"] == "Rodrigue AHOUANSOU"


# ---------- Validation ----------


def test_poste_processus_refs(api):
    poste = {
        "intitule": "Chargé(e) de la sécurité de l'information",
        "direction": "Direction des Systèmes d'Information",
        "titulaire": "Hervé DJOSSOU",
        "processus": ["P10", "P99"],
        "mission": "Appuyer le RSSI",
        "responsabilites": "Registre des incidents",
        "preuve": "Note_de_service_NS-2026-021.pdf",
    }
    r = api.post("/api/v1/postes/", poste, format="json")
    assert r.status_code == 400 and "P99" in str(r.json()["processus"])
    r = api.post("/api/v1/postes/", {**poste, "processus": ["P10"]}, format="json")
    assert r.status_code == 201 and r.json()["id"].startswith("FP")


def test_accuse_date(api):
    ok = {"collaborateur": "Hervé DJOSSOU", "statut": "Non lu", "date": "—"}
    assert api.post("/api/v1/accuses/", ok, format="json").status_code == 201
    r = api.post("/api/v1/accuses/", {**ok, "date": "21/09/2026"}, format="json")
    assert r.status_code == 400 and "date" in r.json()


def test_reunion_closed_lists(api):
    reu = {
        "objet": "Consultation aire de stockage",
        "datePrevue": "2026-10-11",
        "participants": "Comité HS (CHSS)",
        "ordreDuJour": "Éclairage",
        "statut": "Planifiée",
    }
    r = api.post("/api/v1/reunions/", reu, format="json")
    assert r.status_code == 201, r.content
    body = r.json()
    assert "date" not in body and body["statutPlan"] == "À faire"
    r = api.post("/api/v1/reunions/", {**reu, "participants": "Direction"}, format="json")
    assert r.status_code == 400


# ---------- Actions métier ----------


def test_plan_strat_remplace_en_vigueur(api):
    r = api.post(
        "/api/v1/plan-strat/",
        {
            "titre": "Plan stratégique 2026-2028 — révision",
            "version": "v3",
            "dateValidation": "2026-09-21",
            "validePar": "Conseil d'administration",
            "statut": "En vigueur",
            "fichier": "Plan_rev1.pdf",
        },
        format="json",
    )
    assert r.status_code == 201, r.content
    plans = {p["id"]: p for p in api.get("/api/v1/plan-strat/").json()}
    assert plans["PS2"]["statut"] == "Obsolète"
    assert plans["PS2"]["hist"][0]["a"] == "Remplacé par v3"
    assert "hist" not in plans["PS1"]  # déjà obsolète : inchangé
    assert plans[r.json()["id"]]["statut"] == "En vigueur"


def test_publier_politique(api):
    r = api.post(
        "/api/v1/politique/publier/",
        {
            "orientations": "1. Satisfaire nos clients.\n2) Prévenir la pollution.\n\n3. Protéger les données.",
            "signataire": "Rodrigue AHOUANSOU, Directeur Général",
            "date": "2026-09-21",
        },
        format="json",
    )
    assert r.status_code == 200, r.content
    p = r.json()
    assert p["version"] == "v4" and p["statut"] == "Publiée" and p["date"] == "2026-09-21"
    assert "AGRO-BÉNIN" in p["resume"]
    assert "Elle porte 3 orientation(s) prioritaire(s) — notamment satisfaire nos clients. ; " in p["resume"]
    assert "ISO 9001, ISO 14001" in p["resume"]
    accuses = api.get("/api/v1/accuses/").json()
    assert all(a["statut"] == "Non lu" and a["date"] == "—" for a in accuses)
    assert JournalEntry.objects.filter(a="a publié la politique SM v4 (résumé généré par l'IA)").exists()
    r = api.post("/api/v1/politique/publier/", {"signataire": "X"}, format="json")
    assert r.status_code == 400


def test_regenerer_resume(api):
    r = api.post("/api/v1/politique/regenerer-resume/")
    assert r.status_code == 200, r.content
    p = r.json()
    assert p["version"] == "v3"
    assert p["resume"].startswith("Par cette politique, la direction de ")
    assert p["hist"][0]["a"] == "Résumé régénéré par l'IA"


def test_accuser_lecture_collaborateur(api, api_collab):
    api.post(
        "/api/v1/politique/publier/",
        {"orientations": "Qualité", "signataire": "DG", "date": "2026-09-21"},
        format="json",
    )
    r = api_collab.post("/api/v1/accuses/accuser-lecture/")
    assert r.status_code == 200, r.content
    a = r.json()
    assert a["id"] == "AR5" and a["collaborateur"] == "Prisca ASSOGBA"
    assert a["statut"] == "Lu" and a["date"] == timezone.localdate().isoformat()
    assert JournalEntry.objects.filter(
        u="Prisca ASSOGBA", a="a accusé lecture de la politique SM v4"
    ).exists()
    # Le collaborateur ne peut pas modifier les accusés par ailleurs.
    assert api_collab.patch("/api/v1/accuses/AR6/", {"statut": "Lu"}, format="json").status_code == 403


def test_accuser_lecture_creates_missing(api_admin):
    r = api_admin.post("/api/v1/accuses/accuser-lecture/")
    assert r.status_code == 201, r.content
    assert r.json()["collaborateur"] == "Hervé DJOSSOU" and r.json()["id"].startswith("AR")
    assert api_admin.get("/api/v1/accuses/").json()[-1]["id"] == r.json()["id"]


def test_relancer(api, api_collab):
    r = api.post("/api/v1/accuses/relancer/")
    assert r.status_code == 200 and r.json() == {"relances": 2}
    assert JournalEntry.objects.filter(a="a relancé les lecteurs de la politique").exists()
    assert api_collab.post("/api/v1/accuses/relancer/").status_code == 403


def test_diffusion(api, api_collab):
    r = api.post(
        "/api/v1/diffusions/",
        {"doc": "Politique SM v3", "canal": "externe", "destinataires": "Clients export"},
        format="json",
    )
    assert r.status_code == 400 and "piece" in r.json()
    r = api.post(
        "/api/v1/diffusions/",
        {
            "doc": "Politique SM v3",
            "canal": "interne",
            "destinataires": "Tous les pilotes de processus",
            "message": "Veuillez prendre connaissance du document ci-joint.",
        },
        format="json",
    )
    assert r.status_code == 201, r.content
    d = r.json()
    assert d["u"] == "Florence DOSSOU-YOVO" and d["piece"] == "—" and "message" not in d
    api.post(
        "/api/v1/diffusions/",
        {"doc": "Organigramme", "canal": "externe", "destinataires": "Auditeur", "piece": "Orga.pdf"},
        format="json",
    )
    rows = api_collab.get("/api/v1/diffusions/").json()
    assert [x["doc"] for x in rows] == ["Organigramme", "Politique SM v3"]  # plus récente en tête
    # le journal fonctionnel est envoyé par le front (POST /journal/), pas par cette vue
    assert not JournalEntry.objects.filter(mod="Diffusion").exists()
    assert (
        api_collab.post(
            "/api/v1/diffusions/", {"doc": "X", "canal": "interne", "destinataires": "Y"}, format="json"
        ).status_code
        == 403
    )


def test_revoquer_reactiver_representant(api):
    r = api.post("/api/v1/representants/RP1/revoquer/")
    assert r.status_code == 200, r.content
    assert r.json()["statut"] == "Révoqué" and r.json()["hist"][0]["a"] == "Mandat révoqué"
    r = api.post("/api/v1/representants/RP1/reactiver/")
    assert r.json()["statut"] == "Actif" and r.json()["hist"][0]["a"] == "Mandat réactivé"
    assert JournalEntry.objects.filter(a__startswith="a révoqué le mandat de ").exists()


def test_realiser_reunion(api):
    reu = api.post(
        "/api/v1/reunions/",
        {
            "objet": "Consultation aire de stockage",
            "datePrevue": "2026-10-11",
            "participants": "Comité HS (CHSS)",
            "ordreDuJour": "Éclairage",
            "statut": "Planifiée",
        },
        format="json",
    ).json()
    url = f"/api/v1/reunions/{reu['id']}/realiser/"
    assert api.post(url, {"compteRendu": "CR"}, format="json").status_code == 400
    r = api.post(
        url,
        {
            "compteRendu": "Éclairage validé",
            "planAction": "Pose de 4 projecteurs — resp. Serge KOUTON — échéance 30/11/2026",
            "statutPlan": "En cours",
            "preuve1": "PV.pdf",
            "preuve2": "Presence.pdf",
        },
        format="json",
    )
    assert r.status_code == 200, r.content
    m = r.json()
    assert m["statut"] == "Réalisée" and m["statutPlan"] == "En cours"
    assert m["date"] == timezone.localdate().isoformat()
    assert m["hist"][0]["a"] == "Réunion marquée réalisée (2 preuves jointes)"
    # Une réunion ayant déjà une date la conserve.
    r = api.post(
        "/api/v1/reunions/RC1/realiser/",
        {"compteRendu": "x", "planAction": "y", "preuve1": "a", "preuve2": "b"},
        format="json",
    )
    assert r.json()["date"] == "2026-07-08" and r.json()["statutPlan"] == "À faire"


def test_planifier_annee(api):
    r = api.post("/api/v1/reunions/planifier-annee/")
    assert r.status_code == 200, r.content
    body = r.json()
    assert body["planifiees"] == 4
    first = body["reunions"][0]
    expected = (timezone.localdate() + timedelta(days=30)).isoformat()
    assert first["datePrevue"] == first["date"] == expected
    assert first["statut"] == "Planifiée" and first["preuve1"] == ""
    rows = api.get("/api/v1/reunions/").json()
    assert len(rows) == 6 and rows[-1]["objet"] == "Revue trimestrielle T4 — bilan SST"
    assert api.post("/api/v1/reunions/planifier-annee/").json()["planifiees"] == 0


def test_collaborateur_read_only(api_collab):
    assert api_collab.get("/api/v1/politique/").status_code == 200
    assert api_collab.post("/api/v1/politique/publier/", {}, format="json").status_code == 403
    assert api_collab.post("/api/v1/politique/regenerer-resume/").status_code == 403
    assert api_collab.post("/api/v1/reunions/planifier-annee/").status_code == 403
    assert api_collab.post("/api/v1/representants/RP1/revoquer/").status_code == 403
