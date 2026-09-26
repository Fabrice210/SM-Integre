"""Module 6 : circuits métier (NC, audits, revues, registre, évaluation des intervenants)."""

import datetime as dt

import pytest
from django.utils import timezone

from apps.core.models import AuditLog, JournalEntry
from apps.performance.models import RegistreEntree
from apps.performance.views import add_months_js

pytestmark = pytest.mark.django_db

YEAR = timezone.localdate().year


def journal(org):
    return list(JournalEntry.objects.filter(organisation=org).values_list("a", "mod", "statut")[:5])


def registre(api):
    return api.get("/api/v1/registre/").json()


# ---------- Non-conformités ----------

NC = {
    "categorie": "Non-conformité",
    "source": "Terrain",
    "description": "Palettes de noix stockées directement au sol dans la zone B",
    "typeActe": "Conformité",
    "processus": "P04",
    "lieu": "Magasin matières premières — zone B",
    "normes": ["9001"],
    "cause": "Manque de palettes après la livraison du 18/09",
    "action": "Commander 150 palettes et rappeler la consigne au magasinier",
}


def test_collaborateur_declares_nc(api_collab, api):
    # Tentative de court-circuiter le circuit : ignorée pour un collaborateur.
    payload = {**NC, "statut": "Clôturée", "n1": "Validé", "n2": "Approuvé", "declarant": "Quelqu'un"}
    r = api_collab.post("/api/v1/ncs/", payload, format="json")
    assert r.status_code == 201, r.content
    nc = r.json()
    assert nc["statut"] == "Déclarée" and nc["n1"] == "En attente" and nc["n2"] == "En attente"
    assert nc["declarant"] == "Prisca ASSOGBA"
    assert nc["ref"] == f"NC-{YEAR}-033"  # 'NC-2026-0' + (25 + nombre de NC) dans le front
    assert nc["date"] == timezone.localdate().isoformat()
    assert nc["id"].startswith("NC")
    # La suite du circuit est réservée aux rôles de pilotage.
    assert api_collab.post(f"/api/v1/ncs/{nc['id']}/valider-pilote/").status_code == 403
    assert (
        api_collab.put(f"/api/v1/ncs/{nc['id']}/", {**NC, "date": "2026-09-21"}, format="json").status_code
        == 403
    )
    # Un pilote qui déclare garde la main sur le déclarant et le statut.
    r = api.post("/api/v1/ncs/", {**NC, "declarant": "Nadège ZINSOU"}, format="json")
    assert r.json()["declarant"] == "Nadège ZINSOU" and r.json()["ref"] == f"NC-{YEAR}-034"


def test_nc_full_cycle(api, demo_org):
    # NC5 : piste d'amélioration validée par le pilote, en attente d'approbation.
    r = api.post("/api/v1/ncs/NC5/approuver/")
    assert r.status_code == 200, r.content
    n = r.json()
    assert n["statut"] == "En traitement" and n["n2"] == "Approuvé"
    assert (
        n["hist"][0]["a"]
        == "AM-2026-006 approuvé(e) par le responsable du système — consolidé(e) dans le registre"
    )
    assert n["hist"][0]["u"] == "Florence DOSSOU-YOVO"
    g = registre(api)[0]  # addRegistre : unshift
    assert g == {
        "id": g["id"],
        "ref": f"RG-{YEAR}-045",
        "type": "Piste d'amélioration",
        "intitule": "Mettre un code couleur sur les bacs de tri des déchets",
        "origine": "Terrain (AM-2026-006)",
        "processus": "P11",
        "normes": ["14001"],
        "statut": "En cours",
        "date": timezone.localdate().isoformat(),
        "responsable": "Arnaud TCHIBOZO",
    }
    assert g["id"].startswith("RG")
    assert journal(demo_org)[0] == ("a approuvé(e) AM-2026-006", "Non-conformités", "En traitement")

    r = api.post(
        "/api/v1/ncs/NC5/analyse/",
        {"cause": "Signalétique absente", "action": "Bacs de couleur + affichage"},
        format="json",
    )
    assert r.status_code == 200 and r.json()["cause"] == "Signalétique absente"
    assert api.post("/api/v1/ncs/NC5/analyse/", {}, format="json").status_code == 400

    assert api.post("/api/v1/ncs/NC5/cloturer/", {}, format="json").status_code == 400  # efficacité requise
    e = "Efficace — aucune récidive constatée sur 30 jours"
    r = api.post("/api/v1/ncs/NC5/cloturer/", {"efficacite": e}, format="json")
    assert r.status_code == 200
    assert r.json()["statut"] == "Clôturée" and r.json()["efficacite"] == e
    assert registre(api)[0]["statut"] == "Clôturé"
    assert journal(demo_org)[0] == ("a clôturé(e) AM-2026-006", "Non-conformités", "Clôturée")
    # Plus aucune action possible sur une NC clôturée.
    for a in ("valider-pilote", "approuver", "refuser", "analyse", "cloturer"):
        assert (
            api.post(f"/api/v1/ncs/NC5/{a}/", {"efficacite": e, "cause": "x"}, format="json").status_code
            == 400
        )
    assert AuditLog.objects.filter(collection="ncs", uid="NC5").count() == 3


def test_nc_validation_and_refusal(api):
    r = api.post("/api/v1/ncs/NC4/valider-pilote/")
    assert r.status_code == 200
    assert r.json()["statut"] == "Validée pilote" and r.json()["n1"] == "Validé"
    assert api.post("/api/v1/ncs/NC4/valider-pilote/").status_code == 400
    r = api.post("/api/v1/ncs/NC4/refuser/")
    assert (r.json()["statut"], r.json()["n1"], r.json()["n2"]) == ("Refusée", "Validé", "Refusé")
    r = api.post("/api/v1/ncs/NC6/refuser/")
    assert (r.json()["statut"], r.json()["n1"], r.json()["n2"]) == ("Refusée", "Refusé", "En attente")


def test_accident_goes_to_registre_as_incident(api):
    nc = api.post("/api/v1/ncs/", {**NC, "categorie": "Accident / incident"}, format="json").json()
    api.post(f"/api/v1/ncs/{nc['id']}/valider-pilote/")
    api.post(f"/api/v1/ncs/{nc['id']}/approuver/")
    g = registre(api)[0]
    assert g["type"] == "Incident" and g["origine"] == f"Terrain ({nc['ref']})"
    assert g["responsable"] == "Serge KOUTON"  # pilote de P04


# ---------- Audits ----------


def test_audit_full_cycle(api, demo_org):
    a = "/api/v1/audits/A5"  # Planifié, P04, Arnaud TCHIBOZO, 9001 + 45001
    assert api.post(f"{a}/demarrer/").status_code == 400
    r = api.post(f"{a}/alerter/")
    assert r.json()["statut"] == "Planifié" and r.json()["hist"][0]["a"] == "Alerte envoyée à Arnaud TCHIBOZO"
    assert journal(demo_org)[0] == ("Alerte envoyée à Arnaud TCHIBOZO (AUD-2026-05)", "Audits", "Terminé")
    assert api.post(f"{a}/diffuser/").json()["statut"] == "Plan diffusé"
    assert api.post(f"{a}/constats/", {"type": "Observation", "description": "x"}).status_code == 400
    assert api.post(f"{a}/demarrer/").json()["statut"] == "En cours"
    r = api.post(f"{a}/constats/", {"type": "NC mineure", "description": "Enregistrements non signés"})
    assert r.json()["constats"] == [
        {"type": "NC mineure", "processus": "P04", "description": "Enregistrements non signés"}
    ]
    api.post(f"{a}/constats/", {"type": "Point fort", "processus": "P04", "description": "Magasin rangé"})
    assert api.post(f"{a}/constats/", {"type": "Remarque", "description": "x"}).status_code == 400
    assert api.post(f"{a}/cloturer/").status_code == 400  # rapport non déposé
    assert api.post(f"{a}/rapport/", {"rapport": "Rapport_AUD-2026-05.pdf"}).status_code == 400
    r = api.post(f"{a}/rapport/", {"rapport": "Rapport_AUD-2026-05.pdf", "compteRendu": "Constats acceptés."})
    assert r.json()["statut"] == "Rapport déposé" and r.json()["compteRendu"] == "Constats acceptés."
    n_before = RegistreEntree.objects.count()
    r = api.post(f"{a}/cloturer/")
    assert r.status_code == 200 and r.json()["statut"] == "Clôturé"
    assert RegistreEntree.objects.count() == n_before + 1  # le point fort n'est pas enregistré
    assert AuditLog.objects.filter(collection="registre", action="create").count() == 1
    g = registre(api)[0]
    assert (g["type"], g["intitule"], g["origine"], g["processus"], g["normes"], g["responsable"]) == (
        "Non-conformité",
        "Enregistrements non signés",
        "Audit AUD-2026-05",
        "P04",
        ["9001", "45001"],
        "Serge KOUTON",
    )
    assert journal(demo_org)[0] == ("a clôturé AUD-2026-05 (1 action(s) au registre)", "Audits", "Terminé")


def test_audit_closure_demo_report(api):
    # A3 : rapport déposé, un constat NC mineure sur P10.
    r = api.post("/api/v1/audits/A3/cloturer/")
    assert r.json()["hist"][0]["a"] == "Audit clôturé — 1 action(s) enregistrée(s) au registre"
    g = registre(api)[0]
    assert g["origine"] == "Audit AUD-2026-03" and g["responsable"] == "Cédric AGBODJAN"


def test_audit_actions_need_write_role(api_collab):
    assert api_collab.post("/api/v1/audits/A5/diffuser/").status_code == 403


# ---------- Revues ----------


def test_revue_actions_and_closure(api, demo_org):
    r = api.post(
        "/api/v1/revues/RV2/actions/",
        {
            "libelle": "Réaliser le test de restauration de l'ERP",
            "responsable": "Cédric AGBODJAN",
            "echeance": "2026-10-26",
        },
        format="json",
    )
    assert r.status_code == 200, r.content
    assert r.json()["actions"] == [
        {
            "libelle": "Réaliser le test de restauration de l'ERP",
            "responsable": "Cédric AGBODJAN",
            "echeance": "2026-10-26",
            "statut": "Mise en œuvre",
        }
    ]
    assert api.post("/api/v1/revues/RV2/actions/", {"libelle": "x"}, format="json").status_code == 400

    r = api.post("/api/v1/revues/RV2/compiler-rapport/")
    assert r.json()["rapportEntree"].startswith(
        "Couverture normative : 81 %. Indicateurs sous la cible : Taux de fréquence TF1, "
        "Taux de valorisation des coques, Systèmes critiques sauvegardés hors site. "
        "Audits clôturés : 2/6. NC ouvertes : 5. "
    )

    r = api.post("/api/v1/revues/RV2/cloturer/")
    assert r.status_code == 200 and r.json()["statut"] == "Clôturée"
    g = registre(api)[0]
    assert (g["type"], g["origine"], g["processus"], g["responsable"]) == (
        "Action de revue",
        "Revue RD-2027-S1",
        "P01",
        "Cédric AGBODJAN",
    )
    revues = api.get("/api/v1/revues/").json()
    nx = revues[-1]  # R.push : la revue suivante est ajoutée en fin de liste
    assert nx["id"].startswith("RV") and nx["id"] not in ("RV1", "RV2")
    assert nx["ref"] == "RD-2027-S1-suiv" and nx["date"] == "2027-07-20"
    assert nx["ordreDuJour"][0] == "Suivi des actions de la revue RD-2027-S1"
    assert nx["ordreDuJour"][1:] == [
        o for o in revues[1]["ordreDuJour"] if not o.startswith("Suivi des actions")
    ]
    assert (nx["statut"], nx["pv"], nx["actions"], nx["type"]) == (
        "Préparée",
        "—",
        [],
        "Revue de direction semestrielle",
    )
    assert nx["rapportEntree"] == "Généré automatiquement à la clôture de RD-2027-S1 — sera complété à J-15."
    assert (
        journal(demo_org)[0][0]
        == "a clôturé la revue RD-2027-S1 et généré l'ordre du jour de la revue suivante"
    )
    assert api.post("/api/v1/revues/RV2/cloturer/").status_code == 400


def test_add_months_like_javascript():
    assert add_months_js(dt.date(2026, 7, 22), 6) == dt.date(2027, 1, 22)
    assert add_months_js(dt.date(2026, 8, 31), 6) == dt.date(2027, 3, 3)  # 31 février -> 3 mars


# ---------- Registre et intervenants ----------


def test_registre_close_and_remind(api, api_collab, demo_org):
    r = api.post("/api/v1/registre/RG1/relancer/")
    assert r.status_code == 200 and r.json()["statut"] == "En cours"
    assert journal(demo_org)[0] == ("a relancé Bertin SOSSA sur RG-2026-031", "Registre", "Relance")
    assert api_collab.post("/api/v1/registre/RG1/cloturer/").status_code == 403
    r = api.post("/api/v1/registre/RG1/cloturer/")
    assert r.json()["statut"] == "Clôturé"
    assert journal(demo_org)[0] == ("a clôturé RG-2026-031", "Registre", "Terminé")
    assert api.post("/api/v1/registre/RG1/cloturer/").status_code == 400


def test_prestataire_evaluation(api, demo_org):
    notes = {"qualite": 2, "delai": 2, "securite": 3, "environnement": 3}
    r = api.post("/api/v1/prestataires/EX3/evaluer/", notes, format="json")
    assert r.status_code == 200
    assert r.json()["notes"] == notes
    assert r.json()["hist"][0]["a"] == "Évaluation : 50 %"
    assert journal(demo_org)[0] == ("a évalué Transports Agossou & Fils (50 %)", "Surveillance", "Terminé")
    assert (
        api.post("/api/v1/prestataires/EX3/evaluer/", {**notes, "delai": 0}, format="json").status_code == 400
    )
