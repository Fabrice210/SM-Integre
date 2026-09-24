import type { Rec } from './types'

/** Contrôleurs des formulaires ouverts : lecture + validation à l'enregistrement. */
export const controllers: Record<string, () => Rec | null> = {}

/** readForm() de l'original : lit et valide le formulaire `formId` (null si invalide). */
export function readForm(formId: string): Rec | null {
  return controllers[formId]?.() ?? null
}
