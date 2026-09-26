import pytest

from apps.core.models import JournalEntry
from apps.support.common import is_registered

pytestmark = pytest.mark.django_db

URGENCE = {
    "type": "Inondation de l'entrepôt de Porto-Novo",
    "procedure": "PR-HSE-11 Plan inondation",
    "responsables": "Martial ADJIBADÉ",
    "consignes": "Surélever les palettes",
    "moyens": "Pompes de relevage",
    "risques": ["R06"],
    "sites": ["Entrepôt de Porto-Novo"],
}
PLAN = {
    "processus": "P07",
    "plan": "Contrôle de l'arrimage des conteneurs",
    "responsable": "Martial ADJIBADÉ",
    "echeance": "2026-10-11",
    "statut": "Pas fait",
}


# ---------- Modèles ----------


def test_modeles(api):
    r = api.post(
        "/api/v1/modeles/",
        {
            "nom": "Modèle FDS",
            "type": "Enregistrement",
            "processus": "Tous",
            "description": "x",
            "fichier": "FDS.docx",
        },
        format="json",
    )
    assert r.status_code == 201, r.content
    assert r.json()["id"].startswith("MD") and r.json()["fichier"] == "FDS.docx"
    assert (
        api.patch(f"/api/v1/modeles/{r.json()['id']}/", {"processus": "P04"}, format="json").status_code
        == 200
    )
    assert (
        api.patch(f"/api/v1/modeles/{r.json()['id']}/", {"processus": "P99"}, format="json").status_code
        == 400
    )
    assert api.patch("/api/v1/modeles/MD1/", {"type": "Mémo"}, format="json").status_code == 400
    assert [m["id"] for m in api.get("/api/v1/modeles/", {"type": "Procédure"}).json()] == ["MD1"]


# ---------- Planification opérationnelle ----------


def test_plans_ops(api, api_collab):
    r = api.post("/api/v1/plans-ops/", PLAN, format="json")
    assert r.status_code == 201, r.content
    uid = r.json()["id"]
    assert uid.startswith("PO")
    assert (
        api.patch(f"/api/v1/plans-ops/{uid}/", {"statut": "Fait"}, format="json").json()["statut"] == "Fait"
    )
    for bad in ({"statut": "Terminé"}, {"responsable": "Inconnu"}, {"processus": "P99"}, {"echeance": "—"}):
        assert api.patch(f"/api/v1/plans-ops/{uid}/", bad, format="json").status_code == 400
    assert (
        api_collab.patch(f"/api/v1/plans-ops/{uid}/", {"statut": "En cours"}, format="json").status_code
        == 403
    )
    assert len(api.get("/api/v1/plans-ops/", {"statut": "Fait"}).json()) >= 1


# ---------- Situations d'urgence ----------


def test_urgence_crud_and_validation(api):
    r = api.post("/api/v1/urgences/", URGENCE, format="json")
    assert r.status_code == 201, r.content
    assert r.json()["id"].startswith("SU") and r.json()["exercices"] == []
    uid = r.json()["id"]
    bad_exercices = [
        [{"date": "2026-10-01"}],
        [{"date": "01/10/2026", "statut": "Planifié"}],
        [{"date": "2026-10-01", "statut": "Annulé"}],
        [{"date": "2026-10-01", "statut": "Planifié", "compteRendu": 3}],
        ["x"],
    ]
    for ex in bad_exercices:
        assert api.patch(f"/api/v1/urgences/{uid}/", {"exercices": ex}, format="json").status_code == 400
    assert api.patch(f"/api/v1/urgences/{uid}/", {"risques": [""]}, format="json").status_code == 400
    # Références vers d'autres modules : validées dès que la collection est disponible.
    r = api.patch(f"/api/v1/urgences/{uid}/", {"risques": ["R99"], "sites": ["Lune"]}, format="json")
    expected = 400 if (is_registered("risques") or is_registered("sites")) else 200
    assert r.status_code == expected


def test_exercices_workflow(api):
    r = api.post(
        "/api/v1/urgences/SU3/exercices/",
        {
            "date": "2026-11-15",
            "participants": "Cellule de crise",
            "scenario": "Rançongiciel",
            "procedure": "PR-SI-06.pdf",
        },
        format="json",
    )
    assert r.status_code == 201, r.content
    ex = r.json()["exercices"]
    assert len(ex) == 2
    assert ex[-1] == {
        "date": "2026-11-15",
        "participants": "Cellule de crise",
        "scenario": "Rançongiciel",
        "procedure": "PR-SI-06.pdf",
        "statut": "Planifié",
        "compteRendu": "—",
        "actions": "—",
    }
    assert r.json()["hist"][0]["a"] == "Exercice planifié le 15 nov. 2026"
    assert JournalEntry.objects.filter(statut="Planifié", mod="Situations d'urgence").exists()

    url = "/api/v1/urgences/SU3/exercices/1/compte-rendu/"
    r = api.post(url, {"compteRendu": "Bascule en 2 h", "actions": "Tester la sauvegarde"}, format="json")
    assert r.status_code == 200, r.content
    assert r.json()["exercices"][1]["statut"] == "Réalisé"
    assert r.json()["exercices"][1]["compteRendu"] == "Bascule en 2 h"
    assert api.post(url, {"compteRendu": "x", "actions": "y"}, format="json").status_code == 400
    assert (
        api.post(
            "/api/v1/urgences/SU3/exercices/9/compte-rendu/",
            {"compteRendu": "x", "actions": "y"},
            format="json",
        ).status_code
        == 404
    )
    assert api.post("/api/v1/urgences/SU3/exercices/", {"date": "x"}, format="json").status_code == 400


def test_compte_rendu_creates_registre_action(api):
    r = api.post(
        "/api/v1/urgences/SU1/exercices/1/compte-rendu/",
        {"compteRendu": "Évacuation en 4 min 10 s", "actions": "Installer un flash lumineux", "creer": True},
        format="json",
    )
    assert r.status_code == 200, r.content
    if is_registered("registre"):
        first = api.get("/api/v1/registre/").json()[0]
        assert first["intitule"] == "Installer un flash lumineux"
        assert first["origine"] == "Exercice : Incendie dans le magasin de coques"
        assert first["responsable"] == "Arnaud TCHIBOZO"


def test_urgences_rights(api_collab):
    assert api_collab.get("/api/v1/urgences/").status_code == 200
    r = api_collab.post(
        "/api/v1/urgences/SU3/exercices/",
        {"date": "2026-11-15", "participants": "x", "scenario": "x", "procedure": "x"},
        format="json",
    )
    assert r.status_code == 403
