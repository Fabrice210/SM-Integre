"""
Droits fins par processus (réglage `droitsParProcessus`, apps.core.scope).

Démo : Serge KOUTON (Pilote de processus seul) pilote P04 et P05 ; Prisca ASSOGBA est
copilote de P05 (rôle passé à « Copilote de processus » ici) ; Florence DOSSOU-YOVO
(Responsable SM + Pilote) et Rodrigue AHOUANSOU (Dirigeant + Pilote) ont un rôle global.

L'organisme est chargé une fois pour le module ; chaque test est isolé dans sa transaction.
"""

import pytest
from django.contrib.auth import get_user_model
from django.db import transaction
from django.test import override_settings
from rest_framework.test import APIClient

from apps.core import registry, scope
from apps.core.demo import load_demo
from apps.core.models import Organisation, Role
from apps.core.permissions import IsMemberAnyMethod
from apps.core.viewsets import OrgModelViewSet

pytestmark = pytest.mark.django_db
User = get_user_model()

API = "/api/v1/"
OWN = ("P04", "P05")  # processus de Serge KOUTON
FAST_HASHER = ["django.contrib.auth.hashers.MD5PasswordHasher"]
PILOTE = "s.kouton@agrobenin.bj"
COPILOTE = "p.assogba@agrobenin.bj"
RSM = "f.dossou-yovo@agrobenin.bj"
DIRIGEANT = "r.ahouansou@agrobenin.bj"
ADMIN = "h.djossou@agrobenin.bj"


@pytest.fixture(scope="module")
def org(django_db_setup, django_db_blocker, demo_data):
    demo = {
        **demo_data,
        "org": {**demo_data["org"], "nom": "Organisme droits par processus"},
        "users": [{**u, "email": "dp." + u["email"]} for u in demo_data["users"]],
    }
    with django_db_blocker.unblock(), override_settings(PASSWORD_HASHERS=FAST_HASHER):
        with transaction.atomic():
            Organisation.objects.filter(users__email="dp." + RSM).delete()  # reste de --reuse-db
            o = load_demo(demo, password="Test-pass-123!")
            o.users.filter(email="dp." + COPILOTE).update(roles=[Role.COPILOTE])
        yield o
        with transaction.atomic():
            Organisation.objects.filter(pk=o.pk).delete()


@pytest.fixture
def on(org):
    """Réglage activé (annulé avec la transaction du test)."""
    Organisation.objects.filter(pk=org.pk).update(droits_par_processus=True)
    return org


def client(org, email):
    # Relu en base (et pas par org.users, qui partagerait l'objet Organisation du module).
    user = User.objects.select_related("organisation").get(email="dp." + email)
    c = APIClient()
    c.force_authenticate(user)
    c.raise_request_exception = False
    return c


def call(c, method, url, data=None):
    """Appel annulé (point de sauvegarde) : l'état de départ est conservé."""
    with transaction.atomic():
        r = getattr(c, method.lower())(API + url, data if data is not None else {}, format="json")
        transaction.set_rollback(True)
    return r


def item(c, coll, uid):
    body = c.get(f"{API}{coll}/{uid}/").json()
    body.pop("id", None)
    return body


# ---------- Réglage ----------


def test_setting_default_off_and_admin_only(org):
    admin = client(org, ADMIN)
    r = admin.get(API + "settings/")
    assert r.status_code == 200 and r.json()["droitsParProcessus"] is False
    assert admin.get(API + "bootstrap/").json()["droitsParProcessus"] is False
    assert call(client(org, PILOTE), "PATCH", "settings/", {"droitsParProcessus": True}).status_code == 403
    with transaction.atomic():
        r = admin.patch(API + "settings/", {"droitsParProcessus": True}, format="json")
        assert r.status_code == 200 and r.json()["droitsParProcessus"] is True
        assert Organisation.objects.get(pk=org.pk).droits_par_processus is True
        transaction.set_rollback(True)
    # PUT sans le champ : réglage inchangé (clients existants).
    current = admin.get(API + "settings/").json()
    current.pop("droitsParProcessus")
    assert call(admin, "PUT", "settings/", current).status_code == 200
    assert call(admin, "PATCH", "settings/", {"droitsParProcessus": "peut-être"}).status_code == 400


def test_off_keeps_current_behaviour(org):
    """Réglage désactivé : un pilote modifie tout, comme avant."""
    pilote = client(org, PILOTE)
    assert call(pilote, "PUT", "risques/R03/", item(pilote, "risques", "R03")).status_code == 200
    assert call(pilote, "PATCH", "swot/" + org_first(org, "swot") + "/", {}).status_code == 200
    assert call(pilote, "PATCH", "processus/P01/", {"finalite": "x"}).status_code == 200
    assert call(pilote, "POST", "risques/R03/realise/").status_code == 200


def org_first(org, name):
    return registry.get(name).model.objects.filter(organisation=org).order_by("position", "id").first().uid


# ---------- Réglage activé : cas nommés ----------


def test_pilote_own_process_only(on):
    pilote = client(on, PILOTE)
    assert call(pilote, "PUT", "risques/R01/", item(pilote, "risques", "R01")).status_code == 200  # P05
    assert call(pilote, "PATCH", "risques/R02/", {"intitule": "Revu"}).status_code == 200  # P04
    r = call(pilote, "PUT", "risques/R03/", item(pilote, "risques", "R03"))  # P10
    assert r.status_code == 403
    assert "processus" in r.json()["detail"]
    assert call(pilote, "DELETE", "risques/R03/").status_code == 403
    assert call(pilote, "DELETE", "risques/R02/").status_code == 204
    # Lecture inchangée.
    assert pilote.get(API + "risques/R03/").status_code == 200
    assert len(pilote.get(API + "risques/").json()) == 7


def test_pilote_cannot_move_item_to_other_process(on):
    pilote = client(on, PILOTE)
    assert call(pilote, "PATCH", "risques/R01/", {"processus": ["P10"]}).status_code == 403
    assert call(pilote, "PATCH", "risques/R01/", {"processus": ["P04", "P10"]}).status_code == 200


def test_copilote(on):
    copilote = client(on, COPILOTE)  # copilote de P05 seulement
    assert call(copilote, "PATCH", "risques/R01/", {"intitule": "x"}).status_code == 200  # P05
    assert call(copilote, "PATCH", "risques/R02/", {"intitule": "x"}).status_code == 403  # P04
    assert call(copilote, "PATCH", "ncs/NC1/", {"description": "x"}).status_code == 200  # P05
    assert call(copilote, "PATCH", "ncs/NC2/", {"description": "x"}).status_code == 403  # P11


def test_process_list_needs_one_owned(on):
    pilote = client(on, PILOTE)
    assert call(pilote, "PATCH", "objectifs/OB1/", {"intitule": "x"}).status_code == 200  # P06 + P05
    assert call(pilote, "PATCH", "risques/R04/", {"intitule": "x"}).status_code == 200  # P05 + P09
    assert call(pilote, "PATCH", "objectifs/OB4/", {"intitule": "x"}).status_code == 403  # P10


def test_item_without_process_is_global_only(on):
    pilote, rsm = client(on, PILOTE), client(on, RSM)
    # « Tous » : aucun processus précis.
    assert call(pilote, "PATCH", "modeles/MD1/", {"titre": "x"}).status_code == 403
    assert call(rsm, "PATCH", "modeles/MD1/", {"titre": "x"}).status_code == 200
    registry.get("risques").model.objects.filter(organisation=on, uid="R01").update(processus=[])
    assert call(pilote, "PATCH", "risques/R01/", {"intitule": "x"}).status_code == 403
    assert call(rsm, "PATCH", "risques/R01/", {"intitule": "x"}).status_code == 200


def test_create_checks_body_process(on):
    pilote = client(on, PILOTE)
    body = {**item(pilote, "risques", "R01"), "id": "RZ1"}
    assert call(pilote, "POST", "risques/", {**body, "processus": ["P05"]}).status_code == 201
    assert call(pilote, "POST", "risques/", {**body, "processus": ["P10", "P04"]}).status_code == 201
    assert call(pilote, "POST", "risques/", {**body, "processus": ["P10"]}).status_code == 403
    assert call(pilote, "POST", "risques/", {**body, "processus": []}).status_code == 403
    body.pop("processus")
    assert call(pilote, "POST", "risques/", body).status_code == 403
    assert call(pilote, "POST", "risques/", ["P05"]).status_code == 403


def test_business_actions(on):
    pilote = client(on, PILOTE)
    assert call(pilote, "POST", "risques/R01/realise/").status_code == 200  # P05
    assert call(pilote, "POST", "risques/R03/realise/").status_code == 403  # P10
    assert call(pilote, "POST", "ncs/NC4/valider-pilote/").status_code == 200  # P05, Déclarée
    assert call(pilote, "POST", "ncs/NC6/valider-pilote/").status_code == 403  # P10, Déclarée
    # Action de liste : rôles globaux seulement.
    assert call(pilote, "POST", "objectifs/import/", []).status_code == 403


def test_nc_declaration_stays_open(on):
    """Déclarer une NC reste ouvert à tout membre ; hors de ses processus, un pilote limité
    déclare comme un collaborateur (circuit au premier niveau)."""
    pilote = client(on, PILOTE)
    body = {"categorie": "Non-conformité", "source": "Terrain", "description": "Écart", "normes": ["9001"]}
    r = call(pilote, "POST", "ncs/", {**body, "processus": "P10", "statut": "Clôturée"})
    assert r.status_code == 201 and r.json()["statut"] == "Déclarée"
    r = call(pilote, "POST", "ncs/", {**body, "processus": "P05", "statut": "Clôturée"})
    assert r.status_code == 201 and r.json()["statut"] == "Clôturée"
    assert call(pilote, "POST", "accuses/accuser-lecture/").status_code in (200, 201)


def test_collections_without_process_and_singletons(on):
    pilote, dirigeant = client(on, PILOTE), client(on, DIRIGEANT)
    swot = "swot/" + org_first(on, "swot") + "/"
    assert call(pilote, "PATCH", swot, {}).status_code == 403
    assert call(dirigeant, "PATCH", swot, {}).status_code == 200
    politique = pilote.get(API + "politique/").json()
    assert call(pilote, "PUT", "politique/", politique).status_code == 403
    assert call(dirigeant, "PUT", "politique/", politique).status_code == 200


def test_process_sheet(on):
    pilote = client(on, PILOTE)
    assert call(pilote, "PATCH", "processus/P04/", {"finalite": "Revue"}).status_code == 200
    assert call(pilote, "PUT", "processus/P05/", item(pilote, "processus", "P05")).status_code == 200
    assert call(pilote, "PATCH", "processus/P01/", {"finalite": "x"}).status_code == 403
    assert call(pilote, "PATCH", "processus/P04/", {"proprietaire": "Serge KOUTON"}).status_code == 200
    assert call(pilote, "PATCH", "processus/P04/", {"proprietaire": "Autre"}).status_code == 403
    assert call(pilote, "PATCH", "processus/P04/", {"copilote": ["Serge KOUTON"]}).status_code == 403
    assert call(pilote, "DELETE", "processus/P04/").status_code == 403
    assert call(pilote, "POST", "processus/", {"id": "P99", "intitule": "Nouveau"}).status_code == 403


@pytest.mark.parametrize("email", [RSM, DIRIGEANT, ADMIN, "a.tchibozo@agrobenin.bj"])
def test_global_roles_keep_all_rights(on, email):
    c = client(on, email)
    assert call(c, "PATCH", "risques/R03/", {"intitule": "x"}).status_code == 200
    assert call(c, "PATCH", "modeles/MD1/", {"titre": "x"}).status_code == 200
    assert call(c, "PATCH", "processus/P04/", {"proprietaire": "Autre"}).status_code == 200
    assert call(c, "POST", "risques/R03/realise/").status_code == 200


def test_collaborateur_unchanged(on):
    """Collaborateur nommé copilote mais sans rôle d'écriture : toujours en lecture seule ;
    un rôle global cumulé avec « Collaborateur » garde tous les droits."""
    auditrice = client(on, "n.zinsou@agrobenin.bj")  # Auditeur interne + Collaborateur
    assert call(auditrice, "PATCH", "risques/R03/", {"intitule": "x"}).status_code == 200
    on.users.filter(email="dp." + COPILOTE).update(roles=[Role.COLLABORATEUR])
    assert call(client(on, COPILOTE), "PATCH", "risques/R01/", {"intitule": "x"}).status_code == 403


# ---------- Test générique : toutes les collections rattachées à un processus ----------

FIELD_COLLECTIONS = [c.name for c in registry.all_collections() if scope.scope_kind(c) == "field"]


def _viewset(col):
    return col.viewset or OrgModelViewSet


def _is_open(act) -> bool:
    return any(p is IsMemberAnyMethod for p in act.kwargs.get("permission_classes") or ())


def _pick(org, col, owned: bool):
    """Élément rattaché (ou non) aux processus du pilote ; créé à partir d'un autre au besoin."""
    rows = list(col.model.objects.filter(organisation=org).order_by("position", "id"))
    for row in rows:
        ids = scope.process_ids(row.processus)
        if ids and bool(ids & set(OWN)) == owned:
            return row.uid
    row = next(r for r in rows if (bool(scope.process_ids(r.processus) & set(OWN)) != owned))
    pid = "P05" if owned else "P01"
    row.processus = [pid] if isinstance(row.processus, list) else pid
    row.save(update_fields=["processus"])
    return row.uid


def _other_process(value):
    return ["P01"] if isinstance(value, list) else "P01"


def test_field_collections_listed():
    assert {"risques", "objectifs", "ncs", "documents", "indicateurs", "registre"} <= set(FIELD_COLLECTIONS)


@pytest.mark.parametrize("name", FIELD_COLLECTIONS)
def test_every_process_collection(on, name):
    col = registry.get(name)
    vs = _viewset(col)
    pilote, rsm = client(on, PILOTE), client(on, RSM)
    own, other = _pick(on, col, True), _pick(on, col, False)
    base = f"{col.url}/"

    # CRUD sur un élément.
    if hasattr(vs, "update"):
        for uid, expected in ((own, 200), (other, 403)):
            body = item(pilote, col.url, uid)
            r = call(pilote, "PUT", f"{base}{uid}/", body)
            assert r.status_code == expected, (name, uid, "PUT", r.status_code, r.content[:300])
            r = call(pilote, "PATCH", f"{base}{uid}/", {})
            assert r.status_code == expected, (name, uid, "PATCH", r.status_code, r.content[:300])
        assert call(rsm, "PATCH", f"{base}{other}/", {}).status_code == 200, name
    if hasattr(vs, "destroy"):
        assert call(pilote, "DELETE", f"{base}{other}/").status_code == 403, name
        assert call(pilote, "DELETE", f"{base}{own}/").status_code == 204, name

    # Création : le processus du corps décide (déclaration de NC : ouverte à tout membre).
    if hasattr(vs, "create") and name != "ncs":
        body = {**item(pilote, col.url, own), "id": "ZZNEW1"}
        r = call(pilote, "POST", base, body)
        assert r.status_code != 403, (name, r.status_code, r.content[:300])
        r = call(pilote, "POST", base, {**body, "processus": _other_process(body.get("processus"))})
        assert r.status_code == 403, (name, r.status_code, r.content[:300])

    # Actions métier.
    for act in vs.get_extra_actions():
        if _is_open(act):
            continue
        for method in act.mapping:
            m = method.upper()
            if m == "GET":
                continue
            path = act.url_path.replace(r"(?P<index>\d+)", "0")
            if act.detail:
                r = call(pilote, m, f"{base}{other}/{path}/", {})
                assert r.status_code == 403, (name, m, path, r.status_code, r.content[:300])
                r = call(pilote, m, f"{base}{own}/{path}/", {})
                assert r.status_code != 403, (name, m, path, r.status_code, r.content[:300])
            else:
                r = call(pilote, m, f"{base}{path}/", {})
                assert r.status_code == 403, (name, m, path, r.status_code, r.content[:300])
