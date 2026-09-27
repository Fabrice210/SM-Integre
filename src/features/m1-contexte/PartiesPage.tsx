import { useMemo } from 'react'
import { DataTable, type Column } from '../../components/data/DataTable'
import { NormBadges, StatusBadge } from '../../components/ui/badges'
import { PageHead } from '../../components/ui/PageHead'
import { useTabs } from '../../components/ui/Tabs'
import { MOD_FULL } from '../../data/referentiels'
import { openForm } from '../../forms/crud'
import { inNorm } from '../../lib/norms'
import { useApp } from '../../store/useApp'
import { crit, critLbl, piDetail } from './details'
import type { Any } from './util'

const etat = (p: Any) => (p.planMisEnOeuvre ? 'Conforme' : 'À traiter')

const COLS: Column<Any>[] = [
  {
    l: 'Partie intéressée',
    r: (p) => (
      <>
        <span className="ttl">{p.nom}</span>
        <br />
        <span className="ref">{p.categorie}</span>
      </>
    ),
  },
  { l: 'Normes', r: (p) => <NormBadges norms={p.normes} /> },
  { l: 'Exigences', r: (p) => <span className="small">{p.exigences}</span> },
  {
    l: 'Criticité',
    r: (p) => (
      <>
        <StatusBadge value={critLbl(p)} /> <span className="small muted">{crit(p)}/15</span>
      </>
    ),
  },
  { l: "Plan d'engagement", r: (p) => <span className="small">{p.plan}</span> },
  { l: 'État', r: (p) => <StatusBadge value={etat(p)} /> },
]

const SYN_COLS: Column<Any>[] = [
  { l: 'Rang', r: (p) => p._rk },
  { l: 'Partie intéressée', r: (p) => <span className="ttl">{p.nom}</span> },
  { l: 'Pouvoir', k: 'pouvoir', cls: 'num' },
  { l: 'Légitimité', k: 'legitimite', cls: 'num' },
  { l: 'Urgence', k: 'urgence', cls: 'num' },
  { l: 'Score', r: (p) => crit(p) + '/15', cls: 'num' },
  { l: 'Criticité', r: (p) => <StatusBadge value={critLbl(p)} /> },
  { l: 'État', r: (p) => <StatusBadge value={etat(p)} /> },
]

/** PAGES['m1-parties'] */
export function PartiesPage() {
  const parties = useApp((s) => s.db.parties) as Any[]
  const norm = useApp((s) => s.ui.norm)
  const L = useMemo(() => parties.filter((r) => inNorm(r, norm)), [parties, norm])
  const ranked = useMemo(
    () =>
      parties
        .slice()
        .sort((a, b) => crit(b) - crit(a))
        .map((p, i) => ({ ...p, _rk: i + 1 })),
    [parties]
  )
  const [t, tb] = useTabs('pi', [
    ['reg', 'Registre'],
    ['syn', 'Synthèse par criticité'],
  ])
  const stats: [string, number][] = [
    ['Parties recensées', L.length],
    ['Criticité élevée', L.filter((p) => critLbl(p) === 'Élevé').length],
    ['Plans conformes', L.filter((p) => p.planMisEnOeuvre).length],
    ['Plans à traiter', L.filter((p) => !p.planMisEnOeuvre).length],
  ]
  return (
    <>
      <PageHead
        kicker={MOD_FULL.m1}
        title="1.2 Parties intéressées"
        desc="Exigences, criticité (pouvoir, légitimité, urgence) et suivi du plan d'engagement, rattachés à une ou plusieurs normes."
      />
      <div className="grid g4 mb">
        {stats.map(([a, b]) => (
          <div className="card" key={a}>
            <div className="small muted">{a}</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{b}</div>
          </div>
        ))}
      </div>
      {tb}
      <div className="card">
        {t === 'reg' ? (
          <DataTable
            id="parties"
            cols={COLS}
            rows={parties}
            onRowClick={piDetail}
            search={['nom', 'exigences']}
            filters={[
              { k: 'categorie', l: 'Catégorie', o: ['Interne', 'Externe'] },
              { k: 'etat', l: 'État', o: ['Conforme', 'À traiter'], fn: (p, v) => etat(p) === v },
            ]}
            onAdd={() => openForm('parties')}
            addLabel="Créer une fiche"
            exportName="Parties_interessees"
            collection="parties"
          />
        ) : (
          <DataTable
            id="pisyn"
            cols={SYN_COLS}
            rows={ranked}
            onRowClick={piDetail}
            exportName="Synthese_parties_interessees"
          />
        )}
      </div>
    </>
  )
}
