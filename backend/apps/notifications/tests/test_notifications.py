"""Notifications e-mail : destinataires, contenu, anti-doublon, désabonnement, simulation."""

import datetime as dt
from io import StringIO

import pytest
from django.core import mail
from django.core.management import call_command
from django.core.management.base import CommandError
from rest_framework.test import APIClient

from apps.core.models import Organisation, User
from apps.notifications.models import NotificationLog, NotificationPreference
from apps.notifications.services import digests
from apps.pilotage import metrics
from apps.pilotage.data import load_db

DAY = "2026-09-21"  # date figée de la démo
LOCMEM = "django.core.mail.backends.locmem.EmailBackend"


@pytest.fixture(autouse=True)
def _locmem(settings):
    settings.EMAIL_BACKEND = LOCMEM
    settings.DEFAULT_FROM_EMAIL = "SM Intégré <no-reply@sm-integre.test>"


def run(*args) -> str:
    out = StringIO()
    call_command("send_alerts", *args, stdout=out)
    return out.getvalue()


def _mail_to(email):
    return [m for m in mail.outbox if m.to == [email]]


def test_recipients_follow_alerts_and_validations(demo_org):
    today = dt.date.fromisoformat(DAY)
    db = load_db(demo_org)
    alerts = metrics.compute_alerts(db, today)
    by_user = {d.user.nom: d for d in digests(demo_org, today)}
    # chaque alerte dont le responsable est un utilisateur lui est adressée
    names = set(demo_org.users.values_list("nom", flat=True))
    for a in alerts:
        if a["resp"] in names:
            assert a["t"] in [i.t for i in by_user[a["resp"]].items]
    # validations : pilote du processus pour la NC (n1), rôles sinon
    kouton = by_user["Serge KOUTON"]
    assert any(i.kind == "validation" and i.t.startswith("NC-") for i in kouton.items)
    florence = by_user["Florence DOSSOU-YOVO"]  # Responsable SM : vérification documentaire, NC en n2
    assert {i.d for i in florence.validations} >= {
        "Document en vérification",
        "Approbation par le responsable du système",
    }
    dg = by_user["Rodrigue AHOUANSOU"]  # Dirigeant : déclaration et ressource soumises
    assert {i.d for i in dg.validations} == {
        "Déclaration à valider par le Directeur Général",
        "Demande de ressource — circuit Finance",
    }
    # personne sans alerte ni rôle de validation : pas de récapitulatif
    assert "Prisca ASSOGBA" not in by_user


def test_validation_owner():
    db = {
        "processus": [{"id": "P01", "proprietaire": "Pilote Un"}],
        "documents": [
            {"id": "D1", "statut": "Approbation", "approbateur": "Appro Bateur"},
            {"id": "D2", "statut": "Vérification", "approbateur": "Appro Bateur"},
        ],
        "ncs": [
            {"id": "N1", "n1": "En attente", "n2": "En attente", "processus": "P01"},
            {"id": "N2", "n1": "Validé", "n2": "En attente", "processus": "P01"},
        ],
    }
    owners = [metrics.validation_owner(db, v) for v in metrics.pending_validations(db)]
    assert owners == [
        ("Appro Bateur", ()),
        ("", ("Responsable SM",)),
        ("Pilote Un", ()),
        ("", ("Responsable SM",)),
    ]


def test_send_email_content(demo_org):
    out = run("--today", DAY)
    assert "e-mail(s) envoyé(s)" in out
    assert len(mail.outbox) == len(digests(demo_org, dt.date.fromisoformat(DAY)))
    [m] = _mail_to("c.agbodjan@agrobenin.bj")
    assert m.subject.startswith("[SM Intégré] ") and "AGRO-BÉNIN" in m.subject
    assert "alertes" in m.subject and "validation en attente" in m.subject
    assert m.from_email == "SM Intégré <no-reply@sm-integre.test>"
    assert "Bonjour Cédric AGBODJAN" in m.body
    assert "ÉCHÉANCES DÉPASSÉES (3)" in m.body and "Traitement du risque R03 en retard" in m.body
    assert "VALIDATIONS EN ATTENTE (1)" in m.body
    html, mime = m.alternatives[0]
    assert (
        mime == "text/html" and "Échéances dépassées (3)" in html and "Récapitulatif du 21 sept. 2026" in html
    )
    assert "&lt;" not in m.body  # texte brut non échappé
    user = User.objects.get(email="c.agbodjan@agrobenin.bj")
    assert NotificationLog.objects.filter(user=user, date=DAY).count() == 7


def test_no_duplicate_same_day(demo_org):
    run("--today", DAY)
    sent = len(mail.outbox)
    logs = NotificationLog.objects.count()
    out = run("--today", DAY)
    assert len(mail.outbox) == sent and NotificationLog.objects.count() == logs
    assert "rien de nouveau" in out and "0 e-mail(s) envoyé(s)" in out
    # une nouvelle alerte le même jour : seul le nouveau point est envoyé
    from apps.core import registry

    ncs = registry.get("ncs").model
    nc = ncs.objects.filter(organisation=demo_org, n1="En attente").first()
    ncs.objects.filter(pk=nc.pk).update(uid="NC99", ref="NC-2026-099")
    run("--today", DAY)
    new = mail.outbox[sent:]
    assert new and all("NC-2026-099" in m.body for m in new)
    assert all("Traitement du risque R03" not in m.body for m in new)
    # le lendemain, les alertes toujours actives sont renvoyées
    run("--today", "2026-09-22")
    assert _mail_to("b.sossa@agrobenin.bj")[-1] is not None
    assert len(_mail_to("b.sossa@agrobenin.bj")) == 2


def test_dry_run_sends_and_records_nothing(demo_org):
    out = run("--dry-run", "--today", DAY)
    assert "[simulation]" in out and "c.agbodjan@agrobenin.bj" in out and "à envoyer" in out
    assert mail.outbox == [] and not NotificationLog.objects.exists()


def test_bad_date():
    with pytest.raises(CommandError):
        run("--today", "21/09/2026")


def test_preferences_endpoint_and_unsubscribe(demo_org, api_collab):
    r = api_collab.get("/api/v1/auth/me/notifications/")
    assert r.status_code == 200
    assert r.json() == {
        "email": "p.assogba@agrobenin.bj",
        "actif": True,
        "echeances": True,
        "validations": True,
    }
    # même un utilisateur en lecture seule gère ses propres préférences
    r = api_collab.patch("/api/v1/auth/me/notifications/", {"actif": False}, format="json")
    assert r.status_code == 200 and r.json()["actif"] is False
    assert NotificationPreference.objects.get(user=api_collab.user).actif is False
    assert APIClient().get("/api/v1/auth/me/notifications/").status_code == 401


def test_unsubscribed_user_gets_nothing(demo_org, api):
    api.patch("/api/v1/auth/me/notifications/", {"actif": False}, format="json")
    kouton = User.objects.get(email="s.kouton@agrobenin.bj")
    NotificationPreference.objects.create(user=kouton, validations=False)
    run("--today", DAY)
    assert _mail_to(api.user.email) == []
    [m] = _mail_to(kouton.email)
    assert "VALIDATIONS EN ATTENTE" not in m.body and "ÉCHÉANCES DÉPASSÉES" in m.body
    # réabonnement
    api.patch("/api/v1/auth/me/notifications/", {"actif": True}, format="json")
    run("--today", DAY)
    assert len(_mail_to(api.user.email)) == 1


def test_inactive_and_other_org_users_skipped(demo_org):
    User.objects.filter(email="b.sossa@agrobenin.bj").update(is_active=False)
    other = Organisation.objects.create(nom="Autre")
    User.objects.create_user(
        email="x@autre.bj",
        password="x-Test-pass-1",
        organisation=other,
        nom="Bertin SOSSA",
        roles=["Dirigeant"],
    )
    run("--today", DAY)
    assert _mail_to("b.sossa@agrobenin.bj") == []
    # homonyme dans un autre organisme vide : aucune alerte ne le concerne
    assert _mail_to("x@autre.bj") == []


def test_smtp_failure_is_reported_and_not_logged(demo_org, monkeypatch):
    def boom(self, *a, **k):
        raise OSError("SMTP indisponible")

    monkeypatch.setattr("django.core.mail.EmailMultiAlternatives.send", boom)
    with pytest.raises(CommandError):
        run("--today", DAY)
    assert not NotificationLog.objects.exists()
