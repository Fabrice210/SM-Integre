import { DIRECTIONS } from '../../data/referentiels'
import type { FormDef, Rec } from '../../forms/types'
import { iso, TODAY } from '../../lib/dates'
import { procOpts, userNames } from '../../lib/lookups'
import { hist } from '../../store/useApp'

/** Formulaires du module 2 (planStrat, axes, champsPerso, preuvesCom, postes, representants, comite, reunions). */
export const M2_FORMS: Record<string, FormDef> = {
  planStrat: {
    title: 'Plan stratégique', prefix: 'PS', label: 'titre', mod: 'Engagement',
    fields: [{ k: 'titre', l: 'Titre du document', req: 1, full: 1 }, { k: 'version', l: 'Version', req: 1 }, { k: 'dateValidation', l: 'Date de validation', t: 'date', req: 1 }, { k: 'validePar', l: 'Validé par', req: 1 }, { k: 'statut', l: 'Statut', t: 'select', o: ['En vigueur', 'Obsolète'] }, { k: 'fichier', l: 'Document (PDF ou Word)', t: 'file', req: 1 }],
    def: () => ({ titre: 'Plan stratégique 2026-2028 — révision à mi-parcours', version: 'v3', dateValidation: iso(TODAY), validePar: 'Conseil d\'administration', statut: 'En vigueur', fichier: 'Plan_strategique_ABI_2026-2028_rev1.pdf' }),
    save: (s, r, n) => {
      if (n && r.statut === 'En vigueur')
        s.db.planStrat.forEach((x) => {
          if (x !== r && x.statut === 'En vigueur') {
            x.statut = 'Obsolète'
            hist(s, x as Rec, 'Remplacé par ' + r.version)
          }
        })
    },
  },
  axes: {
    title: 'Axe stratégique', prefix: 'AX', label: 'libelle', mod: 'Engagement',
    fields: [{ k: 'code', l: 'Code', req: 1 }, { k: 'libelle', l: 'Orientation stratégique', req: 1, full: 1 }, { k: 'avancement', l: 'Avancement de la mise en œuvre (%)', t: 'number', req: 1, check: (v) => (v as number) >= 0 && (v as number) <= 100, err: 'Valeur entre 0 et 100.' }, { k: 'evaluation', l: 'Évaluation de la mise en œuvre', t: 'textarea', req: 1 }],
    def: () => ({ code: 'AX5', libelle: 'Renforcer l\'éthique et la culture qualité', avancement: 20, evaluation: 'Charte éthique adoptée, formation des managers à planifier' }),
  },
  champsPerso: {
    title: 'Champ personnalisé', prefix: 'CP', label: 'libelle', mod: 'Engagement',
    fields: [{ k: 'libelle', l: 'Libellé', req: 1 }, { k: 'type', l: 'Type', t: 'select', o: ['Document', 'Texte', 'Date', 'Nombre'] }, { k: 'valeur', l: 'Valeur ou nom du document', req: 1, full: 1 }, { k: 'commentaire', l: 'Commentaire', t: 'textarea', req: 1 }],
    def: () => ({ libelle: 'Politique de prévention du harcèlement', type: 'Document', valeur: 'Politique_prevention_harcelement.pdf', commentaire: 'En préparation avec les délégués du personnel' }),
  },
  preuvesCom: {
    title: 'Preuve de communication', prefix: 'PC', label: 'objet', mod: 'Politique SM',
    fields: [{ k: 'objet', l: 'Objet communiqué', req: 1 }, { k: 'date', l: 'Date', t: 'date', req: 1 }, { k: 'support', l: 'Support', t: 'select', o: ['Affichage', 'Réunion', 'Email', 'Intranet', 'Causerie'] }, { k: 'lieu', l: 'Lieu ou canal', req: 1 }, { k: 'personnes', l: 'Personnes touchées', t: 'number', req: 1 }, { k: 'preuve', l: 'Preuve jointe', t: 'file', req: 1 }],
    def: () => ({ objet: 'Politique SM v3', date: iso(TODAY), support: 'Causerie', lieu: 'Atelier conditionnement — équipe de nuit', personnes: 42, preuve: 'Feuille_presence_causerie_nuit.pdf' }),
  },
  postes: {
    title: 'Fiche de poste', prefix: 'FP', label: 'intitule', mod: 'Rôles',
    fields: [{ k: 'intitule', l: 'Intitulé du poste', req: 1 }, { k: 'direction', l: 'Direction ou service', t: 'select', o: DIRECTIONS }, { k: 'titulaire', l: 'Titulaire', t: 'select', o: userNames }, { k: 'processus', l: 'Processus concernés', t: 'multi', o: procOpts, req: 1 }, { k: 'mission', l: 'Mission', t: 'textarea', req: 1 }, { k: 'responsabilites', l: 'Responsabilités liées au SM', t: 'textarea', req: 1 }, { k: 'preuve', l: 'Preuve de communication de l\'évolution', t: 'file', req: 1 }],
    def: () => ({ intitule: 'Chargé(e) de la sécurité de l\'information', direction: 'Direction des Systèmes d\'Information', titulaire: 'Hervé DJOSSOU', processus: ['P10'], mission: 'Appuyer le RSSI dans la mise en œuvre du SMSI', responsabilites: 'Tenir le registre des incidents de sécurité, réaliser les tests de restauration', preuve: 'Note_de_service_NS-2026-021.pdf' }),
  },
  representants: {
    title: 'Représentant des travailleurs', prefix: 'RP', label: 'nom', mod: 'Consultation',
    fields: [{ k: 'nom', l: 'Nom', req: 1 }, { k: 'prenom', l: 'Prénom', req: 1 }, { k: 'fonction', l: 'Fonction', req: 1, full: 1 }, { k: 'mandatDebut', l: 'Début de mandat', t: 'date', req: 1 }, { k: 'mandatFin', l: 'Fin de mandat', t: 'date', req: 1 }],
    def: () => ({ nom: 'AGOSSA', prenom: 'Bénédicte', fonction: 'Opératrice pasteurisation — déléguée suppléante', mandatDebut: iso(TODAY), mandatFin: '2028-09-21' }),
  },
  comite: {
    title: 'Membre du comité hygiène et santé', prefix: 'CH', label: 'nom', mod: 'Consultation',
    fields: [{ k: 'nom', l: 'Nom', req: 1 }, { k: 'prenom', l: 'Prénom', req: 1 }, { k: 'dateNaissance', l: 'Date de naissance', t: 'date', req: 1 }, { k: 'role', l: 'Rôle au sein du comité', req: 1 }, { k: 'mandatFin', l: 'Fin de mandat', t: 'date', req: 1 }],
    def: () => ({ nom: 'SOSSA', prenom: 'Bertin', dateNaissance: '1982-04-17', role: 'Membre — représentant de la maintenance', mandatFin: '2028-06-30' }),
  },
  reunions: {
    title: 'Réunion de consultation', prefix: 'RC', label: 'objet', mod: 'Consultation',
    fields: [{ k: 'date', l: 'Date', t: 'date', req: 1 }, { k: 'objet', l: 'Objet', req: 1 }, { k: 'participants', l: 'Participants', req: 1, full: 1 }, { k: 'compteRendu', l: 'Compte rendu', t: 'textarea', req: 1 }, { k: 'planAction', l: 'Plan d\'action de suivi (action, responsable, échéance)', t: 'textarea', req: 1 }, { k: 'statutPlan', l: 'Statut du plan d\'action', t: 'select', o: ['À faire', 'En cours', 'Clôturé'] }],
    def: () => ({ date: iso(TODAY), objet: 'Consultation sur l\'aménagement de l\'aire de stockage des coques', participants: 'Comité HS, délégués, responsable maintenance', compteRendu: 'Les travailleurs demandent un éclairage renforcé et une signalétique au sol', planAction: 'Installer 6 projecteurs LED — Bertin SOSSA — 31/10/2026', statutPlan: 'À faire' }),
  },
}
