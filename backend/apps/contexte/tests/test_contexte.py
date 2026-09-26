import pytest

from apps.core.models import AuditLog, JournalEntry

pytestmark = pytest.mark.django_db


def _enjeu(**kw):
    return {
        "libelle": "Maintenir la continuité électrique de l'usine",
        "source": "Externe (PESTEL)",
        "qualification": "Négatif",
        "axes": ["AX1", "AX3"],
        "normes": ["9001", "14001"],
        "date": "2026-09-21",
        "statut": "Actif",
        **kw,
    }


# ---------- CRUD ----------


@pytest.mark.parametrize(
    "url,count",
    [
        ("swot", 6),
        ("pestel", 8),
        ("axes", 4),
        ("enjeux", 5),
        ("analyse-versions", 2),
        ("parties", 7),
        ("sites", 4),
        ("activites", 5),
        ("domaine-versions", 2),
        ("applicabilite", 4),
    ],
)
def test_list(api, url, count):
    r = api.get(f"/api/v1/{url}/")
    assert r.status_code == 200, r.content
    assert len(r.json()) == count


def test_enjeu_crud(api):
    r = api.post("/api/v1/enjeux/", _enjeu(), format="json")
    assert r.status_code == 201, r.content
    body = r.json()
    assert body["id"].startswith("EN")
    assert "origine" not in body  # enjeu saisi à la main : pas d'origine, comme le front
    uid = body["id"]
    r = api.patch(f"/api/v1/enjeux/{uid}/", {"statut": "Obsolète", "obsolete": True}, format="json")
    assert r.status_code == 200, r.content
    assert r.json()["statut"] == "Obsolète" and r.json()["obsolete"] is True
    assert api.delete(f"/api/v1/enjeux/{uid}/").status_code == 204


def test_filters_and_search(api):
    rows = api.get("/api/v1/swot/?type=Force").json()
    assert rows and all(r["type"] == "Force" for r in rows)
    rows = api.get("/api/v1/parties/?norme=27001").json()
    assert rows and all("27001" in r["normes"] for r in rows)
    rows = api.get("/api/v1/applicabilite/?exclu=Oui").json()
    assert {r["id"] for r in rows} == {"AP1", "AP2"}
    rows = api.get("/api/v1/sites/?search=Parakou").json()
    assert [r["id"] for r in rows] == ["S4"]


def test_closed_lists_and_scales(api):
    r = api.post(
        "/api/v1/swot/",
        {"type": "Menace", "libelle": "X", "description": "X", "impact": 6, "normes": ["9001"]},
        format="json",
    )
    assert r.status_code == 400
    assert set(r.json()) == {"type", "impact"}
    r = api.post(
        "/api/v1/axes/",
        {"code": "AX5", "libelle": "Éthique", "avancement": 120, "evaluation": "—"},
        format="json",
    )
    assert r.status_code == 400 and "avancement" in r.json()
    r = api.post(
        "/api/v1/applicabilite/",
        {"norme": "9999", "article": "X", "exclu": "Non", "justification": "X"},
        format="json",
    )
    assert r.status_code == 400 and "norme" in r.json()


# ---------- Références ----------


def test_enjeu_refs_validated(api):
    r = api.post("/api/v1/enjeux/", _enjeu(axes=["AX1", "AX99"]), format="json")
    assert r.status_code == 400
    assert "AX99" in str(r.json()["axes"])
    r = api.post("/api/v1/enjeux/", _enjeu(origine="PE99"), format="json")
    assert r.status_code == 400 and "origine" in r.json()
    for origine in ("SW1", "PE2"):  # SWOT ou PESTEL
        assert api.post("/api/v1/enjeux/", _enjeu(origine=origine), format="json").status_code == 201


def test_activite_site_by_name(api):
    base = {
        "type": "Produit",
        "libelle": "Amandes grillées salées",
        "statut": "Inclus",
        "justification": "Nouvelle gamme marché national lancée en 2026",
    }
    r = api.post("/api/v1/activites/", {**base, "site": "Usine de Lomé"}, format="json")
    assert r.status_code == 400 and "site" in r.json()
    r = api.post("/api/v1/activites/", {**base, "site": "Usine de Glo-Djigbé"}, format="json")
    assert r.status_code == 201, r.content


def test_justification_min_length(api):
    site = {
        "nom": "Agence de Lomé",
        "adresse": "Lomé",
        "activite": "Représentation",
        "statut": "Exclu",
        "justification": "Trop court",
    }
    assert api.post("/api/v1/sites/", {**site, "justification": "Court"}, format="json").status_code == 400
    r = api.post("/api/v1/sites/", site, format="json")
    assert r.status_code == 201, r.content
    assert r.json()["monnaie"] == "FCFA (XOF)"


# ---------- Actions métier ----------


def test_generer_enjeux(api):
    before = api.get("/api/v1/enjeux/").json()
    r = api.post("/api/v1/enjeux/generer/")
    assert r.status_code == 200, r.content
    body = r.json()
    # PE1, PE4, PE5 ont déjà un enjeu : 5 facteurs PESTEL restants.
    assert body["generes"] == 5
    after = api.get("/api/v1/enjeux/").json()
    assert len(after) == len(before) + 5
    assert after[5:] == before  # nouveaux enjeux en tête (unshift)
    assert [e["origine"] for e in after[:5]] == ["PE8", "PE7", "PE6", "PE3", "PE2"]
    pe8 = after[0]
    assert pe8["libelle"].startswith(("Saisir : ", "Maîtriser : "))
    assert pe8["source"] == "Externe (PESTEL)" and pe8["statut"] == "Actif"
    assert pe8["hist"][0]["a"] == "Généré automatiquement depuis le facteur PE8"
    pe2 = next(e for e in after if e["origine"] == "PE2")
    assert pe2["libelle"] == "Maîtriser : volatilité du prix international de l'amande de cajou"
    assert pe2["axes"] == ["AX1"] and pe2["normes"] == ["9001"]
    assert JournalEntry.objects.filter(a="a généré 5 enjeu(x) depuis la matrice PESTEL").exists()
    # Idempotent : tous les facteurs ont désormais un enjeu.
    assert api.post("/api/v1/enjeux/generer/").json()["generes"] == 0


def test_figer_version_analyse(api):
    r = api.post("/api/v1/analyse-versions/figer/", {"commentaire": "Revue T3"}, format="json")
    assert r.status_code == 201, r.content
    v = r.json()
    assert v["version"] == "v3.0"
    assert v["facteurs"] == 14 and v["enjeux"] == 5
    assert v["auteur"] == "Florence DOSSOU-YOVO" and v["commentaire"] == "Revue T3"
    assert api.get("/api/v1/analyse-versions/").json()[-1]["id"] == v["id"]
    assert JournalEntry.objects.filter(a="a enregistré la version v3.0 (Enjeux)", mod="Enjeux").exists()
    assert api.post("/api/v1/analyse-versions/figer/", {}, format="json").status_code == 400


def test_figer_version_domaine(api):
    r = api.post("/api/v1/domaine-versions/figer/", {"commentaire": "Ajout Lomé"}, format="json")
    assert r.status_code == 201, r.content
    assert r.json()["version"] == "v3"
    assert (
        api.post("/api/v1/domaine-versions/figer/", {"commentaire": "x"}, format="json").json()["version"]
        == "v4"
    )


def test_basculer_plan(api):
    r = api.post("/api/v1/parties/PI1/basculer-plan/")
    assert r.status_code == 200, r.content
    first = r.json()["planMisEnOeuvre"]
    assert r.json()["hist"][0]["a"] in ("Plan déclaré mis en œuvre", "Plan repassé à traiter")
    r = api.post("/api/v1/parties/PI1/basculer-plan/")
    assert r.json()["planMisEnOeuvre"] is (not first)
    assert len(r.json()["hist"]) == 2
    assert AuditLog.objects.filter(collection="parties", uid="PI1").count() == 2


# ---------- Droits ----------


def test_collaborateur_read_only(api_collab):
    assert api_collab.get("/api/v1/enjeux/").status_code == 200
    assert api_collab.post("/api/v1/enjeux/", _enjeu(), format="json").status_code == 403
    assert api_collab.post("/api/v1/enjeux/generer/").status_code == 403
    assert api_collab.post("/api/v1/analyse-versions/figer/", {"commentaire": "x"}).status_code == 403
    assert api_collab.post("/api/v1/parties/PI1/basculer-plan/").status_code == 403
