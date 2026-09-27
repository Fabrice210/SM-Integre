import type { NormId, Org, User } from '../data/referentiels'
import type { DemoData } from '../data/migrations'

export type NormFilter = 'all' | 'cross' | NormId

export interface Session {
  userId: string
  onboarded: boolean
}

/** Données métier sauvegardées (équivalent de DB + ORG + USERS + réglages de l'original). */
export interface Persisted {
  /** Données de démo (DB), complétées par les migrations de la v2. */
  db: DemoData
  org: Org
  users: User[]
  activeNorms: NormId[]
  auditorAccess: boolean
  erpModule: boolean
  /**
   * Droits fins par processus (mode API seulement, réglage de l'organisme côté serveur) :
   * un pilote / copilote sans rôle global n'écrit que sur les éléments de ses processus.
   */
  droitsParProcessus?: boolean
  /** Compteur de uid() : R101, R102… (continue après rechargement). */
  uidSeq: number
  /** L'organisme a terminé l'assistant d'onboarding (S.onboarded). */
  onboarded: boolean
  /** Version des données de démo à l'origine de la sauvegarde (cf. DATA_VERSION). */
  dataVersion: number
}

export interface AiMessage {
  /** 1 = assistant, 0 = utilisateur (forme de l'original) */
  b: 0 | 1
  t: string
  /** Sources citées par l'assistant distant (mode API) : éléments de la `db` de l'organisme. */
  src?: AiSource[]
  /** Réponse en cours de calcul par le serveur (mode API). */
  wait?: boolean
}

export interface AiSource {
  collection: string
  id: string
  libelle: string
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
  /** Année affichée par les calendriers (S.calY, partagée entre les pages). */
  calY: number
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
