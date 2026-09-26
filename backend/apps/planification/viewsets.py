"""
Actions métier du module 3, reprises des fonctions du front (src/features/m3-planification) :

  POST /objectifs/{id}/actions/                 editAction(oid, -1) : ajout d'une action
  PUT|PATCH /objectifs/{id}/actions/{n}/        editAction(oid, n) : modification (n à partir de 0)
  POST /objectifs/{id}/evaluation/              évaluation de l'efficacité {efficacite}
  GET  /objectifs/suivi/                        objProg / objLate : avancement et retard
  POST /objectifs/import/                       doImportObjectifs() : {objectifs: [...]}
  POST /textes/{id}/diffuser/                   submitDiffTexte() : {mode, destinataire, processus}
  POST /textes/{id}/qualifier-urgence/          qualifUrgence() : crée un risque « Situation d'urgence »
  POST /declarations/{id}/soumettre/            declAct(id, 'submit')
  POST /declarations/{id}/decision/             declAct(id, 'ok' | 'ko') : {decision, commentaire?}
  POST /risques/{id}/realise/                   riskRealise() : entrée au registre d'amélioration
  POST /risques/{id}/evaluation/                efficacité du traitement {efficacite}
  GET  /risques/cartographie/                   niv / nivLbl : niveau = probabilité × criticité
  POST /opportunites/{id}/evaluation/           efficacité {efficacite}
  GET  /opportunites/cartographie/              niveau = probabilité × impact
  POST /fiches-maitrise/{id}/mettre-a-jour/     fmUpdate() : prochaine mise à jour à 12 mois

Chaque action historise l'élément (`hist`), écrit le journal (comme logAct) et l'AuditLog.
"""

import datetime

from django.db import transaction
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.core import registry
from apps.core.models import AuditLog, Role
from apps.core.viewsets import OrgModelViewSet, log_write

from . import models as m
from .serializers import RisqueSerializer, validate_action
from .services import (
    add_hist,
    add_registre,
    add_years,
    count_of,
    create_linked,
    fd,
    is_registered,
    log_act,
    niveau,
    niveau_label,
    objectif_avancement,
    objectif_en_retard,
    today,
)


def _payload(request) -> dict:
    """Corps de requête à plat (JSON ou formulaire)."""
    data = request.data
    if hasattr(data, "dict"):
        return data.dict()
    if not isinstance(data, dict):
        raise serializers.ValidationError("Objet attendu.")
    return dict(data)


class _PlanifViewSet(OrgModelViewSet):
    def _save(self, obj, fields=None):
        """Enregistre une modification faite par une action et la trace (AuditLog)."""
        obj.save(update_fields=[*(fields or []), "extra", "updated_at"])
        data = self.get_serializer(obj).data
        log_write(self.request, self.collection.name, AuditLog.Action.UPDATE, obj.uid, data)
        return data


class _EvaluationMixin:
    """POST {id}/evaluation/ {efficacite} : évaluation de l'efficacité, historisée."""

    EVAL_MOD = ""

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def evaluation(self, request, uid=None):
        obj = self.get_object()
        field = obj._meta.get_field("efficacite")
        value = request.data.get("efficacite")
        allowed = [c for c, _ in field.choices]
        if value not in allowed:
            raise serializers.ValidationError(
                {"efficacite": f"Valeur attendue parmi : {', '.join(allowed)}."}
            )
        obj.efficacite = value
        add_hist(obj, request.user, "Efficacité évaluée : " + value)
        label = getattr(obj, "code", "") or obj.uid
        log_act(request, f"a évalué l'efficacité de {label} : {value}", self.EVAL_MOD)
        return Response(self._save(obj, ["efficacite"]))


# ---------- 3.1 Objectifs ----------


class ObjectifViewSet(_EvaluationMixin, _PlanifViewSet):
    EVAL_MOD = "Objectifs"

    @action(detail=True, methods=["post"], url_path="actions")
    @transaction.atomic
    def add_action(self, request, uid=None):
        obj = self.get_object()
        a = validate_action(_payload(request))
        obj.actions = [*(obj.actions or []), a]
        return Response(self._action_saved(obj, a, "Action ajoutée"), status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["put", "patch"], url_path=r"actions/(?P<index>\d+)")
    @transaction.atomic
    def update_action(self, request, uid=None, index=None):
        obj = self.get_object()
        actions = list(obj.actions or [])
        i = int(index)
        if i >= len(actions):
            return Response({"detail": "Action introuvable."}, status=status.HTTP_404_NOT_FOUND)
        # Object.assign(o.actions[i], d) du front : PATCH fusionne, PUT remplace.
        base = actions[i] if request.method == "PATCH" else {}
        a = validate_action({**base, **_payload(request)})
        actions[i] = a
        obj.actions = actions
        return Response(self._action_saved(obj, a, "Action modifiée"))

    def _action_saved(self, obj, a, verbe):
        add_hist(obj, self.request.user, f"{verbe} : {a['libelle']}")
        log_act(self.request, "a mis à jour le plan d'action de " + obj.code, "Objectifs")
        return self._save(obj, ["actions"])

    @action(detail=False, methods=["get"])
    def suivi(self, request):
        return Response(
            [
                {
                    "id": o.uid,
                    "code": o.code,
                    "avancement": objectif_avancement(o.actions or []),
                    "enRetard": objectif_en_retard(o.actions or []),
                }
                for o in self.filter_queryset(self.get_queryset())
            ]
        )

    @action(detail=False, methods=["post"], url_path="import")
    @transaction.atomic
    def import_objectifs(self, request):
        """
        Import d'un tableau de bord existant : {objectifs: [...]} (lignes déjà lues du
        fichier Excel / CSV par le client). Les codes déjà présents sont ignorés ; les
        objectifs importés sont marqués `importe` et démarrent sans action.
        """
        rows = request.data.get("objectifs") if isinstance(request.data, dict) else request.data
        if not isinstance(rows, list) or not rows:
            raise serializers.ValidationError({"objectifs": "Liste d'objectifs attendue."})
        org = request.user.organisation
        codes = set(m.Objectif.objects.filter(organisation=org).values_list("code", flat=True))
        axe = ""
        if is_registered("axes"):
            first = (
                registry.get("axes").model.objects.filter(organisation=org).order_by("position", "id").first()
            )
            axe = first.uid if first else ""
        created, ignored, errors = [], [], {}
        for i, row in enumerate(rows):
            if not isinstance(row, dict):
                errors[i] = ["Objet attendu."]
                continue
            if row.get("code") in codes:
                ignored.append(row.get("code"))
                continue
            data = {"axe": axe, "efficacite": "Non évaluée", **row, "actions": [], "importe": True}
            data.setdefault("id", org.next_uid(m.Objectif.UID_PREFIX))
            ser = self.get_serializer(data=data)
            if not ser.is_valid():
                errors[i] = ser.errors
                continue
            obj = ser.save()
            codes.add(obj.code)
            log_write(request, self.collection.name, AuditLog.Action.CREATE, obj.uid, ser.data)
            created.append(ser.data)
        if errors:
            transaction.set_rollback(True)
            return Response({"lignes": errors}, status=status.HTTP_400_BAD_REQUEST)
        log_act(
            request, f"a importé un tableau de bord des objectifs ({len(created)} objectif(s))", "Objectifs"
        )
        return Response(
            {"importes": len(created), "ignores": ignored, "objectifs": created},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


# ---------- 3.2 Fiches de maîtrise ----------


class FicheMaitriseViewSet(_PlanifViewSet):
    @action(detail=True, methods=["post"], url_path="mettre-a-jour")
    @transaction.atomic
    def mettre_a_jour(self, request, uid=None):
        obj = self.get_object()
        d = today()
        obj.derniere_maj = d
        obj.prochaine_maj = add_years(d, 1)
        add_hist(obj, request.user, "Mise à jour périodique réalisée")
        log_act(request, f"a mis à jour la fiche de maîtrise « {obj.objet} »", "Maîtrise opérationnelle")
        return Response(self._save(obj, ["derniere_maj", "prochaine_maj"]))


# ---------- Veille réglementaire ----------


def proc_name(org, uid: str) -> str:
    """procName() du front : « code · intitulé » ou l'id."""
    if uid and is_registered("processus"):
        p = registry.get("processus").model.objects.filter(organisation=org, uid=uid).first()
        if p:
            return f"{p.code} · {p.intitule}"
    return uid or "—"


class TexteViewSet(_PlanifViewSet):
    @action(detail=True, methods=["post"])
    @transaction.atomic
    def diffuser(self, request, uid=None):
        """{mode: 'dest' | 'proc', destinataire?, processus?}"""
        obj = self.get_object()
        org = request.user.organisation
        mode = request.data.get("mode", "dest")
        if mode not in ("dest", "proc"):
            raise serializers.ValidationError({"mode": "Valeur attendue : 'dest' ou 'proc'."})
        proc = request.data.get("processus") or "—"
        if mode == "proc" and proc != "—":
            if (
                is_registered("processus")
                and not registry.get("processus").model.objects.filter(organisation=org, uid=proc).exists()
            ):
                raise serializers.ValidationError({"processus": f"Processus inconnu : {proc}"})
            cible = "tous les intéressés du processus " + proc_name(org, proc)
        else:
            cible = request.data.get("destinataire") or "destinataire non précisé"
        obj.diffuse = True
        obj.statut_diff = "Diffusé"
        obj.destinataire_diff = cible
        add_hist(obj, request.user, "Texte diffusé à : " + cible)
        log_act(request, f"a diffusé le texte « {obj.intitule[:50]}… » à {cible}", "Veille")
        return Response(self._save(obj, ["diffuse", "statut_diff", "destinataire_diff"]))

    @action(detail=True, methods=["post"], url_path="qualifier-urgence")
    @transaction.atomic
    def qualifier_urgence(self, request, uid=None):
        t = self.get_object()
        ctx = {**self.get_serializer_context(), "skip_ref_validation": True}
        ser = RisqueSerializer(
            data={
                "intitule": "Situation d'urgence liée à : " + t.intitule[:60],
                "cause": t.justificatif,
                "consequences": "Accident, pollution ou sanction réglementaire",
                "type": m.TypeRisque.URGENCE,
                "normes": t.normes,
                "probabilite": 2,
                "criticite": 4,
                "traitement": m.Risque.Traitement.REDUIRE,
                "processus": ["P11"],
                "action": "Créer la fiche de situation d'urgence et planifier un exercice",
                "responsable": t.responsable,
                "echeance": (today() + datetime.timedelta(days=60)).isoformat(),
                "statutAction": m.StatutAction.MISE_EN_OEUVRE,
                "efficacite": m.EfficaciteTraitement.A_EVALUER,
                "realise": False,
            },
            context=ctx,
        )
        ser.is_valid(raise_exception=True)
        r = ser.save()
        add_hist(r, request.user, "Qualifié en situation d'urgence depuis le registre de veille")
        r.save(update_fields=["extra"])
        data = RisqueSerializer(r, context=ctx).data
        log_write(request, "risques", AuditLog.Action.CREATE, r.uid, data)
        log_act(request, f"a qualifié un risque de situation d'urgence depuis la veille ({r.uid})", "Veille")
        return Response(data, status=status.HTTP_201_CREATED)


class DeclarationViewSet(_PlanifViewSet):
    @action(detail=True, methods=["post"])
    @transaction.atomic
    def soumettre(self, request, uid=None):
        d = self.get_object()
        if d.statut not in (m.Declaration.Statut.BROUILLON, m.Declaration.Statut.REFUSEE):
            return Response(
                {
                    "detail": f"Déclaration « {d.statut} » : seule une déclaration en brouillon ou refusée est soumise."
                },
                status=status.HTTP_409_CONFLICT,
            )
        d.statut = m.Declaration.Statut.SOUMISE
        d.commentaire_dg = "En attente de décision du Directeur Général"
        add_hist(d, request.user, "Soumise au Directeur Général")
        log_act(request, f"a soumis la déclaration « {d.objet} » au DG", "Veille", "En attente")
        return Response(self._save(d, ["statut", "commentaire_dg"]))

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def decision(self, request, uid=None):
        """{decision: 'valider' | 'refuser', commentaire?} — Directeur Général (rôle Dirigeant)."""
        d = self.get_object()
        user = request.user
        if not (user.is_superuser or user.has_role(Role.DIRIGEANT)):
            raise PermissionDenied("Décision réservée au Directeur Général (rôle Dirigeant).")
        decision = request.data.get("decision")
        if decision not in ("valider", "refuser"):
            raise serializers.ValidationError({"decision": "Valeur attendue : 'valider' ou 'refuser'."})
        if d.statut != m.Declaration.Statut.SOUMISE:
            return Response(
                {"detail": f"Déclaration « {d.statut} » : seule une déclaration soumise peut être décidée."},
                status=status.HTTP_409_CONFLICT,
            )
        commentaire = (request.data.get("commentaire") or "").strip()
        if decision == "valider":
            d.statut = m.Declaration.Statut.VALIDEE
            d.commentaire_dg = (
                commentaire or f"Validée le {fd(today())} — liée au registre des non-conformités"
            )
            add_hist(d, user, "Validée par le DG")
            self._lier_non_conformite(d)
            log_act(
                request,
                f"a validé la déclaration « {d.objet} » — écart lié au module Non-conformités",
                "Veille",
            )
        else:
            d.statut = m.Declaration.Statut.REFUSEE
            d.commentaire_dg = commentaire or "Refusée — complément demandé sur le plan d'action"
            add_hist(d, user, "Refusée par le DG, retour à l'auteur")
            log_act(request, f"a refusé la déclaration « {d.objet} »", "Veille", "Refusé")
        return Response(self._save(d, ["statut", "commentaire_dg"]))

    def _lier_non_conformite(self, d):
        """Écart créé au module 6.4 (ncs) et au registre d'amélioration, s'ils sont enregistrés."""
        request = self.request
        org = request.user.organisation
        t = m.Texte.objects.filter(organisation=org, uid=d.texte).first()
        normes = t.normes if t else ["9001"]
        responsable = t.responsable if t else request.user.nom
        if is_registered("ncs"):
            create_linked(
                request,
                "ncs",
                {
                    "id": org.next_uid("NC"),
                    "ref": f"NC-{today().year}-0{30 + count_of('ncs', org)}",
                    "categorie": "Non-conformité",
                    "source": "Veille réglementaire",
                    "description": d.objet,
                    "typeActe": "Conformité",
                    "cause": d.cause,
                    "action": d.plan_action,
                    "lieu": org.nom,
                    "processus": "P02",
                    "normes": normes,
                    "statut": "En traitement",
                    "n1": "Validé",
                    "n2": "Approuvé",
                    "date": today().isoformat(),
                    "declarant": d.auteur,
                    "origine": "Déclaration " + d.uid,
                },
            )
        add_registre(
            request, "Non-conformité", d.objet, f"Veille réglementaire ({d.uid})", "P02", normes, responsable
        )


# ---------- 3.3 Risques et opportunités ----------


class RisqueViewSet(_EvaluationMixin, _PlanifViewSet):
    EVAL_MOD = "Risques"

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def realise(self, request, uid=None):
        r = self.get_object()
        if r.realise:
            return Response({"detail": "Risque déjà déclaré réalisé."}, status=status.HTTP_409_CONFLICT)
        r.realise = True
        add_hist(r, request.user, "Risque déclaré réalisé")
        add_registre(
            request,
            "Risque réalisé",
            f"{r.intitule} ({r.uid})",
            "Risque " + r.uid,
            (r.processus or [""])[0],
            r.normes,
            r.responsable,
        )
        log_act(request, f"a déclaré le risque {r.uid} réalisé — entrée créée dans le registre", "Risques")
        return Response(self._save(r, ["realise"]))

    @action(detail=False, methods=["get"])
    def cartographie(self, request):
        out = []
        for r in self.filter_queryset(self.get_queryset()):
            n = niveau({"probabilite": r.probabilite, "criticite": r.criticite})
            out.append(
                {
                    "id": r.uid,
                    "intitule": r.intitule,
                    "probabilite": r.probabilite,
                    "criticite": r.criticite,
                    "niveau": n,
                    "classe": niveau_label(n),
                }
            )
        return Response(out)


class OpportuniteViewSet(_EvaluationMixin, _PlanifViewSet):
    EVAL_MOD = "Opportunités"

    @action(detail=False, methods=["get"])
    def cartographie(self, request):
        return Response(
            [
                {
                    "id": o.uid,
                    "intitule": o.intitule,
                    "probabilite": o.probabilite,
                    "impact": o.impact,
                    "niveau": niveau({"probabilite": o.probabilite, "impact": o.impact}),
                }
                for o in self.filter_queryset(self.get_queryset())
            ]
        )
