"""Exports serveur : contenu (Excel, CSV, PDF), filtre de norme, traçabilité, droits, isolation."""

import io

import pytest
from openpyxl import load_workbook
from pypdf import PdfReader
from rest_framework.test import APIClient

from apps.core import registry
from apps.core.models import AuditLog, JournalEntry, Organisation, User
from apps.exports.columns import SPECS


def _xlsx(resp):
    ws = load_workbook(io.BytesIO(resp.content)).active
    rows = [[c.value for c in r] for r in ws.iter_rows()]
    return rows[0][0], rows[3], rows[4:]


def _pdf_text(resp) -> str:
    reader = PdfReader(io.BytesIO(resp.content))
    return "\n".join(p.extract_text() for p in reader.pages), len(reader.pages)


@pytest.fixture
def other_org_client(db):
    org = Organisation.objects.create(nom="Autre organisme", active_norms=["9001"])
    user = User.objects.create_user(
        email="rsm@autre.bj",
        password="x-Test-pass-1",
        organisation=org,
        nom="Autre RSM",
        roles=["Responsable SM"],
    )
    c = APIClient()
    c.force_authenticate(user)
    return c


# ---------- Tableaux ----------


def test_xlsx_risques_columns_and_content(api, demo_data):
    r = api.get("/api/v1/exports/risques.xlsx")
    assert r.status_code == 200
    assert r["Content-Type"].startswith("application/vnd.openxmlformats")
    assert 'filename="Registre_risques.xlsx"' in r["Content-Disposition"]
    title, headers, rows = _xlsx(r)
    assert title == "Registre risques"
    assert headers == [label for _, label in SPECS["risques"][1]]
    assert len(rows) == len(demo_data["db"]["risques"])
    first = demo_data["db"]["risques"][0]
    assert rows[0][0] == first["id"]
    assert rows[0][headers.index("Risque")] == first["intitule"]
    # listes jointes, normes lisibles
    assert rows[0][headers.index("Normes")] == ", ".join(f"ISO {n}" for n in first["normes"])


def test_xlsx_dates_numbers_and_nested_lists(api, demo_data):
    _, headers, rows = _xlsx(api.get("/api/v1/exports/audits.xlsx"))
    a = demo_data["db"]["audits"][0]
    row = rows[0]
    assert row[headers.index("Date")] == "18 févr. 2026"
    constats = row[headers.index("Constats")]
    assert a["constats"][0]["description"] in constats and "\n" in constats
    _, headers, rows = _xlsx(api.get("/api/v1/exports/indicateurs.xlsx"))
    assert isinstance(rows[0][headers.index("Cible")], int | float)


def test_norme_filter(api, demo_data):
    expected = [x for x in demo_data["db"]["risques"] if "27001" in x["normes"]]
    r = api.get("/api/v1/exports/risques.xlsx?norme=27001")
    _, _, rows = _xlsx(r)
    assert 0 < len(rows) == len(expected) < len(demo_data["db"]["risques"])
    assert "Registre_risques_ISO_27001.xlsx" in r["Content-Disposition"]
    # collection sans normes : filtre ignoré, nom de fichier inchangé
    r = api.get("/api/v1/exports/fiches-maitrise.xlsx?norme=9001")
    assert 'filename="Fiches_maitrise_operationnelle.xlsx"' in r["Content-Disposition"]
    assert len(_xlsx(r)[2]) == len(demo_data["db"]["fichesMaitrise"])
    # champ `norme` (couverture normative)
    _, _, rows = _xlsx(api.get("/api/v1/exports/mapping.xlsx?norme=9001"))
    assert len(rows) == sum(1 for m in demo_data["db"]["mapping"] if m["norme"] == "9001")


def test_csv_front_format(api, demo_data):
    r = api.get("/api/v1/exports/registre.csv")
    assert r.status_code == 200 and r["Content-Type"].startswith("text/csv")
    text = r.content.decode("utf-8")
    assert text.startswith("﻿Référence;Type;Intitulé;Origine;Processus;Responsable;Date;Statut;Normes\r\n")
    lines = text.strip("\r\n").split("\r\n")
    assert len(lines) == 1 + len(demo_data["db"]["registre"])
    assert lines[1].startswith(f'"{demo_data["db"]["registre"][0]["ref"]}";')


def test_generic_columns_kebab_url_and_unknown(api, demo_data):
    # collection sans tableau exportable : toutes les clés, en-têtes lisibles
    _, headers, rows = _xlsx(api.get("/api/v1/exports/analyse-versions.xlsx"))
    assert headers[:3] == ["Identifiant", "Version", "Date"]
    assert len(rows) == len(demo_data["db"]["analyseVersions"])
    assert api.get("/api/v1/exports/fiches-maitrise.csv").status_code == 200
    assert api.get("/api/v1/exports/inconnue.xlsx").status_code == 404
    assert api.get("/api/v1/exports/risques.docx").status_code == 404


@pytest.mark.parametrize("fmt", ["xlsx", "csv"])
def test_every_collection_exports(api, fmt):
    for name in [c.name for c in registry.all_collections()] + ["journal", "users"]:
        r = api.get(f"/api/v1/exports/{name}.{fmt}")
        assert r.status_code == 200, name


def test_export_is_traced(api):
    before = JournalEntry.objects.count()
    api.get("/api/v1/exports/ncs.xlsx?norme=9001")
    api.get("/api/v1/exports/ncs.pdf")
    entries = list(JournalEntry.objects.order_by("-id")[:2])
    assert JournalEntry.objects.count() == before + 2
    assert entries[1].a == "a exporté « Non_conformites » (Excel)" and entries[1].mod == "Export"
    assert entries[0].a == "a généré le PDF « Non conformites »"
    assert entries[0].u == api.user.nom
    log = AuditLog.objects.filter(action="export").order_by("id")
    assert [(x.collection, x.data) for x in log] == [
        ("ncs", {"format": "xlsx", "norme": "9001"}),
        ("ncs", {"format": "pdf"}),
    ]


# ---------- PDF ----------


def test_registre_pdf(api, demo_data):
    r = api.get("/api/v1/exports/registre.pdf", HTTP_ACCEPT="application/pdf")
    assert r.status_code == 200 and r["Content-Type"] == "application/pdf"
    assert r.content.startswith(b"%PDF")
    text, pages = _pdf_text(r)
    assert "Registre amelioration continue" in text.replace("é", "e")
    assert "AGRO-BÉNIN" in text or demo_data["org"]["nom"].split()[0] in text
    assert "Page 1 / " in text
    assert demo_data["db"]["registre"][0]["ref"] in "".join(text.split())
    assert pages >= 1


def test_rapport_revue_pdf(api, demo_data):
    rv = demo_data["db"]["revues"][0]
    r = api.get(f"/api/v1/exports/rapport-revue/{rv['id']}.pdf")
    assert r.status_code == 200
    text, _ = _pdf_text(r)
    for s in ("PV " + rv["ref"], "Ordre du jour", "Rapport d'entrée", "Procès-verbal", rv["ordreDuJour"][0]):
        assert s in text, s
    assert rv["actions"][0]["libelle"] in text
    assert JournalEntry.objects.first().a == f"a généré le PDF « PV {rv['ref']} »"
    assert api.get("/api/v1/exports/rapport-revue/RV999.pdf").status_code == 404


def test_rapport_audit_pdf(api, demo_data):
    a = demo_data["db"]["audits"][0]
    r = api.get(f"/api/v1/exports/rapport-audit/{a['id']}.pdf")
    assert r.status_code == 200
    text, _ = _pdf_text(r)
    assert f"Rapport d'audit {a['ref']}" in text
    assert a["constats"][0]["description"] in " ".join(text.split())
    assert a["auditeur"] in text
    assert api.get("/api/v1/exports/rapport-audit/NOPE.pdf").status_code == 404


def test_tableau_de_bord_pdf(api):
    r = api.get("/api/v1/exports/tableau-de-bord.pdf?today=2026-09-21&norme=9001")
    assert r.status_code == 200
    text, _ = _pdf_text(r)
    for s in ("Tableau de bord", "ISO 9001", "Indicateurs clés", "Par processus", "Alertes actives"):
        assert s in text, s
    assert api.get("/api/v1/exports/tableau-de-bord.pdf?norme=1234").status_code == 400
    assert api.get("/api/v1/exports/tableau-de-bord.pdf?today=hier").status_code == 400


# ---------- Droits et isolation ----------


def test_read_only_user_can_export(api_collab):
    assert api_collab.get("/api/v1/exports/risques.xlsx").status_code == 200
    assert api_collab.get("/api/v1/exports/tableau-de-bord.pdf").status_code == 200


def test_anonymous_and_disabled_auditor_forbidden(demo_org):
    assert APIClient().get("/api/v1/exports/risques.xlsx").status_code == 401
    ext = User.objects.create_user(
        email="ext@audit.bj",
        password="x-Test-pass-1",
        organisation=demo_org,
        nom="Ext",
        roles=["Auditeur externe"],
    )
    c = APIClient()
    c.force_authenticate(ext)
    assert c.get("/api/v1/exports/risques.csv").status_code == 200
    demo_org.auditor_access = False
    demo_org.save()
    ext.refresh_from_db()
    c.force_authenticate(ext)
    assert c.get("/api/v1/exports/risques.csv").status_code == 403
    assert c.get("/api/v1/exports/tableau-de-bord.pdf").status_code == 403


def test_org_isolation(demo_org, other_org_client, demo_data):
    _, _, rows = _xlsx(other_org_client.get("/api/v1/exports/risques.xlsx"))
    assert rows == []
    text = other_org_client.get("/api/v1/exports/users.csv").content.decode()
    assert "agrobenin" not in text and "rsm@autre.bj" in text
    rv = demo_data["db"]["revues"][0]["id"]
    assert other_org_client.get(f"/api/v1/exports/rapport-revue/{rv}.pdf").status_code == 404
    assert other_org_client.get("/api/v1/exports/rapport-audit/A1.pdf").status_code == 404
    # le journal de l'organisme de démo n'est pas touché par l'export de l'autre organisme
    assert not JournalEntry.objects.filter(organisation=demo_org, mod="Export").exists()
