"""
Récapitulatif e-mail des alertes (commande `send_alerts`).

Les alertes et validations en attente sont celles du tableau de bord
(apps.pilotage.metrics.compute_alerts / pending_validations, sur les données de
l'organisme relues par apps.pilotage.data.load_db) : aucune règle n'est dupliquée ici.

Destinataires :
  - alerte : l'utilisateur dont le nom complet est le responsable (`resp`) de l'alerte ;
  - validation : la personne désignée (metrics.validation_owner) ou, à défaut, les
    utilisateurs ayant le rôle appelé à valider.

Anti-doublon : chaque alerte envoyée est notée dans NotificationLog (utilisateur, jour,
empreinte) ; une alerte déjà notifiée le même jour n'est pas renvoyée, et aucun e-mail
n'est envoyé s'il ne reste rien de nouveau.
"""

import datetime as dt
import hashlib
import logging
import os
from dataclasses import dataclass, field

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

from apps.core.models import Organisation
from apps.core.permissions import is_member
from apps.pilotage import metrics
from apps.pilotage.data import load_db

from .models import NotificationLog, NotificationPreference

logger = logging.getLogger(__name__)

LVL_ORDER = {"red": 0, "amber": 1, "blue": 2}


@dataclass
class Item:
    kind: str  # NotificationLog.Kind
    t: str
    d: str
    lvl: str = "blue"
    page: str = ""

    @property
    def key(self) -> str:
        return hashlib.sha256(f"{self.kind}|{self.t}|{self.d}".encode()).hexdigest()

    @property
    def late(self) -> bool:
        return self.kind == NotificationLog.Kind.ALERTE and self.lvl == "red"


@dataclass
class Digest:
    user: object
    items: list[Item] = field(default_factory=list)

    @property
    def depassees(self) -> list[Item]:
        return [i for i in self.items if i.late]

    @property
    def proches(self) -> list[Item]:
        return [i for i in self.items if i.kind == NotificationLog.Kind.ALERTE and not i.late]

    @property
    def validations(self) -> list[Item]:
        return [i for i in self.items if i.kind == NotificationLog.Kind.VALIDATION]


@dataclass
class Report:
    sent: int = 0
    skipped: int = 0
    failed: int = 0
    lines: list[str] = field(default_factory=list)


def _norm_name(s) -> str:
    return " ".join(str(s or "").split()).casefold()


def digests(org: Organisation, today: dt.date) -> list[Digest]:
    """Alertes et validations de l'organisme réparties par destinataire (préférences appliquées)."""
    db = load_db(org)
    alerts = metrics.compute_alerts(db, today)
    validations = [(v, *metrics.validation_owner(db, v)) for v in metrics.pending_validations(db)]
    users = (
        get_user_model()
        .objects.filter(organisation=org, is_active=True)
        .exclude(email="")
        .select_related("organisation", "notification_preference")
        .order_by("id")
    )
    out = []
    for user in users:
        if not is_member(user):
            continue
        pref = NotificationPreference.for_user(user)
        if not pref.actif:
            continue
        me = _norm_name(user.nom)
        items: list[Item] = []
        if pref.echeances:
            items += [
                Item(NotificationLog.Kind.ALERTE, a["t"], a["d"], a["lvl"], a["page"])
                for a in alerts
                if me and _norm_name(a.get("resp")) == me
            ]
            items.sort(key=lambda i: LVL_ORDER.get(i.lvl, 9))
        if pref.validations:
            items += [
                Item(NotificationLog.Kind.VALIDATION, v["t"], v["d"], "blue", v["page"])
                for v, resp, roles in validations
                if (resp and me and _norm_name(resp) == me) or (not resp and user.has_role(*roles))
            ]
        if items:
            out.append(Digest(user, items))
    return out


def _app_url() -> str:
    return (getattr(settings, "FRONTEND_URL", "") or os.environ.get("FRONTEND_URL", "")).rstrip("/")


def build_message(org: Organisation, digest: Digest, today: dt.date) -> EmailMultiAlternatives:
    n_al = len(digest.depassees) + len(digest.proches)
    n_val = len(digest.validations)
    parts = []
    if n_al:
        parts.append(f"{n_al} alerte{'s' if n_al > 1 else ''}")
    if n_val:
        parts.append(f"{n_val} validation{'s' if n_val > 1 else ''} en attente")
    subject = f"[SM Intégré] {' et '.join(parts)} — {org.nom}"
    ctx = {
        "org": org,
        "user": digest.user,
        "date": metrics.fd(today.isoformat()),
        "depassees": digest.depassees,
        "proches": digest.proches,
        "validations": digest.validations,
        "app_url": _app_url(),
    }
    text = render_to_string("notifications/recap.txt", ctx)
    html = render_to_string("notifications/recap.html", ctx)
    msg = EmailMultiAlternatives(subject, text, settings.DEFAULT_FROM_EMAIL, [digest.user.email])
    msg.attach_alternative(html, "text/html")
    return msg


def send_alerts(today: dt.date, dry_run: bool = False, organisations=None) -> Report:
    """Envoie le récapitulatif du jour à chaque destinataire de chaque organisme."""
    report = Report()
    orgs = organisations if organisations is not None else Organisation.objects.order_by("id")
    for org in orgs:
        for digest in digests(org, today):
            user = digest.user
            already = set(NotificationLog.objects.filter(user=user, date=today).values_list("key", flat=True))
            digest.items = [i for i in digest.items if i.key not in already]
            if not digest.items:
                report.skipped += 1
                report.lines.append(f"{org.nom} · {user.email} : rien de nouveau aujourd'hui")
                continue
            summary = (
                f"{org.nom} · {user.email} : {len(digest.depassees)} dépassée(s), "
                f"{len(digest.proches)} proche(s), {len(digest.validations)} validation(s)"
            )
            if dry_run:
                report.lines.append(f"[simulation] {summary}")
                report.sent += 1
                continue
            try:
                build_message(org, digest, today).send()
            except Exception:  # un échec SMTP ne bloque pas les autres destinataires
                logger.exception("Échec d'envoi du récapitulatif à %s", user.email)
                report.failed += 1
                report.lines.append(f"ÉCHEC {summary}")
                continue
            NotificationLog.objects.bulk_create(
                [
                    NotificationLog(
                        organisation=org, user=user, date=today, key=i.key, kind=i.kind, titre=i.t[:255]
                    )
                    for i in digest.items
                ],
                ignore_conflicts=True,
            )
            report.sent += 1
            report.lines.append(summary)
    return report
