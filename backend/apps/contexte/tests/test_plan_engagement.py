"""POST /parties/{id}/plan-engagement/ : planEngagementAction() du front (details.tsx)."""

from datetime import timedelta

import pytest

from apps.core.models import AuditLog, JournalEntry
from apps.core.tracing import today

pytestmark = pytest.mark.django_db

URL = "/api/v1/parties/{}/plan-engagement/"


def test_cree_objectif_ob_pi_puis_ajoute_action(api):
    n_objectifs = len(api.get("/api/v1/objectifs/").json())
    r = api.post(URL.format("PI1"))
    assert r.status_code == 201, r.content
    body = r.json()
    assert body["deja"] is False
    echeance = (today() + timedelta(days=90)).isoformat()
    ob = body["objectif"]
    assert ob == {
        "id": "OB-PI",
        "code": "OB-PI",
        "axe": "AX1",
        "libelle": "Engagement des parties intéressées",
        "kpi": "Plans d'engagement suivis",
        "cible": "100 % des parties critiques",
        "delai": echeance,
        "efficacite": "Non évaluée",
        "processus": ["P01"],
        "normes": ["9001", "14001", "45001", "27001"],
        "actions": [
            {
                "libelle": "Plan d'engagement — Clients export (Europe, Inde)",
                "responsable": "Florence DOSSOU-YOVO",
                "echeance": echeance,
                "statut": "En cours",
                "observation": "Revue trimestrielle qualité, portail de traçabilité, clauses de "
                "confidentialité (remis trimestriellement)",
                "pi": "PI1",
            }
        ],
    }
    assert body["partie"]["hist"][0]["a"] == "Plan d'engagement rattaché au module Objectifs / Actions"

    # Ajouté en fin de liste (push), relu tel quel par l'API.
    objectifs = api.get("/api/v1/objectifs/").json()
    assert len(objectifs) == n_objectifs + 1 and objectifs[-1] == ob

    journal = list(JournalEntry.objects.values_list("a", "mod")[:2])
    assert journal == [
        (
            "a rattaché le plan d'engagement de Clients export (Europe, Inde) aux actions (module Objectifs)",
            "Parties intéressées",
        ),
        ("a créé l'objectif de suivi des plans d'engagement", "Objectifs"),
    ]
    assert AuditLog.objects.filter(collection="objectifs", uid="OB-PI", action="create").exists()

    # Deuxième partie : même objectif, une action de plus.
    r = api.post(URL.format("PI2"))
    assert r.status_code == 201, r.content
    assert [a["pi"] for a in r.json()["objectif"]["actions"]] == ["PI1", "PI2"]
    assert len(api.get("/api/v1/objectifs/").json()) == n_objectifs + 1


def test_plan_deja_suivi(api):
    assert api.post(URL.format("PI3")).status_code == 201
    n_journal = JournalEntry.objects.count()
    r = api.post(URL.format("PI3"))
    assert r.status_code == 200, r.content
    assert r.json()["deja"] is True
    assert len(r.json()["objectif"]["actions"]) == 1
    assert JournalEntry.objects.count() == n_journal


def test_droits_et_introuvable(api, api_collab):
    assert api_collab.post(URL.format("PI1")).status_code == 403
    assert api.post(URL.format("PI999")).status_code == 404
