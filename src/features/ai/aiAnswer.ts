import { NORMS, type NormId } from '../../data/referentiels'
import { days, fd } from '../../lib/dates'
import { competenceGaps } from '../../services/metrics'
import type { AppState } from '../../store/types'
import { coverage, openActions } from '../../services/metrics'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

/** Suggestions contextuelles par module ou page (AI_CTX de l'original). */
export const AI_CTX: Record<string, string[]> = {
  dashboard: [
    'Quelles sont les 3 priorités avant le prochain audit ?',
    'Résume la situation de la conformité réglementaire',
    'Quelle norme présente la plus faible couverture ?',
  ],
  m1: [
    'Suggère des enjeux non couverts pour notre secteur',
    "Quelles parties intéressées critiques n'ont pas de plan mis en œuvre ?",
    'Propose des indicateurs pour le processus Maintenance',
  ],
  m2: [
    'Rédige une trame de politique conforme aux normes actives',
    "Quels collaborateurs n'ont pas accusé lecture de la politique ?",
    'Quels mandats arrivent à échéance ?',
  ],
  m3: [
    'Suggère des risques SST non identifiés pour la Maintenance',
    'Quels textes réglementaires ne sont pas conformes ?',
    'Quelles actions sont en retard ?',
  ],
  m4: [
    "Quelle est notre dernière preuve de formation sécurité pour l'équipe IT ?",
    'Quelles compétences critiques ne sont pas couvertes ?',
    'Génère un support de sensibilisation au tri des déchets',
  ],
  m5: [
    "Propose une trame de procédure conforme à l'article 7.5",
    'Quels documents sont en attente de validation ?',
    "Quels exercices d'urgence sont en retard ?",
  ],
  m6: [
    'Résume les 3 derniers audits du processus',
    'Génère un projet de PV de revue de direction',
    'Détecte les non-conformités récurrentes',
  ],
  other: [
    "Quelles exigences n'ont pas de preuve suffisante ?",
    'Qui a validé la politique SM ?',
    'Quelles actions sont en retard ?',
  ],
}

/** aiAnswer(q) de l'original : réponse calculée à partir des données (q en minuscules). */
export function aiAnswer(q: string, s: AppState): string {
  const DB = s.db as Any
  const activeN = s.activeNorms
  if (q.includes('retard') && q.includes('exercice')) {
    const L: string[] = []
    DB.urgences.forEach((u: Any) =>
      u.exercices
        .filter((e: Any) => e.statut === 'En retard')
        .forEach((e: Any) => L.push(`• ${u.type} — prévu le ${fd(e.date)}`))
    )
    return 'Exercices non réalisés dans les délais :\n' + L.join('\n')
  }
  if (q.includes('retard')) {
    const L = openActions(s.db, s.ui.norm).filter((a) => (days(a.echeance) ?? 0) < 0)
    return (
      `${L.length} action(s) en retard :\n` +
      L.map((a) => `• ${a.libelle} — ${a.responsable} (échéance ${fd(a.echeance)})`).join('\n') +
      '\n\nJe peux préparer une relance groupée ; elle sera envoyée après votre confirmation.'
    )
  }
  if (q.includes('formation') && (q.includes('it') || q.includes('sécurité'))) {
    const f = DB.formations.find((x: Any) => x.id === 'FO2')
    return `Dernière preuve : « ${f.theme} » réalisée le ${fd(f.date)} par ${f.formateur} pour ${f.participants}. Évaluation du ${fd(f.evaluationDate)} : ${f.resultat}.`
  }
  if (q.includes('audit') && (q.includes('résume') || q.includes('3')))
    return (
      'Synthèse des 3 derniers audits :\n' +
      DB.audits
        .filter((a: Any) => a.constats.length)
        .slice(-3)
        .map(
          (a: Any) =>
            `• ${a.ref} (${fd(a.date)}) — ${a.constats.map((c: Any) => c.type + ' : ' + c.description).join(' ; ')}`
        )
        .join('\n') +
      '\n\nTendance : la maîtrise des équipements et des sauvegardes revient dans 2 audits sur 3.'
    )
  if (q.includes('pv') || q.includes('revue'))
    return (
      'Projet de PV (à valider) :\n1. Couverture normative globale : ' +
      coverage(s.db, activeN, 'all') +
      ' %.\n2. ' +
      DB.ncs.filter((n: Any) => n.statut !== 'Clôturée').length +
      ' NC ouvertes, dont 1 majeure (carters).\n3. Conformité réglementaire : 2 textes non conformes (Code du numérique, déchets).\n4. Indicateurs sous la cible : TF1 (11,2 pour 8), valorisation des coques (60 % pour 85 %).\nDécisions proposées : prioriser le test de restauration ERP et la déclaration APDP.'
    )
  if (q.includes('risque'))
    return "Risques SST suggérés pour le processus Maintenance (par comparaison sectorielle) :\n• Électrisation lors d'interventions sur armoires non consignées\n• Chute de hauteur lors de l'entretien des silos\n• Exposition au bruit des décortiqueuses (> 85 dB)\nAucun risque n'est créé sans votre validation."
  if (q.includes('texte') || q.includes('réglementaire') || q.includes('conformité')) {
    const L = DB.textes.filter((t: Any) => t.statut !== 'Fait')
    return (
      `${L.length} texte(s) non conforme(s) :\n` +
      L.map((t: Any) => `• ${t.intitule} — ${t.justificatif}`).join('\n')
    )
  }
  if (q.includes('compétence'))
    return (
      'Compétences critiques insuffisamment couvertes :\n' +
      competenceGaps(s.db)
        .filter((g) => g.critique)
        .map((g) => `• ${g.comp} : ${g.couverts} collaborateur(s) au niveau requis`)
        .join('\n') +
      '\nPlan suggéré : programmer la formation « Audit interne ISO » et la conduite de chariot en priorité.'
    )
  if (q.includes('mandat'))
    return 'Mandats arrivant à échéance : Jules HOUESSOU et Estelle KPADONOU (délégués titulaires) le 15 oct. 2026. Pensez à organiser les élections.'
  if (q.includes('accus') || q.includes('lecture'))
    return (
      'Accusés de lecture manquants pour la politique SM v3 : ' +
      DB.accuses
        .filter((a: Any) => a.statut === 'Non lu')
        .map((a: Any) => a.collaborateur)
        .join(', ') +
      '.'
    )
  if (q.includes('document') || q.includes('validation'))
    return (
      'Documents en cours de circuit :\n' +
      DB.documents
        .filter((d: Any) => ['Rédaction', 'Vérification', 'Approbation'].includes(d.statut))
        .map((d: Any) => `• ${d.ref} ${d.intitule} — étape ${d.statut}`)
        .join('\n')
    )
  if (q.includes('procédure') || q.includes('7.5') || q.includes('trame'))
    return "Trame proposée (ISO 9001 §7.5, commune aux normes actives) :\n1. Objet et domaine d'application\n2. Références normatives et réglementaires\n3. Responsabilités (RACI)\n4. Logigramme et description des étapes\n5. Enregistrements et durée de conservation\n6. Indicateurs de suivi\n7. Historique des versions"
  if (q.includes('politique'))
    return `La politique SM ${DB.politique.version} a été signée par ${DB.politique.signataire} et publiée le ${fd(DB.politique.date)}.`
  if (q.includes('preuve') || q.includes('couverture') || q.includes('faible')) {
    const L = DB.mapping
      .filter((m: Any) => activeN.includes(m.norme))
      .sort((a: Any, b: Any) => a.couverture - b.couverture)
      .slice(0, 4)
    return (
      'Exigences les moins démontrées :\n' +
      L.map(
        (m: Any) =>
          `• ${NORMS[m.norme as NormId].code} §${m.article} ${m.libelle} — ${m.couverture} %`
      ).join('\n')
    )
  }
  if (q.includes('partie'))
    return (
      'Parties intéressées critiques avec plan non mis en œuvre : ' +
      DB.parties
        .filter((p: Any) => !p.planMisEnOeuvre)
        .map((p: Any) => p.nom)
        .join(', ') +
      '.'
    )
  if (q.includes('enjeu'))
    return "Enjeux suggérés non couverts : dépendance énergétique au réseau SBEE, disponibilité de main-d'œuvre qualifiée en saison, exigences des acheteurs européens sur le devoir de vigilance."
  if (q.includes('indicateur'))
    return 'Indicateurs suggérés pour la Maintenance : taux de disponibilité des lignes, MTBF des décortiqueuses, part de maintenance préventive, coût des pannes.'
  if (q.includes('récurrent') || q.includes('tendance'))
    return 'Récurrence détectée : 3 écarts liés aux protections machines (P05) en 6 mois. Suggestion : analyse Ishikawa sur la maîtrise des équipements.'
  if (q.includes('priorit'))
    return "Priorités avant l'audit AUD-2026-04 (14 oct.) :\n1. Compléter les bordereaux de déchets (NC-2026-015)\n2. Réaliser l'exercice « déversement chimique » en retard\n3. Mettre à jour la fiche de maîtrise « produits chimiques » échue"
  if (q.includes('support') || q.includes('sensibilisation'))
    return "Support proposé « Trier, c'est valoriser » : 1 affiche A3 bilingue français/fongbé, 3 pictogrammes (coques, plastiques, déchets dangereux), 1 quiz de 5 questions pour la causerie. À valider avant diffusion."
  return "Je n'ai pas trouvé d'élément précis pour cette question dans vos données. Reformulez en citant un module, un processus ou une norme."
}
