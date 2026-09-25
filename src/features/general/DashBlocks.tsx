import { Fragment, useMemo, type ReactNode } from 'react'
import { go } from '../../app/navigation'
import { Progress } from '../../components/ui/badges'
import { Icon } from '../../components/ui/Icon'
import { DIRECTIONS } from '../../data/referentiels'
import { inNorm } from '../../lib/norms'
import { update, useApp } from '../../store/useApp'
import { NC_CAT } from '../m6-performance/nc'
import { DASH_FILT, dashProcData, dashStatSets, exportDash } from './dashStats'

const setFilt = (k: 'proc' | 'dir', v: string) =>
  update((s) => {
    ;(s.ui.filt[DASH_FILT] = s.ui.filt[DASH_FILT] || {})[k] = v
  })

/** dashProcBlock() de l'original : objectifs, actions et risques par processus. */
export function DashProcBlock() {
  const db = useApp((s) => s.db)
  const users = useApp((s) => s.users)
  const norm = useApp((s) => s.ui.norm)
  const filt = useApp((s) => s.ui.filt[DASH_FILT])
  const rows = useMemo(() => dashProcData(db, users, norm, filt ?? {}), [db, users, norm, filt])
  const f = filt ?? {}
  return (
    <div className="card mb">
      <div className="card-h">
        <div>
          <h3>Par processus</h3>
          <div className="sub">
            Objectifs atteints ou à risque, actions en cours et risques ouverts — filtrable
          </div>
        </div>
        <div className="btn-row">
          <select
            className="sel"
            aria-label="Filtrer par processus"
            value={f.proc || ''}
            onChange={(e) => setFilt('proc', e.target.value)}
          >
            <option value="">Tous les processus</option>
            {db.processus
              .filter((p) => inNorm(p, norm))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.intitule}
                </option>
              ))}
          </select>
          <select
            className="sel"
            aria-label="Filtrer par direction"
            value={f.dir || ''}
            onChange={(e) => setFilt('dir', e.target.value)}
          >
            <option value="">Toutes les directions</option>
            {DIRECTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <button className="btn sm" onClick={() => exportDash('proc', 'pdf')}>
            <Icon name="doc" size={14} /> PDF
          </button>
          <button className="btn sm" onClick={() => exportDash('proc', 'xls')}>
            {/* IC.chart n'existe pas dans l'original : icône vide, comme I(undefined) */}
            <Icon size={14} /> Excel
          </button>
        </div>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Processus</th>
              <th>Direction</th>
              <th>Objectifs</th>
              <th>Atteints</th>
              <th>À risque</th>
              <th>Actions en cours</th>
              <th>Risques ouverts</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((r) => (
                <tr key={r.id} className="click" onClick={() => go('m3-objectifs')}>
                  <td className="ttl">{r.proc}</td>
                  <td className="small muted">{r.dir}</td>
                  <td className="num">{r.obj}</td>
                  <td className="num">
                    <span className="badge b-green">{r.atteints}</span>
                  </td>
                  <td className="num">
                    {r.risque ? <span className="badge b-amber">{r.risque}</span> : '0'}
                  </td>
                  <td className="num">{r.act}</td>
                  <td className="num">
                    {r.risk ? <span className="badge b-red">{r.risk}</span> : '0'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="empty">
                  Aucun processus ne correspond à ce filtre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Box({
  k,
  title,
  src,
  children,
}: {
  k: string
  title: string
  src: string
  children: ReactNode
}) {
  return (
    <div className="card">
      <div className="card-h">
        <div>
          <h3 style={{ fontSize: 14.5 }}>{title}</h3>
          <div className="sub">{src}</div>
        </div>
        <div className="btn-row">
          <button
            className="btn sm ghost"
            title="Exporter en PDF"
            onClick={() => exportDash(k, 'pdf')}
          >
            <Icon name="doc" size={14} />
          </button>
          <button
            className="btn sm ghost"
            title="Exporter en Excel"
            onClick={() => exportDash(k, 'xls')}
          >
            <Icon size={14} />
          </button>
        </div>
      </div>
      {children}
    </div>
  )
}

function Counters({
  items,
  pad,
  size,
}: {
  items: [string, number, string][]
  pad: string
  size: number
}) {
  return (
    <>
      {items.map(([l, v, c]) => (
        <div key={l} className="card flat" style={{ padding: pad }}>
          <div style={{ fontSize: size, fontWeight: 700 }}>{v}</div>
          <span className={`badge ${c}`}>{l}</span>
        </div>
      ))}
    </>
  )
}

/** dashStatsBlock() de l'original : statistiques structurées exportables. */
export function DashStatsBlock() {
  const db = useApp((s) => s.db)
  const norm = useApp((s) => s.ui.norm)
  const s = useMemo(() => dashStatSets(db, norm), [db, norm])

  const cell = (p: number, i: number) => {
    const rc = s.R.filter((r) => r.probabilite === p && r.criticite === i).length
    const oc = s.O.filter((o) => o.probabilite === p && o.impact === i).length
    const n = rc + oc
    const sev = p * i
    const bg = sev >= 12 ? '#F3C9C4' : sev >= 6 ? '#FBE7C6' : '#DCEDE1'
    return (
      <div
        key={i}
        className="pi-cell"
        style={{ background: n ? bg : '#F6F8F7' }}
        title={`Probabilité ${p} × Impact ${i} : ${rc} risque(s), ${oc} opportunité(s)`}
      >
        {n || ''}
      </div>
    )
  }

  return (
    <>
      <h2 className="dash-sec">Statistiques structurées</h2>
      <div className="small muted" style={{ margin: '2px 2px 12px' }}>
        Déclinées par norme et par processus — chaque bloc est exportable en PDF ou Excel.
      </div>
      <div className="grid g3 mb">
        <Box k="risk" title="Risques & opportunités" src="Module 3">
          <div className="pi-grid">
            {[4, 3, 2, 1].map((p) => (
              <div key={p} className="pi-row">
                <span className="pi-ax">{p}</span>
                {[1, 2, 3, 4].map((i) => cell(p, i))}
              </div>
            ))}
            <div className="pi-row">
              <span className="pi-ax"></span>
              {[1, 2, 3, 4].map((i) => (
                <span key={i} className="pi-ax b">
                  {i}
                </span>
              ))}
            </div>
          </div>
          <div className="small muted" style={{ margin: '-4px 0 6px' }}>
            Probabilité (vertical) × Impact (horizontal)
          </div>
          <div className="stat-mini">
            <span className="lbl small muted">Taux de mise en œuvre des actions</span>
            <Progress value={s.roMEO} />
          </div>
        </Box>
        <Box k="reg" title="Conformité réglementaire" src="Module 3 — Veille">
          <div className="grid g3" style={{ gap: 8, textAlign: 'center' }}>
            <Counters
              pad="10px 6px"
              size={22}
              items={[
                ['Conformes', s.tOk, 'b-green'],
                ['Diffusés', s.tDiff, 'b-blue'],
                ['En attente', s.tWait, 'b-amber'],
              ]}
            />
          </div>
        </Box>
        <Box k="aud" title="Audits & Revues" src="Module 6">
          <div className="small" style={{ lineHeight: 2 }}>
            <span className="badge b-grey">Planifiés {s.camp.plan}</span>{' '}
            <span className="badge b-blue">Plans diffusés {s.camp.diff}</span>{' '}
            <span className="badge b-amber">Rapports déposés {s.camp.dep}</span>{' '}
            <span className="badge b-green">Clôturés {s.camp.clos}</span>
          </div>
          <div className="stat-mini" style={{ marginTop: 8 }}>
            <span className="lbl small muted">Clôture des actions d'audit / revue</span>
            <Progress value={s.regRate} />
          </div>
        </Box>
        <Box k="nc" title="Non-conformités" src="Module 6">
          <div className="small" style={{ lineHeight: 2 }}>
            {NC_CAT.map((c, i) => (
              <Fragment key={c}>
                {i > 0 ? ' ' : ''}
                <span className="badge b-grey">
                  {c.split(' ')[0]} {s.N.filter((n) => n.categorie === c).length}
                </span>
              </Fragment>
            ))}
          </div>
          <div className="grid g3" style={{ gap: 8, textAlign: 'center', marginTop: 8 }}>
            <Counters
              pad="8px 4px"
              size={18}
              items={[
                ['Déclarées', s.ncDecl, 'b-amber'],
                ['En cours', s.ncCours, 'b-blue'],
                ['Clôturées', s.ncClos, 'b-green'],
              ]}
            />
          </div>
        </Box>
        <Box k="ged" title="Documentaire (GED)" src="Module 5">
          <div className="stat-mini">
            <span className="lbl small muted">Documents en attente de revue</span>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{s.dWait}</div>
          </div>
          <div className="stat-mini" style={{ marginTop: 6 }}>
            <span className="lbl small muted">Taux de diffusion contrôlée</span>
            <Progress value={s.dRate} />
          </div>
        </Box>
      </div>
    </>
  )
}
