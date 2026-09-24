import { MOIS, TODAY } from '../data/referentiels'

/** Date de référence de la démo (figée comme dans l'original). */
export { TODAY }

/** « 21 sept. 2026 » ; renvoie la valeur telle quelle si ce n'est pas une date. */
export function fd(s: string | null | undefined): string {
  if (!s || s === '—') return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return String(s)
  return d.getDate() + ' ' + MOIS[d.getMonth()] + ' ' + d.getFullYear()
}

/** Nombre de jours entre TODAY et la date (négatif si passée). */
export function days(s: string | null | undefined): number | null {
  if (!s || s === '—') return null
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  return Math.round((d.getTime() - TODAY.getTime()) / 86400000)
}

export function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(n: number): string {
  const d = new Date(TODAY)
  d.setDate(d.getDate() + n)
  return iso(d)
}

export function nowStamp(): string {
  const d = new Date()
  return iso(TODAY) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}
