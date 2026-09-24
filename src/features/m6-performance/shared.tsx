/**
 * Utilitaires locaux des modules 5 et 6. Le calendrier, addRegistre,
 * coverage et openActions sont dans le socle (components/data/Calendar,
 * services/registre, services/metrics).
 */
import type { AppState } from '../../store/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Any = any

/** Accès non typé à DB (la démo est typée par inférence, les enregistrements évoluent). */
export const DB = (s: AppState): Any => s.db

/** esc() de l'original, pour les documents imprimables (printDoc). */
export const esc = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  )
