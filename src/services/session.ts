import { routerRef } from '../app/routerRef'
import type { DemoData } from '../data/migrations'
import type { User } from '../data/referentiels'
import { DATA_VERSION, initialData, useApp } from '../store/useApp'
import { toast } from '../store/useOverlays'
import * as api from './api'
import { saveBlob } from './exports'
import {
  afterReload,
  discard,
  flush,
  isIdle,
  onReloadNeeded,
  setKnownCollections,
  writeCount,
} from './sync'

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

/** Incrémenté à chaque fin de session : une réponse arrivée après est ignorée. */
let epoch = 0
/** Déconnexion en cours (dernières écritures) : une nouvelle connexion l'attend. */
let ending: Promise<void> | null = null

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
    droitsParProcessus: p.droitsParProcessus ?? false,
    onboarded: p.onboarded,
    // Les id sont générés par le client (nextId) : le compteur repart après le plus grand.
    uidSeq: Math.max(p.uidSeq ?? 0, maxIdSeq(db)),
    dataVersion: DATA_VERSION,
  })
}

/** Connexion : jetons, puis état du serveur. Rejette une ApiError (message affichable). */
export async function apiLogin(email: string, password: string, remember: boolean): Promise<User> {
  await ending
  const user = await api.login(email, password, remember)
  hydrate(await api.fetchBootstrap())
  return user
}

/** Inscription d'un organisme : jetons renvoyés, puis état (vierge) du serveur. */
export async function apiSignup(data: api.SignupData): Promise<User> {
  const user = await api.signup(data)
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

/** Oublie jetons, écritures en attente et données de l'organisme. */
function forget() {
  epoch++
  discard()
  api.clearTokens()
  useApp.setState({ ...initialData(), session: null })
}

/**
 * Déconnexion : envoie les dernières écritures (journal ; 5 s au plus si le serveur
 * est injoignable), révoque le jeton de renouvellement, puis oublie jetons et données.
 */
export function endSession(): Promise<void> {
  const e = epoch
  ending ??= flush(5000)
    .then(async () => {
      if (e !== epoch) return // session déjà perdue entre-temps
      discard()
      await api.revokeTokens()
      if (e === epoch) forget()
    })
    .finally(() => (ending = null))
  return ending
}

/**
 * Recharge l'état du serveur sans écraser une écriture locale : on attend que la file
 * soit vide, et on recommence si une écriture a été faite pendant le chargement.
 */
async function resync() {
  const e = epoch
  for (let i = 0; i < 5; i++) {
    await flush()
    const n = writeCount()
    const state = await api.fetchBootstrap()
    if (e !== epoch) return
    if (n === writeCount() && isIdle()) return hydrate(state)
  }
  console.warn('[api] rechargement abandonné : écritures continues.')
}

/**
 * Accusé de lecture de la politique par l'utilisateur connecté (tout membre, y compris
 * un Collaborateur qui ne peut pas modifier les accusés) : action métier du serveur,
 * puis rechargement de son état (accusé, journal).
 */
export async function acknowledgePolicy() {
  await api.request('/accuses/accuser-lecture/', { method: 'POST' })
  await resync()
}

/** Résultat de POST /users/<id>/anonymiser/. */
export interface AnonymiseResult {
  id: string
  nom: string
  jetonsRevoques: number
  remplacementsDonnees: number
  journalPseudonymise: number
}

/**
 * Droit à l'effacement (administrateur) : le serveur anonymise le compte (et, sur option,
 * remplace le nom dans les données), puis l'état du serveur est rechargé.
 */
export async function anonymiseUser(id: string, remplacerDansDonnees: boolean) {
  await flush()
  const r = await api.request<AnonymiseResult>(`/users/${encodeURIComponent(id)}/anonymiser/`, {
    method: 'POST',
    body: { remplacerDansDonnees },
  })
  await resync()
  return r
}

/** Droit d'accès / portabilité : fichier JSON des données personnelles de l'utilisateur connecté. */
export async function exportMyData() {
  const { blob, filename } = await api.fetchFile('/auth/me/export/')
  saveBlob(filename, blob)
  return filename
}

if (api.API_MODE) {
  // Écriture refusée par le serveur : on recharge son état pour rester cohérent.
  // Puis les modifications retenues pendant le rechargement sont rejouées (cf. sync.ts).
  onReloadNeeded(() =>
    resync()
      .catch((e) => {
        console.error('[api] rechargement impossible :', e)
        toast('Impossible de recharger les données du serveur : rechargez la page.', 'warn')
      })
      .finally(afterReload)
  )

  // Renouvellement refusé (session expirée ou révoquée) : retour à la connexion.
  api.onAuthLost(() => {
    if (!useApp.getState().session) return
    forget()
    routerRef.navigate?.('/login')
    toast('Session expirée : reconnectez-vous.', 'warn')
  })
}
