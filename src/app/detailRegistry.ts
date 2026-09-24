/**
 * Ouvreurs de fiches détaillées exposés par les modules (docDetail, ncDetail…),
 * pour les liens transverses (validations en attente, alertes, IA).
 */
export const detailOpeners: Record<string, (id: string) => void> = {}

export function registerDetails(defs: Record<string, (id: string) => void>) {
  Object.assign(detailOpeners, defs)
}
