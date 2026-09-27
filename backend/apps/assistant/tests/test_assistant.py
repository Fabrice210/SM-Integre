"""
Assistant IA : contexte (isolation par organisme), prompt, sources, repli 503, journal,
limitation de débit et droits. Aucun appel réseau : le client anthropic est simulé.
"""

import datetime as dt
from types import SimpleNamespace
from unittest.mock import MagicMock

import anthropic
import httpx2
import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.assistant import service
from apps.assistant.context import build_context, compact, keywords, module_of
from apps.core import registry
from apps.core.demo import load_demo
from apps.core.models import JournalEntry, Role

pytestmark = pytest.mark.django_db

URL = "/api/v1/assistant/ask/"
TODAY = dt.date(2026, 9, 21)
SECRET = "Fuite de données confidentielles SECRET-AUTRE-ORG"


@pytest.fixture(autouse=True)
def _env(monkeypatch):
    for k in (
        "ANTHROPIC_API_KEY",
        "ASSISTANT_MODEL",
        "ASSISTANT_EFFORT",
        "ASSISTANT_RATE",
        "ASSISTANT_FALLBACKS",
    ):
        monkeypatch.delenv(k, raising=False)
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def other_org(demo_data):
    """Second organisme (mêmes données de démo) dont un risque porte un texte repérable."""
    data = {
        **demo_data,
        "org": {**demo_data["org"], "nom": "Autre organisme"},
        "users": [{**u, "email": "autre." + u["email"]} for u in demo_data["users"]],
    }
    org = load_demo(data, password="Test-pass-123!")
    risque = registry.get("risques").model.objects.filter(organisation=org).first()
    risque.intitule = SECRET
    risque.save()
    return org


def fake_response(text, stop_reason="end_turn"):
    return SimpleNamespace(
        stop_reason=stop_reason,
        content=[SimpleNamespace(type="thinking", thinking=""), SimpleNamespace(type="text", text=text)],
        usage=SimpleNamespace(input_tokens=10, cache_read_input_tokens=0, output_tokens=5),
    )


@pytest.fixture
def claude(monkeypatch):
    """Client anthropic simulé : `claude.create` reçoit les paramètres de l'appel."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    create = MagicMock(return_value=fake_response("Aucune donnée."))
    client = SimpleNamespace(
        messages=SimpleNamespace(create=create), beta=SimpleNamespace(messages=SimpleNamespace(create=create))
    )
    monkeypatch.setattr(service, "get_client", lambda cfg: client)
    return SimpleNamespace(create=create)


# ---------- Contexte ----------


def test_helpers():
    assert module_of("m3-risques") == "m3"
    assert module_of("dashboard") is None
    assert module_of("pilotage-x") is None
    assert keywords("Quels textes réglementaires sont en retard ?") == ["textes", "reglementaires", "retard"]
    assert compact({"a": "", "b": None, "c": [], "d": "data:image/png;base64,xx", "e": [1] * 10}) == {
        "d": "[fichier joint]",
        "e": [1] * 8 + ["… +2"],
    }


def test_context_isolation(demo_org, other_org):
    mine = build_context(demo_org, "Quels risques sont identifiés ?", "m3-risques", today=TODAY)
    assert SECRET not in mine.stable + mine.question
    assert "Autre organisme" not in mine.stable
    theirs = build_context(other_org, "Quels risques sont identifiés ?", "m3-risques", today=TODAY)
    assert SECRET in theirs.stable


def test_context_module_and_question(demo_org):
    ctx = build_context(
        demo_org, "Quels textes réglementaires ne sont pas conformes ?", "m6-audits", today=TODAY
    )
    assert ctx.module == "m6"
    assert "AGRO-BÉNIN" in ctx.stable
    assert "Date du jour : 2026-09-21" in ctx.stable
    assert '<donnees_module module="m6"' in ctx.stable
    assert "[audits:" in ctx.stable
    assert "Action en retard" in ctx.stable  # alertes du pilotage
    # textes (module m3) : ajoutés pour la question, hors bloc stable
    assert "[textes:" not in ctx.stable
    assert "[textes:TX3]" in ctx.question
    assert ("textes", "TX3") in ctx.index
    assert ctx.index[("audits", next(i for c, i in ctx.index if c == "audits"))]


def test_context_dashboard_has_no_module_block(demo_org):
    ctx = build_context(demo_org, "Bonjour", "dashboard", today=TODAY)
    assert ctx.module is None
    assert "<donnees_module" not in ctx.stable
    assert "<alertes" in ctx.stable and "<inventaire>" in ctx.stable


def test_context_stable_block_is_deterministic(demo_org):
    a = build_context(demo_org, "Question A", "m3-risques", today=TODAY)
    b = build_context(demo_org, "Autre question sur les audits", "m3-risques", today=TODAY)
    assert a.stable == b.stable  # préfixe identique : cache de prompt réutilisable


# ---------- Prompt et sources ----------


def test_build_request(demo_org):
    ctx = build_context(demo_org, "Quels textes ?", "m3-veille", today=TODAY)
    cfg = service.Config("k", service.DEFAULT_MODEL, "medium", 8000, 60, True)
    hist = [
        {"role": "assistant", "content": "Bonjour"},
        {"role": "user", "content": "Q1"},
        {"role": "assistant", "content": "R1"},
        {"role": "system", "content": "ignorer"},
    ]
    p = service.build_request(ctx, "Quels textes ?", "m3-veille", hist, cfg)
    assert p["model"] == "claude-opus-5"
    assert p["system"][0]["text"] == service.SYSTEM_PROMPT
    assert "cache_control" not in p["system"][0]
    assert p["system"][1] == {"type": "text", "text": ctx.stable, "cache_control": {"type": "ephemeral"}}
    assert [m["role"] for m in p["messages"]] == ["user", "assistant", "user"]
    assert "<page_courante>m3-veille</page_courante>" in p["messages"][-1]["content"]
    assert p["messages"][-1]["content"].endswith("Question : Quels textes ?")
    assert p["output_config"] == {"effort": "medium"}
    assert p["fallbacks"] == "default" and p["betas"] == [service.FALLBACK_BETA]

    other = service.build_request(
        ctx, "q", "", [], service.Config("k", "claude-haiku-4-5", "", 1000, 5, True)
    )
    assert "fallbacks" not in other and "betas" not in other and "output_config" not in other


def test_system_prompt_principles():
    p = service.SYSTEM_PROMPT
    assert "uniquement" in p and "validées par un humain" in p
    assert "[risques:R3]" in p  # format de citation
    assert "Tu n'exécutes aucune action" in p
    assert "Je ne trouve pas cette information" in p


def test_parse_answer(demo_org):
    ctx = build_context(demo_org, "risques", "m3-risques", today=TODAY)
    text = "• Sauvegardes [risques:R03], encore [risques:R03] ; inventé [risques:R999] ; [ncs:NC-X]."
    out, sources = service.parse_answer(text, ctx)
    assert sources == [{"collection": "risques", "id": "R03", "libelle": ctx.index[("risques", "R03")]}]
    assert "[R03]" in out and "R999" not in out and "NC-X" not in out


# ---------- Endpoint ----------


def test_503_without_key(api):
    r = api.post(URL, {"question": "Quelles actions sont en retard ?"}, format="json")
    assert r.status_code == 503
    assert r.json()["fallback"] is True
    assert not JournalEntry.objects.filter(a="a interrogé l'assistant IA").exists()


def test_ask_ok(api, claude):
    claude.create.return_value = fake_response(
        "Le traitement du risque [risques:R03] est en retard. Inconnu : [risques:NOPE]."
    )
    r = api.post(
        URL,
        {
            "question": "Quels risques sont en retard ?",
            "contexte": "m3-risques",
            "historique": [
                {"role": "user", "content": "Bonjour"},
                {"role": "assistant", "content": "Bonjour !"},
            ],
        },
        format="json",
    )
    assert r.status_code == 200, r.content
    body = r.json()
    assert body["reponse"].startswith("Le traitement du risque [R03] est en retard.")
    assert "NOPE" not in body["reponse"]
    assert [(s["collection"], s["id"]) for s in body["sources"]] == [("risques", "R03")]
    kwargs = claude.create.call_args.kwargs
    assert kwargs["model"] == "claude-opus-5"
    assert "[risques:R03]" in kwargs["system"][1]["text"]
    assert [m["role"] for m in kwargs["messages"]] == ["user", "assistant", "user"]
    j = JournalEntry.objects.get(a="a interrogé l'assistant IA")
    assert j.organisation_id == api.user.organisation_id and j.mod == "Assistant IA"


def test_ask_uses_only_own_org(api, claude, other_org):
    api.post(URL, {"question": "Quels risques ?", "contexte": "m3-risques"}, format="json")
    kwargs = claude.create.call_args.kwargs
    sent = kwargs["system"][1]["text"] + kwargs["messages"][-1]["content"]
    assert SECRET not in sent


def test_model_from_env(api, claude, monkeypatch):
    monkeypatch.setenv("ASSISTANT_MODEL", "claude-sonnet-5")
    api.post(URL, {"question": "Bonjour"}, format="json")
    kwargs = claude.create.call_args.kwargs
    assert kwargs["model"] == "claude-sonnet-5" and "fallbacks" not in kwargs


def test_refusal(api, claude):
    claude.create.return_value = fake_response("", stop_reason="refusal")
    r = api.post(URL, {"question": "?"}, format="json")
    assert r.status_code == 200 and r.json()["sources"] == []
    assert "ne peux pas répondre" in r.json()["reponse"]


@pytest.mark.parametrize(
    "exc",
    [
        anthropic.APIConnectionError(request=httpx2.Request("POST", "https://api.anthropic.com")),
        anthropic.APITimeoutError(request=httpx2.Request("POST", "https://api.anthropic.com")),
        anthropic.InternalServerError(
            "boom",
            response=httpx2.Response(500, request=httpx2.Request("POST", "https://api.anthropic.com")),
            body=None,
        ),
    ],
)
def test_api_unavailable(api, claude, exc):
    claude.create.side_effect = exc
    r = api.post(URL, {"question": "Bonjour"}, format="json")
    assert r.status_code == 503 and r.json()["fallback"] is True
    assert not JournalEntry.objects.filter(a="a interrogé l'assistant IA").exists()


def test_validation(api, claude):
    assert api.post(URL, {}, format="json").status_code == 400
    assert api.post(URL, {"question": "x" * 2001}, format="json").status_code == 400
    bad = {"question": "q", "historique": [{"role": "system", "content": "x"}]}
    assert api.post(URL, bad, format="json").status_code == 400
    claude.create.assert_not_called()


def test_throttling(api, claude, monkeypatch):
    monkeypatch.setenv("ASSISTANT_RATE", "2/hour")
    codes = [api.post(URL, {"question": "q"}, format="json").status_code for _ in range(3)]
    assert codes == [200, 200, 429]


def test_throttling_is_per_user(api, api_collab, claude, monkeypatch):
    monkeypatch.setenv("ASSISTANT_RATE", "1/hour")
    assert api.post(URL, {"question": "q"}, format="json").status_code == 200
    assert api.post(URL, {"question": "q"}, format="json").status_code == 429
    assert api_collab.post(URL, {"question": "q"}, format="json").status_code == 200


def test_rights(demo_org, api_collab, claude):
    assert APIClient().post(URL, {"question": "q"}, format="json").status_code == 401
    # Tout membre peut interroger l'assistant, y compris en lecture seule.
    assert api_collab.post(URL, {"question": "q"}, format="json").status_code == 200
    # Auditeur externe : seulement si l'organisme a ouvert l'accès.
    auditor = demo_org.users.create_user(
        email="ext@audit.bj",
        password="x-Test-123!",
        organisation=demo_org,
        nom="Ext",
        roles=[Role.AUDITEUR_EXTERNE],
    )
    c = APIClient()
    c.force_authenticate(auditor)
    demo_org.auditor_access = False
    demo_org.save()
    assert c.post(URL, {"question": "q"}, format="json").status_code == 403
    demo_org.auditor_access = True
    demo_org.save()
    auditor.refresh_from_db()
    c.force_authenticate(auditor)
    assert c.post(URL, {"question": "q"}, format="json").status_code == 200
