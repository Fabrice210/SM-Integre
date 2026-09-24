import { ALL_N, type NormId } from '../../data/referentiels'
import type { AppState } from '../../store/types'

/** toggleN(n) de l'original, à appeler dans un update() : active/désactive une norme, ordre conservé. */
export function toggleNorm(s: AppState, n: NormId) {
  const a = s.activeNorms
  const i = a.indexOf(n)
  if (i >= 0) a.splice(i, 1)
  else a.push(n)
  a.sort((x, y) => ALL_N.indexOf(x) - ALL_N.indexOf(y))
}
