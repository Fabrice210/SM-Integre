import { enablePatches, produce, produceWithPatches, type Patch } from 'immer'
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
 * Un élément nouveau sans `id` en reçoit un (préfixe de sa collection + compteur), pour
 * être suivi comme les autres (sinon chaque update suivant le recréerait).
 *
 * Les écritures partent dans une file séquentielle, dans l'ordre des update(), sans
 * fusion (chaque écriture reste liée à son update et à sa recette).
 *
 * Erreurs :
 *   - serveur injoignable ou limitation de débit (429) : l'écriture reste en tête de
 *     file et est rejouée (délai croissant) — rien n'est perdu ni envoyé dans le désordre ;
 *   - refus (4xx : conflit, validation, droits) ou erreur serveur (5xx) : les écritures
 *     du même update encore en attente (effets liés, journal) sont abandonnées, l'erreur
 *     est affichée et l'état est rechargé (bootstrap) une fois la file vide. Jusque-là,
 *     les updates qui touchent un élément refusé (en file ou nouveaux) sont retenus puis
 *     rejoués sur l'état rechargé : le changement refusé n'est pas réembarqué ;
 *   - création refusée car l'id est déjà pris (autre client) : nouvel id, remplacé dans
 *     le store et les écritures en attente, création rejouée (sans rechargement) ;
 *   - session perdue (401) : la file est vidée (cf. session.ts, retour à la connexion).
 *
 * Réponse du serveur : si l'élément n'a pas changé localement depuis l'envoi, la
 * version du serveur (statut imposé, historique…) remplace la copie locale.
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
  /** id de l'élément (listes). */
  id?: string
  /** update() d'origine. */
  batch?: number
  /** La réponse du serveur peut remplacer l'élément local (collections de `db`). */
  adopt?: 'item' | 'singleton'
  /** Recette de l'update() d'origine (rejouée après un refus, cf. hold). */
  recipe?: Recipe
  /** Nouvelles tentatives après collision d'identifiant. */
  retries?: number
}

type Recipe = (s: AppState) => void

/**
 * URL d'une collection, comme le registre du backend : tiret entre une minuscule
 * (ou un chiffre) et une majuscule, puis minuscules (analyseVersions -> analyse-versions,
 * sourcesNC -> sources-nc).
 */
export const collectionUrl = (name: string) =>
  '/' + name.replace(/([a-z0-9])(?=[A-Z])/g, '$1-').toLowerCase() + '/'

const hasId = (r: unknown): r is Rec & { id: string } =>
  !!r && typeof r === 'object' && typeof (r as Rec).id === 'string'

const isRecList = (v: unknown): v is Rec[] =>
  Array.isArray(v) && v.every((r) => !!r && typeof r === 'object' && !Array.isArray(r))

/* ---------- Calcul des écritures ---------- */

/** Liste d'éléments à `id` : ajouts, modifications et suppressions. */
function listWrites(
  coll: string,
  base: string,
  before: unknown,
  after: Rec[],
  adopt?: Write['adopt']
): Write[] {
  const prevList = Array.isArray(before) ? (before as unknown[]) : []
  const old = new Map(prevList.filter(hasId).map((r) => [r.id, r]))
  const prevRefs = new Set(prevList)
  const item = (id: string) => base + encodeURIComponent(id) + '/'
  const key = (id: string) => coll + ':' + id
  const head: Write[] = [] // nouveaux éléments placés avant tout élément existant (unshift)
  const rest: Write[] = []
  let pastHead = old.size === 0 // liste vide avant : ordre conservé par des ajouts en fin
  const seen = new Set<string>()
  for (const r of after) {
    const o = hasId(r) ? old.get(r.id) : undefined
    if (o || prevRefs.has(r)) pastHead = true
    if (!hasId(r)) {
      // Ne devrait pas arriver (ensureIds) : création unique, sans suivi ultérieur.
      if (prevRefs.has(r)) continue
      console.warn(`[sync] élément sans id dans « ${coll} » : création seule, sans suivi.`, r)
      ;(pastHead ? rest : head).push({ method: 'POST', url: base, body: r, coll })
      continue
    }
    seen.add(r.id)
    if (o === r) continue
    const w = { body: r, coll, key: key(r.id), id: r.id, adopt }
    if (o) rest.push({ method: 'PUT', url: item(r.id), ...w })
    else (pastHead ? rest : head).push({ method: 'POST', url: base, ...w })
  }
  // En tête : du dernier au premier, chacun inséré au début -> ordre final identique.
  head.reverse().forEach((w) => (w.url += '?at=start'))
  const dels = [...old.keys()].filter((id) => !seen.has(id))
  return [
    ...dels.map((id): Write => ({ method: 'DELETE', url: item(id), coll, key: key(id), id })),
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
  if (SINGLETONS.has(name) || !isRecList(after))
    return [{ method: 'PUT', url, body: after, coll: name, key: name, adopt: 'singleton' }]
  return listWrites(name, url, before, after, 'item')
}

/** Collections de `db` touchées par les patches. */
function touchedCollections(prev: AppState, next: AppState, patches: Patch[]): Set<string> {
  const colls = new Set<string>()
  for (const p of patches) {
    if (p.path.length === 0 || (p.path[0] === 'db' && p.path.length === 1))
      Object.keys({ ...prev.db, ...next.db }).forEach((k) => colls.add(k))
    else if (p.path[0] === 'db') colls.add(String(p.path[1]))
  }
  return colls
}

/** Écritures REST correspondant au passage de `prev` à `next`, dans l’ordre d’envoi. */
export function writesFor(prev: AppState, next: AppState, patches: Patch[]): Write[] {
  const b = prev.db as unknown as Record<string, unknown>
  const a = next.db as unknown as Record<string, unknown>
  const out: Write[] = []
  for (const c of touchedCollections(prev, next, patches))
    out.push(...collectionWrites(c, b[c], a[c]))
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
  // Créations référencées par une autre écriture du même update (action liée à une fiche,
  // objectif qui cite un processus créé en même temps…) : d'abord, et avant celles qui
  // les référencent, sinon la référence serait inconnue du serveur.
  const json = new Map(out.map((w) => [w, JSON.stringify(w.body ?? null)]))
  const posts = out.filter((w) => w.method === 'POST' && w.id)
  const referrers = (p: Write) =>
    out.filter(
      (w) =>
        w !== p &&
        w.method !== 'DELETE' &&
        w.coll !== 'journal' &&
        json.get(w)!.includes(JSON.stringify(p.id))
    )
  const levels = new Map<Write, number>()
  const level = (p: Write, depth = 0): number => {
    if (levels.has(p)) return levels.get(p)!
    const by = depth > 10 ? [] : referrers(p)
    const l = by.length
      ? 1 + Math.max(...by.map((w) => (w.method === 'POST' && w.id ? level(w, depth + 1) : 0)))
      : 0
    levels.set(p, l)
    return l
  }
  posts.forEach((p) => level(p))
  // Puis modifications (souvent l'action elle-même, ex. transition de statut soumise
  // à des droits), créations (effets liés : NC, registre…), suppressions, journal.
  const rank = (w: Write) =>
    w.coll === 'journal'
      ? 3
      : w.method === 'DELETE'
        ? 2
        : w.method === 'POST'
          ? levels.get(w)
            ? -levels.get(w)!
            : 1
          : 0
  return out.sort((x, y) => rank(x) - rank(y)) // tri stable : ordre conservé à rang égal
}

/**
 * Donne un `id` aux éléments nouveaux qui n'en ont pas (listes de `db`), avec le
 * préfixe des autres éléments de la collection et le compteur du store (nextId).
 */
function ensureIds(prev: AppState, next: AppState, patches: Patch[]): AppState {
  const b = prev.db as unknown as Record<string, unknown>
  const a = next.db as unknown as Record<string, unknown>
  const todo = [...touchedCollections(prev, next, patches)].filter((c) => {
    const list = a[c]
    if (c in APPEND_ONLY || SINGLETONS.has(c) || !isRecList(list)) return false
    const old = new Set(Array.isArray(b[c]) ? (b[c] as unknown[]) : [])
    return list.some((r) => !hasId(r) && !old.has(r))
  })
  if (!todo.length) return next
  return produce(next, (d) => {
    const db = d.db as unknown as Record<string, Rec[]>
    for (const c of todo) {
      const old = new Set(Array.isArray(b[c]) ? (b[c] as unknown[]) : [])
      const prefix = /^[A-Za-z]+/.exec(db[c].find(hasId)?.id ?? '')?.[0] ?? 'X'
      ;(a[c] as Rec[]).forEach((r, i) => {
        if (hasId(r) || old.has(r)) return
        d.uidSeq += 1
        db[c][i].id = prefix + d.uidSeq
      })
    }
  })
}

/* ---------- File d'attente ---------- */

const queue: Write[] = []
let running: Promise<void> | null = null
let reloadNeeded = false
let batchSeq = 0
/** Nombre d'écritures mises en file depuis le chargement (cf. isQuiet). */
let enqueued = 0
/** Incrémenté par discard() : une file en cours d'envoi s'arrête. */
let generation = 0
/** Serveur injoignable signalé (un seul message jusqu'au retour de la connexion). */
let offline = false
/** Collections connues du serveur (clés de `db` du dernier bootstrap). */
let known = new Set<string>(CORE)
/** Collections absentes du serveur déjà signalées (un seul avertissement). */
const missing = new Set<string>()
let reloadHandler: (() => Promise<void>) | null = null
/** Accès au store (remplacement d'un élément par la réponse du serveur). */
let store: { get: () => AppState; set: (s: AppState) => void } | null = null
/** update() synchronisé (rejeu des recettes retenues). */
let apply: ((recipe: Recipe) => void) | null = null
/**
 * Éléments (clés) dont une écriture a été refusée : jusqu'à la fin du rechargement,
 * les updates qui les touchent sont retenus (`held`) puis rejoués sur l'état du serveur,
 * pour ne pas réembarquer le changement refusé (PUT de l'élément complet).
 */
const blocked = new Set<string>()
const held: Recipe[] = []

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Rechargement des données (bootstrap) quand le serveur a refusé une écriture. */
export function onReloadNeeded(handler: () => Promise<void>) {
  reloadHandler = handler
}

/** Collections présentes côté serveur (appelé à chaque hydratation). */
export function setKnownCollections(names: string[]) {
  known = new Set([...CORE, ...names])
}

/** Compteur d'écritures : inchangé entre deux lectures = aucune écriture entre-temps. */
export const writeCount = () => enqueued

/** Aucune écriture en attente ni en cours. */
export const isIdle = () => !running && !queue.length

function warnMissing(coll: string) {
  if (missing.has(coll)) return
  missing.add(coll)
  toast(`« ${coll} » n'est pas encore géré par le serveur : modification non enregistrée.`, 'warn')
}

/**
 * Ajoute une écriture. Pas de fusion entre updates : chaque écriture reste liée à son
 * update (abandon groupé en cas de refus, rejeu de la recette), et l'ordre est conservé.
 */
function enqueue(w: Write) {
  if (!known.has(w.coll)) return warnMissing(w.coll)
  enqueued++
  queue.push(w)
}

/** Deux valeurs JSON identiques (ordre des clés indifférent). */
function sameJson(x: unknown, y: unknown): boolean {
  if (x === y) return true
  if (!x || !y || typeof x !== 'object' || typeof y !== 'object') return false
  if (Array.isArray(x) !== Array.isArray(y)) return false
  const kx = Object.keys(x).filter((k) => (x as Rec)[k] !== undefined)
  const ky = Object.keys(y).filter((k) => (y as Rec)[k] !== undefined)
  return kx.length === ky.length && kx.every((k) => sameJson((x as Rec)[k], (y as Rec)[k]))
}

/**
 * Réponse du serveur à une création / modification : si l'élément local est encore
 * celui qui a été envoyé (aucune modification depuis, rien en attente), il est remplacé
 * par la version du serveur, qui peut différer (statut imposé, historique…).
 */
function adopt(w: Write, data: unknown) {
  if (!store || !w.adopt || !data || typeof data !== 'object') return
  if (queue.some((q) => q.key === w.key)) return
  const s = store.get()
  const db = s.db as unknown as Record<string, unknown>
  const cur = db[w.coll]
  if (sameJson(w.body, data)) return
  let value: unknown
  if (w.adopt === 'singleton') {
    if (cur !== w.body) return
    value = data
  } else {
    const i = Array.isArray(cur) ? cur.indexOf(w.body) : -1
    if (i < 0 || (data as Rec).id !== w.id) return
    value = (cur as unknown[]).map((x, j) => (j === i ? data : x))
  }
  store.set({ ...s, db: { ...db, [w.coll]: value } as unknown as AppState['db'] })
}

function fail(w: Write, e: unknown) {
  const err = e instanceof ApiError ? e : new ApiError(0, String(e))
  console.error(`[sync] ${w.method} ${w.url} : ${err.status} ${err.message}`, err.data ?? '')
  if (err.status === 401) {
    // Session perdue : rien ne peut plus être envoyé (retour à la connexion, cf. session.ts).
    discard()
    return
  }
  if (err.status === 404 && !known.has(w.coll)) return warnMissing(w.coll)
  if (isIdCollision(w, err) && reassignId(w)) return
  toast(
    err.status >= 500
      ? `Erreur du serveur (${err.status}) : modification non enregistrée.`
      : 'Modification refusée par le serveur : ' + err.message,
    'warn'
  )
  // Refus ou erreur serveur : l'action n'est pas (entièrement) enregistrée -> on abandonne
  // le reste de cet update (effets liés, journal), puis on recharge l'état du serveur.
  if (w.key) blocked.add(w.key)
  for (let i = queue.length - 1; i >= 0; i--)
    if (queue[i].batch === w.batch) {
      const [x] = queue.splice(i, 1)
      if (x.key) blocked.add(x.key)
    }
  holdQueued()
  reloadNeeded = true
}

/**
 * Updates déjà en file qui touchent un élément refusé : calculés sur l'état local qui
 * contient encore le changement refusé -> retirés de la file et retenus, pour être
 * rejoués sur l'état rechargé. Leurs autres éléments sont bloqués à leur tour.
 */
function holdQueued() {
  for (;;) {
    const batch = queue.find((q) => q.key && blocked.has(q.key))?.batch
    if (batch === undefined) return
    const recipe = queue.find((q) => q.batch === batch && q.recipe)?.recipe
    for (let i = queue.length - 1; i >= 0; i--)
      if (queue[i].batch === batch) {
        const [x] = queue.splice(i, 1)
        if (x.key) blocked.add(x.key)
      }
    if (recipe) held.push(recipe)
  }
}

/**
 * Fin du rechargement (état du serveur hydraté) : débloque les éléments refusés et
 * rejoue les updates retenus ; une recette qui ne s'applique plus est abandonnée.
 */
export function afterReload() {
  blocked.clear()
  const recipes = held.splice(0)
  let lost = 0
  for (const r of recipes) {
    try {
      apply?.(r)
    } catch (e) {
      lost++
      console.warn('[sync] modification retenue abandonnée :', e)
    }
  }
  if (lost)
    toast(
      `${lost} modification(s) faite(s) pendant la resynchronisation ne s'applique(nt) plus à l'état du serveur : abandonnée(s).`,
      'warn'
    )
}

/* ---------- Collision d'identifiant (deux clients, même id) ---------- */

const isIdCollision = (w: Write, err: ApiError) =>
  w.method === 'POST' &&
  err.status === 400 &&
  !!w.id &&
  (w.retries ?? 0) < 5 &&
  /déjà utilisé/.test(JSON.stringify((err.data as Rec | undefined)?.id ?? ''))

/** Remplace `from` par `to` partout où la valeur apparaît telle quelle (références). */
function replaceValue<T>(v: T, from: string, to: string): T {
  if (v === from) return to as T
  if (!v || typeof v !== 'object') return v
  let changed = false
  const out = (Array.isArray(v) ? [] : {}) as Record<string, unknown>
  for (const [k, x] of Object.entries(v)) {
    const y = replaceValue(x, from, to)
    if (y !== x) changed = true
    out[k] = y
  }
  return changed ? (out as T) : v
}

/**
 * Création refusée car l'id (généré par ce client) vient d'être pris par un autre :
 * nouvel id (compteur recalé au-delà), remplacé dans le store et dans les écritures
 * en attente qui le référencent, puis création rejouée — sans rechargement.
 */
function reassignId(w: Write): boolean {
  const old = w.id!
  const m = /^(.*?)(\d+)$/.exec(old)
  if (!store || !m) return false
  const s = store.get()
  const list = w.coll === 'users' ? s.users : (s.db as unknown as Record<string, unknown>)[w.coll]
  const taken = new Set((Array.isArray(list) ? list : []).filter(hasId).map((r) => r.id))
  let seq = Math.max(s.uidSeq, Number(m[2]))
  let id: string
  do id = m[1] + ++seq
  while (taken.has(id))
  const db = replaceValue(s.db, old, id)
  const users = w.coll === 'users' ? replaceValue(s.users, old, id) : s.users
  store.set({ ...s, db, users, uidSeq: seq })
  const oldKey = w.key
  const key = w.coll + ':' + id
  const oldSeg = '/' + encodeURIComponent(old) + '/'
  const newSeg = '/' + encodeURIComponent(id) + '/'
  for (const q of queue) {
    q.body = replaceValue(q.body, old, id)
    if (q.key === oldKey) Object.assign(q, { key, id, url: q.url.replace(oldSeg, newSeg) })
  }
  const after = w.coll === 'users' ? users : (db as unknown as Record<string, unknown>)[w.coll]
  const body =
    (Array.isArray(after) ? after : []).find((r) => hasId(r) && r.id === id) ??
    replaceValue(w.body, old, id)
  queue.unshift({ ...w, id, key, body, retries: (w.retries ?? 0) + 1 })
  console.info(`[sync] identifiant ${old} déjà pris sur le serveur : création rejouée en ${id}.`)
  return true
}

async function drain() {
  const gen = generation
  let attempt = 0
  while (queue.length && gen === generation) {
    const w = queue.shift()!
    try {
      const data = await request(w.url, { method: w.method, body: w.body })
      attempt = 0
      if (offline) {
        offline = false
        toast('Connexion au serveur rétablie : modifications enregistrées.')
      }
      if (gen === generation) adopt(w, data)
    } catch (e) {
      if (gen !== generation) return
      if (e instanceof ApiError && e.status === 429) {
        // Limitation de débit (ex. renouvellement du jeton) : on patiente, puis on rejoue.
        queue.unshift(w)
        await sleep(Math.min(30000, 2000 * 2 ** attempt++))
        continue
      }
      if (e instanceof ApiError && e.status === 0) {
        // Serveur injoignable : on rejoue la même écriture plus tard, sans rien perdre.
        queue.unshift(w)
        if (!offline) {
          offline = true
          toast('Serveur injoignable : les modifications seront envoyées dès son retour.', 'warn')
        }
        await sleep(Math.min(30000, 1000 * 2 ** attempt++))
        continue
      }
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

/**
 * Attend que toutes les écritures en attente soient envoyées ; false si le délai
 * (ms) est écoulé avant.
 */
export async function flush(timeout = Infinity): Promise<boolean> {
  const deadline = Date.now() + timeout
  while (running) {
    const left = deadline - Date.now()
    if (left <= 0) return false
    await Promise.race([running, sleep(Math.min(left, 2 ** 31 - 1))])
  }
  return true
}

/** Abandonne les écritures en attente (déconnexion, session perdue). */
export function discard() {
  queue.length = 0
  blocked.clear()
  held.length = 0
  generation++
  reloadNeeded = false
  offline = false
}

/**
 * update() du store en mode API : applique la recette, puis envoie au serveur ce
 * qui a changé dans les données persistées (rien si la session n'est pas ouverte).
 */
export function syncedUpdate<S extends AppState>(get: () => S, set: (next: S) => void) {
  enablePatches()
  store = { get, set: set as (s: AppState) => void }
  const update = (recipe: Recipe) => {
    const prev = get()
    const [produced, patches] = produceWithPatches(
      prev,
      (d) => void recipe(d as unknown as AppState)
    )
    if (produced === prev) return
    const online = isAuthenticated()
    const next = online ? ensureIds(prev, produced, patches) : produced
    set(next as S)
    if (!online) return
    const writes = writesFor(prev, next, patches)
    if (!writes.length) return
    // Élément refusé en cours de resynchronisation : update retenu, rejoué après.
    if (writes.some((w) => w.key && blocked.has(w.key))) {
      held.push(recipe)
      return
    }
    const batch = ++batchSeq
    writes.forEach((w) => enqueue({ ...w, batch, recipe }))
    if (queue.length) pump()
  }
  apply = update
  return update
}
