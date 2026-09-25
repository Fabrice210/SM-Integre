import type { Seed } from './seed'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

/** Nouvelle collection de la v2 (rapports de conformité réglementaire). */
const RAPPORTS_CONF = [
  {
    id: 'RC1',
    ref: 'RC-2026-001',
    texte: 'TX1',
    titre: 'Rapport de conformité — Code du travail',
    statut: 'Conforme',
    date: '2026-06-15',
    auteur: 'Gildas HOUNKPATIN',
    synthese:
      'Registre des accidents tenu, visites médicales réalisées, affichage réglementaire en place.',
    pieces: 'Rapport_conformite_code_travail.pdf',
  },
  {
    id: 'RC2',
    ref: 'RC-2026-002',
    texte: 'TX3',
    titre: 'Rapport de conformité — Code du numérique',
    statut: 'Non conforme',
    date: '2026-09-01',
    auteur: 'Cédric AGBODJAN',
    synthese:
      "Déclaration des traitements de données RH non effectuée auprès de l'APDP ; dossier en cours de constitution.",
    pieces: 'Audit_conformite_donnees_2026.pdf',
  },
]

/** Nouvelle collection de la v2 : applicabilité normative (section 1.3), ligne 1469. */
const APPLICABILITE = [
  {
    id: 'AP1',
    norme: '9001',
    article: '8.3 Conception et développement',
    exclu: 'Oui',
    justification: 'Formulations fournies par les clients ; aucune activité de conception interne',
    commentaire: 'Exclusion confirmée en revue de direction',
  },
  {
    id: 'AP2',
    norme: '27001',
    article: 'A.14.2 Développement sécurisé',
    exclu: 'Oui',
    justification: 'Aucun développement logiciel réalisé en interne',
    commentaire: "Mesure exclue et justifiée dans la Déclaration d'applicabilité (SoA)",
  },
  {
    id: 'AP3',
    norme: '14001',
    article: 'Toutes exigences applicables',
    exclu: 'Non',
    justification: 'Aspects environnementaux significatifs identifiés sur les sites de production',
    commentaire: '',
  },
  {
    id: 'AP4',
    norme: '45001',
    article: 'Toutes exigences applicables',
    exclu: 'Non',
    justification: "Périmètre SST couvrant l'ensemble des travailleurs",
    commentaire: '',
  },
]

export type DemoData = Seed & {
  rapportsConf: typeof RAPPORTS_CONF
  applicabilite: typeof APPLICABILITE
  /** Créée à la volée par submitDiffusion (DB.diffusions = DB.diffusions || []). */
  diffusions?: Record<string, unknown>[]
}

/**
 * Compléments de données que l'original v2 applique au chargement, après la
 * déclaration de DB (lignes 1461, 1469, 1484, 1552, 1555, 1603–1607, 1658, 1679, 1693, 1695 et 1788). Logique
 * reprise telle quelle ; appliquée une fois, à la création des données de démo.
 */
export function migrateDemo(seed: Seed): DemoData {
  const DB = seed as Any

  DB.sites.forEach((x: Any) => {
    if (!x.monnaie) x.monnaie = 'FCFA (XOF)'
  })

  DB.applicabilite = structuredClone(APPLICABILITE)

  DB.processus.forEach((p: Any) => {
    if (!p.copilote)
      p.copilote =
        (
          {
            P01: ['Florence DOSSOU-YOVO'],
            P04: ['Nadège ZINSOU'],
            P05: ['Prisca ASSOGBA'],
            P10: ['Hervé DJOSSOU'],
            P11: ['Bertin SOSSA'],
          } as Record<string, string[]>
        )[p.id] || []
  })

  DB.representants.forEach((r: Any) => {
    if (r.statut === undefined) r.statut = 'Actif'
    if (r.suppleant === undefined) r.suppleant = ''
    if (!r.qualiteLien) r.qualiteLien = /suppl/i.test(r.fonction) ? 'Suppléant' : 'Titulaire'
  })

  DB.reunions.forEach((m: Any) => {
    if (!m.datePrevue) m.datePrevue = m.date
    if (!m.statut) m.statut = 'Réalisée'
    if (!m.ordreDuJour) m.ordreDuJour = m.objet
    if (
      !['Comité HS (CHSS)', 'Délégués du personnel', 'Tout le personnel'].includes(m.participants)
    )
      m.participants = 'Comité HS (CHSS)'
    if (!m.preuve1) m.preuve1 = 'PV_' + m.id + '.pdf'
    if (!m.preuve2) m.preuve2 = 'Feuille_presence_' + m.id + '.pdf'
  })

  DB.textes.forEach((t: Any) => {
    if (!t.categorie) {
      const s = (t.intitule || '').toLowerCase()
      t.categorie = s.startsWith('loi')
        ? 'Loi'
        : s.startsWith('décret') || s.startsWith('decret')
          ? 'Décret'
          : s.startsWith('arrêté') || s.startsWith('arrete')
            ? 'Arrêté'
            : s.includes('convention')
              ? 'Convention'
              : 'Autre'
    }
    if (['TX1', 'TX2', 'TX4', 'TX6'].includes(t.id) && !t.diffuse) {
      t.diffuse = true
      t.statutDiff = 'Diffusé'
      t.destinataireDiff = 'Tous les intéressés du processus concerné'
    }
  })

  DB.rapportsConf = DB.rapportsConf || structuredClone(RAPPORTS_CONF)

  DB.formations.forEach((f: Any) => {
    if (!f.evaluationResponsable) f.evaluationResponsable = 'Nadège ZINSOU'
  })

  DB.communications.forEach((c: Any) => {
    if (!c.type)
      c.type = /sensibilis|caus|gants|hameç|phish|tri des/i.test(
        (c.objectif || '') + ' ' + (c.moyen || '')
      )
        ? 'Sensibilisation'
        : 'Communication'
    if (!c.portee)
      c.portee = /riverain|fournisseur|sous-traitant|client|externe/i.test(c.cible || '')
        ? 'Externe'
        : 'Interne'
    if (c.dateRealisation === undefined) c.dateRealisation = c.statut === 'Fait' ? c.date : ''
  })

  DB.documents.forEach((d: Any) => {
    if (!d.dateVersion) d.dateVersion = (d.versions && d.versions.at(-1).date) || d.dateCreation
    if (!d.redacteur) d.redacteur = (d.versions && d.versions.at(-1).auteur) || d.proprietaire
    if (!d.approbateur) d.approbateur = 'Florence DOSSOU-YOVO'
  })

  DB.modeles.forEach((m: Any, i: number) => {
    if (!m.processus) m.processus = ['Tous', 'P05', 'P04', 'P11'][i] || 'Tous'
  })

  DB.revues.forEach((r: Any) => {
    if (!r.participants) r.participants = 'Direction, pilotes de processus, responsable SM'
  })

  return DB as DemoData
}
