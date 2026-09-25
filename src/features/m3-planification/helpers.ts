import type { FieldDef, Rec } from '../../forms/types'
import { days } from '../../lib/dates'
import { userNames } from '../../lib/lookups'

/* ---------- 3.1 Objectifs (lignes 1451–1455 de l'original) ---------- */
export const ACT_ST = ['Mise en œuvre', 'En cours', 'Clôturé']

export function objProg(o: Rec): number {
  return o.actions.length
    ? (o.actions.filter((a: Rec) => a.statut === 'Clôturé').length / o.actions.length) * 100
    : 0
}

export function objLate(o: Rec): boolean {
  return o.actions.some((a: Rec) => a.statut !== 'Clôturé' && (days(a.echeance) as number) < 0)
}

export const ACT_F: FieldDef[] = [
  { k: 'libelle', l: 'Action', req: 1, full: 1 },
  { k: 'responsable', l: 'Responsable', t: 'select', o: userNames },
  { k: 'echeance', l: 'Échéance', t: 'date', req: 1 },
  { k: 'statut', l: 'Statut', t: 'select', o: ACT_ST },
  { k: 'pieces', l: 'Pièces jointes', t: 'file' },
  { k: 'observation', l: 'Observation', t: 'textarea', req: 1 },
]

/* ---------- 3.3 Risques et opportunités (lignes 1500–1501) ---------- */
export const RTYPES = [
  'Qualité',
  'Environnement',
  'SST',
  "Sécurité de l'information",
  "Situation d'urgence",
]

export const niv = (r: Rec): number => r.probabilite * (r.criticite || r.impact)
export const nivLbl = (s: number) =>
  s >= 12 ? 'Très élevé' : s >= 8 ? 'Élevé' : s >= 4 ? 'Moyen' : 'Faible'
