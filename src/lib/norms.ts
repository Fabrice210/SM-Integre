import type { NormFilter } from '../store/types'

/** inNorm(r) de l'original : l'élément est-il visible avec le filtre de norme courant ? */
export function inNorm(r: { normes?: readonly string[] } | null | undefined, norm: NormFilter): boolean {
  if (norm === 'all' || norm === 'cross') return true
  if (!r || !r.normes) return true
  return r.normes.includes(norm)
}
