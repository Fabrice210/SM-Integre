import type { ReactNode } from 'react'
import { closeModal } from '../../store/useOverlays'
import { Icon } from './Icon'

/** linkItem(t, s, go) de l'original : ligne cliquable qui ferme le tiroir puis agit. */
export function LinkItem({ title, sub, onClick }: { title: ReactNode; sub?: ReactNode; onClick: () => void }) {
  return (
    <button
      className="linkitem"
      onClick={() => {
        closeModal('drawer')
        onClick()
      }}
    >
      <span>
        <b>{title}</b>
        {sub ? (
          <>
            <br />
            <span className="muted">{sub}</span>
          </>
        ) : null}
      </span>
      <Icon name="arrow" size={14} />
    </button>
  )
}

/** block(t, items) de l'original : section « éléments liés » d'une fiche. */
export function Block({ title, items }: { title: ReactNode; items: ReactNode[] }) {
  return (
    <div className="dsec">
      <h4>
        {title} ({items.length})
      </h4>
      {items.length ? <div className="linklist">{items}</div> : <div className="small muted">Aucun élément lié pour le moment.</div>}
    </div>
  )
}
