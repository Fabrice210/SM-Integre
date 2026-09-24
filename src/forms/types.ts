import type { Opts } from '../lib/options'
import type { AppState } from '../store/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Rec = Record<string, any>

/** Champ de formulaire (même forme que dans l'original). */
export interface FieldDef {
  k: string
  l: string
  /** text (défaut), number, date, email, textarea, select, multi, norms, scale, file, toggle */
  t?: string
  req?: boolean | number
  full?: boolean | number
  o?: Opts
  h?: string
  err?: string
  check?: (value: unknown, out: Rec) => boolean
  /** scale : nombre de niveaux (5 par défaut). */
  max?: number
  /** toggle : libellé (« Oui » par défaut). */
  lbl?: string
}

/** FORMS[coll] de l'original. Les fonctions reçoivent l'état (brouillon immer pour save). */
export interface FormDef {
  title: string
  sub?: string
  fields: FieldDef[] | ((rec: Rec, isNew: boolean) => FieldDef[])
  def: (s: AppState) => Rec
  /** Après enregistrement, sur le brouillon ; peut renvoyer le message du toast. */
  save?: (s: AppState, rec: Rec, isNew: boolean) => string | void | null
  prefix?: string
  label?: string
  mod?: string
  wide?: boolean
  /** Liste cible si ce n'est pas s.db[coll]. */
  list?: (s: AppState) => Rec[]
}
