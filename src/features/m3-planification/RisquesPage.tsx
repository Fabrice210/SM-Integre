import { Fragment, useMemo, type ReactNode } from 'react'
import { DataTable } from '../../components/data/DataTable'
import { DueDate, NormBadges, Progress, StatusBadge } from '../../components/ui/badges'
import { Icon } from '../../components/ui/Icon'
import { PageHead } from '../../components/ui/PageHead'
import { useTabs } from '../../components/ui/Tabs'
import { MOD_FULL, NORMS, type NormId } from '../../data/referentiels'
import { openForm } from '../../forms/crud'
import type { Rec } from '../../forms/types'
import { procOpts } from '../../lib/lookups'
import { inNorm } from '../../lib/norms'
import { exportTable, tableRegistry } from '../../services/exports'
import { update, useApp } from '../../store/useApp'
import { toast } from '../../store/useOverlays'
import { niv, nivLbl, RTYPES } from './helpers'
import { oppDetail, riskDetail } from './risques'

type Row = { id: string; normes?: readonly string[] } & Rec

const actionCell = (r: Row) => (
  <>
    <span className="small">{r.action}</span>
    <br />
    <DueDate date={r.echeance} done={r.statutAction === 'Clôturé'} />
  </>
)

/** PAGES['m3-risques'] de l'original. */
export function RisquesPage() {
  const [t, tb] = useTabs('ro', [
    ['r', 'Risques'],
    ['o', 'Opportunités'],
    ['m', 'Cartographie commune'],
    ['s', 'Reporting statistique'],
  ])
  const risques = useApp((s) => s.db.risques) as Row[]
  const opportunites = useApp((s) => s.db.opportunites) as Row[]
  const activeNorms = useApp((s) => s.activeNorms)
  const norm = useApp((s) => s.ui.norm)
  const R = useMemo(() => risques.filter((x) => inNorm(x, norm)), [risques, norm])
  const O = useMemo(() => opportunites.filter((x) => inNorm(x, norm)), [opportunites, norm])

  let c: ReactNode = null
  if (t === 'r')
    c = (
      <div className="card">
        <DataTable<Row>
          id="risques"
          cols={[
            { l: 'Réf.', k: 'id' },
            {
              l: 'Risque',
              r: (r) => (
                <>
                  <span className="ttl">{r.intitule}</span>
                  <br />
                  <span className="ref">{r.cause}</span>
                </>
              ),
            },
            { l: 'Type', r: (r) => <span className="badge b-grey">{r.type}</span> },
            {
              l: 'P × C',
              r: (r) => (
                <>
                  {r.probabilite} × {r.criticite} = <b>{niv(r)}</b>
                </>
              ),
            },
            { l: 'Niveau', r: (r) => <StatusBadge value={nivLbl(niv(r))} /> },
            { l: 'Traitement', k: 'traitement' },
            { l: 'Action', r: actionCell },
            { l: 'Statut', r: (r) => <StatusBadge value={r.statutAction} /> },
            { l: 'Normes', r: (r) => <NormBadges norms={r.normes} /> },
          ]}
          rows={risques}
          onRowClick={riskDetail}
          search={['intitule', 'cause', 'id']}
          filters={[
            { k: 'type', l: 'Type', o: RTYPES },
            {
              k: 'normes',
              l: 'Norme',
              o: () => activeNorms.map((n) => [n, NORMS[n].code] as [string, string]),
            },
            { k: 'processus', l: 'Processus', o: procOpts },
          ]}
          onAdd={() => openForm('risques')}
          addLabel="Créer une fiche risque"
          exportName="Registre_risques"
          collection="risques"
          extra={
            activeNorms.includes('45001') ? (
              <button
                className="btn sm"
                onClick={() => {
                  update((s) => {
                    s.ui.filt.risques = { type: 'SST' }
                  })
                  toast('Vue DUERP : registre filtré sur les risques SST.')
                }}
              >
                Vue DUERP
              </button>
            ) : null
          }
        />
      </div>
    )
  if (t === 'o')
    c = (
      <div className="card">
        <DataTable<Row>
          id="opps"
          cols={[
            { l: 'Réf.', k: 'id' },
            {
              l: 'Opportunité',
              r: (r) => (
                <>
                  <span className="ttl">{r.intitule}</span>
                  <br />
                  <span className="ref">{r.origine}</span>
                </>
              ),
            },
            { l: 'Bénéfices', r: (r) => <span className="small">{r.benefices}</span> },
            {
              l: 'P × I',
              r: (r) => (
                <>
                  {r.probabilite} × {r.impact} = <b>{niv(r)}</b>
                </>
              ),
            },
            { l: 'Exploitation', r: (r) => <span className="small">{r.exploitation}</span> },
            { l: 'Action', r: actionCell },
            { l: 'Statut', r: (r) => <StatusBadge value={r.statutAction} /> },
            { l: 'Normes', r: (r) => <NormBadges norms={r.normes} /> },
          ]}
          rows={opportunites}
          onRowClick={oppDetail}
          search={['intitule', 'origine']}
          filters={[
            { k: 'type', l: 'Type', o: RTYPES },
            { k: 'processus', l: 'Processus', o: procOpts },
          ]}
          onAdd={() => openForm('opportunites')}
          addLabel="Créer une fiche opportunité"
          exportName="Registre_opportunites"
          collection="opportunites"
        />
      </div>
    )
  if (t === 'm') {
    const cell = (p: number, g: number) => {
      const s = p * g
      const cls = s >= 12 ? 4 : s >= 8 ? 3 : s >= 4 ? 2 : 1
      return (
        <div key={g} className={`cell hm-${cls}`}>
          {R.filter((r) => r.probabilite === p && r.criticite === g).map((r) => (
            <span key={r.id} className="pin" onClick={() => riskDetail(r.id)} title={r.intitule}>
              {r.id}
            </span>
          ))}
          {O.filter((o) => o.probabilite === p && o.impact === g).map((o) => (
            <span key={o.id} className="pin opp" onClick={() => oppDetail(o.id)} title={o.intitule}>
              {o.id}
            </span>
          ))}
        </div>
      )
    }
    c = (
      <div className="card">
        <div className="card-h">
          <div>
            <h3>Matrice croisée risques et opportunités</h3>
            <div className="sub">
              Probabilité en ordonnée, criticité (risques) ou impact (opportunités) en abscisse
            </div>
          </div>
          <div className="legend">
            <span>
              <i style={{ background: '#fff', border: '1px solid #ccc' }}></i>Risque
            </span>
            <span>
              <i style={{ background: 'var(--green)' }}></i>Opportunité
            </span>
          </div>
        </div>
        <div className="heat">
          {[4, 3, 2, 1].map((p) => (
            <Fragment key={p}>
              <div className="ax">{p}</div>
              {[1, 2, 3, 4].map((g) => cell(p, g))}
            </Fragment>
          ))}
          <div></div>
          {[1, 2, 3, 4].map((g) => (
            <div key={g} className="ax">
              {g}
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (t === 's')
    c = (
      <Stats R={R} O={O} risques={risques} opportunites={opportunites} activeNorms={activeNorms} />
    )

  return (
    <>
      <PageHead
        kicker={MOD_FULL.m3}
        title="3.4 Risques et opportunités"
        desc="Registre unique typé par référentiel : évaluation, traitement, action générée au planning (action + responsable + délai) et suivi de l'efficacité."
      />
      {tb}
      {c}
    </>
  )
}

interface StatsProps {
  R: Row[]
  O: Row[]
  risques: Row[]
  opportunites: Row[]
  activeNorms: NormId[]
}

/** Onglet « Reporting statistique ». */
function Stats({ R, O, risques, opportunites, activeNorms }: StatsProps) {
  const rows = activeNorms.map((n) => {
    const r = risques.filter((x) => x.normes!.includes(n)),
      o = opportunites.filter((x) => x.normes!.includes(n))
    const all = [...r, ...o]
    return {
      n,
      subis: r.filter((x) => x.realise).length,
      nr: r.length,
      no: o.length,
      taux: all.length
        ? Math.round((all.filter((x) => x.statutAction === 'Clôturé').length / all.length) * 100)
        : 0,
    }
  })
  const kpis: [string, ReactNode][] = [
    ['Risques identifiés', R.length],
    ['Risques subis (réalisés)', R.filter((r) => r.realise).length],
    ['Opportunités saisies', O.length],
    [
      'Actions mises en œuvre',
      Math.round(
        ([...R, ...O].filter((x) => x.statutAction === 'Clôturé').length /
          Math.max(1, R.length + O.length)) *
          100
      ) + ' %',
    ],
  ]
  // L'original enregistre le tableau au rendu : on l'enregistre au clic sur « PDF »
  const exportPdf = () => {
    tableRegistry.rostat = {
      headers: ['Norme', 'Risques', 'Risques subis', 'Opportunités', 'Actions clôturées'],
      rows: rows.map((x) => [
        x.n + ' ' + NORMS[x.n].nom,
        String(x.nr),
        String(x.subis),
        String(x.no),
        x.taux + ' %',
      ]),
      exportName: 'Reporting_risques_opportunites',
    }
    exportTable('rostat', 'pdf')
  }
  return (
    <>
      <div className="grid g4 mb">
        {kpis.map(([a, b]) => (
          <div key={a} className="card">
            <div className="small muted">{a}</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{b}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-h">
          <h3>Taux de mise en œuvre des actions par norme</h3>
          <button className="btn sm" onClick={exportPdf}>
            <Icon name="doc" size={14} /> PDF
          </button>
        </div>
        <DataTable<Rec & { id: string }>
          id="rostat"
          cols={[
            {
              l: 'Norme',
              r: (x) => (
                <>
                  <NormBadges norms={[x.n]} /> {NORMS[x.n as NormId].nom}
                </>
              ),
            },
            { l: 'Risques', k: 'nr', cls: 'num' },
            { l: 'Risques subis', k: 'subis', cls: 'num' },
            { l: 'Opportunités', k: 'no', cls: 'num' },
            { l: 'Actions clôturées', r: (x) => <Progress value={x.taux} /> },
          ]}
          rows={rows.map((x) => ({ ...x, id: x.n }))}
          norm={false}
          exportName="Reporting_risques_opportunites"
        />
      </div>
    </>
  )
}
