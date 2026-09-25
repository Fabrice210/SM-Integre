import { registerForms } from '../../forms/registry'
import { addDays, iso, TODAY } from '../../lib/dates'
import { procOpts, userNames } from '../../lib/lookups'
import { currentUser, useApp } from '../../store/useApp'

/** FORMS.ressources, formations, savoirs, communications de l'original. */
registerForms({
  ressources: {
    title: 'Demande de ressource',
    prefix: 'RS',
    label: 'besoin',
    mod: 'Ressources',
    fields: [
      { k: 'besoin', l: 'Besoin', req: 1, full: 1 },
      {
        k: 'type',
        l: 'Type',
        t: 'select',
        o: ['Humaine', 'Matérielle', 'Financière', 'Infrastructure'],
      },
      { k: 'processus', l: 'Processus', t: 'select', o: procOpts },
      { k: 'disponible', l: 'Disponible actuellement (bilan)', req: 1 },
      { k: 'montant', l: 'Montant estimé (FCFA)', t: 'number', req: 1 },
      { k: 'justification', l: 'Justification du besoin', t: 'textarea', req: 1 },
      { k: 'circuit', l: 'Circuit de validation', t: 'select', o: ['RH', 'Finance', 'Achats'] },
      { k: 'dateDemandee', l: 'Date de mise à disposition souhaitée', t: 'date', req: 1 },
    ],
    def: (s) => ({
      besoin: 'Groupe électrogène de secours 250 kVA',
      type: 'Matérielle',
      processus: 'P09',
      disponible: 'Groupe 100 kVA vieillissant',
      montant: 38000000,
      justification: "Délestages fréquents, risque d'arrêt de la pasteurisation",
      circuit: 'Finance',
      dateDemandee: addDays(75),
      dateReelle: '—',
      statut: 'Brouillon',
      demandeur: currentUser(s).nom,
    }),
  },

  formations: {
    title: 'Session de formation',
    prefix: 'FO',
    label: 'theme',
    mod: 'Compétences',
    fields: [
      { k: 'theme', l: 'Thème', req: 1, full: 1 },
      { k: 'date', l: 'Date de la session', t: 'date', req: 1 },
      { k: 'formateur', l: 'Formateur', req: 1 },
      { k: 'participants', l: 'Participants', req: 1, full: 1 },
      { k: 'statut', l: 'Statut', t: 'select', o: ['Planifiée', 'Réalisée', 'Reportée'] },
      { k: 'evaluationDate', l: 'Évaluation post-formation prévue le', t: 'date', req: 1 },
      { k: 'evaluationResponsable', l: "Responsable de l'évaluation", t: 'select', o: userNames },
      { k: 'resultat', l: "Résultat de l'évaluation (Kirkpatrick 1 à 4)", t: 'textarea', req: 1 },
      { k: 'normes', l: 'Normes', t: 'norms', req: 1 },
    ],
    def: () => ({
      theme: 'Conduite de chariot élévateur (CACES)',
      date: addDays(30),
      formateur: 'Centre de formation professionnelle de Cotonou',
      participants: 'Magasiniers de Porto-Novo et de Glo-Djigbé (8 pers.)',
      statut: 'Planifiée',
      evaluationDate: addDays(60),
      evaluationResponsable: 'Nadège ZINSOU',
      resultat: 'À évaluer : test pratique et observation au poste',
      normes: ['45001'],
    }),
  },

  savoirs: {
    title: 'Savoir critique',
    prefix: 'SC',
    label: 'savoir',
    mod: 'Compétences',
    fields: [
      {
        k: 'savoir',
        l: 'Savoir critique (liste issue de la matrice de compétences)',
        t: 'select',
        o: () => useApp.getState().db.competences.liste,
      },
      { k: 'detenteurs', l: 'Détenteurs actuels', req: 1 },
      { k: 'couverture', l: 'Couverture', req: 1 },
      { k: 'criticite', l: 'Situation', t: 'select', o: ['Critique', 'Couvert'] },
      { k: 'action', l: 'Action du plan de formation thématique', t: 'textarea', req: 1 },
    ],
    def: () => ({
      savoir: 'Étalonnage des humidimètres',
      detenteurs: 'Nadège ZINSOU',
      couverture: '1 détenteur',
      criticite: 'Critique',
      action: "Former 2 contrôleurs réception d'ici décembre",
    }),
  },

  communications: {
    title: 'Action de sensibilisation / communication',
    prefix: 'CM',
    label: 'objectif',
    mod: 'Communication',
    fields: [
      { k: 'type', l: 'Type', t: 'select', o: ['Sensibilisation', 'Communication'] },
      { k: 'objectif', l: 'Objectif', req: 1, full: 1 },
      { k: 'quiFait', l: 'Qui fait', t: 'select', o: userNames },
      { k: 'portee', l: 'Portée', t: 'select', o: ['Interne', 'Externe'] },
      {
        k: 'cible',
        l: 'Cible',
        req: 1,
        h: 'Interne ou externe — ex. fournisseurs, sous-traitants, riverains, clients (saisie libre possible)',
      },
      { k: 'moyen', l: 'Moyen', req: 1 },
      { k: 'date', l: 'Date prévue (délai)', t: 'date', req: 1 },
      { k: 'statut', l: 'Statut', t: 'select', o: ['Pas fait', 'Fait'] },
      { k: 'dateRealisation', l: 'Date de réalisation effective', t: 'date' },
      { k: 'processus', l: 'Processus associé', t: 'select', o: procOpts },
      { k: 'preuve', l: 'Preuve (photo, feuille de présence, email)', t: 'file', req: 1 },
      { k: 'normes', l: 'Normes', t: 'norms', req: 1 },
    ],
    def: () => ({
      type: 'Sensibilisation',
      objectif: "Présenter le plan d'urgence incendie",
      quiFait: 'Arnaud TCHIBOZO',
      portee: 'Interne',
      cible: 'Nouveaux embauchés de la campagne 2026',
      moyen: "Session d'accueil sécurité",
      date: addDays(14),
      statut: 'Pas fait',
      dateRealisation: '',
      processus: 'P11',
      preuve: 'Feuille_presence_accueil_securite.pdf',
      normes: ['45001', '14001'],
    }),
    save: (_s, r) => {
      if (r.statut === 'Fait' && !r.dateRealisation) {
        r.dateRealisation = iso(TODAY)
        return 'Action « Fait » — pensez à préciser la date de réalisation effective.'
      }
    },
  },
})
