import type { Seed } from '../data/seed'
import { days, fd } from '../lib/dates'
import { competenceGaps, procOwner, taux } from './metrics'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

export interface Alert {
  lvl: 'red' | 'amber' | 'blue'
  t: string
  d: string
  /** Page à ouvrir pour traiter l'alerte. */
  page: string
  resp: string
  key: string
}

/** computeAlerts() de l'original : surveillance automatique des échéances. */
export function computeAlerts(db: Seed, dismissed: readonly string[]): Alert[] {
  const A: Alert[] = []
  const push = (lvl: Alert['lvl'], t: string, d: string, page: string, resp: string, key?: string) =>
    A.push({ lvl, t, d, page, resp, key: key || t })
  const D = db as Any

  D.objectifs.forEach((o: Any) =>
    o.actions.forEach((a: Any) => {
      const d = days(a.echeance)
      if (a.statut !== 'Clôturé' && d !== null && d < 0)
        push('red', `Action en retard — ${o.code}`, `${a.libelle} (${a.responsable}) — échéance ${fd(a.echeance)}`, 'm3-objectifs', a.responsable)
    })
  )
  D.risques.forEach((r: Any) => {
    const d = days(r.echeance)
    if (r.statutAction !== 'Clôturé' && d !== null && d < 0)
      push('red', `Traitement du risque ${r.id} en retard`, `${r.action} — ${r.responsable}`, 'm3-risques', r.responsable)
  })
  const mandats = [
    ...D.representants.map((x: Any) => ({ ...x, q: 'Représentant' })),
    ...D.comite.map((x: Any) => ({ ...x, q: 'Comité HS' })),
  ]
  mandats.forEach((m: Any) => {
    const d = days(m.mandatFin)
    if (d !== null && d >= 0 && d <= 60)
      push('amber', `Mandat arrivant à échéance (${m.q})`, `${m.prenom} ${m.nom} — fin le ${fd(m.mandatFin)} (J-${d})`, 'm2-consultation', 'Gildas HOUNKPATIN')
  })
  D.textes.forEach((t: Any) => {
    const d = days(t.echeance)
    if (t.statut === 'Pas fait' && d !== null && d <= 15)
      push(d < 0 ? 'red' : 'amber', `Texte réglementaire non conforme`, `${t.intitule.slice(0, 70)}… — ${d < 0 ? 'délai dépassé' : 'J-' + d}`, 'm3-veille', t.responsable)
  })
  D.declarations
    .filter((x: Any) => x.statut === 'Soumise')
    .forEach((x: Any) => push('blue', 'Déclaration en attente de validation du DG', x.objet, 'm3-veille', 'Rodrigue AHOUANSOU'))
  D.ressources.forEach((r: Any) => {
    const d = days(r.dateDemandee)
    if (r.statut !== 'Mise à disposition' && d !== null && d < 0)
      push('red', 'Retard de mise à disposition', `${r.besoin} — demandée pour le ${fd(r.dateDemandee)}`, 'm4-ressources', r.demandeur)
  })
  D.documents.forEach((x: Any) => {
    const d = days(x.dateRevue)
    if (x.statut !== 'Obsolète' && d !== null && d <= 30)
      push(d < 0 ? 'red' : 'amber', 'Revue documentaire proche', `${x.ref} ${x.intitule} — ${fd(x.dateRevue)}`, 'm5-ged', x.proprietaire)
  })
  D.urgences.forEach((u: Any) =>
    u.exercices.forEach((e: Any) => {
      // l'original compare days(e.date)<0 (null<0 est faux) : même résultat avec ?? 0
      if (e.statut === 'En retard' || (e.statut === 'Planifié' && (days(e.date) ?? 0) < 0))
        push('red', "Exercice d'urgence non réalisé", `${u.type} — prévu le ${fd(e.date)}`, 'm5-urgences', u.responsables.split(' (')[0])
    })
  )
  D.fichesMaitrise.forEach((f: Any) => {
    const d = days(f.prochaineMaj)
    if (d !== null && d <= 30)
      push(d < 0 ? 'red' : 'amber', 'Mise à jour de fiche de maîtrise', `${f.objet} — ${d < 0 ? 'échue depuis ' + -d + ' j' : 'J-' + d}`, 'm5-fiches', f.responsable)
  })
  D.indicateurs.forEach((k: Any) => {
    const t = taux(k)
    if (t < 80)
      push('amber', 'Écart significatif sur un indicateur', `${k.kpi} : ${k.valeur}${k.unite} pour une cible de ${k.cible}${k.unite} (taux ${t} %)`, 'm6-surveillance', k.responsable)
  })
  D.audits.forEach((a: Any) => {
    const d = days(a.date)
    if (a.statut !== 'Clôturé' && d !== null && d >= 0 && d <= 60)
      push('blue', 'Audit à venir — auditeur alerté', `${a.ref} ${a.titre} — ${fd(a.date)} (${a.auditeur})`, 'm6-audits', a.auditeur)
  })
  competenceGaps(db)
    .filter((g) => g.critique)
    .slice(0, 2)
    .forEach((g) =>
      push('amber', 'Compétence critique non couverte', `${g.comp} — ${g.nb} collaborateur(s) sous le niveau requis`, 'm4-competences', 'Gildas HOUNKPATIN')
    )
  D.ncs
    .filter((n: Any) => n.statut === 'Déclarée')
    .forEach((n: Any) => push('blue', 'Non-conformité à valider', `${n.ref} — ${n.description}`, 'm6-nc', procOwner(db, n.processus)))

  return A.filter((a) => !dismissed.includes(a.key))
}

export interface PendingValidation {
  t: string
  d: string
  page: string
  /** Fiche à ouvrir ensuite (cf. app/detailRegistry). */
  detail: { fn: string; id: string }
}

/** pendingValidations() de l'original. */
export function pendingValidations(db: Seed): PendingValidation[] {
  const L: PendingValidation[] = []
  const D = db as Any
  D.documents
    .filter((d: Any) => ['Vérification', 'Approbation'].includes(d.statut))
    .forEach((d: Any) =>
      L.push({ t: `${d.ref} — ${d.intitule}`, d: `Document en ${d.statut.toLowerCase()}`, page: 'm5-ged', detail: { fn: 'docDetail', id: d.id } })
    )
  D.declarations
    .filter((d: Any) => d.statut === 'Soumise')
    .forEach((d: Any) =>
      L.push({ t: d.objet, d: 'Déclaration à valider par le Directeur Général', page: 'm3-veille', detail: { fn: 'declDetail', id: d.id } })
    )
  D.ncs
    .filter((n: Any) => n.n1 === 'En attente' || (n.n1 === 'Validé' && n.n2 === 'En attente'))
    .forEach((n: Any) =>
      L.push({
        t: `${n.ref} — ${n.description}`,
        d: n.n1 === 'En attente' ? 'Validation par le pilote' : 'Approbation par le responsable du système',
        page: 'm6-nc',
        detail: { fn: 'ncDetail', id: n.id },
      })
    )
  D.ressources
    .filter((r: Any) => r.statut === 'Soumise')
    .forEach((r: Any) =>
      L.push({ t: r.besoin, d: `Demande de ressource — circuit ${r.circuit}`, page: 'm4-ressources', detail: { fn: 'resDetail', id: r.id } })
    )
  return L
}
