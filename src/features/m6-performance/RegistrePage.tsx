/** 6.5 Registre d'amélioration continue (original l.1688-1693). */
import { DataTable } from '../../components/data/DataTable'
import { NormBadges, StatusBadge } from '../../components/ui/badges'
import { PageHead } from '../../components/ui/PageHead'
import { MOD_FULL } from '../../data/referentiels'
import { fd } from '../../lib/dates'
import { procName, procOpts, procShort } from '../../lib/lookups'
import { inNorm } from '../../lib/norms'
import { logAct, update, useApp } from '../../store/useApp'
import { closeModal, openDrawer, toast } from '../../store/useOverlays'
import { DB, type Any } from './shared'

const REG_T = [
  'Non-conformité',
  'Incident',
  "Piste d'amélioration",
  'Observation',
  "Action d'audit",
  'Action de revue',
  'Action corrective',
  'Risque réalisé',
]

/** regDetail(id) de l'original. */
export function regDetail(id: string) {
  const g = DB(useApp.getState()).registre.find((x: Any) => x.id === id)
  if (!g) return
  openDrawer({
    title: g.ref + ' · ' + g.type,
    sub: g.origine,
    body: (
      <>
        <dl className="kv">
          <dt>Intitulé</dt>
          <dd>{g.intitule}</dd>
          <dt>Processus</dt>
          <dd>{procName(g.processus)}</dd>
          <dt>Responsable</dt>
          <dd>{g.responsable}</dd>
          <dt>Date</dt>
          <dd>{fd(g.date)}</dd>
          <dt>Statut</dt>
          <dd>
            <StatusBadge value={g.statut} />
          </dd>
          <dt>Normes</dt>
          <dd>
            <NormBadges norms={g.normes} />
          </dd>
        </dl>
        <div className="note" style={{ marginTop: 14 }}>
          Entrée consolidée automatiquement depuis : {g.origine}.
        </div>
      </>
    ),
    foot:
      g.statut !== 'Clôturé' ? (
        <>
          <button
            className="btn"
            onClick={() => {
              update((s) =>
                logAct(s, 'a relancé ' + g.responsable + ' sur ' + g.ref, 'Registre', 'Relance')
              )
              toast('Relance envoyée à ' + g.responsable + '.')
            }}
          >
            Relancer le responsable
          </button>
          <button
            className="btn primary"
            onClick={() => {
              update((s) => {
                const r = DB(s).registre.find((x: Any) => x.id === id)
                r.statut = 'Clôturé'
                logAct(s, 'a clôturé ' + r.ref, 'Registre')
              })
              closeModal('drawer')
              toast('Entrée clôturée et archivée.')
            }}
          >
            Clôturer
          </button>
        </>
      ) : null,
  })
}

export function RegistrePage() {
  const registre = useApp((s) => s.db.registre) as Any[]
  const norm = useApp((s) => s.ui.norm)
  const R = registre.filter((r) => inNorm(r, norm))
  const clos = R.filter((r) => r.statut === 'Clôturé').length
  const stats: [string, string | number][] = [
    ['Entrées au registre', R.length],
    ['En cours', R.filter((r) => r.statut !== 'Clôturé').length],
    ['Clôturées', clos],
    ['Taux de clôture', Math.round((clos / Math.max(1, R.length)) * 100) + ' %'],
  ]
  return (
    <>
      <PageHead
        kicker={MOD_FULL.m6}
        title="6.5 Registre d'amélioration continue"
        desc="Base unique consolidant automatiquement non-conformités, incidents, pistes d'amélioration et actions issues des audits, revues et risques réalisés."
      />
      <div className="grid g4 mb">
        {stats.map(([a, b]) => (
          <div key={a} className="card">
            <div className="small muted">{a}</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{b}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <DataTable
          id="reg"
          cols={[
            { l: 'Référence', r: (g) => <span className="ttl">{g.ref}</span> },
            { l: 'Type', r: (g) => <span className="badge b-grey">{g.type}</span> },
            { l: 'Intitulé', k: 'intitule' },
            { l: 'Origine', k: 'origine' },
            { l: 'Processus', r: (g) => procShort(g.processus) },
            { l: 'Responsable', k: 'responsable' },
            { l: 'Date', r: (g) => fd(g.date) },
            { l: 'Statut', r: (g) => <StatusBadge value={g.statut} /> },
            { l: 'Normes', r: (g) => <NormBadges norms={g.normes} /> },
          ]}
          rows={registre}
          onRowClick={regDetail}
          search={['ref', 'intitule', 'origine', 'responsable']}
          filters={[
            { k: 'type', l: 'Type', o: REG_T },
            { k: 'statut', l: 'Statut', o: ['En cours', 'Clôturé'] },
            { k: 'processus', l: 'Processus', o: procOpts },
            {
              k: 'periode',
              l: 'Période',
              o: [
                ['2026-0', '1er semestre 2026'],
                ['2026-S2', '2e semestre 2026'],
              ],
              fn: (g, v) => (v === '2026-0' ? g.date < '2026-07-01' : g.date >= '2026-07-01'),
            },
          ]}
          exportName="Registre_amelioration_continue"
        />
      </div>
    </>
  )
}
