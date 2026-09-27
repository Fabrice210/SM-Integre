"""
Audit de sécurité générique, sur TOUTES les routes générées par le registre :

  1. isolation multi-organisme : un utilisateur d'un autre organisme obtient 404 sur
     chaque élément (lecture, PUT, PATCH, DELETE, actions détaillées) ;
  2. droits : un Collaborateur reçoit 403 sur chaque route d'écriture, sauf la liste
     blanche explicite (OPEN_TO_MEMBERS) ;
  3. auditeurs externes : lecture seule, aucun accès si auditorAccess=false ;
  4. « fuzz » léger : corps vides, types faux, dates invalides, normes inconnues ->
     jamais de 500.

Les deux organismes sont chargés une fois pour le module (chargement de la démo coûteux) ;
chaque test reste isolé dans sa transaction (annulée à la fin).
"""

import re

import pytest
from django.db import transaction
from django.test import override_settings
from rest_framework.test import APIClient

from apps.core import registry
from apps.core.demo import load_demo
from apps.core.models import Organisation, Role
from apps.core.naming import to_camel
from apps.core.viewsets import OrgModelViewSet

pytestmark = pytest.mark.django_db

API = "/api/v1/"
ISO_UID = "ZZISO1"  # élément présent uniquement dans l'organisme A
OTHER_USER_UID = "uZZ"

# Routes d'écriture ouvertes à tout membre (hors auditeurs externes) : accusé de lecture,
# déclaration de NC, journal. Les règles plus fines (demandeur d'une ressource, rédacteur /
# propriétaire / approbateur d'un document, responsable d'une évaluation de formation,
# porteur d'une action de communication) ne s'appliquent qu'aux personnes nommées dans
# l'élément : un collaborateur quelconque reçoit 403, ce que vérifie le test générique.
OPEN_TO_MEMBERS = {
    ("POST", "accuses/accuser-lecture/"),
    ("POST", "ncs/"),
    ("POST", "journal/"),
}

FAST_HASHER = ["django.contrib.auth.hashers.MD5PasswordHasher"]


def _other_demo(demo_data):
    return {
        **demo_data,
        "org": {**demo_data["org"], "nom": "Autre organisme"},
        "users": [{**u, "email": "autre." + u["email"]} for u in demo_data["users"]],
    }


@pytest.fixture(scope="module")
def orgs(django_db_setup, django_db_blocker, demo_data):
    """Organismes A et B (même démo), plus un élément « ZZISO1 » par collection dans A seulement."""
    with django_db_blocker.unblock(), override_settings(PASSWORD_HASHERS=FAST_HASHER):
        with transaction.atomic():
            # Restes d'une exécution interrompue (--reuse-db) : données validées hors transaction.
            Organisation.objects.filter(users__email__in=["f.dossou-yovo@agrobenin.bj"]).delete()
            Organisation.objects.filter(users__email__in=["autre.f.dossou-yovo@agrobenin.bj"]).delete()
            a = load_demo(demo_data, password="Test-pass-123!")
            b = load_demo(_other_demo(demo_data), password="Test-pass-123!")
            for col in registry.all_collections():
                if col.singleton:
                    continue
                obj = col.model.objects.filter(organisation=a).order_by("position", "id").first()
                if obj is not None:
                    col.model.objects.filter(pk=obj.pk).update(uid=ISO_UID)
            u = a.users.get(uid="u14")
            u.uid = OTHER_USER_UID
            u.save(update_fields=["uid"])
            a.users.create_user(
                email="auditeur.externe@cabinet.bj",
                password="Test-pass-123!",
                organisation=a,
                uid="u90",
                nom="Auditeur EXTERNE",
                roles=[Role.AUDITEUR_EXTERNE],
            )
        yield a, b
        with transaction.atomic():
            for org in (a, b):
                Organisation.objects.filter(pk=org.pk).delete()


def _client(user):
    c = APIClient()
    c.force_authenticate(user)
    c.raise_request_exception = False
    c.user = user
    return c


def _user(org, email):
    return org.users.get(email=email)


@pytest.fixture
def rsm_a(orgs):
    return _client(_user(orgs[0], "f.dossou-yovo@agrobenin.bj"))


@pytest.fixture
def rsm_b(orgs):
    return _client(_user(orgs[1], "autre.f.dossou-yovo@agrobenin.bj"))


@pytest.fixture
def admin_b(orgs):
    return _client(_user(orgs[1], "autre.h.djossou@agrobenin.bj"))


@pytest.fixture
def collab_a(orgs):
    return _client(_user(orgs[0], "p.assogba@agrobenin.bj"))


@pytest.fixture
def auditeur_ext(orgs):
    return _client(_user(orgs[0], "auditeur.externe@cabinet.bj"))


# ---------- Inventaire des routes ----------


def _path(url_path: str) -> str:
    """exercices/(?P<index>\\d+)/compte-rendu -> exercices/0/compte-rendu"""
    return re.sub(r"\(\?P<\w+>[^)]*\)", "0", url_path)


def _viewset(col):
    from apps.core.viewsets import SingletonViewSet

    return col.viewset or (SingletonViewSet if col.singleton else OrgModelViewSet)


def _has_detail(col) -> bool:
    return not col.singleton and hasattr(_viewset(col), "retrieve")


def routes(col):
    """[(méthode, url relative à /api/v1/, détail ?)] de la collection (hors lecture de liste)."""
    vs = _viewset(col)
    base = f"{col.url}/"
    out = []
    if col.singleton:
        out += [("PUT", base, False), ("PATCH", base, False)]
    else:
        if hasattr(vs, "create"):
            out.append(("POST", base, False))
        if _has_detail(col):
            detail = f"{base}{ISO_UID}/"
            out.append(("GET", detail, True))
            if hasattr(vs, "update"):
                out += [("PUT", detail, True), ("PATCH", detail, True)]
            if hasattr(vs, "destroy"):
                out.append(("DELETE", detail, True))
    for act in vs.get_extra_actions():
        for method in act.mapping:
            m = method.upper()
            if act.detail:
                out.append((m, f"{base}{ISO_UID}/{_path(act.url_path)}/", True))
            else:
                out.append((m, f"{base}{_path(act.url_path)}/", False))
    return out


COLLECTIONS = [c.name for c in registry.all_collections()]
CORE_WRITES = [
    ("POST", "users/"),
    ("PUT", f"users/{OTHER_USER_UID}/"),
    ("PATCH", f"users/{OTHER_USER_UID}/"),
    ("DELETE", f"users/{OTHER_USER_UID}/"),
    ("PUT", "organisation/"),
    ("PATCH", "organisation/"),
    ("PUT", "settings/"),
    ("PATCH", "settings/"),
    ("POST", "journal/"),
]
READS = [
    "bootstrap/",
    "auth/me/",
    "dashboard/",
    "alerts/",
    "journal/",
    "users/",
    "organisation/",
    "settings/",
]


def _call(client, method, url, data=None):
    return getattr(client, method.lower())(API + url, data if data is not None else {}, format="json")


def _is_write(method):
    return method not in ("GET", "HEAD", "OPTIONS")


# ---------- 1. Isolation multi-organisme ----------


def test_every_collection_has_an_isolated_item(orgs):
    a, b = orgs
    for col in registry.all_collections():
        if _has_detail(col):
            assert col.model.objects.filter(organisation=a, uid=ISO_UID).exists(), col.name
            assert not col.model.objects.filter(organisation=b, uid=ISO_UID).exists(), col.name


@pytest.mark.parametrize("name", COLLECTIONS)
def test_other_org_gets_404(rsm_b, orgs, name):
    col = registry.get(name)
    detail = [(m, u) for m, u, is_detail in routes(col) if is_detail]
    for method, url in detail:
        r = _call(rsm_b, method, url)
        assert r.status_code == 404, (method, url, r.status_code, r.content[:300])
    if not col.singleton:
        rows = rsm_b.get(f"{API}{col.url}/").json()
        assert all(row.get("id") != ISO_UID for row in rows), name
    # Rien n'a été modifié dans l'organisme A.
    if _has_detail(col):
        assert col.model.objects.filter(organisation=orgs[0], uid=ISO_UID).exists()


def test_other_org_users_404(admin_b):
    for method, url in CORE_WRITES:
        if OTHER_USER_UID in url:
            r = _call(admin_b, method, url)
            assert r.status_code == 404, (method, url, r.status_code)
    assert admin_b.get(f"{API}users/{OTHER_USER_UID}/").status_code == 404
    assert all(u["id"] != OTHER_USER_UID for u in admin_b.get(f"{API}users/").json())


def test_other_org_data_absent_from_aggregates(rsm_b):
    state = rsm_b.get(f"{API}bootstrap/").json()
    for name, rows in state["db"].items():
        if isinstance(rows, list):
            assert all(not isinstance(r, dict) or r.get("id") != ISO_UID for r in rows), name
    assert all(u["id"] != OTHER_USER_UID for u in state["users"])
    for url in ("dashboard/", "alerts/"):
        r = rsm_b.get(API + url)
        assert r.status_code == 200
        assert ISO_UID not in r.content.decode()


# ---------- 2. Droits : un collaborateur ne modifie rien (hors liste blanche) ----------


@pytest.mark.parametrize("name", COLLECTIONS)
def test_collaborateur_cannot_write(collab_a, name):
    col = registry.get(name)
    for method, url, _ in routes(col):
        if not _is_write(method) or (method, url) in OPEN_TO_MEMBERS:
            continue
        r = _call(collab_a, method, url)
        assert r.status_code == 403, (method, url, r.status_code, r.content[:300])


def test_collaborateur_core_writes(collab_a):
    for method, url in CORE_WRITES:
        if (method, url) in OPEN_TO_MEMBERS:
            continue
        r = _call(collab_a, method, url)
        assert r.status_code == 403, (method, url, r.status_code)


def test_collaborateur_whitelist(collab_a):
    r = _call(collab_a, "POST", "accuses/accuser-lecture/")
    assert r.status_code in (200, 201), r.content
    r = _call(collab_a, "POST", "journal/", {"d": "2026-09-26 10:00", "a": "test", "mod": "GED"})
    assert r.status_code == 201, r.content
    r = _call(
        collab_a,
        "POST",
        "ncs/",
        {
            "categorie": "Non-conformité",
            "source": "Terrain",
            "description": "Écart constaté",
            "processus": "P05",
            "normes": ["9001"],
            "lieu": "Atelier",
        },
    )
    assert r.status_code == 201, r.content
    assert r.json()["statut"] == "Déclarée"


# ---------- 3. Auditeurs externes ----------


@pytest.mark.parametrize("name", COLLECTIONS)
def test_auditeur_externe_read_only(auditeur_ext, name):
    col = registry.get(name)
    assert auditeur_ext.get(f"{API}{col.url}/").status_code == 200
    for method, url, _ in routes(col):
        if _is_write(method):
            r = _call(auditeur_ext, method, url)
            assert r.status_code == 403, (method, url, r.status_code, r.content[:300])
        elif not url.endswith("/fichier/"):
            assert _call(auditeur_ext, method, url).status_code == 200, (method, url)


def test_auditeur_externe_core(auditeur_ext):
    for url in READS:
        assert auditeur_ext.get(API + url).status_code in (200, 403), url
    for url in ("bootstrap/", "auth/me/", "dashboard/", "journal/"):
        assert auditeur_ext.get(API + url).status_code == 200, url
    for method, url in CORE_WRITES:
        assert _call(auditeur_ext, method, url).status_code == 403, (method, url)


def test_auditeur_externe_without_access(auditeur_ext, orgs):
    a = orgs[0]
    Organisation.objects.filter(pk=a.pk).update(auditor_access=False)
    auditeur_ext.user.organisation.refresh_from_db()
    for url in READS:
        assert auditeur_ext.get(API + url).status_code == 403, url
    for col in registry.all_collections():
        assert auditeur_ext.get(f"{API}{col.url}/").status_code == 403, col.name
    assert _call(auditeur_ext, "POST", "ncs/").status_code == 403


# ---------- 5. Validation : jamais de 500 ----------

BAD_VALUES = [
    ["x", 1],
    [{"a": 1}],
    "texte",
    12345,
    -1,
    1e308,
    {"a": {"b": 1}},
    None,
    True,
    "2026-13-45",
    "",
    "../../etc/passwd",
    10**30,
    "a\x00b",
]
BAD_BODIES = [{}, [], [{"a": 1}], "texte", 42, None]
BAD_NORMES = [["9999"], "9001", 5, [{"a": 1}], {"9001": True}, [["9001"]], [None]]
# Clés utilisées par les corps des actions métier (tous modules).
ACTION_KEYS = (
    "efficacite decision commentaire mode destinataire processus motif date contenu diffusion accuse "
    "compteRendu actions creer planAction statutPlan preuve1 preuve2 orientations signataire collaborateur "
    "competence niveau nom direction csv resultat evaluationDate preuve dateRealisation objectifs "
    "participants scenario procedure type description rapport libelle responsable echeance statut cause "
    "action miseEnOeuvre qualite delai securite environnement doc canal destinataires piece id"
).split()


def _no_500(client, method, url, data, recompute=False):
    """
    Chaque appel est annulé (point de sauvegarde) : l'élément visé reste dans son état initial.
    `recompute` : si l'écriture est acceptée, le tableau de bord et les alertes
    doivent encore se calculer avec la donnée enregistrée.
    """
    with transaction.atomic():
        r = _call(client, method, url, data)
        if recompute and r.status_code < 300:
            for read in ("dashboard/", "alerts/"):
                rr = client.get(API + read)
                assert rr.status_code == 200, (method, url, data, read, rr.status_code)
        transaction.set_rollback(True)
    assert r.status_code < 500, (method, url, data, r.status_code)
    return r


def _fields(col):
    ser = col.serializer(context={"organisation": None})
    out = []
    for name, f in ser.fields.items():
        if f.read_only:
            continue
        out.append("id" if name == "uid" else to_camel(name))
    return out


@pytest.mark.parametrize("name", COLLECTIONS)
def test_fuzz_never_500(rsm_a, name):
    col = registry.get(name)
    base = f"{col.url}/"
    fields = [] if col.name == "sourcesNC" else _fields(col)
    targets = []  # (méthode, url, corps valide de départ)
    if col.singleton:
        current = rsm_a.get(API + base).json()
        targets += [("PUT", base, current), ("PATCH", base, {})]
    else:
        if hasattr(_viewset(col), "create"):
            targets.append(("POST", base, {}))
        if _has_detail(col):
            detail = f"{base}{ISO_UID}/"
            current = rsm_a.get(API + detail).json()
            current.pop("id", None)
            targets += [("PUT", detail, current), ("PATCH", detail, {})]
    for method, url, start in targets:
        for body in BAD_BODIES:
            _no_500(rsm_a, method, url, body)
        for f in fields:
            for v in BAD_VALUES:
                # Recalcul seulement si le type diffère de la valeur d'origine (confusion de type).
                confused = f in start and type(v) is not type(start[f])
                _no_500(rsm_a, method, url, {**start, f: v}, recompute=method == "PUT" and confused)
        if "normes" in fields:
            for v in BAD_NORMES:
                _no_500(rsm_a, method, url, {**start, "normes": v})
    # Actions métier : corps absents, de mauvais type, clés de mauvais type.
    for method, url, _ in routes(col):
        if method == "GET" or (method, url) in {(m, u) for m, u, _ in targets}:
            continue
        if method in ("PUT", "PATCH", "DELETE") and url == f"{base}{ISO_UID}/":
            continue
        for body in BAD_BODIES:
            _no_500(rsm_a, method, url, body)
        for v in BAD_VALUES:
            _no_500(rsm_a, method, url, dict.fromkeys(ACTION_KEYS, v))
        for k in ACTION_KEYS:
            for v in ([{"x": 1}], 12345):
                _no_500(rsm_a, method, url, {k: v})
    # Lecture avec des paramètres invalides.
    for qs in ("?norme=9999", "?ordering=-inexistant", "?search=%00", "?at=start&page=x", "?statut=[]"):
        assert rsm_a.get(API + base + qs).status_code < 500, qs


@pytest.mark.parametrize(
    "url",
    ["dashboard/?today=2026-13-45", "dashboard/?norme=xx", "alerts/?today=x", "dashboard/?proc=[]&dir="],
)
def test_pilotage_params_never_500(rsm_a, url):
    assert rsm_a.get(API + url).status_code in (200, 400)


def test_core_fuzz_never_500(rsm_a):
    for method, url in CORE_WRITES:
        if OTHER_USER_UID in url:
            url = url.replace(OTHER_USER_UID, "u2")
        for body in BAD_BODIES:
            _no_500(rsm_a, method, url, body)
        for k in ("nom", "email", "roles", "password", "id", "activeNorms", "auditorAccess", "d", "a", "mod"):
            for v in BAD_VALUES:
                _no_500(rsm_a, method, url, {k: v})
