"""
Actions métier du module 6, fidèles au front (src/features/m6-performance) :

  ncs          POST /ncs/                         déclaration par tout membre (IsMemberAnyMethod)
               POST /ncs/{id}/valider-pilote/      ncAct 'v1' : Déclarée -> Validée pilote
               POST /ncs/{id}/approuver/           ncAct 'v2' : -> En traitement + entrée au registre
               POST /ncs/{id}/refuser/             ncAct 'ko' : -> Refusée
               POST /ncs/{id}/analyse/             analyse des causes / action / mise en œuvre
               POST /ncs/{id}/cloturer/            ncAct 'close' : efficacité + clôture (registre clôturé)
  audits       POST /audits/{id}/alerter|diffuser|demarrer/   audAct
               POST /audits/{id}/constats/         addConstat
               POST /audits/{id}/rapport/          audReport : -> Rapport déposé
               POST /audits/{id}/cloturer/         audClose : constats -> registre, -> Clôturé
  revues       POST /revues/{id}/actions/          revAction
               POST /revues/{id}/compiler-rapport/ rapport d'entrée compilé depuis les modules
               POST /revues/{id}/cloturer/         revClose : actions -> registre + revue suivante
  registre     POST /registre/{id}/cloturer|relancer/
  prestataires POST /prestataires/{id}/evaluer/    evalPresta (score = somme / 20)

Chaque action écrit l'historique de l'objet (`hist`), le journal d'audit (logAct du
front) et l'AuditLog technique. Si le front appelle ces actions, il ne doit pas
publier lui-même l'entrée de journal correspondante.
"""

import datetime as dt
import re

from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core import scope
from apps.core.models import AuditLog
from apps.core.permissions import IsMemberAnyMethod
from apps.core.viewsets import OrgModelViewSet, log_write

from . import models as m
from . import serializers as s
from .services import add_hist, add_registre, can_write, log_act, proc_owner


class WorkflowViewSet(OrgModelViewSet):
    """Base des collections à actions : contrôle de statut et enregistrement tracé."""

    def _require(self, obj, *statuts):
        if obj.statut not in statuts:
            raise serializers.ValidationError(
                {"statut": f"Action impossible au statut « {obj.statut} » (attendu : {', '.join(statuts)})."}
            )

    def _input(self, serializer_class):
        ser = serializer_class(data=self.request.data, context=self.get_serializer_context())
        ser.is_valid(raise_exception=True)
        return ser.validated_data

    def _done(self, obj, name: str):
        obj.save()
        data = self.get_serializer(obj).data
        log_write(
            self.request, self.collection.name, AuditLog.Action.UPDATE, obj.uid, {"action": name, **data}
        )
        return Response(data)

    def _add_registre(self, *args):
        """addRegistre() depuis une action : entrée tracée dans l'AuditLog."""
        g = add_registre(self.org, *args)
        log_write(
            self.request, "registre", AuditLog.Action.CREATE, g.uid, {"ref": g.ref, "origine": g.origine}
        )
        return g

    @property
    def org(self):
        return self.request.user.organisation


# ---------- 6.1 Intervenants externes ----------


def presta_score(notes: dict) -> int:
    """pScore(p) du front."""
    total = sum(notes.get(k, 0) for k in s.NOTE_KEYS)
    return int(total / 20 * 100 + 0.5)  # Math.round


class PrestataireViewSet(WorkflowViewSet):
    @extend_schema(request=s.EvaluationSerializer)
    @action(detail=True, methods=["post"])
    @transaction.atomic
    def evaluer(self, request, uid=None):
        """Évaluation : notes 1-5, score = somme / 20 (plan de progrès requis sous 60 %)."""
        p = self.get_object()
        notes = dict(self._input(s.EvaluationSerializer))
        p.notes = notes
        sc = presta_score(notes)
        add_hist(p, request.user, f"Évaluation : {sc} %")
        log_act(self.org, request.user, f"a évalué {p.nom} ({sc} %)", "Surveillance")
        return self._done(p, "evaluer")


# ---------- 6.2 Audits ----------


class AuditViewSet(WorkflowViewSet):
    S = m.Audit.Statut

    def _aud_act(self, a, statut: str, msg: str, name: str):
        """audAct(id, a) du front."""
        a.statut = statut
        add_hist(a, self.request.user, msg)
        log_act(self.org, self.request.user, f"{msg} ({a.ref})", "Audits")
        return self._done(a, name)

    @extend_schema(request=None)
    @action(detail=True, methods=["post"])
    @transaction.atomic
    def alerter(self, request, uid=None):
        a = self.get_object()
        self._require(a, self.S.PLANIFIE)
        return self._aud_act(a, a.statut, f"Alerte envoyée à {a.auditeur}", "alerter")

    @extend_schema(request=None)
    @action(detail=True, methods=["post"])
    @transaction.atomic
    def diffuser(self, request, uid=None):
        a = self.get_object()
        self._require(a, self.S.PLANIFIE)
        return self._aud_act(
            a, self.S.PLAN_DIFFUSE, "Plan d'audit diffusé aux audités et à l'auditeur", "diffuser"
        )

    @extend_schema(request=None)
    @action(detail=True, methods=["post"])
    @transaction.atomic
    def demarrer(self, request, uid=None):
        a = self.get_object()
        self._require(a, self.S.PLAN_DIFFUSE)
        return self._aud_act(a, self.S.EN_COURS, "Audit démarré", "demarrer")

    @extend_schema(request=s.ConstatSerializer)
    @action(detail=True, methods=["post"])
    @transaction.atomic
    def constats(self, request, uid=None):
        """addConstat : {type, processus, description} ajouté aux constats."""
        a = self.get_object()
        self._require(a, self.S.EN_COURS, self.S.RAPPORT_DEPOSE)
        c = self._input(s.ConstatSerializer)
        a.constats = [
            *(a.constats or []),
            {
                "type": c["type"],
                "processus": c.get("processus") or a.perimetre,
                "description": c["description"],
            },
        ]
        return self._done(a, "constats")

    @extend_schema(request=s.RapportAuditSerializer)
    @action(detail=True, methods=["post"])
    @transaction.atomic
    def rapport(self, request, uid=None):
        """audReport : dépôt du rapport et du compte-rendu de la réunion de clôture."""
        a = self.get_object()
        self._require(a, self.S.EN_COURS)
        d = self._input(s.RapportAuditSerializer)
        a.rapport = d["rapport"]
        a.compte_rendu = d["compteRendu"]
        a.statut = self.S.RAPPORT_DEPOSE
        add_hist(a, request.user, "Rapport déposé")
        log_act(self.org, request.user, f"a déposé le rapport {a.ref}", "Audits")
        return self._done(a, "rapport")

    @extend_schema(request=None)
    @action(detail=True, methods=["post"])
    @transaction.atomic
    def cloturer(self, request, uid=None):
        """audClose : chaque constat (hors point fort) devient une entrée du registre."""
        a = self.get_object()
        self._require(a, self.S.RAPPORT_DEPOSE)
        n = 0
        for c in a.constats or []:
            if c.get("type") == m.Audit.TypeConstat.POINT_FORT:
                continue
            self._add_registre(
                "Non-conformité" if c["type"].startswith("NC") else "Observation",
                c.get("description", ""),
                f"Audit {a.ref}",
                c.get("processus", ""),
                a.normes,
                proc_owner(self.org, c.get("processus", "")),
            )
            n += 1
        a.statut = self.S.CLOTURE
        add_hist(a, request.user, f"Audit clôturé — {n} action(s) enregistrée(s) au registre")
        log_act(self.org, request.user, f"a clôturé {a.ref} ({n} action(s) au registre)", "Audits")
        return self._done(a, "cloturer")


# ---------- 6.3 Revues ----------


def add_months_js(d: dt.date, n: int) -> dt.date:
    """Date.setMonth(getMonth() + n) : un 31 août + 6 mois déborde sur mars, comme en JavaScript."""
    y, mo = divmod(d.month - 1 + n, 12)
    return dt.date(d.year + y, mo + 1, 1) + dt.timedelta(days=d.day - 1)


def rapport_auto(org) -> str:
    """rapportAuto() du front : rapport d'entrée compilé depuis les modules."""
    from apps.pilotage import metrics
    from apps.pilotage.data import load_db

    db = load_db(org)
    today = timezone.localdate()
    ind = ", ".join(k.get("kpi", "") for k in db["indicateurs"] if metrics.taux(k) < 80)
    clos = sum(1 for a in db["audits"] if a.get("statut") == "Clôturé")
    nc = sum(1 for n in db["ncs"] if n.get("statut") != "Clôturée")
    tx = sum(1 for t in db["textes"] if t.get("statut") != "Fait")
    late = sum(
        1 for a in metrics.open_actions(db, "all") if (metrics.days(a.get("echeance"), today) or 0) < 0
    )
    return (
        f"Couverture normative : {metrics.coverage(db, org.active_norms, 'all')} %. "
        f"Indicateurs sous la cible : {ind}. Audits clôturés : {clos}/{len(db['audits'])}. "
        f"NC ouvertes : {nc}. Textes non conformes : {tx}. Actions en retard : {late}."
    )


class RevueViewSet(WorkflowViewSet):
    S = m.Revue.Statut

    @extend_schema(request=s.ActionRevueSerializer)
    @action(detail=True, methods=["post"], url_path="actions")
    @transaction.atomic
    def ajouter_action(self, request, uid=None):
        """revAction : action ajoutée au plan de la revue."""
        r = self.get_object()
        self._require(r, self.S.PREPAREE)
        d = self._input(s.ActionRevueSerializer)
        r.actions = [
            *(r.actions or []),
            {
                "libelle": d["libelle"],
                "responsable": d["responsable"],
                "echeance": d["echeance"].isoformat(),
                "statut": d["statut"],
            },
        ]
        return self._done(r, "actions")

    @extend_schema(request=None)
    @action(detail=True, methods=["post"], url_path="compiler-rapport")
    @transaction.atomic
    def compiler_rapport(self, request, uid=None):
        r = self.get_object()
        self._require(r, self.S.PREPAREE)
        r.rapport_entree = rapport_auto(self.org)
        add_hist(r, request.user, "Rapport d'entrée compilé automatiquement")
        return self._done(r, "compiler-rapport")

    @extend_schema(request=None)
    @action(detail=True, methods=["post"])
    @transaction.atomic
    def cloturer(self, request, uid=None):
        """revClose : actions au registre et préparation de la revue suivante (+6 mois)."""
        r = self.get_object()
        self._require(r, self.S.PREPAREE)
        r.statut = self.S.CLOTUREE
        for a in r.actions or []:
            self._add_registre(
                "Action de revue",
                a.get("libelle", ""),
                f"Revue {r.ref}",
                "P01",
                r.normes,
                a.get("responsable", ""),
            )
        d = add_months_js(r.date if isinstance(r.date, dt.date) else dt.date.fromisoformat(r.date), 6)
        last = m.Revue.objects.filter(organisation=self.org).aggregate(p=Max("position"))["p"]
        suivante = m.Revue.objects.create(
            organisation=self.org,
            uid=self.org.next_uid(m.Revue.UID_PREFIX),
            position=(last + 1) if last is not None else 0,
            ref=re.sub(r"\d{4}", str(d.year), r.ref, count=1) + "-suiv",
            date=d,
            type=r.type,
            normes=list(r.normes or []),
            statut=self.S.PREPAREE,
            # Absent de l'objet créé par le front, puis ajouté par sa migration au rechargement.
            participants=r.participants or "Direction, pilotes de processus, responsable SM",
            ordre_du_jour=[
                f"Suivi des actions de la revue {r.ref}",
                *[o for o in r.ordre_du_jour or [] if not o.startswith("Suivi des actions")],
            ],
            rapport_entree=f"Généré automatiquement à la clôture de {r.ref} — sera complété à J-15.",
            pv="—",
            actions=[],
        )
        log_write(request, self.collection.name, AuditLog.Action.CREATE, suivante.uid)
        add_hist(r, request.user, f"Revue clôturée — {len(r.actions or [])} action(s) au registre")
        log_act(
            self.org,
            request.user,
            f"a clôturé la revue {r.ref} et généré l'ordre du jour de la revue suivante",
            "Revues",
        )
        return self._done(r, "cloturer")


# ---------- 6.4 Non-conformités ----------


class NonConformiteViewSet(WorkflowViewSet):
    S = m.NonConformite.Statut

    def get_permissions(self):
        # Tout membre peut déclarer ; la suite du circuit est réservée aux rôles de pilotage.
        if self.action == "create":
            return [IsMemberAnyMethod()]
        return super().get_permissions()

    @transaction.atomic
    def perform_create(self, serializer):
        user = self.request.user
        # Pilote limité à ses processus (droitsParProcessus) : déclarant ordinaire hors de ceux-ci.
        out_of_scope = scope.is_process_scoped(user) and not scope.owns_any(
            self.request, serializer.validated_data.get("processus")
        )
        if not can_write(user) or out_of_scope:
            # Un collaborateur déclare : le circuit démarre toujours au premier niveau, la
            # référence est générée (pas de doublon d'une NC existante), l'efficacité et
            # l'historique (`hist`) ne sont pas renseignables par le déclarant.
            extra = {k: v for k, v in (serializer.validated_data.get("extra") or {}).items() if k != "hist"}
            obj = serializer.save(
                statut=self.S.DECLAREE,
                n1=m.NonConformite.Niveau1.EN_ATTENTE,
                n2=m.NonConformite.Niveau2.EN_ATTENTE,
                declarant=user.nom,
                ref="",
                efficacite=None,
                extra=extra,
            )
        else:
            obj = serializer.save(declarant=serializer.validated_data.get("declarant") or user.nom)
        log_write(self.request, self.collection.name, AuditLog.Action.CREATE, obj.uid, serializer.data)

    def _nc_act(self, n, m_text: str, name: str):
        """Fin commune de ncAct : historique « ref message » et journal « a <verbe> ref »."""
        add_hist(n, self.request.user, f"{n.ref} {m_text}")
        log_act(self.org, self.request.user, f"a {m_text.split(' ')[0]} {n.ref}", "Non-conformités", n.statut)
        return self._done(n, name)

    @extend_schema(request=None)
    @action(detail=True, methods=["post"], url_path="valider-pilote")
    @transaction.atomic
    def valider_pilote(self, request, uid=None):
        n = self.get_object()
        self._require(n, self.S.DECLAREE)
        n.n1 = m.NonConformite.Niveau1.VALIDE
        n.statut = self.S.VALIDEE_PILOTE
        return self._nc_act(
            n, "validé(e) par le pilote — transmis(e) au responsable du système", "valider-pilote"
        )

    @extend_schema(request=None)
    @action(detail=True, methods=["post"])
    @transaction.atomic
    def approuver(self, request, uid=None):
        n = self.get_object()
        self._require(n, self.S.VALIDEE_PILOTE)
        n.n2 = m.NonConformite.Niveau2.APPROUVE
        n.statut = self.S.EN_TRAITEMENT
        self._add_registre(
            "Incident" if n.categorie == m.NonConformite.Categorie.ACCIDENT else n.categorie,
            n.description,
            f"{n.source} ({n.ref})",
            n.processus,
            n.normes,
            proc_owner(self.org, n.processus),
        )
        return self._nc_act(
            n, "approuvé(e) par le responsable du système — consolidé(e) dans le registre", "approuver"
        )

    @extend_schema(request=None)
    @action(detail=True, methods=["post"])
    @transaction.atomic
    def refuser(self, request, uid=None):
        n = self.get_object()
        self._require(n, self.S.DECLAREE, self.S.VALIDEE_PILOTE)
        n.statut = self.S.REFUSEE
        if n.n1 == m.NonConformite.Niveau1.VALIDE:
            n.n2 = m.NonConformite.Niveau2.REFUSE
        else:
            n.n1 = m.NonConformite.Niveau1.REFUSE
        return self._nc_act(n, "refusé(e) — retour au déclarant", "refuser")

    @extend_schema(request=s.AnalyseSerializer)
    @action(detail=True, methods=["post"])
    @transaction.atomic
    def analyse(self, request, uid=None):
        """Analyse des causes et plan d'action (cause, action, miseEnOeuvre) tant que la NC est ouverte."""
        n = self.get_object()
        self._require(n, self.S.DECLAREE, self.S.VALIDEE_PILOTE, self.S.EN_TRAITEMENT, self.S.REFUSEE)
        d = self._input(s.AnalyseSerializer)
        for key, field in (("cause", "cause"), ("action", "action"), ("miseEnOeuvre", "mise_en_oeuvre")):
            if key in d:
                setattr(n, field, d[key])
        return self._nc_act(n, "analysé(e) — causes et plan d'action mis à jour", "analyse")

    @extend_schema(request=s.EfficaciteSerializer)
    @action(detail=True, methods=["post"])
    @transaction.atomic
    def cloturer(self, request, uid=None):
        """Évaluation de l'efficacité puis clôture ; l'entrée du registre liée est clôturée."""
        n = self.get_object()
        self._require(n, self.S.EN_TRAITEMENT)
        e = self._input(s.EfficaciteSerializer)["efficacite"]
        n.statut = self.S.CLOTUREE
        n.efficacite = e
        g = (
            m.RegistreEntree.objects.filter(organisation=self.org, origine__contains=n.ref)
            .order_by("position", "id")
            .first()
        )
        if g is not None:
            g.statut = m.RegistreEntree.Statut.CLOTURE
            g.save(update_fields=["statut", "updated_at"])
            log_write(request, "registre", AuditLog.Action.UPDATE, g.uid, {"statut": g.statut})
        return self._nc_act(n, f"clôturé(e) — efficacité : {e}", "cloturer")


# ---------- 6.5 Registre ----------


class RegistreViewSet(WorkflowViewSet):
    S = m.RegistreEntree.Statut

    @extend_schema(request=None)
    @action(detail=True, methods=["post"])
    @transaction.atomic
    def cloturer(self, request, uid=None):
        g = self.get_object()
        self._require(g, self.S.EN_COURS)
        g.statut = self.S.CLOTURE
        log_act(self.org, request.user, f"a clôturé {g.ref}", "Registre")
        return self._done(g, "cloturer")

    @extend_schema(request=None)
    @action(detail=True, methods=["post"])
    @transaction.atomic
    def relancer(self, request, uid=None):
        g = self.get_object()
        self._require(g, self.S.EN_COURS)
        log_act(self.org, request.user, f"a relancé {g.responsable} sur {g.ref}", "Registre", "Relance")
        return Response(self.get_serializer(g).data)
