import type { Seed } from '../data/seed'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

/** procOwner(pid) de l'original. */
export function procOwner(db: Seed, pid: string): string {
  const p = db.processus.find((x) => x.id === pid)
  return p ? p.proprietaire : 'Florence DOSSOU-YOVO'
}

/** taux(k) de l'original : atteinte de la cible d'un indicateur (0–100). */
export function taux(k: Any): number {
  if (!k.valeur && k.valeur !== 0) return 0
  const t = k.sens === 'baisse' ? (k.valeur <= k.cible ? 100 : (k.cible / k.valeur) * 100) : (k.valeur / k.cible) * 100
  return Math.min(100, Math.round(t))
}

/** competenceGaps() de l'original. */
export function competenceGaps(db: Seed) {
  const C = db.competences as Any
  return C.liste.map((c: string, i: number) => {
    const nb = C.collaborateurs.filter((p: Any) => p.niveaux[i] > 0 && p.niveaux[i] < C.requis[c]).length
    const zero = C.collaborateurs.filter((p: Any) => p.niveaux[i] >= C.requis[c]).length
    return { comp: c, nb, couverts: zero, critique: zero < 2 }
  }) as { comp: string; nb: number; couverts: number; critique: boolean }[]
}
