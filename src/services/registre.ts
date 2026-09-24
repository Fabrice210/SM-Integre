import type { Rec } from '../forms/types'
import { iso, TODAY } from '../lib/dates'
import { nextId } from '../store/useApp'
import type { AppState } from '../store/types'

/**
 * addRegistre() de l'original (ligne 1505) : entrée du registre d'amélioration continue.
 * À appeler dans un update() — utilisée par les modules 3, 5 et 6.
 */
export function addRegistre(
  s: AppState,
  type: string,
  intitule: string,
  origine: string,
  processus: string,
  normes: readonly string[],
  responsable: string
) {
  const registre = s.db.registre as unknown as Rec[]
  registre.unshift({
    id: nextId(s, 'RG'),
    ref: 'RG-2026-0' + (38 + registre.length),
    type,
    intitule,
    origine,
    processus,
    normes,
    statut: 'En cours',
    date: iso(TODAY),
    responsable,
  })
}
