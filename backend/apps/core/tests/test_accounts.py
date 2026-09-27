"""Onboarding multi-organismes : inscription, invitation, mot de passe par jeton."""

import re

import pytest
from django.core import mail
from rest_framework.test import APIClient

from apps.core.models import Organisation, User

pytestmark = pytest.mark.django_db

SIGNUP = {
    "organisation": "Coopérative Test",
    "nom": "Awa KOUASSI",
    "email": "awa@coop-test.bj",
    "password": "Un-mot-de-passe-solide-42",
}


def _link(message):
    m = re.search(r"\?uid=([^&\s]+)&token=(\S+)", message.body)
    assert m, message.body
    return m.group(1), m.group(2)


# ---------- Inscription ----------


@pytest.mark.parametrize("allowed", [False, True])
def test_auth_config_exposes_signup(settings, allowed):
    settings.ALLOW_SIGNUP = allowed
    r = APIClient().get("/api/v1/auth/config/")
    assert r.status_code == 200
    assert r.json() == {"signup": allowed}


def test_signup_disabled_by_default(settings):
    settings.ALLOW_SIGNUP = False
    r = APIClient().post("/api/v1/auth/signup/", SIGNUP, format="json")
    assert r.status_code == 404
    assert not Organisation.objects.exists()


def test_signup_creates_blank_organisation(settings):
    settings.ALLOW_SIGNUP = True
    c = APIClient()
    r = c.post("/api/v1/auth/signup/", SIGNUP, format="json")
    assert r.status_code == 201, r.content
    body = r.json()
    assert body["user"] == {
        "id": "u1",
        "nom": "Awa KOUASSI",
        "email": "awa@coop-test.bj",
        "poste": "Responsable SM",
        "direction": "",
        "roles": ["Responsable SM"],
    }
    org = Organisation.objects.get()
    assert org.nom == "Coopérative Test" and not org.onboarded

    # Connecté d'emblée ; organisme vierge (aucune donnée de démo), réglable par le RSM.
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {body['access']}")
    state = c.get("/api/v1/bootstrap/").json()
    assert state["org"]["nom"] == "Coopérative Test"
    assert state["users"] == [body["user"]]
    assert state["db"]["processus"] == [] and state["db"]["journal"] == []
    assert state["onboarded"] is False
    r = c.patch("/api/v1/settings/", {"activeNorms": ["9001"], "onboarded": True}, format="json")
    assert r.status_code == 200, r.content

    # Connexion classique ensuite.
    r = APIClient().post(
        "/api/v1/auth/login/", {"email": SIGNUP["email"], "password": SIGNUP["password"]}, format="json"
    )
    assert r.status_code == 200


def test_signup_validation(settings, demo_org):
    settings.ALLOW_SIGNUP = True
    c = APIClient()
    r = c.post("/api/v1/auth/signup/", {**SIGNUP, "email": "f.dossou-yovo@agrobenin.bj"}, format="json")
    assert r.status_code == 400 and "email" in r.json()
    r = c.post("/api/v1/auth/signup/", {**SIGNUP, "password": "123"}, format="json")
    assert r.status_code == 400 and "password" in r.json()
    assert Organisation.objects.count() == 1


def test_organisations_are_isolated(settings, api):
    settings.ALLOW_SIGNUP = True
    r = APIClient().post("/api/v1/auth/signup/", SIGNUP, format="json")
    other = APIClient()
    other.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}")
    assert other.get("/api/v1/processus/").json() == []
    assert len(other.get("/api/v1/users/").json()) == 1
    assert other.get("/api/v1/processus/P01/").status_code == 404


# ---------- Invitation et mot de passe ----------


def test_invitation_then_password_confirm(api, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        r = api.post(
            "/api/v1/users/",
            {"nom": "Koffi MENSAH", "email": "k.mensah@agrobenin.bj", "roles": ["Collaborateur"]},
            format="json",
        )
    assert r.status_code == 201, r.content
    assert len(mail.outbox) == 1
    msg = mail.outbox[0]
    assert msg.to == ["k.mensah@agrobenin.bj"]
    assert "Florence DOSSOU-YOVO vous invite" in msg.body
    assert "http://localhost:5174/definir-mot-de-passe?uid=" in msg.body
    user = User.objects.get(email="k.mensah@agrobenin.bj")
    assert not user.has_usable_password()

    uid, token = _link(msg)
    c = APIClient()
    r = c.post(
        "/api/v1/auth/password/confirm/",
        {"uid": uid, "token": token, "password": "Nouveau-mot-de-passe-7"},
        format="json",
    )
    assert r.status_code == 200, r.content
    r = c.post(
        "/api/v1/auth/login/",
        {"email": "k.mensah@agrobenin.bj", "password": "Nouveau-mot-de-passe-7"},
        format="json",
    )
    assert r.status_code == 200
    # Jeton à usage unique : invalidé par le changement de mot de passe.
    r = c.post(
        "/api/v1/auth/password/confirm/",
        {"uid": uid, "token": token, "password": "Encore-un-autre-8"},
        format="json",
    )
    assert r.status_code == 400 and "token" in r.json()


def test_user_with_password_gets_no_invitation(api):
    r = api.post(
        "/api/v1/users/",
        {"nom": "A B", "email": "ab@agrobenin.bj", "password": "Mot-de-passe-9"},
        format="json",
    )
    assert r.status_code == 201
    assert mail.outbox == []


def test_resend_invitation(api, api_collab):
    assert api.post("/api/v1/users/u5/inviter/").status_code == 200
    assert len(mail.outbox) == 1
    assert api_collab.post("/api/v1/users/u5/inviter/").status_code == 403


def test_password_reset_flow(demo_org):
    c = APIClient()
    r = c.post("/api/v1/auth/password/reset/", {"email": "P.Assogba@agrobenin.bj"}, format="json")
    assert r.status_code == 200
    assert len(mail.outbox) == 1 and mail.outbox[0].to == ["p.assogba@agrobenin.bj"]
    uid, token = _link(mail.outbox[0])

    # Unknown e-mail: same answer, no e-mail.
    r2 = c.post("/api/v1/auth/password/reset/", {"email": "personne@exemple.bj"}, format="json")
    assert r2.status_code == 200 and r2.json() == r.json()
    assert len(mail.outbox) == 1

    bad = c.post(
        "/api/v1/auth/password/confirm/",
        {"uid": uid, "token": "mauvais-jeton", "password": "Nouveau-mot-de-passe-7"},
        format="json",
    )
    assert bad.status_code == 400
    weak = c.post(
        "/api/v1/auth/password/confirm/", {"uid": uid, "token": token, "password": "123"}, format="json"
    )
    assert weak.status_code == 400 and "password" in weak.json()
    ok = c.post(
        "/api/v1/auth/password/confirm/",
        {"uid": uid, "token": token, "password": "Nouveau-mot-de-passe-7"},
        format="json",
    )
    assert ok.status_code == 200
    assert User.objects.get(email="p.assogba@agrobenin.bj").check_password("Nouveau-mot-de-passe-7")


def test_password_confirm_rejects_garbage_uid():
    r = APIClient().post(
        "/api/v1/auth/password/confirm/",
        {"uid": "!!", "token": "x", "password": "Abcdef-123456"},
        format="json",
    )
    assert r.status_code == 400
