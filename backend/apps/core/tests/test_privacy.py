"""Données personnelles : export (accès / portabilité), anonymisation (effacement), purge des traces."""

import copy
import datetime as dt
import json

import pytest
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from apps.core import registry
from apps.core.demo import load_demo
from apps.core.models import AuditLog, JournalEntry
from apps.notifications.models import NotificationLog, NotificationPreference

pytestmark = pytest.mark.django_db

PRISCA = "Prisca ASSOGBA"
PRISCA_EMAIL = "p.assogba@agrobenin.bj"
EXPORT = "/api/v1/auth/me/export/"


def _anon_url(user):
    return f"/api/v1/users/{user.uid}/anonymiser/"


@pytest.fixture
def prisca(demo_org):
    return demo_org.users.get(email=PRISCA_EMAIL)


@pytest.fixture
def org_b(demo_org, demo_data):
    """Second organisme : même démo (mêmes noms de personnes), e-mails distincts."""
    data = copy.deepcopy(demo_data)
    for u in data["users"]:
        u["email"] = "b." + u["email"]
    return load_demo(data, password="Test-pass-123!")


def _login(email):
    r = APIClient().post("/api/v1/auth/login/", {"email": email, "password": "Test-pass-123!"}, format="json")
    assert r.status_code == 200, r.content
    return r.json()


# ---------- Export (droit d'accès et à la portabilité) ----------


def test_export_contains_personal_data_only(api_collab, prisca, org_b):
    NotificationPreference.objects.create(user=prisca, actif=False)
    NotificationLog.objects.create(
        organisation=prisca.organisation,
        user=prisca,
        date=dt.date(2026, 9, 1),
        key="k",
        kind="alerte",
        titre="T",
    )
    r = api_collab.get(EXPORT)
    assert r.status_code == 200, r.content
    assert r["Content-Disposition"].startswith('attachment; filename="donnees-personnelles-')
    assert r["Cache-Control"] == "no-store"
    body = json.loads(r.content)
    compte = body["compte"]
    assert compte["nom"] == PRISCA and compte["email"] == PRISCA_EMAIL
    assert "password" not in json.dumps(body)
    assert body["preferencesNotifications"]["actif"] is False
    assert [n["titre"] for n in body["notificationsEnvoyees"]] == ["T"]
    assert all(e["u"] == PRISCA for e in body["journal"])
    # Éléments du registre où elle est nommée, dans son organisme seulement.
    mentions = {(m["collection"], m["id"]): m["champs"] for m in body["mentions"]}
    assert mentions[("processus", "P05")] == ["copilote"]
    assert any("detenteurs" in champs for champs in mentions.values())
    assert body["organisme"]["nom"] == prisca.organisation.nom


def test_export_is_journaled_and_includes_own_audit_log(api_collab, api, prisca):
    api.patch("/api/v1/auth/me/notifications/", {"actif": False}, format="json")  # AuditLog de Florence
    api_collab.patch("/api/v1/auth/me/notifications/", {"echeances": False}, format="json")
    body = api_collab.get(EXPORT).json()
    assert [t["collection"] for t in body["traceTechnique"]] == ["notificationPreferences"]
    assert body["traceTechnique"][0]["donnees"]["echeances"] is False
    entry = JournalEntry.objects.filter(organisation=prisca.organisation).first()
    assert (entry.u, entry.a, entry.user_id) == (PRISCA, "a exporté ses données personnelles", prisca.pk)
    # Le second export inclut l'entrée du premier.
    body = api_collab.get(EXPORT).json()
    assert body["journal"][-1]["a"] == "a exporté ses données personnelles"


def test_export_requires_authentication_and_is_throttled(api_collab, settings):
    assert APIClient().get(EXPORT).status_code == 401
    rates = settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]
    settings.REST_FRAMEWORK = {
        **settings.REST_FRAMEWORK,
        "DEFAULT_THROTTLE_RATES": {**rates, "export": "2/hour"},
    }
    from rest_framework.throttling import ScopedRateThrottle

    ScopedRateThrottle.THROTTLE_RATES = settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]
    try:
        assert [api_collab.get(EXPORT).status_code for _ in range(3)] == [200, 200, 429]
    finally:
        ScopedRateThrottle.THROTTLE_RATES = rates


def test_export_allowed_for_external_auditor(demo_org, prisca):
    # Droit d'accès maintenu même quand l'accès auditeur aux données de l'organisme est coupé.
    prisca.roles = ["Auditeur externe"]
    prisca.save()
    demo_org.auditor_access = False
    demo_org.save()
    c = APIClient()
    c.force_authenticate(prisca)
    assert c.get("/api/v1/bootstrap/").status_code == 403
    assert c.get(EXPORT).status_code == 200


# ---------- Anonymisation (droit à l'effacement) ----------


def test_anonymise_account_and_revoke_tokens(api, prisca, demo_org):
    tokens = _login(PRISCA_EMAIL)
    NotificationPreference.objects.create(user=prisca)
    NotificationLog.objects.create(
        organisation=demo_org, user=prisca, date=dt.date(2026, 9, 1), key="k", kind="alerte"
    )
    JournalEntry.objects.create(
        organisation=demo_org, user=prisca, d="2026-09-01 10:00", u=PRISCA, a="a déclaré une NC", mod="NC"
    )
    journal_before = JournalEntry.objects.filter(organisation=demo_org, u=PRISCA).count()

    r = api.post(_anon_url(prisca), {}, format="json")
    assert r.status_code == 200, r.content
    body = r.json()
    label = f"Utilisateur supprimé #{prisca.pk}"
    assert body == {
        "id": prisca.uid,
        "nom": label,
        "jetonsRevoques": 1,
        "remplacementsDonnees": 0,
        "journalPseudonymise": 0,
    }
    prisca.refresh_from_db()
    assert prisca.nom == label and not prisca.is_active and not prisca.has_usable_password()
    assert prisca.email == f"utilisateur-supprime-{prisca.pk}@anonymise.invalid"
    assert prisca.poste == prisca.direction == "" and prisca.roles == []
    assert not NotificationPreference.objects.filter(user=prisca).exists()
    assert not NotificationLog.objects.filter(user=prisca).exists()
    assert (
        BlacklistedToken.objects.filter(token__user=prisca).count()
        == OutstandingToken.objects.filter(user=prisca).count()
    )

    # Jetons révoqués : renouvellement refusé ; jeton d'accès refusé (compte inactif) ;
    # plus de connexion possible avec l'ancien e-mail.
    c = APIClient()
    assert c.post("/api/v1/auth/refresh/", {"refresh": tokens["refresh"]}, format="json").status_code == 401
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    assert c.get("/api/v1/auth/me/").status_code == 401
    r = APIClient().post(
        "/api/v1/auth/login/", {"email": PRISCA_EMAIL, "password": "Test-pass-123!"}, format="json"
    )
    assert r.status_code == 401

    # Sans l'option : historique intact (traçabilité), registre inchangé.
    assert JournalEntry.objects.filter(organisation=demo_org, u=PRISCA).count() == journal_before
    assert registry.get("processus").model.objects.get(organisation=demo_org, uid="P05").copilote == [PRISCA]
    # L'action elle-même est tracée, sans le nom effacé.
    last = JournalEntry.objects.filter(organisation=demo_org).first()
    assert last.a.startswith(f"a anonymisé le compte {label}") and PRISCA not in last.a
    log = AuditLog.objects.filter(organisation=demo_org, collection="users").first()
    assert log.data == {"anonymise": True, "remplacerDansDonnees": False}
    # Le compte reste listé (neutre) : les références d'historique restent cohérentes.
    users = {u["id"]: u for u in api.get("/api/v1/users/").json()}
    assert users[prisca.uid]["nom"] == label


def test_anonymise_with_replacement_in_data(api, api_collab, prisca, demo_org, org_b, demo_data):
    api_collab.get(EXPORT)  # entrée de journal à son nom
    api_collab.patch("/api/v1/auth/me/notifications/", {"actif": False}, format="json")
    AuditLog.objects.create(
        organisation=demo_org,
        user=api.user,
        collection="processus",
        uid="P05",
        action="update",
        data={"copilote": [PRISCA]},
    )
    r = api.post(_anon_url(prisca), {"remplacerDansDonnees": True}, format="json")
    assert r.status_code == 200, r.content
    body = r.json()
    label = body["nom"]
    assert body["remplacementsDonnees"] >= 6 and body["journalPseudonymise"] >= 1

    # Plus aucune mention de son nom dans l'état de l'organisme…
    state = api.get("/api/v1/bootstrap/").json()
    dump = json.dumps(state, ensure_ascii=False)
    assert PRISCA not in dump
    assert state["db"]["processus"][[p["id"] for p in state["db"]["processus"]].index("P05")]["copilote"] == [
        label
    ]
    assert "Serge KOUTON, Estelle KPADONOU, " + label in dump
    # … ni dans le journal ni dans la trace technique (historique conservé, pseudonymisé).
    assert not JournalEntry.objects.filter(organisation=demo_org, u=PRISCA).exists()
    assert JournalEntry.objects.filter(organisation=demo_org, u=label, user=prisca).exists()
    assert not any(
        PRISCA in json.dumps(a.data, ensure_ascii=False)
        for a in AuditLog.objects.filter(organisation=demo_org)
    )

    # Autre organisme : strictement intact (fidélité à la démo, homonyme compris).
    b_user = org_b.users.get(email="b." + PRISCA_EMAIL)
    assert b_user.nom == PRISCA and b_user.is_active
    c = APIClient()
    c.force_authenticate(org_b.users.get(email="b.f.dossou-yovo@agrobenin.bj"))
    state_b = c.get("/api/v1/bootstrap/").json()
    for col in registry.all_collections():
        expected = demo_data["db"].get(col.name, None if col.in_demo else [])
        assert state_b["db"][col.name] == expected, col.name
    assert state_b["db"]["journal"] == demo_data["db"]["journal"]
    assert state_b["org"] == demo_data["org"]


def test_anonymise_guards(api, api_admin, prisca, demo_org):
    # Soi-même : refusé.
    r = api.post(_anon_url(api.user), {}, format="json")
    assert r.status_code == 400 and "propre compte" in r.json()["detail"]
    # Corps invalide.
    assert (
        api.post(_anon_url(prisca), {"remplacerDansDonnees": "peut-être"}, format="json").status_code == 400
    )
    # Deux fois : refusé la seconde.
    assert api.post(_anon_url(prisca), {}, format="json").status_code == 200
    assert api.post(_anon_url(prisca), {}, format="json").status_code == 400


def test_anonymise_last_admin_refused(demo_org):
    admins = [u for u in demo_org.users.all() if u.has_role("Responsable SM", "Administrateur système")]
    assert len(admins) >= 2
    keeper, target = admins[0], admins[1]
    # Tous les autres administrateurs perdent leur rôle : `keeper`, superutilisateur de la
    # plateforme sans rôle d'administration, tente d'anonymiser le dernier administrateur.
    for u in admins:
        if u is not target:
            u.roles = [r for r in u.roles if r not in ("Responsable SM", "Administrateur système")]
            u.save()
    keeper.is_superuser = True
    keeper.save()
    c = APIClient()
    c.force_authenticate(keeper)
    r = c.post(_anon_url(target), {}, format="json")
    assert r.status_code == 400 and "dernier administrateur" in r.json()["detail"]
    target.refresh_from_db()
    assert target.is_active and "@anonymise.invalid" not in target.email


def test_anonymise_rights_and_isolation(api, api_collab, prisca, org_b):
    # Collaborateur : pas d'administration.
    assert api_collab.post(_anon_url(api.user), {}, format="json").status_code == 403
    # Administrateur d'un autre organisme : 404, rien n'est modifié (uid absent de son organisme).
    prisca.uid = "zz9"
    prisca.save()
    c = APIClient()
    c.force_authenticate(org_b.users.get(email="b.f.dossou-yovo@agrobenin.bj"))
    assert c.post(_anon_url(prisca), {}, format="json").status_code == 404
    prisca.refresh_from_db()
    assert prisca.nom == PRISCA and prisca.is_active
    # Compte de la plateforme (staff) : non modifiable par un administrateur d'organisme.
    prisca.is_staff = True
    prisca.save()
    assert api.post(_anon_url(prisca), {}, format="json").status_code == 403
    # Non authentifié.
    assert APIClient().post(_anon_url(prisca), {}, format="json").status_code == 401


def test_anonymise_is_atomic(api, prisca, monkeypatch):
    from apps.core import privacy

    def boom(*a, **k):
        raise RuntimeError("panne")

    monkeypatch.setattr(privacy, "pseudonymise_logs", boom)
    client = api
    client.raise_request_exception = False
    r = client.post(_anon_url(prisca), {"remplacerDansDonnees": True}, format="json")
    assert r.status_code == 500
    prisca.refresh_from_db()
    assert prisca.nom == PRISCA and prisca.is_active
    assert registry.get("processus").model.objects.get(
        organisation=prisca.organisation, uid="P05"
    ).copilote == [PRISCA]


# ---------- Conservation : purge des traces techniques ----------


def _age(qs, field, days):
    qs.update(**{field: timezone.now() - dt.timedelta(days=days)})


def test_purge_logs(demo_org, prisca, settings, capsys):
    old = AuditLog.objects.create(organisation=demo_org, user=prisca, collection="x", action="update")
    new = AuditLog.objects.create(organisation=demo_org, user=prisca, collection="x", action="update")
    old_n = NotificationLog.objects.create(
        organisation=demo_org, user=prisca, date=dt.date(2025, 1, 1), key="a", kind="alerte"
    )
    new_n = NotificationLog.objects.create(
        organisation=demo_org, user=prisca, date=dt.date(2026, 9, 1), key="b", kind="alerte"
    )
    _age(AuditLog.objects.filter(pk=old.pk), "at", 400)
    _age(NotificationLog.objects.filter(pk=old_n.pk), "sent_at", 400)
    journal = JournalEntry.objects.count()
    JournalEntry.objects.update(created_at=timezone.now() - dt.timedelta(days=4000))

    # 0 (défaut) : rien.
    settings.AUDITLOG_RETENTION_DAYS = 0
    call_command("purge_logs")
    assert AuditLog.objects.filter(pk=old.pk).exists()

    call_command("purge_logs", "--days", "365", "--dry-run")
    assert "1 AuditLog et 1 NotificationLog seraient supprimés" in capsys.readouterr().out
    assert AuditLog.objects.filter(pk=old.pk).exists()

    settings.AUDITLOG_RETENTION_DAYS = 365
    call_command("purge_logs")
    assert not AuditLog.objects.filter(pk=old.pk).exists() and AuditLog.objects.filter(pk=new.pk).exists()
    assert not NotificationLog.objects.filter(pk=old_n.pk).exists()
    assert NotificationLog.objects.filter(pk=new_n.pk).exists()
    assert JournalEntry.objects.count() == journal  # journal fonctionnel jamais purgé


def test_purge_logs_rejects_negative_days():
    from django.core.management.base import CommandError

    with pytest.raises(CommandError):
        call_command("purge_logs", "--days", "-1")
