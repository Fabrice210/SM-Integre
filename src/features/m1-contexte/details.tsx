import { go } from '../../app/navigation'
import { openDetail } from '../../components/data/Detail'
import { NormBadges, StatusBadge } from '../../components/ui/badges'
import { Block, LinkItem } from '../../components/ui/links'
import { fd } from '../../lib/dates'
import { axeName } from '../../lib/lookups'
import { taux } from '../../services/metrics'
import { hist, logAct, update, useApp } from '../../store/useApp'
import { joinNodes, type Any } from './util'

/** crit(p) et critLbl(p) : criticité d'une partie intéressée. */
export const crit = (p: Any): number => p.pouvoir + p.legitimite + p.urgence
export const critLbl = (p: Any) => (crit(p) >= 13 ? 'Élevé' : crit(p) >= 10 ? 'Moyen' : 'Faible')

/** enjDetail(id) */
export function enjDetail(id: string) {
  const DB = useApp.getState().db
  const e: Any = DB.enjeux.find((x) => x.id === id)
  openDetail({
    coll: 'enjeux',
    id,
    title: e.libelle,
    sub: e.source,
    rows: [
      ['Qualification', <StatusBadge value={e.qualification} />],
      [
        'Axes de la politique',
        joinNodes(
          e.axes.map((a: string) => axeName(a)),
          <br />
        ),
      ],
      ['Normes', <NormBadges norms={e.normes} />],
      ["Facteur d'origine", e.origine || 'Saisie manuelle'],
      ['Identifié le', fd(e.date)],
      ['Statut', <StatusBadge value={e.statut} />],
    ],
    extra: (
      <Block
        title="Risques et opportunités liés"
        items={DB.risques
          .filter((r) => r.normes.some((n) => e.normes.includes(n)))
          .slice(0, 3)
          .map((r) => (
            <LinkItem
              key={r.id}
              title={r.id + ' · ' + r.intitule}
              sub={r.type}
              onClick={() => go('m3-risques')}
            />
          ))}
      />
    ),
    obs: true,
    del: true,
  })
}

/** piDetail(id) */
export function piDetail(id: string) {
  const p: Any = useApp.getState().db.parties.find((x) => x.id === id)
  const toggle = () => {
    update((s) => {
      const p: Any = s.db.parties.find((x) => x.id === id)
      p.planMisEnOeuvre = !p.planMisEnOeuvre
      hist(s, p, p.planMisEnOeuvre ? 'Plan déclaré mis en œuvre' : 'Plan repassé à traiter')
      logAct(s, "a mis à jour l'état du plan d'engagement de " + p.nom, 'Parties intéressées')
    })
    piDetail(id)
  }
  openDetail({
    coll: 'parties',
    id,
    title: p.nom,
    sub: 'Partie intéressée ' + p.categorie.toLowerCase(),
    rows: [
      ['Normes', <NormBadges norms={p.normes} />],
      ['Exigences', p.exigences],
      [
        "Grille d'évaluation",
        `Pouvoir ${p.pouvoir}/5 · Légitimité ${p.legitimite}/5 · Urgence ${p.urgence}/5`,
      ],
      [
        'Criticité',
        <>
          <StatusBadge value={critLbl(p)} />
          {' ' + crit(p) + '/15'}
        </>,
      ],
      ["Plan d'engagement", p.plan],
      ['État', <StatusBadge value={p.planMisEnOeuvre ? 'Conforme' : 'À traiter'} />],
    ],
    del: true,
    acts: (
      <button className="btn" onClick={toggle}>
        {p.planMisEnOeuvre ? 'Repasser à traiter' : 'Déclarer le plan mis en œuvre'}
      </button>
    ),
  })
}

/** Fiche d'un site (clic sur une ligne de l'onglet Sites). */
export function siteDetail(i: string) {
  const x: Any = useApp.getState().db.sites.find((s) => s.id === i)
  openDetail({
    coll: 'sites',
    id: i,
    title: x.nom,
    rows: [
      ['Adresse', x.adresse],
      ['Activité', x.activite],
      ['Statut', <StatusBadge value={x.statut} />],
      ['Justification', x.justification],
    ],
    del: true,
  })
}

/** procDetail(id) : fiche processus et ses liens avec les autres modules. */
export function procDetail(id: string) {
  const DB = useApp.getState().db as Any
  const p = DB.processus.find((x: Any) => x.id === id)
  const li = (key: string, t: string, s: string, page: string) => (
    <LinkItem key={key} title={t} sub={s} onClick={() => go(page)} />
  )
  const links = (
    <>
      <Block
        title="Risques et opportunités (Module 3)"
        items={[
          ...DB.risques
            .filter((r: Any) => r.processus.includes(id))
            .map((r: Any) => li(r.id, r.id + ' · ' + r.intitule, 'Risque ' + r.type, 'm3-risques')),
          ...DB.opportunites
            .filter((r: Any) => r.processus.includes(id))
            .map((r: Any) => li(r.id, r.id + ' · ' + r.intitule, 'Opportunité', 'm3-risques')),
        ]}
      />
      <Block
        title="Objectifs et plans d'action (Module 3)"
        items={DB.objectifs
          .filter((o: Any) => o.processus.includes(id))
          .map((o: Any) =>
            li(o.id, o.code + ' · ' + o.libelle, 'Cible ' + o.cible, 'm3-objectifs')
          )}
      />
      <Block
        title="Ressources (Module 4)"
        items={DB.ressources
          .filter((r: Any) => r.processus === id)
          .map((r: Any) => li(r.id, r.besoin, r.statut, 'm4-ressources'))}
      />
      <Block
        title="Actions de communication (Module 4)"
        items={DB.communications
          .filter((c: Any) => c.processus === id)
          .map((c: Any) => li(c.id, c.objectif, c.statut + ' — ' + fd(c.date), 'm4-communication'))}
      />
      <Block
        title="Documents (Module 5)"
        items={DB.documents
          .filter((d: Any) => d.processus === id)
          .map((d: Any) => li(d.id, d.ref + ' · ' + d.intitule, d.statut, 'm5-ged'))}
      />
      <Block
        title="Plans opérationnels et fiches de maîtrise (Module 5)"
        items={[
          ...DB.plansOps
            .filter((x: Any) => x.processus === id)
            .map((x: Any) => li(x.id, x.plan, x.statut, 'm5-planif')),
          ...DB.fichesMaitrise
            .filter((x: Any) => x.processus === id)
            .map((x: Any) => li(x.id, x.objet, 'Fiche de maîtrise', 'm5-fiches')),
        ]}
      />
      <Block
        title="Actions d'amélioration (Module 6)"
        items={[
          ...DB.ncs
            .filter((n: Any) => n.processus === id)
            .map((n: Any) => li(n.id, n.ref + ' · ' + n.description, n.statut, 'm6-nc')),
          ...DB.indicateurs
            .filter((k: Any) => k.processus === id)
            .map((k: Any) =>
              li(
                k.id,
                'Indicateur : ' + k.kpi,
                "Taux d'atteinte " + taux(k) + ' %',
                'm6-surveillance'
              )
            ),
        ]}
      />
    </>
  )
  openDetail({
    coll: 'processus',
    id,
    title: p.code + ' · ' + p.intitule,
    sub: 'Processus de ' + p.categorie.toLowerCase(),
    rows: [
      ['Pilote', p.proprietaire],
      ['Finalité', p.finalite],
      ['Entrées', p.entrees],
      ['Sorties', p.sorties],
      ['Indicateurs', p.indicateurs],
      ['Normes', <NormBadges norms={p.normes} />],
    ],
    extra: links,
    obs: true,
  })
}
