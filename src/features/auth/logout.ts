import { routerRef } from '../../app/routerRef'
import { API_MODE } from '../../services/api'
import { endSession } from '../../services/session'
import { logAct, update } from '../../store/useApp'
import { toast } from '../../store/useOverlays'

/** logout() de l'original : retour à l'écran de connexion. */
export function logout() {
  update((s) => {
    logAct(s, "s'est déconnecté(e)", 'Session')
    s.session = null
    s.ui.ai = false
    s.ui.notif = false
  })
  if (API_MODE) void endSession()
  routerRef.navigate?.('/login')
  toast('Vous êtes déconnecté(e).')
}
