"""
Actions métier du module 2 (reprises de src/features/m2-leadership/).

  POST /plan-strat/                          forms.ts planStrat.save : le nouveau plan « En vigueur »
                                             rend obsolètes les précédents
  POST /politique/publier/                   editPolitique() {orientations, signataire, date}
  POST /politique/regenerer-resume/          regenPolResume()
  POST /accuses/accuser-lecture/             accusé de lecture de l'utilisateur connecté (tout membre)
  POST /accuses/relancer/                    relance des lecteurs (PolitiquePage)
  GET|POST /diffusions/                      diffuserNoyau() / submitDiffusion() (db.diffusions)
  POST /representants/{id}/revoquer/         repDetail() : révocation du mandat
  POST /representants/{id}/reactiver/        repDetail() : réactivation du mandat
  POST /reunions/{id}/realiser/              marquerReunionFaite() {compteRendu, planAction, statutPlan,
                                             preuve1, preuve2}
  POST /reunions/planifier-annee/            planifierAnnee()
"""

import re
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.contexte.tracing import add_hist, log_act, now_stamp, today
from apps.core.models import AuditLog
from apps.core.permissions import IsMemberAnyMethod
from apps.core.viewsets import OrgModelViewSet, SingletonViewSet, log_write

from . import models as m
from .serializers import (
    DiffuserSerializer,
    DiffusionSerializer,
    PublierPolitiqueSerializer,
    RealiserReunionSerializer,
)

# ---------- 2.1 Engagement ----------


class PlanStratViewSet(OrgModelViewSet):
    @transaction.atomic
    def perform_create(self, serializer):
        super().perform_create(serializer)
        plan = serializer.instance
        if plan.statut != m.PlanStrat.Statut.EN_VIGUEUR:
            return
        anciens = m.PlanStrat.objects.filter(
            organisation=plan.organisation, statut=m.PlanStrat.Statut.EN_VIGUEUR
        ).exclude(pk=plan.pk)
        for x in anciens:
            x.statut = m.PlanStrat.Statut.OBSOLETE
            add_hist(x, self.request.user, "Remplacé par " + plan.version)
            x.save()
            log_write(
                self.request,
                self.collection.name,
                AuditLog.Action.UPDATE,
                x.uid,
                self.get_serializer(x).data,
            )


# ---------- 2.2 Politique ----------


def gen_pol_resume(org, orientations: str) -> str:
    """genPolResume() du front : résumé de la politique à partir des orientations."""
    os_ = [re.sub(r"^\d+[.)]\s*", "", o).strip() for o in (orientations or "").split("\n")]
    os_ = [o for o in os_ if o]
    norms = ", ".join(f"ISO {n}" for n in org.active_norms or [])
    txt = (
        f"Par cette politique, la direction de {org.nom} affirme son engagement en faveur d'un système "
        f"de management intégré ({norms}). Elle porte {len(os_)} orientation(s) prioritaire(s)"
    )
    if os_:
        txt += " — notamment " + " ; ".join(o[:1].lower() + o[1:] for o in os_[:3])
    return (
        txt + ". La direction s'engage à fournir les ressources nécessaires, à satisfaire aux exigences "
        "applicables et à améliorer en continu l'efficacité du système."
    )


def _next_major(version: str) -> str:
    """'v' + (parseInt(version.slice(1)) + 1)."""
    match = re.match(r"^\s*[+-]?\d+", (version or "")[1:])
    return "v" + str((int(match.group(0)) if match else 0) + 1)


class PolitiqueViewSet(SingletonViewSet):
    def _respond(self, request, obj):
        data = self.collection.serializer(obj, context=self.get_serializer_context()).data
        log_write(request, self.collection.name, AuditLog.Action.UPDATE, "", data)
        return Response(data)

    @action(detail=False, methods=["post"], serializer_class=PublierPolitiqueSerializer)
    @transaction.atomic
    def publier(self, request):
        """Publie une nouvelle version : résumé généré, version +1, accusés de lecture réinitialisés."""
        body = PublierPolitiqueSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        d = body.validated_data
        pol = self.get_object()
        org = request.user.organisation
        pol.orientations = d["orientations"]
        pol.signataire = d["signataire"]
        pol.date = d["date"]
        pol.resume = gen_pol_resume(org, d["orientations"])
        pol.version = _next_major(pol.version)
        pol.statut = m.Politique.Statut.PUBLIEE
        pol.save()
        m.Accuse.objects.filter(organisation=org).update(statut=m.Accuse.Statut.NON_LU, date="—")
        log_act(
            request.user,
            "a publié la politique SM " + pol.version + " (résumé généré par l'IA)",
            "Politique SM",
        )
        return self._respond(request, pol)

    @action(detail=False, methods=["post"], url_path="regenerer-resume")
    @transaction.atomic
    def regenerer_resume(self, request):
        pol = self.get_object()
        pol.resume = gen_pol_resume(request.user.organisation, pol.orientations)
        add_hist(pol, request.user, "Résumé régénéré par l'IA")
        pol.save()
        log_act(request.user, "a régénéré le résumé de la politique via l'IA", "Politique SM")
        return self._respond(request, pol)


class AccuseViewSet(OrgModelViewSet):
    @action(
        detail=False,
        methods=["post"],
        url_path="accuser-lecture",
        permission_classes=[IsMemberAnyMethod],
    )
    @transaction.atomic
    def accuser_lecture(self, request):
        """L'utilisateur connecté accuse lecture de la politique en vigueur (tout membre)."""
        user = request.user
        org = user.organisation
        acc = m.Accuse.objects.filter(organisation=org, collaborateur=user.nom).first()
        created = acc is None
        if created:
            last = m.Accuse.objects.filter(organisation=org).order_by("-position").first()
            acc = m.Accuse(
                organisation=org,
                uid=org.next_uid(m.Accuse.UID_PREFIX),
                collaborateur=user.nom,
                position=(last.position + 1) if last else 0,
            )
        acc.statut = m.Accuse.Statut.LU
        acc.date = today()
        acc.save()
        data = self.get_serializer(acc).data
        log_write(
            request,
            self.collection.name,
            AuditLog.Action.CREATE if created else AuditLog.Action.UPDATE,
            acc.uid,
            data,
        )
        pol = m.Politique.objects.filter(organisation=org).first()
        version = f" {pol.version}" if pol and pol.version else ""
        log_act(user, f"a accusé lecture de la politique SM{version}", "Politique SM")
        return Response(data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=False, methods=["post"])
    def relancer(self, request):
        """Relance les collaborateurs qui n'ont pas encore lu la politique."""
        n = self.get_queryset().filter(statut=m.Accuse.Statut.NON_LU).count()
        log_act(request.user, "a relancé les lecteurs de la politique", "Politique SM")
        return Response({"relances": n})


class DiffusionViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    """
    Diffusions de documents (db.diffusions) : lecture et ajout seuls.
    Interne : dépôt direct dans l'espace du destinataire ; externe : email avec pièce jointe.
    """

    serializer_class = DiffusionSerializer
    queryset = m.Diffusion.objects.none()
    filterset_fields = ("canal", "doc")
    search_fields = ("doc", "destinataires")

    def get_queryset(self):
        return m.Diffusion.objects.filter(organisation=self.request.user.organisation)

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "organisation": self.request.user.organisation}

    def get_serializer_class(self):
        return DiffuserSerializer if self.action == "create" else DiffusionSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        body = DiffuserSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        d = body.validated_data
        user = request.user
        org = user.organisation
        obj = m.Diffusion.objects.create(
            organisation=org,
            uid=org.next_uid(m.Diffusion.UID_PREFIX),
            d=now_stamp(),
            u=user.nom,
            doc=d["doc"],
            canal=d["canal"],
            destinataires=d["destinataires"],
            piece=d.get("piece") or "—",
        )
        data = DiffusionSerializer(obj, context=self.get_serializer_context()).data
        log_write(request, "diffusions", AuditLog.Action.CREATE, obj.uid, data)
        # Pas d'entrée au journal fonctionnel ici : le front l'envoie lui-même
        # (POST /journal/) dans la même mise à jour que la diffusion.
        return Response(data, status=status.HTTP_201_CREATED)


# ---------- 2.4 Consultation ----------


class RepresentantViewSet(OrgModelViewSet):
    def _set_statut(self, request, statut):
        r = self.get_object()
        r.statut = statut
        actif = statut == m.Representant.Statut.ACTIF
        add_hist(r, request.user, "Mandat réactivé" if actif else "Mandat révoqué")
        r.save()
        data = self.get_serializer(r).data
        log_write(request, self.collection.name, AuditLog.Action.UPDATE, r.uid, data)
        log_act(
            request.user,
            ("a réactivé le mandat de " if actif else "a révoqué le mandat de ") + r.prenom + " " + r.nom,
            "Consultation",
        )
        return Response(data)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def revoquer(self, request, uid=None):
        return self._set_statut(request, m.Representant.Statut.REVOQUE)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def reactiver(self, request, uid=None):
        return self._set_statut(request, m.Representant.Statut.ACTIF)


# planifierAnnee() : (objet, participants, dans n jours).
CALENDRIER_ANNUEL = (
    ("Revue trimestrielle T1 — conditions de travail", m.Reunion.Participants.CHSS, 30),
    ("Consultation semestrielle des délégués du personnel", m.Reunion.Participants.DELEGUES, 120),
    ("Assemblée générale du personnel", m.Reunion.Participants.PERSONNEL, 200),
    ("Revue trimestrielle T4 — bilan SST", m.Reunion.Participants.CHSS, 300),
)


class ReunionViewSet(OrgModelViewSet):
    @action(detail=True, methods=["post"], serializer_class=RealiserReunionSerializer)
    @transaction.atomic
    def realiser(self, request, uid=None):
        """Marque la réunion réalisée : compte rendu, plan d'action et deux preuves."""
        body = RealiserReunionSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        d = body.validated_data
        r = self.get_object()
        r.compte_rendu = d["compteRendu"]
        r.plan_action = d["planAction"]
        r.statut_plan = d["statutPlan"]
        r.preuve1 = d["preuve1"]
        r.preuve2 = d["preuve2"]
        r.statut = m.Reunion.Statut.REALISEE
        r.date = r.date or today()
        add_hist(r, request.user, "Réunion marquée réalisée (2 preuves jointes)")
        r.save()
        r.refresh_from_db()
        data = self.collection.serializer(r, context=self.get_serializer_context()).data
        log_write(request, self.collection.name, AuditLog.Action.UPDATE, r.uid, data)
        log_act(request.user, "a marqué la réunion « " + r.objet + " » comme réalisée", "Consultation")
        return Response(data)

    @action(detail=False, methods=["post"], url_path="planifier-annee")
    @transaction.atomic
    def planifier_annee(self, request):
        """Établit le calendrier annuel des réunions de consultation (sans doublon d'objet)."""
        user = request.user
        org = user.organisation
        qs = m.Reunion.objects.filter(organisation=org)
        objets = set(qs.values_list("objet", flat=True))
        last = qs.order_by("-position").first()
        position = (last.position + 1) if last else 0
        base = timezone.localdate()
        crees = []
        for objet, participants, jours in CALENDRIER_ANNUEL:
            if objet in objets:
                continue
            d = base + timedelta(days=jours)
            crees.append(
                m.Reunion.objects.create(
                    organisation=org,
                    uid=org.next_uid(m.Reunion.UID_PREFIX),
                    position=position,
                    objet=objet,
                    date_prevue=d,
                    date=d,
                    participants=participants,
                    ordre_du_jour="À préciser lors de la préparation",
                    statut=m.Reunion.Statut.PLANIFIEE,
                    compte_rendu="",
                    plan_action="",
                    statut_plan=m.Reunion.StatutPlan.A_FAIRE,
                    preuve1="",
                    preuve2="",
                )
            )
            position += 1
        data = self.get_serializer(crees, many=True).data
        for row in data:
            log_write(request, self.collection.name, AuditLog.Action.CREATE, row["id"], row)
        log_act(user, "a établi la planification annuelle des réunions de consultation", "Consultation")
        return Response({"planifiees": len(crees), "reunions": data})
