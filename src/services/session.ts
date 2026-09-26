import { routerRef } from '../app/routerRef'
import type { DemoData } from '../data/migrations'
import type { User } from '../data/referentiels'
import { DATA_VERSION, initialData, useApp } from '../store/useApp'
import { toast } from '../store/useOverlays'
import * as api from './api'
import { flush, onReloadNeeded, setKnownCollections } from './sync'

/**
 * Session en mode API : connexion JWT, hydratation du store par GET /bootstrap/,
 * reprise au rechargement de la page, déconnexion. L'hydratation passe par
 * useApp.setState (et non update) : elle ne renvoie donc rien au serveur.
 */

/** Plus grand suffixe numérique des `id` (R105 -> 105), à toute profondeur. */
function maxIdSeq(v: unknown): number {
  if (Array.isArray(v)) return v.reduce((m: number, x) => Math.max(m, maxIdSeq(x)), 0)
  if (!v || typeof v !== 'object') return 0
  let m = 0
  for (const [k, x] of Object.entries(v)) {
    if (k === 'id' && typeof x === 'string') m = Math.max(m, Number(/(\d+)$/.exec(x)?.[1] ?? 0))
    else if (x && typeof x === 'object') m = Math.max(m, maxIdSeq(x))
  }
  return m
}

/** Remplace les données du store par l'état du serveur. */
export function hydrate(p: api.BootstrapPayload) {
  const demo = initialData().db as unknown as Record<string, unknown>
  const lacking = Object.keys(demo).filter((k) => !(k in p.db))
  if (lacking.length)
    console.warn(
      '[api] collections absentes du serveur (données de démo locales, non enregistrées) :',
      lacking.join(', ')
    )
  setKnownCollections(Object.keys(p.db))
  const db = { ...demo, ...p.db } as DemoData
  useApp.setState({
    db,
    org: p.org,
    users: p.users,
    activeNorms: p.activeNorms,
    auditorAccess: p.auditorAccess,
    erpModule: p.erpModule,
    onboarded: p.onboarded,
    // Les id sont générés par le client (nextId) : le compteur repart après le plus grand.
    uidSeq: Math.max(p.uidSeq ?? 0, maxIdSeq(db)),
    dataVersion: DATA_VERSION,
  })
}

/** Connexion : jetons, puis état du serveur. Rejette une ApiError (message affichable). */
export async function apiLogin(email: string, password: string, remember: boolean): Promise<User> {
  const user = await api.login(email, password, remember)
  hydrate(await api.fetchBootstrap())
  return user
}

/** Au démarrage : reprend la session si le jeton de renouvellement est encore valide. */
export async function restoreSession() {
  try {
    if (!api.isAuthenticated() || !(await api.renew())) return
    const [me, state] = await Promise.all([api.fetchMe(), api.fetchBootstrap()])
    hydrate(state)
    useApp.setState({ session: { userId: me.id, onboarded: state.onboarded } })
  } catch (e) {
    console.error('[api] reprise de session impossible :', e)
  }
}

/** Déconnexion : envoie les dernières écritures (journal), puis oublie jetons et données. */
export async function endSession() {
  await flush()
  api.clearTokens()
  useApp.setState({ ...initialData(), session: null })
}

if (api.API_MODE) {
  // Écriture refusée par le serveur : on recharge son état pour rester cohérent.
  onReloadNeeded(async () => {
    try {
      hydrate(await api.fetchBootstrap())
    } catch (e) {
      console.error('[api] rechargement impossible :', e)
    }
  })

  // Renouvellement refusé (session expirée ou révoquée) : retour à la connexion.
  api.onAuthLost(() => {
    if (!useApp.getState().session) return
    useApp.setState({ session: null })
    routerRef.navigate?.('/login')
    toast('Session expirée : reconnectez-vous.', 'warn')
  })
}
