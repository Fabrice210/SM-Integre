import { go } from '../../app/navigation'
import { routerRef } from '../../app/routerRef'
import type { User } from '../../data/referentiels'
import { logAct, update } from '../../store/useApp'
import type { AppState } from '../../store/types'

/** Contrôle d'adresse e-mail de doLogin() de l'original. */
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i

/** Ouvre la session de l'utilisateur, puis onboarding ou tableau de bord. */
export function openSession(pick: (s: AppState) => User) {
  let onboarded = false
  update((s) => {
    const u = pick(s)
    s.session = { userId: u.id, onboarded: s.onboarded }
    logAct(s, "s'est connecté(e)", 'Session')
    onboarded = s.onboarded
    if (!s.onboarded)
      s.ui.onb = { step: 0, cfg: 0, ai: 'idle', props: null, invites: null, prof: null }
    else {
      s.ui.history = []
      s.ui.histIndex = -1
    }
  })
  if (!onboarded) routerRef.navigate?.('/onboarding/1')
  else go('dashboard')
}
