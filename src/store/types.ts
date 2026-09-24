import type { NormId, Org, User } from '../data/referentiels'
import type { Seed } from '../data/seed'

export type NormFilter = 'all' | 'cross' | NormId

export interface Session {
  userId: string
  onboarded: boolean
}

/** Données métier sauvegardées (équivalent de DB + ORG + USERS + réglages de l'original). */
export interface Persisted {
  db: Seed
  org: Org
  users: User[]
  activeNorms: NormId[]
  auditorAccess: boolean
  erpModule: boolean
  /** Compteur de uid() : R101, R102… (continue après rechargement). */
  uidSeq: number
  /** L'organisme a terminé l'assistant d'onboarding (S.onboarded). */
  onboarded: boolean
}

export interface AiMessage {
  /** 1 = assistant, 0 = utilisateur (forme de l'original) */
  b: 0 | 1
  t: string
}

/** État d'interface (équivalent des champs de S non métier) — non sauvegardé, sauf mention. */
export interface UiState {
  norm: NormFilter
  tabs: Record<string, string>
  search: Record<string, string>
  filt: Record<string, Record<string, string>>
  notif: boolean
  ai: boolean
  aiMsgs: AiMessage[]
  chart: string
  chartSel: number
  sidebar: boolean
  dismissed: string[]
  history: string[]
  histIndex: number
  openMods: string[]
  /** État libre de l'assistant d'onboarding (S.onb de l'original). */
  onb: { step: number; [key: string]: unknown }
}

export interface AppState extends Persisted {
  session: Session | null
  ui: UiState
}
