import type { ReactNode } from 'react'
import { Icon } from '../ui/Icon'
import { TODAY } from '../../lib/dates'
import { update, useApp } from '../../store/useApp'

export interface CalEvent {
  /** Date ISO de l'événement */
  d: string
  /** Libellé */
  t: string
  /** Classe d'état : 'done', 'late' ou '' */
  s: string
  onClick: () => void
  /** Responsable */
  r?: string
}

const MS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.']

/** calendar(ev, sub) de l'original (ligne 1496) — l'année affichée est S.calY (s.ui.calY). */
export function Calendar({ events, sub }: { events: CalEvent[]; sub: ReactNode }) {
  const y = useApp((s) => s.ui.calY)
  const setY = (v: number) =>
    update((s) => {
      s.ui.calY = v
    })
  return (
    <div className="card">
      <div className="card-h">
        <div>
          <h3>Calendrier {y}</h3>
          <div className="sub">{sub}</div>
        </div>
        <div className="btn-row">
          <button className="icon-btn sq" onClick={() => setY(y - 1)} aria-label="Année précédente">
            <Icon name="left" size={15} />
          </button>
          <button className="icon-btn sq" onClick={() => setY(y + 1)} aria-label="Année suivante">
            <Icon name="right" size={15} />
          </button>
        </div>
      </div>
      <div className="cal">
        {MS.map((m, i) => (
          <div key={m} className={`m ${y === TODAY.getFullYear() && i === TODAY.getMonth() ? 'now' : ''}`}>
            <h6>{m}</h6>
            {events
              .filter((e) => {
                const d = new Date(e.d)
                return d.getFullYear() === y && d.getMonth() === i
              })
              .map((e, k) => (
                <div key={k} className={`ev ${e.s}`} onClick={e.onClick} title={e.t}>
                  {new Date(e.d).getDate()} — {e.t}
                  <br />
                  <span className="muted">{e.r || ''}</span>
                </div>
              ))}
          </div>
        ))}
      </div>
      <div className="legend" style={{ marginTop: 10 }}>
        <span>
          <i style={{ background: 'var(--green-soft)' }}></i>Réalisé / conforme
        </span>
        <span>
          <i style={{ background: 'var(--red-soft)' }}></i>En retard
        </span>
        <span>
          <i style={{ background: '#fff', border: '1px solid var(--line)' }}></i>Planifié
        </span>
      </div>
    </div>
  )
}
