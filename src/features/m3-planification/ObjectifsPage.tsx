import { Fragment, useMemo, type ReactNode } from 'react'
import { DataTable } from '../../components/data/DataTable'
import { DueDate, NormBadges, Progress, StatusBadge } from '../../components/ui/badges'
import { PageHead } from '../../components/ui/PageHead'
import { useTabs } from '../../components/ui/Tabs'
import { MOD_FULL } from '../../data/referentiels'
import { openForm } from '../../forms/crud'
import type { Rec } from '../../forms/types'
import { fd } from '../../lib/dates'
import { axeName, procOpts } from '../../lib/lookups'
import { inNorm } from '../../lib/norms'
import { useApp } from '../../store/useApp'
import { ACT_ST, objLate, objProg } from './helpers'
import { editAction, objDetail } from './objectifs'

function ObjCard({ o }: { o: Rec }) {
  return (
    <div className="card flat" style={{ cursor: 'pointer' }} onClick={() => objDetail(o.id)}>
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <span className="badge b-blue">{o.code}</span>
        {objLate(o) ? (
          <span className="badge b-red">retard signalé</span>
        ) : (
          <StatusBadge value={o.efficacite} />
        )}
      </div>
      <h3 style={{ fontSize: '14.5px', margin: '8px 0 4px' }}>{o.libelle}</h3>
      <div className="small muted">
        {o.kpi} — cible {o.cible} — {fd(o.delai)}
      </div>
      <div style={{ marginTop: 8 }}>
        <Progress value={objProg(o)} />
      </div>
    </div>
  )
}

/** PAGES['m3-objectifs'] de l'original. */
export function ObjectifsPage() {
  const [t, tb] = useTabs('obj', [
    ['list', 'Liste des objectifs'],
    ['proc', 'Vue par processus'],
    ['axe', 'Vue par axe stratégique'],
    ['act', 'Suivi des actions'],
  ])
  const objectifs = useApp((s) => s.db.objectifs) as Rec[]
  const processus = useApp((s) => s.db.processus)
  const axes = useApp((s) => s.db.axes)
  const norm = useApp((s) => s.ui.norm)
  const O = useMemo(() => objectifs.filter((o) => inNorm(o, norm)), [objectifs, norm])
  const L = useMemo(() => {
    const L: Rec[] = []
    O.forEach((o) =>
      o.actions.forEach((a: Rec, i: number) =>
        L.push({ ...a, id: o.id + '#' + i, obj: o.code, normes: o.normes, processus: o.processus })
      )
    )
    return L
  }, [O])

  let c: ReactNode = null
  if (t === 'list')
    c = (
      <div className="card">
        <DataTable<Rec & { id: string }>
          id="obj"
          cols={[
            { l: 'Code', k: 'code' },
            {
              l: 'Objectif',
              r: (o) => (
                <>
                  <span className="ttl">{o.libelle}</span>
                  <br />
                  <span className="ref">{axeName(o.axe)}</span>
                </>
              ),
            },
            { l: 'KPI', k: 'kpi' },
            { l: 'Cible', k: 'cible' },
            { l: 'Délai', r: (o) => fd(o.delai) },
            {
              l: 'Processus',
              r: (o) =>
                o.processus.map((p: string, i: number) => (
                  <Fragment key={p}>
                    {i > 0 ? ' ' : ''}
                    <span className="badge b-grey">{p}</span>
                  </Fragment>
                )),
            },
            {
              l: 'Avancement',
              r: (o) => (
                <>
                  <Progress value={objProg(o)} />
                  {objLate(o) ? <span className="badge b-red">retard</span> : null}
                </>
              ),
            },
            { l: 'Normes', r: (o) => <NormBadges norms={o.normes} /> },
          ]}
          rows={objectifs as (Rec & { id: string })[]}
          onRowClick={objDetail}
          search={['libelle', 'kpi', 'code']}
          filters={[
            { k: 'processus', l: 'Processus', o: procOpts },
            { k: 'axe', l: 'Axe', o: () => axes.map((a) => [a.id, a.code] as [string, string]) },
            {
              k: 'periode',
              l: 'Période',
              o: ['2026', '2027'],
              fn: (o, v) => o.delai.startsWith(v),
            },
          ]}
          onAdd={() => openForm('objectifs')}
          addLabel="Définir un objectif"
          exportName="Objectifs"
        />
      </div>
    )
  if (t === 'proc')
    c = processus
      .filter((p) => O.some((o) => o.processus.includes(p.id)))
      .map((p) => (
        <div key={p.id} className="card mb">
          <div className="card-h">
            <h3>
              {p.code} · {p.intitule}
            </h3>
            <span className="small muted">Pilote : {p.proprietaire}</span>
          </div>
          <div className="grid g3">
            {O.filter((o) => o.processus.includes(p.id)).map((o) => (
              <ObjCard key={o.id} o={o} />
            ))}
          </div>
        </div>
      ))
  if (t === 'axe')
    c = axes.map((a) => {
      const list = O.filter((o) => o.axe === a.id)
      return (
        <div key={a.id} className="card mb">
          <div className="card-h">
            <h3>
              {a.code} — {a.libelle}
            </h3>
            <Progress value={a.avancement} />
          </div>
          <div className="grid g3">
            {list.length ? (
              list.map((o) => <ObjCard key={o.id} o={o} />)
            ) : (
              <div className="small muted">Aucun objectif rattaché à cet axe.</div>
            )}
          </div>
        </div>
      )
    })
  if (t === 'act')
    c = (
      <div className="card">
        <DataTable<Rec & { id: string }>
          id="acts"
          cols={[
            { l: 'Objectif', k: 'obj' },
            { l: 'Action', r: (a) => <span className="ttl">{a.libelle}</span> },
            { l: 'Responsable', k: 'responsable' },
            {
              l: 'Échéance',
              r: (a) => <DueDate date={a.echeance} done={a.statut === 'Clôturé'} />,
            },
            { l: 'Statut', r: (a) => <StatusBadge value={a.statut} /> },
            { l: 'Observation', r: (a) => <span className="small">{a.observation}</span> },
          ]}
          rows={L as (Rec & { id: string })[]}
          onRowClick={(i) => editAction(i.split('#')[0], +i.split('#')[1])}
          search={['libelle', 'responsable']}
          filters={[
            { k: 'statut', l: 'Statut', o: ACT_ST },
            { k: 'processus', l: 'Processus', o: procOpts },
          ]}
          exportName="Extraction_plans_action"
        />
      </div>
    )

  return (
    <>
      <PageHead
        kicker={MOD_FULL.m3}
        title="3.1 Objectifs et plans d'action"
        desc="Objectifs liés aux orientations stratégiques, avec KPI, cible, délai, processus et plan d'action suivi jusqu'à l'évaluation de l'efficacité."
      />
      {tb}
      {c}
    </>
  )
}
