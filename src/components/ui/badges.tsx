import { NORMS, ST_COL, type NormId } from '../../data/referentiels'
import { days, fd } from '../../lib/dates'
import { useApp } from '../../store/useApp'

/** Classe de couleur d'un statut (logique de sb()). */
export function statusClass(s: string): string {
  let c = 'b-grey'
  for (const [k, v] of Object.entries(ST_COL)) {
    if ((v as string[]).includes(s)) {
      c = 'b-' + k
      break
    }
  }
  if (s === 'Négatif') c = 'b-red'
  if (s === 'Obsolète') c = 'b-grey'
  return c
}

/** sb(s) de l'original. */
export function StatusBadge({ value }: { value?: string | null }) {
  if (value == null || value === '') return <span className="badge b-grey">—</span>
  return <span className={`badge dot ${statusClass(value)}`}>{value}</span>
}

/** nb(arr) de l'original : pastilles des normes actives. */
export function NormBadges({ norms }: { norms?: readonly string[] | null }) {
  const active = useApp((s) => s.activeNorms)
  const shown = (norms || []).filter((n): n is NormId => active.includes(n as NormId))
  if (!shown.length) return <span className="muted small">—</span>
  return (
    <>
      {shown.map((n) => (
        <span key={n} className={`norm n${n}`} title={`${NORMS[n].code} — ${NORMS[n].nom}`}>
          {n}
        </span>
      ))}
    </>
  )
}

/** prog(p, warnBelow, badBelow) de l'original. */
export function Progress({ value, warnBelow = 60, badBelow = 35 }: { value: number; warnBelow?: number; badBelow?: number }) {
  const p = Math.max(0, Math.min(100, Math.round(value)))
  const c = p < badBelow ? 'bad' : p < warnBelow ? 'warn' : ''
  return (
    <div className="prog-line">
      <div className={`prog ${c}`} style={{ flex: 1 }}>
        <i style={{ width: `${p}%` }}></i>
      </div>
      <span>{p} %</span>
    </div>
  )
}

/** dueBadge(s, done) de l'original : date + retard ou J-n. */
export function DueDate({ date, done = false }: { date?: string | null; done?: boolean }) {
  if (done) return <>{fd(date)}</>
  const d = days(date)
  if (d === null) return <>{fd(date)}</>
  if (d < 0)
    return (
      <>
        {fd(date)} <span className="badge b-red">en retard de {-d} j</span>
      </>
    )
  if (d <= 30)
    return (
      <>
        {fd(date)} <span className="badge b-amber">J-{d}</span>
      </>
    )
  return <>{fd(date)}</>
}

/** wfHTML(steps, curIdx, ko) de l'original : circuit de validation. */
export function Workflow({ steps, current, ko = false }: { steps: string[]; current: number; ko?: boolean }) {
  return (
    <div className="wf">
      {steps.map((s, i) => (
        <WorkflowStep key={s + i} label={s} index={i} current={current} ko={ko} />
      ))}
    </div>
  )
}

function WorkflowStep({ label, index: i, current, ko }: { label: string; index: number; current: number; ko: boolean }) {
  const cls = i < current ? 'done' : i === current ? (ko ? 'ko' : 'cur') : ''
  return (
    <>
      {i > 0 && <div className={`wf-bar ${i <= current ? 'done' : ''}`}></div>}
      <div className={`wf-step ${cls}`}>
        <span className="c">{i < current ? '✓' : i + 1}</span>
        {label}
      </div>
    </>
  )
}
