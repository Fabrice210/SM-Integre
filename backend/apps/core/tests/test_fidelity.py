"""
Contrat avec le front : /api/v1/bootstrap/ doit renvoyer exactement la `db` de la
démonstration (backend/demo/demo.json). Chaque collection enregistrée est vérifiée
élément par élément ; test_all_collections_registered liste celles qui manquent.
"""

import pytest

from apps.core import registry

pytestmark = pytest.mark.django_db


def test_registered_collections_round_trip(api, demo_data):
    state = api.get("/api/v1/bootstrap/").json()
    for col in registry.all_collections():
        expected = demo_data["db"].get(col.name)
        assert expected is not None, f"{col.name} absente de demo.json"
        got = state["db"][col.name]
        if col.singleton:
            assert got == expected, col.name
            continue
        assert len(got) == len(expected), col.name
        for g, e in zip(got, expected, strict=True):
            assert g == e, f"{col.name} {e.get('id')}"


def test_journal_and_org_round_trip(api, demo_data):
    state = api.get("/api/v1/bootstrap/").json()
    assert state["db"]["journal"] == demo_data["db"]["journal"]
    assert state["org"] == demo_data["org"]
    assert state["users"] == demo_data["users"]


def test_all_collections_registered(demo_data):
    names = {c.name for c in registry.all_collections()} | {"journal"}
    missing = sorted(set(demo_data["db"]) - names)
    assert not missing, f"Collections non implémentées : {missing}"
