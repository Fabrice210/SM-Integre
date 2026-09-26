import { enablePatches, produceWithPatches, type Patch } from 'immer'
import type { AppState } from '../store/types'
import { toast } from '../store/useOverlays'
import { ApiError, isAuthenticated, request } from './api'

/**
 * Synchronisation des écritures du store vers l'API (mode API seulement).
 *
 * Chaque update(recipe) est produit avec ses patches immer. Les patches disent
 * QUELLES parties persistées ont changé (db.<collection>, org, users, réglages) ;
 * pour une collection touchée, on compare ensuite avant / après par `id` : immer ne
 * recrée que les objets réellement modifiés, donc une référence différente = élément
 * modifié (à n'importe quelle profondeur). Les index des patches ne suffisent pas :
 * unshift / splice décalent tous les éléments et produisent des « replace » en série.
 *
 *   élément nouveau   -> POST   /<collection>/          (id fourni par le client)
 *   élément modifié   -> PUT    /<collection>/<id>/     (élément complet)
 *   élément supprimé  -> DELETE /<collection>/<id>/
 *   objet unique      -> PUT    /<collection>/          (politique, competences…)
 *   db.journal        -> POST   /journal/               (entrées nouvelles, ajout seul)
 *   org               -> PUT    /organisation/
 *   users             -> POST / PUT / DELETE /users/<id>/
 *   réglages          -> PATCH  /settings/              (activeNorms, auditorAccess…)
 *
 * Les écritures partent dans une file séquentielle ; tant qu'une écriture n'est pas
 * envoyée, une écriture ultérieure sur le même élément s'y fond (un seul appel).
 */

/** Objets uniques par organisme : pas d'id, GET / PUT / PATCH sur /<url>/. */
const SINGLETONS = new Set([
  'politique',
  'competences',
  'statsSurv',
  'sourcesNC',
  'cloturesMois',
  'cloturesAn',
])
const SETTINGS_KEYS = ['activeNorms', 'auditorAccess', 'erpModule', 'onboarded'] as const
/** Collections hors `db` toujours présentes côté serveur. */
const CORE = ['journal', 'org', 'users', 'settings']

type Rec = Record<string, unknown> & { id?: string }

interface Write {
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  url: string
  body?: unknown
  /** Collection (pour les messages et la gestion des 404). */
  coll: string
  /** Élément visé (regroupement des écritures en attente sur un même élément). */
  key?: string
}

/** URL d'une collection : clé de `db` en kebab-case (analyseVersions -> analyse-versions). */
export const collectionUrl = (name: string) =>
  '/' + name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()) + '/'

const hasId = (r: unknown): r is Rec & { id: string } =>
  !!r && typeof r === 'object' && typeof (r as Rec).id === 'string'

/* ---------- Calcul des écritures ---------- */

/** Liste d'éléments à `id` : ajouts, modifications et suppressions. */
function listWrites(coll: string, base: string, before: unknown, after: Rec[]): Write[] {
  const old = new Map((Array.isArray(before) ? before : []).filter(hasId).map((r) => [r.id, r]))
  const item = (id: string) => base + encodeURIComponent(id) + '/'
  const out: Write[] = []
  const seen = new Set<string>()
  for (const r of after) {
    if (!hasId(r)) {
      console.warn(`[sync] élément sans id dans « ${coll} » : création seule, sans suivi.`, r)
      out.push({ method: 'POST', url: base, body: r, coll })
      continue
    }
    seen.add(r.id)
    const o = old.get(r.id)
    if (o === r) continue
    const key = coll + ':' + r.id
    out.push(
      o
        ? { method: 'PUT', url: item(r.id), body: r, coll, key }
        : { method: 'POST', url: base, body: r, coll, key }
    )
  }
  const dels = [...old.keys()].filter((id) => !seen.has(id))
  return [
    ...dels.map((id): Write => ({ method: 'DELETE', url: item(id), coll, key: coll + ':' + id })),
    ...out,
  ]
}

/** Journal en ajout seul : entrées nouvelles, de la plus ancienne à la plus récente. */
function journalWrites(before: unknown[] = [], after: Rec[]): Write[] {
  const old = new Set(before)
  return after
    .filter((e) => !old.has(e))
    .reverse()
    .map(({ d, a, mod, statut }) => ({
      method: 'POST',
      url: '/journal/',
      body: { d, a, mod, statut },
      coll: 'journal',
    }))
}

function collectionWrites(name: string, before: unknown, after: unknown): Write[] {
  if (before === after || after === undefined) return []
  if (name === 'journal') return journalWrites(before as unknown[], after as Rec[])
  const url = collectionUrl(name)
  const isList = Array.isArray(after) && after.every((r) => !!r && typeof r === 'object')
  if (SINGLETONS.has(name) || !isList)
    return [{ method: 'PUT', url, body: after, coll: name, key: name }]
  return listWrites(name, url, before, after as Rec[])
}

/** Écritures REST correspondant au passage de `prev` à `next`. */
export function writesFor(prev: AppState, next: AppState, patches: Patch[]): Write[] {
  const b = prev.db as unknown as Record<string, unknown>
  const a = next.db as unknown as Record<string, unknown>
  const colls = new Set<string>()
  for (const p of patches) {
    if (p.path.length === 0 || (p.path[0] === 'db' && p.path.length === 1))
      Object.keys({ ...b, ...a }).forEach((k) => colls.add(k))
    else if (p.path[0] === 'db') colls.add(String(p.path[1]))
  }
  const out: Write[] = []
  for (const c of colls) out.push(...collectionWrites(c, b[c], a[c]))
  if (prev.org !== next.org)
    out.push({ method: 'PUT', url: '/organisation/', body: next.org, coll: 'org', key: 'org' })
  if (prev.users !== next.users)
    out.push(...listWrites('users', '/users/', prev.users, next.users as unknown as Rec[]))
  const settings = Object.fromEntries(
    SETTINGS_KEYS.filter((k) => prev[k] !== next[k]).map((k) => [k, next[k]])
  )
  if (Object.keys(settings).length)
    out.push({
      method: 'PATCH',
      url: '/settings/',
      body: settings,
      coll: 'settings',
      key: 'settings',
    })
  return out
}

/* ---------- File d'attente ---------- */

const queue: Write[] = []
let running: Promise<void> | null = null
let reloadNeeded = false
/** Collections connues du serveur (clés de `db` du dernier bootstrap). */
let known = new Set<string>(CORE)
/** Collections absentes du serveur déjà signalées (un seul avertissement). */
const missing = new Set<string>()
let reloadHandler: (() => Promise<void>) | null = null

/** Rechargement des données (bootstrap) quand le serveur a refusé une écriture. */
export function onReloadNeeded(handler: () => Promise<void>) {
  reloadHandler = handler
}

/** Collections présentes côté serveur (appelé à chaque hydratation). */
export function setKnownCollections(names: string[]) {
  known = new Set([...CORE, ...names])
}

/** Ajoute une écriture, fondue dans une écriture en attente sur le même élément si possible. */
function enqueue(w: Write) {
  let i = queue.length - 1
  while (i >= 0 && (!w.key || queue[i].key !== w.key)) i--
  const q = queue[i]
  if (!q) queue.push(w)
  else if (w.method === 'PATCH' && q.method === 'PATCH')
    q.body = { ...(q.body as object), ...(w.body as object) }
  else if (w.method === 'PUT' && (q.method === 'PUT' || q.method === 'POST')) q.body = w.body
  else if (w.method === 'DELETE' && q.method === 'POST') queue.splice(i, 1)
  else if (w.method === 'DELETE' && q.method === 'PUT') queue[i] = w
  else queue.push(w)
}

function fail(w: Write, e: unknown) {
  const err = e instanceof ApiError ? e : new ApiError(0, String(e))
  console.error(`[sync] ${w.method} ${w.url} : ${err.status} ${err.message}`, err.data ?? '')
  if (err.status === 401) return // session perdue : retour à la connexion (cf. session.ts)
  if (err.status === 404 && !known.has(w.coll)) {
    if (!missing.has(w.coll)) {
      missing.add(w.coll)
      toast(
        `« ${w.coll} » n'est pas encore géré par le serveur : modification non enregistrée.`,
        'warn'
      )
    }
    return
  }
  if (err.status === 0) {
    toast("Serveur injoignable : la modification n'a pas été enregistrée.", 'warn')
    return
  }
  toast('Modification refusée par le serveur : ' + err.message, 'warn')
  // Le serveur et l'écran divergent (conflit, validation, droits) : on recharge.
  if (err.status < 500) reloadNeeded = true
}

async function drain() {
  while (queue.length) {
    const w = queue.shift()!
    try {
      await request(w.url, { method: w.method, body: w.body })
    } catch (e) {
      fail(w, e)
    }
  }
}

function pump() {
  running ??= drain().finally(() => {
    running = null
    if (queue.length) pump()
    else if (reloadNeeded && reloadHandler) {
      reloadNeeded = false
      void reloadHandler()
    }
  })
}

/** Attend que toutes les écritures en attente soient envoyées. */
export async function flush() {
  while (running) await running
}

/**
 * update() du store en mode API : applique la recette, puis envoie au serveur ce
 * qui a changé dans les données persistées (rien si la session n'est pas ouverte).
 */
export function syncedUpdate<S extends AppState>(get: () => S, set: (next: S) => void) {
  enablePatches()
  return (recipe: (s: AppState) => void) => {
    const prev = get()
    const [next, patches] = produceWithPatches(prev, (d) => void recipe(d as unknown as AppState))
    if (next === prev) return
    set(next as S)
    if (!isAuthenticated()) return
    const writes = writesFor(prev, next as S, patches)
    if (!writes.length) return
    writes.forEach(enqueue)
    pump()
  }
}
