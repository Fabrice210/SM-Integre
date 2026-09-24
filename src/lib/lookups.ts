import { useApp } from '../store/useApp'

/**
 * Helpers de libellés et d'options (lignes 796–802 de l'original).
 * Ils lisent l'état courant : utilisables dans le rendu, les options de
 * formulaire (FieldDef.o) et les actions.
 */
const db = () => useApp.getState().db

/** « P01 · Management stratégique » */
export function procName(id: string | null | undefined): string {
  const p = db().processus.find((x) => x.id === id)
  return p ? p.code + ' · ' + p.intitule : id || '—'
}

/** « Management stratégique » */
export function procShort(id: string | null | undefined): string {
  const p = db().processus.find((x) => x.id === id)
  return p ? p.intitule : id || '—'
}

/** « AX1 — libellé » */
export function axeName(id: string): string {
  const a = db().axes.find((x) => x.id === id)
  return a ? a.code + ' — ' + a.libelle : id
}

export const userNames = () => useApp.getState().users.map((u) => u.nom)
export const procOpts = () => db().processus.map((p) => [p.id, p.code + ' · ' + p.intitule] as [string, string])
export const siteOpts = () => db().sites.map((s) => s.nom)
export const riskOpts = () => db().risques.map((r) => [r.id, r.id + ' · ' + r.intitule] as [string, string])
