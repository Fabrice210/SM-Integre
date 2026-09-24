import type { FormDef } from './types'

/** Registre des formulaires (FORMS de l'original), alimenté par chaque module. */
export const FORMS: Record<string, FormDef> = {}

export function registerForms(defs: Record<string, FormDef>) {
  Object.assign(FORMS, defs)
}
