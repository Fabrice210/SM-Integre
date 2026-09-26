import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { ALL_N, ORG, USERS, type NormId } from '../data/referentiels'
import { migrateDemo } from '../data/migrations'
import { seed } from '../data/seed'
import { nowStamp } from '../lib/dates'
import { API_MODE } from '../services/api'
import { localRepository as repo } from '../services/persistence'
import { syncedUpdate } from '../services/sync'
import type { AppState, Persisted, UiState } from './types'

/**
 * Version des données de démo : à incrémenter quand l'original change ses données
 * (scripts/extract-reference.mjs). Une sauvegarde plus ancienne est alors remplacée.
 */
export const DATA_VERSION = 2

/** Données initiales : copie profonde de la démo (l'original n'est jamais muté). */
export function initialData(): Persisted {
  return {
    db: migrateDemo(structuredClone(seed)),
    org: structuredClone(ORG),
    users: structuredClone(USERS),
    activeNorms: [...ALL_N] as NormId[],
    auditorAccess: true,
    erpModule: false,
    uidSeq: 100,
    onboarded: false,
    dataVersion: DATA_VERSION,
  }
}

/** Données sauvegardées, sinon démo ; une session marquée « onboarded » vaut onboarding terminé. */
function loadInitial(): Persisted {
  const saved = repo.loadData()
  const data = saved && saved.dataVersion === DATA_VERSION ? saved : initialData()
  const session = repo.loadSession()
  return { ...data, onboarded: Boolean(data.onboarded || session?.onboarded) }
}

const initialUi = (): UiState => ({
  norm: 'all',
  tabs: {},
  search: {},
  filt: {},
  notif: false,
  ai: false,
  aiMsgs: [],
  chart: 'mois',
  chartSel: 4,
  calY: 2026,
  sidebar: false,
  dismissed: [],
  history: [],
  histIndex: -1,
  openMods: ['m1'],
  onb: { step: 0 },
})

interface Actions {
  /** Applique une modification (brouillon immer) — équivalent de « muter S/DB puis render() ». */
  update: (recipe: (s: AppState) => void) => void
  resetDemo: () => void
}

export const useApp = create<AppState & Actions>()(
  immer((set, get) => ({
    // Mode API : données et session viennent du serveur après connexion (services/session.ts)
    ...(API_MODE ? initialData() : loadInitial()),
    session: API_MODE ? null : repo.loadSession(),
    ui: initialUi(),
    update: API_MODE
      ? syncedUpdate(get, (next) => set(next))
      : (recipe) => set((s) => void recipe(s)),
    resetDemo: () => {
      repo.reset()
      set(() => ({ ...initialData(), session: null, ui: initialUi() }))
    },
  }))
)

/** Raccourci hors composant. */
export const update = (recipe: (s: AppState) => void) => useApp.getState().update(recipe)

/* ---------- Sauvegarde automatique (données + session) ---------- */
const PERSISTED_KEYS = ['db', 'org', 'users', 'activeNorms', 'auditorAccess', 'erpModule', 'uidSeq', 'onboarded', 'dataVersion'] as const

useApp.subscribe((s, prev) => {
  if (API_MODE) return // le serveur fait foi (cf. services/sync.ts)
  // immer ne crée de nouvelles références que pour ce qui a réellement changé
  if (PERSISTED_KEYS.some((k) => s[k] !== prev[k])) {
    repo.saveData(Object.fromEntries(PERSISTED_KEYS.map((k) => [k, s[k]])) as unknown as Persisted)
  }
  if (s.session !== prev.session) repo.saveSession(s.session)
})

/* ---------- Helpers à utiliser DANS un update() (brouillon) ---------- */

/** Utilisateur courant (S.user de l'original). */
export function currentUser(s: Pick<AppState, 'users' | 'session'>) {
  return s.users.find((u) => u.id === s.session?.userId) ?? s.users[0]
}

/** uid(p) de l'original : p + compteur (R101, R102…). */
export function nextId(s: AppState, prefix = 'X'): string {
  s.uidSeq += 1
  return prefix + s.uidSeq
}

/** logAct() de l'original : entrée en tête du journal d'audit. */
export function logAct(s: AppState, a: string, mod: string, statut = 'Terminé') {
  s.db.journal.unshift({ d: nowStamp(), u: currentUser(s).nom, a, mod, statut } as (typeof s.db.journal)[number])
}

/** hist() de l'original : historique d'un enregistrement. */
export function hist(s: AppState, rec: { hist?: { d: string; u: string; a: string }[] }, a: string) {
  rec.hist = rec.hist || []
  rec.hist.unshift({ d: nowStamp(), u: currentUser(s).nom, a })
}
