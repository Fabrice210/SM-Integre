import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { closeModal, useOverlays, type ModalSlot } from '../../store/useOverlays'
import { update, useApp } from '../../store/useApp'
import { Icon } from '../ui/Icon'

/** Modales (modal, modal2), tiroir et toasts — ajoutés à <body> comme dans l'original. */
export function OverlayRoot() {
  const { modals, drawer, toasts } = useOverlays()

  // Échap ferme la couche du dessus ; Ctrl/⌘ K donne le focus à la recherche d'écran
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { modals: m, drawer: d } = useOverlays.getState()
      if (e.key === 'Escape') {
        if (m.modal) closeModal('modal')
        else if (m.modal2) closeModal('modal2')
        else if (d) closeModal('drawer')
        else if (useApp.getState().ui.notif) update((s) => void (s.ui.notif = false))
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        document.getElementById('sideSearch')?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const toastRoot = document.getElementById('toasts')
  return (
    <>
      {drawer
        ? createPortal(
            <div className="overlay drawer-ov" id="drawer" onMouseDown={(e) => e.target === e.currentTarget && closeModal('drawer')}>
              <aside className="drawer" role="dialog" aria-modal="true" aria-label={drawer.label ?? (typeof drawer.title === 'string' ? drawer.title : undefined)}>
                <div className="modal-h">
                  <div>
                    <h3>{drawer.title}</h3>
                    {drawer.sub ? <p>{drawer.sub}</p> : null}
                  </div>
                  <button className="icon-btn sq" onClick={() => closeModal('drawer')} aria-label="Fermer">
                    <Icon name="x" size={16} />
                  </button>
                </div>
                <div className="modal-b" style={{ flex: 1 }}>
                  {drawer.body}
                </div>
                {drawer.foot ? <div className="modal-f">{drawer.foot}</div> : null}
              </aside>
            </div>,
            document.body
          )
        : null}
      {(['modal', 'modal2'] as ModalSlot[]).map((slot) => {
        const m = modals[slot]
        if (!m) return null
        return createPortal(
          <ModalFocus slot={slot} key={slot}>
            <div className="overlay" id={slot} onMouseDown={(e) => e.target === e.currentTarget && closeModal(slot)}>
              <div className={`modal ${m.wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={m.label ?? (typeof m.title === 'string' ? m.title : undefined)}>
                <div className="modal-h">
                  <div>
                    <h3>{m.title}</h3>
                    {m.sub ? <p>{m.sub}</p> : null}
                  </div>
                  <button className="icon-btn sq" onClick={() => closeModal(slot)} aria-label="Fermer">
                    <Icon name="x" size={16} />
                  </button>
                </div>
                <div className="modal-b">{m.body}</div>
                {m.foot ? <div className="modal-f">{m.foot}</div> : null}
              </div>
            </div>
          </ModalFocus>,
          document.body
        )
      })}
      {toastRoot
        ? createPortal(
            toasts.map((t) => (
              <div key={t.id} className={`toast ${t.type}`}>
                {t.msg}
              </div>
            )),
            toastRoot
          )
        : null}
    </>
  )
}

/** Donne le focus au premier champ de la modale, comme l'original (30 ms). */
function ModalFocus({ slot, children }: { slot: ModalSlot; children: React.ReactNode }) {
  useEffect(() => {
    const t = setTimeout(() => {
      document.getElementById(slot)?.querySelector<HTMLElement>('input,select,textarea,button.btn')?.focus()
    }, 30)
    return () => clearTimeout(t)
  }, [slot])
  return <>{children}</>
}
