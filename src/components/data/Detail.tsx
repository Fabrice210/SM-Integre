import type { ReactNode } from 'react'
import { delRec, findRec, markObsolete, openForm } from '../../forms/crud'
import { useApp } from '../../store/useApp'
import { openDrawer } from '../../store/useOverlays'
import { Icon } from '../ui/Icon'

interface DetailSpec {
  title: ReactNode
  sub?: ReactNode
  rows?: [label: string, value: ReactNode][]
  extra?: ReactNode
  coll?: string
  id?: string
  edit?: boolean
  del?: boolean
  obs?: boolean
  acts?: ReactNode
}

const DEFAULT_HIST = [{ d: '2026-03-14 10:02', u: 'Florence DOSSOU-YOVO', a: "Création (reprise de l'existant)" }]

/**
 * detail({...}) de l'original : fiche en tiroir (clé/valeur, extra, historique, actions).
 * Après une action qui modifie l'enregistrement, rappeler la fonction de détail
 * du module pour rafraîchir la fiche, comme dans l'original.
 */
export function openDetail({ title, sub, rows = [], extra, coll, id, edit = true, del = false, obs = false, acts }: DetailSpec) {
  const r = coll && id ? findRec(useApp.getState(), coll, id) : undefined
  const h: { d: string; u: string; a: string }[] = r?.hist || DEFAULT_HIST
  openDrawer({
    title,
    sub,
    body: (
      <>
        <dl className="kv">
          {rows.map(([k, v], i) => (
            <Row key={k + i} k={k} v={v} />
          ))}
        </dl>
        {extra}
        <div className="dsec">
          <h4>Historique</h4>
          <ul className="timeline">
            {h.map((x, i) => (
              <li key={i}>
                <b>{x.a}</b>
                <br />
                <span className="when">
                  {x.d} — {x.u}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </>
    ),
    foot: (
      <>
        {acts}
        {obs && coll && id ? (
          <button className="btn" onClick={() => markObsolete(coll, id)}>
            <Icon name="archive" size={15} /> Classer obsolète
          </button>
        ) : null}
        {del && coll && id ? (
          <button className="btn danger" onClick={() => delRec(coll, id)}>
            <Icon name="trash" size={15} /> Supprimer
          </button>
        ) : null}
        {edit && coll && id ? (
          <button className="btn primary" onClick={() => openForm(coll, id)}>
            <Icon name="edit" size={15} /> Modifier
          </button>
        ) : null}
      </>
    ),
  })
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </>
  )
}
