"""Tests ciblés de l'audit de sécurité : un test par faille ou bug corrigé."""

import os

import pytest
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.core.models import Organisation, Role, User

pytestmark = pytest.mark.django_db

API = "/api/v1/"
PASSWORD = "Test-pass-123!"


def _new_user(api, **kw):
    data = {"nom": "Jean TEST", "email": "j.test@agrobenin.bj", "roles": ["Collaborateur"], **kw}
    return api.post(f"{API}users/", data, format="json")


# ---------- Utilisateurs ----------


def test_user_created_in_admin_org_only(api_admin, demo_org):
    other = Organisation.objects.create(nom="Autre")
    r = _new_user(
        api_admin,
        organisation=other.pk,
        is_superuser=True,
        is_staff=True,
        isSuperuser=True,
        password="Un-mot-de-passe-solide-42",
    )
    assert r.status_code == 201, r.content
    u = User.objects.get(email="j.test@agrobenin.bj")
    assert u.organisation_id == demo_org.pk
    assert not u.is_superuser and not u.is_staff


def test_user_cannot_escalate_or_move_org(api_admin, demo_org):
    other = Organisation.objects.create(nom="Autre")
    r = api_admin.patch(
        f"{API}users/u9/",
        {"organisation": other.pk, "is_superuser": True, "isStaff": True, "is_staff": True},
        format="json",
    )
    assert r.status_code == 200
    u = demo_org.users.get(uid="u9")
    assert u.organisation_id == demo_org.pk and not u.is_superuser and not u.is_staff


def test_admin_cannot_modify_platform_superuser(api_admin, demo_org):
    User.objects.create_superuser(
        email="root@plateforme.bj", password=PASSWORD, organisation=demo_org, uid="u99"
    )
    assert (
        api_admin.patch(f"{API}users/u99/", {"password": "Autre-mot-de-passe-77"}, format="json").status_code
        == 403
    )
    assert api_admin.delete(f"{API}users/u99/").status_code == 403


@pytest.mark.parametrize("password", ["12345678", "password", "azertyui", "j.test@agrobenin.bj"])
def test_user_password_validators(api_admin, password):
    r = _new_user(api_admin, password=password)
    assert r.status_code == 400
    assert "password" in r.json()


def test_user_password_change_validated(api_admin, demo_org):
    assert api_admin.patch(f"{API}users/u9/", {"password": "12345678"}, format="json").status_code == 400
    r = api_admin.patch(f"{API}users/u9/", {"password": "Nouveau-secret-2026"}, format="json")
    assert r.status_code == 200
    assert demo_org.users.get(uid="u9").check_password("Nouveau-secret-2026")


def test_user_email_unique_case_insensitive(api_admin):
    r = _new_user(api_admin, email="F.Dossou-Yovo@AgroBenin.bj")
    assert r.status_code == 400 and "email" in r.json()


def test_user_old_email_reusable_after_change(api_admin):
    assert (
        api_admin.patch(f"{API}users/u9/", {"email": "prisca@agrobenin.bj"}, format="json").status_code == 200
    )
    # Ancienne adresse libérée (username suit l'e-mail) : pas d'erreur d'intégrité.
    r = _new_user(api_admin, email="p.assogba@agrobenin.bj")
    assert r.status_code == 201, r.content


@pytest.mark.parametrize("roles", ["Responsable SM", ["Super admin"], [["Responsable SM"]], "x"])
def test_user_roles_validated(api_admin, roles):
    assert _new_user(api_admin, roles=roles).status_code == 400


def test_user_uid_no_collision_after_delete(api_admin, demo_org):
    assert api_admin.delete(f"{API}users/u3/").status_code == 204
    r = _new_user(api_admin)
    assert r.status_code == 201
    uid = r.json()["id"]
    assert demo_org.users.filter(uid=uid).count() == 1
    assert _new_user(api_admin, email="x@agrobenin.bj", id=uid).status_code == 400
    assert _new_user(api_admin, email="y@agrobenin.bj", id="../u1").status_code == 400


def test_last_admin_cannot_be_deleted_or_demoted(api_admin, demo_org):
    # Deux administrateurs : Florence (Responsable SM) et Hervé (Administrateur système).
    assert (
        api_admin.patch(f"{API}users/u1/", {"roles": ["Pilote de processus"]}, format="json").status_code
        == 200
    )
    r = api_admin.delete(f"{API}users/u14/")
    assert r.status_code == 400
    r = api_admin.patch(f"{API}users/u14/", {"roles": ["Collaborateur"]}, format="json")
    assert r.status_code == 400
    assert demo_org.users.get(uid="u14").has_role(Role.ADMIN)
    # Un deuxième administrateur rend l'opération possible.
    assert api_admin.patch(f"{API}users/u1/", {"roles": ["Responsable SM"]}, format="json").status_code == 200
    assert api_admin.delete(f"{API}users/u14/").status_code == 204


# ---------- Authentification ----------


@pytest.fixture
def clear_cache():
    cache.clear()
    yield
    cache.clear()


def _login(email, password):
    return APIClient().post(f"{API}auth/login/", {"email": email, "password": password}, format="json")


def test_login_no_user_enumeration(demo_org, clear_cache):
    unknown = _login("inconnu@agrobenin.bj", PASSWORD)
    wrong = _login("f.dossou-yovo@agrobenin.bj", "mauvais")
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json() == wrong.json()


def test_login_inactive_user_refused(demo_org, clear_cache):
    u = demo_org.users.get(uid="u9")
    ok = _login(u.email, PASSWORD)
    assert ok.status_code == 200
    u.is_active = False
    u.save(update_fields=["is_active"])
    r = _login(u.email, PASSWORD)
    assert r.status_code == 401
    assert r.json() == _login("inconnu@agrobenin.bj", PASSWORD).json()
    # Un jeton émis avant la désactivation n'ouvre plus l'API.
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {ok.json()['access']}")
    assert c.get(f"{API}bootstrap/").status_code == 401


def test_login_throttled(demo_org, clear_cache):
    codes = [_login("f.dossou-yovo@agrobenin.bj", "mauvais").status_code for _ in range(12)]
    assert codes[0] == 401
    assert codes[-1] == 429


def test_refresh_token_of_deleted_user(demo_org, clear_cache):
    u = demo_org.users.get(uid="u9")
    refresh = _login(u.email, PASSWORD).json()["refresh"]
    c = APIClient()
    assert c.post(f"{API}auth/refresh/", {"refresh": refresh}, format="json").status_code == 200
    u.is_active = False
    u.save(update_fields=["is_active"])
    assert c.post(f"{API}auth/refresh/", {"refresh": refresh}, format="json").status_code == 401
    u.delete()
    c.raise_request_exception = False
    assert c.post(f"{API}auth/refresh/", {"refresh": refresh}, format="json").status_code == 401


# ---------- Déclaration de NC par un collaborateur ----------


def test_collaborateur_nc_declaration_is_sanitized(api_collab):
    r = api_collab.post(
        f"{API}ncs/",
        {
            "ref": "NC-2026-014",
            "categorie": "Non-conformité",
            "source": "Terrain",
            "description": "Écart",
            "processus": "P05",
            "normes": ["9001"],
            "statut": "Clôturée",
            "efficacite": "Efficace",
            "hist": [{"d": "2020-01-01", "u": "DG", "a": "Validé"}],
            "note": "conservée",
        },
        format="json",
    )
    assert r.status_code == 201, r.content
    d = r.json()
    assert d["statut"] == "Déclarée" and d["declarant"] == "Prisca ASSOGBA"
    assert d["ref"] != "NC-2026-014"
    assert "efficacite" not in d and "hist" not in d
    assert d["note"] == "conservée"


# ---------- Identifiants, entrées invalides ----------


@pytest.mark.parametrize("uid", ["../etc", "a/b", ".hidden", "..", "x" * 33, "a b", "é1"])
def test_uid_format_validated(api, uid):
    r = api.post(
        f"{API}processus/", {"id": uid, "code": "X", "intitule": "X", "categorie": "Support"}, format="json"
    )
    assert r.status_code == 400


def test_huge_numeric_uid_does_not_overflow_counter(api):
    r = api.post(
        f"{API}processus/",
        {"id": "P" + "9" * 30, "code": "X", "intitule": "X", "categorie": "Support"},
        format="json",
    )
    assert r.status_code == 201
    r = api.post(f"{API}processus/", {"code": "Y", "intitule": "Y", "categorie": "Support"}, format="json")
    assert r.status_code == 201


def test_nul_character_rejected(api):
    r = api.post(
        f"{API}processus/",
        {"code": "X", "intitule": "X", "categorie": "Support", "hist": ["a\x00"]},
        format="json",
    )
    assert r.status_code == 400
    r = api.patch(f"{API}organisation/", {"adresse": "a\x00b"}, format="json")
    assert r.status_code == 400


def test_invalid_lookup_is_404(api):
    assert api.get(f"{API}processus/.hidden/").status_code == 404
    assert api.get(f"{API}users/%00/").status_code == 404


@pytest.mark.parametrize("normes", ["9001", 5, [1], {"9001": True}, [["9001"]]])
def test_normes_must_be_a_list_of_known_norms(api, normes):
    r = api.post(
        f"{API}processus/",
        {"code": "X", "intitule": "X", "categorie": "Support", "normes": normes},
        format="json",
    )
    assert r.status_code == 400


@pytest.mark.parametrize("value", [["P01", 1], [{"id": "P01"}], {"a": 1}, 5])
def test_refs_must_be_text(api, value):
    r = api.post(f"{API}postes/", {"intitule": "X", "processus": value}, format="json")
    assert r.status_code == 400
    assert "processus" in r.json()
    r = api.post(f"{API}audits/", {"perimetre": value}, format="json")
    assert r.status_code == 400
    assert "perimetre" in r.json()


def test_action_body_must_be_an_object(api):
    assert api.post(f"{API}risques/R01/evaluation/", [], format="json").status_code == 400
    # Import d'objectifs : un tableau reste accepté comme corps.
    r = api.post(f"{API}objectifs/import/", [{"code": "OB-01"}], format="json")
    assert r.status_code == 200


def test_texte_diffuser_rejects_non_text(api):
    uid = api.get(f"{API}textes/").json()[0]["id"]
    r = api.post(f"{API}textes/{uid}/diffuser/", {"destinataire": [{"x": 1}]}, format="json")
    assert r.status_code == 400


def test_settings_and_organisation_validated(api):
    assert api.put(f"{API}organisation/", [1, 2], format="json").status_code == 400
    assert api.patch(f"{API}settings/", {"activeNorms": ["9999"]}, format="json").status_code == 400
    assert api.patch(f"{API}settings/", {"activeNorms": "9001"}, format="json").status_code == 400
    r = api.patch(f"{API}settings/", {"activeNorms": ["9001", "9001", "14001"]}, format="json")
    assert r.json()["activeNorms"] == ["9001", "14001"]


def test_competences_import_overflow_value(api):
    csv = "Nom;Direction;A\nJean;DRH;inf\nMarie;DRH;1e999\n"
    r = api.post(f"{API}competences/import/", {"csv": csv}, format="json")
    assert r.status_code == 200, r.content
    rows = r.json()["competences"]["collaborateurs"][-2:]
    assert all(v == 0 for p in rows for v in p["niveaux"])


# ---------- Transactions ----------


def test_singleton_update_is_atomic(api, monkeypatch, demo_org):
    from apps.core import viewsets
    from apps.leadership.models import Politique

    before = Politique.objects.get(organisation=demo_org).signataire

    def boom(*a, **k):
        raise RuntimeError("panne")

    monkeypatch.setattr(viewsets, "log_write", boom)
    api.raise_request_exception = False
    r = api.patch(f"{API}politique/", {"signataire": "Changé"}, format="json")
    assert r.status_code == 500
    assert Politique.objects.get(organisation=demo_org).signataire == before


# ---------- GED : fichiers ----------


@pytest.fixture
def media(settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path)
    return tmp_path


def _pdf(name):
    return SimpleUploadedFile(name, b"%PDF-1.4\nxx", content_type="application/pdf")


@pytest.mark.parametrize(
    "name, expected",
    [
        ("../../../etc/passwd.pdf", "passwd.pdf"),
        ("..\\..\\win\\evil.PDF", "evil.pdf"),
        ("rapport final (v2).pdf", "rapport_final__v2.pdf"),
        ("x" * 300 + ".pdf", "x" * 100 + ".pdf"),
        (".pdf.pdf", "pdf.pdf"),
    ],
)
def test_upload_filename_sanitized(api, media, demo_org, name, expected):
    r = api.post(f"{API}documents/D4/fichier/", {"file": _pdf(name)}, format="multipart")
    assert r.status_code == 200, r.content
    assert r.json()["fichier"] == expected
    folder = media / str(demo_org.pk) / "documents" / "D4"
    assert os.listdir(folder) == [expected]


def test_upload_rejects_hidden_extension(api, media):
    for name in ("page.html", "evil.pdf.exe", ".pdf", "noext", "image.svg"):
        r = api.post(f"{API}documents/D4/fichier/", {"file": _pdf(name)}, format="multipart")
        assert r.status_code == 400, name


def test_download_headers_and_missing_file(api, media, demo_org):
    api.post(f"{API}documents/D4/fichier/", {"file": _pdf("procédure été.pdf")}, format="multipart")
    r = api.get(f"{API}documents/D4/fichier/")
    assert r.status_code == 200
    cd = r["Content-Disposition"]
    assert cd.startswith("attachment;")
    assert "filename*=utf-8''proc%C3%A9dure_%C3%A9t%C3%A9.pdf" in cd
    # Fichier disparu du stockage : 404 et non erreur serveur.
    for f in (media / str(demo_org.pk) / "documents" / "D4").iterdir():
        f.unlink()
    assert api.get(f"{API}documents/D4/fichier/").status_code == 404


def test_delete_document_removes_file_after_commit(api, media, demo_org, django_capture_on_commit_callbacks):
    api.post(f"{API}documents/D4/fichier/", {"file": _pdf("a.pdf")}, format="multipart")
    path = media / str(demo_org.pk) / "documents" / "D4" / "a.pdf"
    assert path.exists()
    with django_capture_on_commit_callbacks(execute=True):
        assert api.delete(f"{API}documents/D4/").status_code == 204
    assert not path.exists()
