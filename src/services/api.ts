import type { User } from '../data/referentiels'
import type { AiSource, Persisted } from '../store/types'

/**
 * Client de l'API Django (backend/). Le mode API n'est actif que si VITE_API_URL
 * est défini au build (ex. http://localhost:8000/api/v1) ; sinon l'app reste
 * 100 % locale (démo, localStorage, connexion factice) et ce module n'est pas utilisé.
 *
 * Jetons JWT : `access` en mémoire seulement ; `refresh` en localStorage (ou en
 * sessionStorage si « Rester connecté(e) » est décoché). Un 401 déclenche un seul
 * renouvellement, partagé entre requêtes concurrentes, puis la requête est rejouée.
 */
export const API_URL: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')
export const API_MODE = API_URL !== ''

/** Erreur d'appel : `status` HTTP, 0 si le serveur est injoignable. */
export class ApiError extends Error {
  readonly status: number
  readonly data: unknown

  constructor(status: number, message: string, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

/** Réponse de POST /auth/login/. */
export interface LoginResponse {
  access: string
  refresh: string
  user: User
}

/** Réponse de GET /bootstrap/ : la forme `Persisted` du front, sans dataVersion. */
export type BootstrapPayload = Omit<Persisted, 'dataVersion'>

/* ---------- Jetons ---------- */

const REFRESH_KEY = 'sm:refresh'
let access: string | null = null
let renewing: Promise<boolean> | null = null
let authLost: (() => void) | null = null

function storages(): Storage[] {
  try {
    return [localStorage, sessionStorage]
  } catch {
    return []
  }
}

/** Jeton de renouvellement conservé (localStorage si « rester connecté », sinon sessionStorage). */
function readRefresh(): { token: string; remember: boolean } | null {
  for (const [i, st] of storages().entries()) {
    try {
      const token = st.getItem(REFRESH_KEY)
      if (token) return { token, remember: i === 0 }
    } catch {
      /* stockage indisponible */
    }
  }
  return null
}

function storeTokens(tokens: { access: string; refresh: string } | null, remember = true) {
  access = tokens?.access ?? null
  for (const [i, st] of storages().entries()) {
    try {
      if (tokens && (i === 0) === remember) st.setItem(REFRESH_KEY, tokens.refresh)
      else st.removeItem(REFRESH_KEY)
    } catch {
      /* stockage indisponible : la session vivra le temps de l'onglet */
    }
  }
}

/** Oublie les jetons (déconnexion). */
export const clearTokens = () => storeTokens(null)

/** Une session serveur est ouverte (ou peut être reprise). */
export const isAuthenticated = () => access !== null || readRefresh() !== null

/** Appelé quand la session est perdue (renouvellement refusé). */
export function onAuthLost(handler: () => void) {
  authLost = handler
}

/** Renouvelle le jeton d'accès ; false si la session est expirée. */
export function renew(): Promise<boolean> {
  renewing ??= (async () => {
    const saved = readRefresh()
    if (!saved) return false
    try {
      const t = await request<{ access: string; refresh?: string }>('/auth/refresh/', {
        method: 'POST',
        body: { refresh: saved.token },
        auth: false,
      })
      storeTokens({ access: t.access, refresh: t.refresh ?? saved.token }, saved.remember)
      return true
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) throw e
      clearTokens()
      return false
    }
  })().finally(() => (renewing = null))
  return renewing
}

/* ---------- Requêtes ---------- */

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** false : pas de jeton ni de renouvellement (connexion, renouvellement). */
  auth?: boolean
  /** En-tête Accept (défaut : JSON). */
  accept?: string
}

/** Message lisible d'une erreur DRF : {detail} ou {champ: [messages]}. */
function messageOf(status: number, data: unknown): string {
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (typeof d.detail === 'string') return d.detail
    const parts = Object.entries(d).map(([k, v]) => {
      const msg = Array.isArray(v) ? v.join(' ') : typeof v === 'string' ? v : JSON.stringify(v)
      return k === 'non_field_errors' ? msg : `${k} : ${msg}`
    })
    if (parts.length) return parts.join(' ; ')
  }
  return `Erreur ${status} du serveur.`
}

async function send(path: string, { method = 'GET', body, auth = true, accept }: RequestOptions) {
  const headers: Record<string, string> = { Accept: accept ?? 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth && access) headers.Authorization = `Bearer ${access}`
  try {
    return await fetch(API_URL + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (e) {
    throw new ApiError(0, 'Serveur injoignable : vérifiez votre connexion.', e)
  }
}

/** Envoie la requête ; renouvelle le jeton une fois sur 401. */
async function authorized(path: string, opts: RequestOptions): Promise<Response> {
  const auth = opts.auth !== false
  if (auth && !access) await renew()
  let res = await send(path, opts)
  if (res.status === 401 && auth) {
    if (await renew()) res = await send(path, opts)
    else authLost?.()
  }
  return res
}

async function fail(res: Response): Promise<never> {
  const text = await res.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : undefined
  } catch {
    data = text
  }
  throw new ApiError(res.status, messageOf(res.status, data), data)
}

/** Appel JSON typé ; renouvelle le jeton une fois sur 401. */
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await authorized(path, opts)
  const text = await res.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : undefined
  } catch {
    data = text
  }
  if (!res.ok) throw new ApiError(res.status, messageOf(res.status, data), data)
  return data as T
}

/* ---------- Points d'entrée ---------- */

/** Connexion par e-mail et mot de passe ; conserve les jetons. */
export async function login(email: string, password: string, remember = true): Promise<User> {
  const r = await request<LoginResponse>('/auth/login/', {
    method: 'POST',
    body: { email, password },
    auth: false,
  })
  storeTokens(r, remember)
  return r.user
}

/** Erreurs par champ d'une réponse DRF 400 (clés camelCase du serveur), messages joints. */
export function fieldErrors(e: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!(e instanceof ApiError) || !e.data || typeof e.data !== 'object') return out
  for (const [k, v] of Object.entries(e.data as Record<string, unknown>)) {
    if (k === 'detail') continue
    out[k] = Array.isArray(v) ? v.map(String).join(' ') : typeof v === 'string' ? v : ''
  }
  return out
}

/** Options publiques de l'écran de connexion (GET /auth/config/). */
export const fetchAuthConfig = () => request<{ signup: boolean }>('/auth/config/', { auth: false })

/** Données de POST /auth/signup/ : nouvel organisme et son Responsable SM. */
export interface SignupData {
  organisation: string
  sigle?: string
  nom: string
  email: string
  password: string
}

/** Inscription d'un organisme ; conserve les jetons renvoyés (session ouverte). 404 : fermée. */
export async function signup(data: SignupData): Promise<User> {
  const r = await request<LoginResponse>('/auth/signup/', {
    method: 'POST',
    body: data,
    auth: false,
  })
  storeTokens(r, true)
  return r.user
}

/** Demande d'un lien de (ré)initialisation du mot de passe ; réponse neutre. */
export const requestPasswordReset = (email: string) =>
  request<{ detail: string }>('/auth/password/reset/', {
    method: 'POST',
    body: { email },
    auth: false,
  })

/** Définition du mot de passe avec le jeton reçu par e-mail. */
export const confirmPassword = (uid: string, token: string, password: string) =>
  request<{ detail: string }>('/auth/password/confirm/', {
    method: 'POST',
    body: { uid, token, password },
    auth: false,
  })

/** Réponse de POST /assistant/ask/ (sources : éléments cités de la `db` de l'organisme). */
export interface AssistantAnswer {
  reponse: string
  sources: AiSource[]
}

/** Échange précédent transmis à l'assistant pour le suivi de la conversation. */
export interface AssistantTurn {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Question à l'assistant IA du serveur. Un 503 `{fallback: true}` signale que l'assistant
 * distant n'est pas configuré ou indisponible : l'appelant garde alors son moteur local.
 */
export const askAssistant = (question: string, contexte: string, historique: AssistantTurn[]) =>
  request<AssistantAnswer>('/assistant/ask/', {
    method: 'POST',
    body: { question, contexte, historique },
  })

export const fetchMe = () => request<User>('/auth/me/')

/** Nom de fichier d'un en-tête Content-Disposition (filename*=UTF-8'' prioritaire). */
function filenameOf(disposition: string | null): string | null {
  if (!disposition) return null
  const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
  if (star) {
    try {
      return decodeURIComponent(star[1])
    } catch {
      /* nom mal encodé : repli sur filename= */
    }
  }
  return /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? null
}

/** Fichier produit par l'API (exports Excel / CSV / PDF), avec son nom. */
export async function fetchFile(path: string): Promise<{ blob: Blob; filename: string }> {
  const res = await authorized(path, { accept: '*/*' })
  if (!res.ok) return fail(res)
  const fallback = path.split('?')[0].split('/').pop() || 'export'
  return { blob: await res.blob(), filename: filenameOf(res.headers.get('Content-Disposition')) ?? fallback }
}
export const fetchBootstrap = () => request<BootstrapPayload>('/bootstrap/')
