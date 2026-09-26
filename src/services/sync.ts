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
 *   élément nouveau   -> POST   /<collection>/[?at=start] (id fourni par le client ;
 *                                                         en tête si unshift())
 *   élément modifié   -> PUT    /<collection>/<id>/       (élément complet)
 *   élément supprimé  -> DELETE /<collection>/<id>/
 *   objet unique      -> PUT    /<collection>/            (politique, competences…)
 *   db.journal        -> POST   /journal/                 (ajout seul)
 *   db.diffusions     -> POST   /diffusions/              (ajout seul)
 *   org               -> PUT    /organisation/
 *   users             -> POST / PUT / DELETE /users/<id>/
 *   réglages          -> PATCH  /settings/                (activeNorms, auditorAccess…)
 *
 * Les écritures partent dans une file séquentielle ; tant qu'une écriture n'est pas
 * envoyée, une écriture ultérieure sur le même élément s'y fond (un seul appel).
 * Si le serveur refuse une écriture (4xx : conflit, validation, droits), les écritures
 * du même update encore en attente (effets liés, journal — envoyé en dernier) sont
 * abandonnées, l'erreur est affichée et l'état est rechargé (bootstrap).
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
/** Collections en ajout seul (pas de PUT / DELETE) : on n'envoie que les nouvelles entrées. */
const APPEND_ONLY: Record<string, (e: Rec) => unknown> = {
  // `u` est fixé par le serveur
  journal: ({ d, a, mod, statut }) => ({ d, a, mod, statut }),
  // id, date et auteur fixés par le serveur
  diffusions: ({ doc, canal, destinataires, piece }) => ({ doc, canal, destinataires, piece }),
}
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
  /** update() d'origine. */
  batch?: number
}

/**
 * URL d'une collection, comme le registre du backend : tiret entre une minuscule
 * (ou un chiffre) et une majuscule, puis minuscules (analyseVersions -> analyse-versions,
 * sourcesNC -> sources-nc).
 */
export const collectionUrl = (name: string) =>
  '/' + name.replace(/([a-z0-9])(?=[A-Z])/g, '$1-').toLowerCase() + '/'

const hasId = (r: unknown): r is Rec & { id: string } =>
  !!r && typeof r === 'object' && typeof (r as Rec).id === 'string'

/* ---------- Calcul des écritures ---------- */

/** Liste d'éléments à `id` : ajouts, modifications et suppressions. */
function listWrites(coll: string, base: string, before: unknown, after: Rec[]): Write[] {
  const old = new Map((Array.isArray(before) ? before : []).filter(hasId).map((r) => [r.id, r]))
  const item = (id: string) => base + encodeURIComponent(id) + '/'
  const key = (id: string) => coll + ':' + id
  const head: Write[] = [] // nouveaux éléments placés avant tout élément existant (unshift)
  const rest: Write[] = []
  let pastHead = old.size === 0 // liste vide avant : ordre conservé par des ajouts en fin
  const seen = new Set<string>()
  for (const r of after) {
    const o = hasId(r) ? old.get(r.id) : undefined
    if (o) pastHead = true
    if (!hasId(r)) {
      console.warn(`[sync] élément sans id dans « ${coll} » : création seule, sans suivi.`, r)
      ;(pastHead ? rest : head).push({ method: 'POST', url: base, body: r, coll })
      continue
    }
    seen.add(r.id)
    if (o === r) continue
    if (o) rest.push({ method: 'PUT', url: item(r.id), body: r, coll, key: key(r.id) })
    else (pastHead ? rest : head).push({ method: 'POST', url: base, body: r, coll, key: key(r.id) })
  }
  // En tête : du dernier au premier, chacun inséré au début -> ordre final identique.
  head.reverse().forEach((w) => (w.url += '?at=start'))
  const dels = [...old.keys()].filter((id) => !seen.has(id))
  return [
    ...dels.map((id): Write => ({ method: 'DELETE', url: item(id), coll, key: key(id) })),
    ...head,
    ...rest,
  ]
}

/** Ajout seul : entrées nouvelles (par référence), de la plus ancienne à la plus récente. */
function appendWrites(coll: string, before: unknown, after: Rec[]): Write[] {
  const old = new Set(Array.isArray(before) ? before : [])
  const fresh = after.filter((e) => !old.has(e))
  // Entrées ajoutées en tête (unshift) : la plus ancienne est la dernière.
  const ordered = after.indexOf(fresh[0]) === 0 ? fresh.reverse() : fresh
  return ordered.map((e) => ({
    method: 'POST',
    url: collectionUrl(coll),
    body: APPEND_ONLY[coll](e),
    coll,
  }))
}

function collectionWrites(name: string, before: unknown, after: unknown): Write[] {
  if (before === after || after === undefined) return []
  if (name in APPEND_ONLY && Array.isArray(after)) return appendWrites(name, before, after)
  const url = collectionUrl(name)
  const isList = Array.isArray(after) && after.every((r) => !!r && typeof r === 'object')
  if (SINGLETONS.has(name) || !isList)
    return [{ method: 'PUT', url, body: after, coll: name, key: name }]
  return listWrites(name, url, before, after as Rec[])
}

/** Écritures REST correspondant au passage de `prev` à `next`, dans l’ordre d’envoi. */
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
  // Modifications d'abord (souvent l'action elle-même, ex. transition de statut soumise
  // à des droits), puis créations (effets liés : NC, registre…), suppressions, journal.
  const rank = (w: Write) =>
    w.coll === 'journal' ? 3 : w.method === 'DELETE' ? 2 : w.method === 'POST' ? 1 : 0
  return out.sort((x, y) => rank(x) - rank(y)) // tri stable : ordre conservé à rang égal
}

/* ---------- File d'attente ---------- */

const queue: Write[] = []
let running: Promise<void> | null = null
let reloadNeeded = false
let batchSeq = 0
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
  if (err.status >= 500) return
  // Conflit, validation ou droits (403) : l'action est refusée -> on abandonne le reste
  // de cet update (effets liés, journal), puis on recharge pour rejoindre le serveur.
  for (let i = queue.length - 1; i >= 0; i--) if (queue[i].batch === w.batch) queue.splice(i, 1)
  reloadNeeded = true
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
    const batch = ++batchSeq
    writes.forEach((w) => enqueue({ ...w, batch }))
    pump()
  }
}
