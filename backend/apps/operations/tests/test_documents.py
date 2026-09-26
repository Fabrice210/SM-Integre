import os

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.core.models import JournalEntry
from apps.operations import viewsets
from apps.support.common import today

pytestmark = pytest.mark.django_db

URL = "/api/v1/documents/"
NEW = {
    "ref": "PR-HSE-08",
    "intitule": "Gestion des déchets de production",
    "type": "Procédure",
    "proprietaire": "Arnaud TCHIBOZO",
    "processus": "P11",
    "dateRevue": "2027-09-30",
    "normes": ["14001"],
    "droits": "Lecture : tous ; Validation : Direction Industrielle",
    "diffusion": "Direction Industrielle",
    "modele": "Modèle de procédure",
    "contenu": "Trier les déchets à la source.\nPeser chaque enlèvement.",
    "version": "1",
    "statut": "Rédaction",
    "approbateur": "Florence DOSSOU-YOVO",
}


# ---------- CRUD et validations ----------


def test_create_from_front_form(client_for):
    arnaud = client_for("Arnaud TCHIBOZO")
    r = arnaud.post(URL, NEW, format="json")
    assert r.status_code == 201, r.content
    d = r.json()
    assert d["id"].startswith("D")
    assert "contenu" not in d
    assert d["versions"] == [
        {"v": "1", "date": today().isoformat(), "auteur": "Arnaud TCHIBOZO", "contenu": NEW["contenu"]}
    ]
    assert d["redacteur"] == "Arnaud TCHIBOZO"
    assert d["dateVersion"] == d["dateCreation"] == today().isoformat()
    assert d["modele"] == "Modèle de procédure"
    assert "fichier" not in d and "refus" not in d


@pytest.mark.parametrize(
    "patch",
    [
        {"contenu": ""},
        {"versions": [{"v": "1", "date": "2026-01-01", "auteur": "X"}]},
        {"versions": [{"v": "1", "date": "01/01/2026", "auteur": "X", "contenu": "c"}]},
        {"versions": [{"v": "1", "date": "2026-01-01", "auteur": "X", "contenu": "c"}] * 2},
        {"approbateur": "Personne INCONNUE"},
        {"processus": "P99"},
        {"type": "Mémo"},
        {"statut": "Publié"},
        {"dateRevue": "—"},
    ],
)
def test_validation(api, patch):
    assert api.post(URL, {**NEW, **patch}, format="json").status_code == 400


def test_update_keeps_versions_and_clears_optional_date(api):
    r = api.patch(f"{URL}D1/", {"dateVersion": ""}, format="json")
    assert r.status_code == 200, r.content
    assert "dateVersion" not in r.json()
    assert len(r.json()["versions"]) == 2
    assert api.patch(f"{URL}D1/", {"versions": []}, format="json").status_code == 400


def test_filters(api):
    assert {d["id"] for d in api.get(URL, {"statut": "Diffusé"}).json()} == {"D1", "D5", "D7"}
    assert {d["id"] for d in api.get(URL, {"norme": "27001"}).json()} >= {"D4"}
    assert [d["id"] for d in api.get(URL, {"search": "PR-SI"}).json()] == ["D4"]


# ---------- Workflow ----------


def test_full_workflow(client_for):
    cedric = client_for("Cédric AGBODJAN")  # rédacteur de D4 et pilote de P10
    florence = client_for("Florence DOSSOU-YOVO")  # approbatrice désignée
    r = cedric.post(f"{URL}D4/soumettre/")
    assert r.status_code == 200, r.content
    assert r.json()["statut"] == "Vérification"
    assert r.json()["hist"][0]["a"] == "Document soumis à vérification — vérificateur notifié"
    j = JournalEntry.objects.first()
    assert (j.a, j.mod, j.statut, j.u) == (
        "a soumis le document PR-SI-03",
        "GED",
        "Vérification",
        "Cédric AGBODJAN",
    )
    assert cedric.post(f"{URL}D4/verifier/").json()["statut"] == "Approbation"
    assert cedric.post(f"{URL}D4/approuver/").status_code == 403  # pas l'approbateur
    r = florence.post(f"{URL}D4/approuver/")
    assert r.status_code == 200
    d = r.json()
    assert (d["statut"], d["version"], d["accuses"]) == ("Diffusé", "1", 0)
    # Nouvelle version : la version diffusée reste en vigueur jusqu'à l'approbation.
    r = cedric.post(
        f"{URL}D4/nouvelle-version/", {"contenu": "Nouveau contenu", "motif": "Revue 2026"}, format="json"
    )
    d = r.json()
    assert (d["statut"], d["version"], len(d["versions"])) == ("Rédaction", "1", 2)
    assert d["versions"][-1] == {
        "v": "2",
        "date": today().isoformat(),
        "auteur": "Cédric AGBODJAN",
        "contenu": "Nouveau contenu",
    }
    assert d["hist"][0]["a"] == "Version 2 ouverte : Revue 2026"
    cedric.post(f"{URL}D4/soumettre/")
    cedric.post(f"{URL}D4/verifier/")
    d = florence.post(f"{URL}D4/approuver/").json()
    assert (d["statut"], d["version"]) == ("Diffusé", "2")


def test_refuser(api, client_for):
    assert api.post(f"{URL}D2/refuser/", {}, format="json").status_code == 400  # motif obligatoire
    assert (
        client_for("Aïcha BIO SIKA").post(f"{URL}D2/refuser/", {"motif": "x"}, format="json").status_code
        == 403
    )
    r = api.post(f"{URL}D2/refuser/", {"motif": "Préciser les responsabilités"}, format="json")
    assert r.status_code == 200
    assert (r.json()["statut"], r.json()["refus"]) == ("Rédaction", "Préciser les responsabilités")
    # À la vérification : le pilote (ou copilote) du processus peut refuser.
    prisca = client_for("Prisca ASSOGBA")  # copilote de P05, processus de D3
    assert prisca.post(f"{URL}D3/refuser/", {"motif": "Incomplet"}, format="json").status_code == 200


def test_designated_approver(api, client_for):
    serge = client_for("Serge KOUTON")
    assert serge.post(f"{URL}D2/approuver/").status_code == 403
    api.patch(f"{URL}D2/", {"approbateur": "Serge KOUTON"}, format="json")
    assert serge.post(f"{URL}D2/approuver/").status_code == 200


def test_status_change_by_update_is_checked(client_for):
    aicha = client_for("Aïcha BIO SIKA")  # rédactrice de D2, pas approbatrice
    r = aicha.patch(f"{URL}D2/", {"statut": "Diffusé", "approbateur": "Aïcha BIO SIKA"}, format="json")
    assert r.status_code == 403
    assert (
        aicha.patch(f"{URL}D2/", {"intitule": "Évaluation des fournisseurs"}, format="json").status_code
        == 200
    )
    assert (
        client_for("Serge KOUTON").post(URL, {**NEW, "statut": "Diffusé"}, format="json").status_code == 403
    )


def test_invalid_transitions(api):
    assert api.post(f"{URL}D1/soumettre/").status_code == 409
    assert api.post(f"{URL}D4/approuver/").status_code == 409
    assert (
        api.post(f"{URL}D4/nouvelle-version/", {"contenu": "x", "motif": "y"}, format="json").status_code
        == 409
    )
    assert api.post(f"{URL}D6/obsolete/").status_code == 409


def test_diffuser_and_obsolete(api, client_for):
    r = api.post(f"{URL}D1/diffuser/", {"diffusion": "Tous les collaborateurs"}, format="json")
    assert (r.json()["diffusion"], r.json()["accuses"]) == ("Tous les collaborateurs", 0)
    assert r.json()["hist"][0]["a"] == "Diffusé à : Tous les collaborateurs"
    assert client_for("Serge KOUTON").post(f"{URL}D7/obsolete/").status_code == 403
    r = client_for("Arnaud TCHIBOZO").post(f"{URL}D7/obsolete/")
    assert (r.json()["statut"], r.json()["obsolete"]) == ("Obsolète", True)


def test_collaborateur_cannot_act(api_collab):
    assert api_collab.post(f"{URL}D4/soumettre/").status_code == 403
    assert api_collab.post(f"{URL}D1/diffuser/", {"diffusion": "x"}, format="json").status_code == 403


# ---------- Pièces jointes ----------


def _pdf(name="procedure.pdf", size=100):
    return SimpleUploadedFile(name, b"%PDF-1.4\n" + b"x" * size, content_type="application/pdf")


def test_upload_and_download(client_for, media, demo_org):
    cedric = client_for("Cédric AGBODJAN")
    r = cedric.post(f"{URL}D4/fichier/", {"file": _pdf()}, format="multipart")
    assert r.status_code == 200, r.content
    assert r.json()["fichier"] == "procedure.pdf"
    assert os.path.exists(media / str(demo_org.pk) / "documents" / "D4" / "procedure.pdf")
    r = cedric.get(f"{URL}D4/fichier/")
    assert r.status_code == 200
    assert b"".join(r.streaming_content).startswith(b"%PDF")
    # Remplacement : l'ancien fichier est supprimé, le nom reste une chaîne dans le JSON.
    r = cedric.post(f"{URL}D4/fichier/", {"file": _pdf("v2.pdf")}, format="multipart")
    assert r.json()["fichier"] == "v2.pdf"
    assert sorted(os.listdir(media / str(demo_org.pk) / "documents" / "D4")) == ["v2.pdf"]
    # Le champ n'est pas modifiable par le JSON.
    r = cedric.patch(f"{URL}D4/", {"fichier": "autre.pdf"}, format="json")
    assert r.json()["fichier"] == "v2.pdf"
    assert "fichier" not in r.json().get("extra", {})


def test_upload_rules(api, client_for, media, monkeypatch):
    assert api.get(f"{URL}D4/fichier/").status_code == 404
    bad = SimpleUploadedFile("script.exe", b"MZ", content_type="application/octet-stream")
    assert api.post(f"{URL}D4/fichier/", {"file": bad}, format="multipart").status_code == 400
    monkeypatch.setattr(viewsets, "MAX_UPLOAD_SIZE", 50)
    assert api.post(f"{URL}D4/fichier/", {"file": _pdf()}, format="multipart").status_code == 400
    monkeypatch.undo()
    assert api.post(f"{URL}D1/fichier/", {"file": _pdf()}, format="multipart").status_code == 409  # diffusé
    serge = client_for("Serge KOUTON")
    assert serge.post(f"{URL}D4/fichier/", {"file": _pdf()}, format="multipart").status_code == 403
