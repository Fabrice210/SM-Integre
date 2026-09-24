import type { Seed } from '../../data/seed'
import { days } from '../../lib/dates'
import { useApp } from '../../store/useApp'

export interface Upcoming {
  t: string
  d: string
  m: string
  r: string
}

/** upcoming() de l'original : échéances des 30 prochains jours. */
export function upcoming(db: Seed): Upcoming[] {
  const L: Upcoming[] = []
  const add = (t: string, d: string, m: string, r: string) => {
    const x = days(d)
    if (x !== null && x >= 0 && x <= 30) L.push({ t, d, m, r })
  }
  db.objectifs.forEach((o) =>
    o.actions.forEach(
      (a) =>
        a.statut !== 'Clôturé' &&
        add(a.libelle, a.echeance, "Plan d'action " + o.code, a.responsable)
    )
  )
  db.audits.forEach((a) => add(a.titre, a.date, 'Audit ' + a.ref, a.auditeur))
  db.textes.forEach((t) =>
    add(
      'Évaluation : ' + t.intitule.slice(0, 50) + '…',
      t.echeance,
      'Veille réglementaire',
      t.responsable
    )
  )
  db.urgences.forEach((u) =>
    u.exercices.forEach((e) =>
      add('Exercice : ' + u.type, e.date, "Situations d'urgence", u.responsables.split(' (')[0])
    )
  )
  db.plansOps.forEach(
    (p) =>
      p.statut !== 'Fait' && add(p.plan, p.echeance, 'Planification opérationnelle', p.responsable)
  )
  db.formations.forEach(
    (f) =>
      f.statut === 'Planifiée' && add('Formation : ' + f.theme, f.date, 'Compétences', f.formateur)
  )
  db.fichesMaitrise.forEach((f) =>
    add('Mise à jour : ' + f.objet, f.prochaineMaj, 'Fiche de maîtrise', f.responsable)
  )
  db.documents.forEach(
    (d) => d.statut !== 'Obsolète' && add('Revue ' + d.ref, d.dateRevue, 'GED', d.proprietaire)
  )
  return L.sort((a, b) => new Date(a.d).getTime() - new Date(b.d).getTime())
}

/** Les entrées du journal n'ont pas d'id : clé de ligne dérivée de la position. */
export const withId = <T extends object>(x: T, i: number) => ({ id: 'J' + i, ...x })

/** Modules présents dans le journal (options du filtre « Module »). */
export const journalMods = () => [...new Set(useApp.getState().db.journal.map((j) => j.mod))]
