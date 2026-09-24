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

/** coverage(n) de l'original : couverture moyenne des exigences pour une norme (ou toutes). */
export function coverage(db: Seed, activeNorms: readonly string[], n?: string): number {
  const L = (db.mapping as Any[]).filter(
    (m) => activeNorms.includes(m.norme) && (!n || n === 'all' || n === 'cross' || m.norme === n)
  )
  return L.length ? Math.round(L.reduce((a, m) => a + m.couverture, 0) / L.length) : 0
}

/** openActions() de l'original : actions non clôturées (objectifs + risques), filtrées par norme. */
export function openActions(db: Seed, norm: string) {
  const a: Any[] = []
  ;(db.objectifs as Any[]).forEach((o) =>
    o.actions.forEach((x: Any) => {
      if (x.statut !== 'Clôturé') a.push({ ...x, src: o.code, normes: o.normes })
    })
  )
  ;(db.risques as Any[]).forEach((r) => {
    if (r.statutAction !== 'Clôturé')
      a.push({ libelle: r.action, responsable: r.responsable, echeance: r.echeance, statut: r.statutAction, src: r.id, normes: r.normes })
  })
  return a.filter((r) => norm === 'all' || norm === 'cross' || !r.normes || r.normes.includes(norm))
}
