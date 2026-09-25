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
    synthese: 'Registre des accidents tenu, visites médicales réalisées, affichage réglementaire en place.',
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
    synthese: "Déclaration des traitements de données RH non effectuée auprès de l'APDP ; dossier en cours de constitution.",
    pieces: 'Audit_conformite_donnees_2026.pdf',
  },
]

export type DemoData = Seed & { rapportsConf: typeof RAPPORTS_CONF }

/**
 * Compléments de données que l'original v2 applique au chargement, après la
 * déclaration de DB (lignes 1603–1607, 1658, 1679, 1693 et 1695). Logique
 * reprise telle quelle ; appliquée une fois, à la création des données de démo.
 */
export function migrateDemo(seed: Seed): DemoData {
  const DB = seed as Any

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
      c.type = /sensibilis|caus|gants|hameç|phish|tri des/i.test((c.objectif || '') + ' ' + (c.moyen || ''))
        ? 'Sensibilisation'
        : 'Communication'
    if (!c.portee) c.portee = /riverain|fournisseur|sous-traitant|client|externe/i.test(c.cible || '') ? 'Externe' : 'Interne'
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

  return DB as DemoData
}
