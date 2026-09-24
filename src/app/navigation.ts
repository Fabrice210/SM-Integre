import { MOD_FULL } from '../data/referentiels'
import { closeModal } from '../store/useOverlays'
import { update, useApp } from '../store/useApp'
import { routerRef } from './routerRef'

/**
 * go(id) de l'original : change de page, ferme tiroir/notifications/menu,
 * ouvre le module dans la barre latérale et empile l'historique interne
 * (qui pilote l'état des boutons précédent/suivant de la barre du haut).
 */
export function go(id: string, push = true) {
  update((s) => {
    s.ui.sidebar = false
    s.ui.notif = false
    if (push) {
      s.ui.history = s.ui.history.slice(0, s.ui.histIndex + 1)
      s.ui.history.push(id)
      s.ui.histIndex = s.ui.history.length - 1
    }
    const m = id.split('-')[0]
    if (m in MOD_FULL && !s.ui.openMods.includes(m)) s.ui.openMods.push(m)
  })
  closeModal('drawer')
  routerRef.navigate?.(`/${id}`)
  document.querySelector('.content')?.scrollTo(0, 0)
}

/** nav(d) de l'original : précédent (-1) / suivant (+1) dans l'historique interne. */
export function nav(d: -1 | 1) {
  const { history, histIndex } = useApp.getState().ui
  const n = histIndex + d
  if (n < 0 || n >= history.length) return
  update((s) => {
    s.ui.histIndex = n
  })
  go(history[n], false)
}
