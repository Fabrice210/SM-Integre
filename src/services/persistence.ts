import type { Persisted, Session } from '../store/types'

/**
 * Couche d'accès unique aux données sauvegardées. Implémentation actuelle :
 * localStorage. Une API distante pourra la remplacer sans toucher aux écrans.
 */
export interface Repository {
  loadData(): Persisted | null
  saveData(data: Persisted): void
  loadSession(): Session | null
  saveSession(session: Session | null): void
  reset(): void
}

const DATA_KEY = 'sm:data'
const SESSION_KEY = 'sm:session'

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* stockage indisponible (navigation privée…) : l'app reste utilisable en mémoire */
  }
}

export const localRepository: Repository = {
  loadData: () => read<Persisted>(DATA_KEY),
  saveData: (data) => write(DATA_KEY, data),
  loadSession: () => read<Session>(SESSION_KEY),
  saveSession: (session) => write(SESSION_KEY, session),
  reset: () => {
    write(DATA_KEY, null)
    write(SESSION_KEY, null)
  },
}
