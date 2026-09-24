import { registerForms } from '../../forms/registry'
import { addDays, fd, iso, TODAY } from '../../lib/dates'
import { procOpts, userNames } from '../../lib/lookups'
import { currentUser, logAct, useApp } from '../../store/useApp'
import { ACT_ST, RTYPES } from './helpers'

/** FORMS.objectifs, textes, declarations, risques, opportunites de l'original. */
registerForms({
  objectifs: {
    title: 'Objectif',
    prefix: 'OB',
    label: 'libelle',
    mod: 'Objectifs',
    wide: true,
    fields: [
      { k: 'code', l: 'Code', req: 1 },
      {
        k: 'axe',
        l: 'Orientation stratégique (Module 2)',
        t: 'select',
        o: () =>
          useApp
            .getState()
            .db.axes.map((a) => [a.id, a.code + ' — ' + a.libelle] as [string, string]),
      },
      { k: 'libelle', l: 'Objectif', req: 1, full: 1 },
      { k: 'kpi', l: 'Indicateur (KPI)', req: 1 },
      { k: 'cible', l: 'Cible', req: 1 },
      { k: 'delai', l: 'Délai', t: 'date', req: 1 },
      {
        k: 'efficacite',
        l: "Évaluation de l'efficacité",
        t: 'select',
        o: [
          'Non évaluée',
          "En cours d'évaluation",
          'Partiellement efficace',
          'Efficace',
          'Non efficace',
        ],
      },
      { k: 'processus', l: 'Processus concernés', t: 'multi', o: procOpts, req: 1 },
      { k: 'normes', l: 'Normes', t: 'norms', req: 1 },
    ],
    def: () => ({
      code: 'OB-05',
      axe: 'AX3',
      libelle: "Réduire de 15 % la consommation d'eau par tonne produite",
      kpi: "m³ d'eau par tonne de produit fini",
      cible: '-15 % vs 2025',
      delai: '2027-06-30',
      efficacite: 'Non évaluée',
      processus: ['P05', 'P09'],
      normes: ['14001'],
      actions: [],
    }),
    save: (_s, r, n) => {
      if (n) r.actions = r.actions || []
    },
  },

  textes: {
    title: 'Texte réglementaire',
    prefix: 'TX',
    label: 'intitule',
    mod: 'Veille',
    fields: [
      { k: 'intitule', l: 'Intitulé du texte', req: 1, full: 1 },
      {
        k: 'domaine',
        l: 'Domaine',
        t: 'select',
        o: [
          'Santé et sécurité au travail',
          'Environnement',
          'Déchets',
          'Protection des données',
          'Social',
          'Qualité et consommation',
          'Fiscal',
        ],
      },
      { k: 'datePublication', l: 'Date de publication', t: 'date', req: 1 },
      { k: 'lien', l: 'Lien source', req: 1 },
      { k: 'statut', l: 'Statut de conformité', t: 'select', o: ['Fait', 'Pas fait'] },
      { k: 'justificatif', l: 'Justificatif du statut', t: 'textarea', req: 1 },
      {
        k: 'pieces',
        l: "Pièces justificatives (preuves d'audit de conformité)",
        t: 'file',
        req: 1,
      },
      { k: 'echeance', l: 'Prochaine évaluation', t: 'date', req: 1 },
      { k: 'responsable', l: 'Responsable', t: 'select', o: userNames },
      { k: 'normes', l: 'Normes', t: 'norms', req: 1 },
    ],
    def: () => ({
      intitule: 'Arrêté interministériel fixant les normes de rejet des eaux usées industrielles',
      domaine: 'Environnement',
      datePublication: '2021-06-15',
      lien: 'https://sgg.gouv.bj',
      statut: 'Pas fait',
      justificatif: "Analyse des rejets de la station d'épuration à programmer",
      pieces: 'Devis_laboratoire_analyses.pdf',
      echeance: addDays(45),
      responsable: 'Arnaud TCHIBOZO',
      normes: ['14001'],
    }),
  },

  declarations: {
    title: 'Déclaration de non-conformité réglementaire',
    prefix: 'DC',
    label: 'objet',
    mod: 'Veille',
    fields: [
      {
        k: 'texte',
        l: 'Texte concerné',
        t: 'select',
        o: () =>
          useApp
            .getState()
            .db.textes.map((t) => [t.id, t.intitule.slice(0, 80)] as [string, string]),
      },
      { k: 'objet', l: 'Objet', req: 1, full: 1 },
      { k: 'cause', l: 'Cause', t: 'textarea', req: 1 },
      { k: 'impact', l: 'Impact', t: 'textarea', req: 1 },
      { k: 'planAction', l: "Plan d'action", t: 'textarea', req: 1 },
    ],
    def: (s) => ({
      texte: 'TX3',
      objet: 'Registre des traitements de données incomplet',
      cause: 'Nouveaux traitements (vidéosurveillance) non recensés',
      impact: 'Non-respect du Code du numérique',
      planAction: 'Mettre à jour le registre et informer le personnel',
      statut: 'Brouillon',
      auteur: currentUser(s).nom,
      date: iso(TODAY),
      commentaireDG: 'Non soumise',
    }),
  },

  risques: {
    title: 'Fiche risque',
    prefix: 'R',
    label: 'intitule',
    mod: 'Risques',
    wide: true,
    fields: [
      { k: 'intitule', l: 'Intitulé du risque', req: 1, full: 1 },
      { k: 'type', l: 'Type de risque', t: 'select', o: RTYPES },
      { k: 'normes', l: 'Normes', t: 'norms', req: 1 },
      { k: 'cause', l: 'Cause', t: 'textarea', req: 1 },
      { k: 'consequences', l: 'Conséquences', t: 'textarea', req: 1 },
      { k: 'probabilite', l: 'Probabilité (1 rare à 4 fréquent)', t: 'scale', max: 4 },
      { k: 'criticite', l: 'Criticité (1 mineure à 4 grave)', t: 'scale', max: 4 },
      {
        k: 'traitement',
        l: 'Moyen de traitement',
        t: 'select',
        o: ['Éviter', 'Réduire', 'Transférer', 'Accepter'],
      },
      { k: 'processus', l: 'Processus associés', t: 'multi', o: procOpts, req: 1 },
      { k: 'action', l: 'Action de traitement générée', req: 1, full: 1 },
      { k: 'responsable', l: 'Responsable', t: 'select', o: userNames },
      { k: 'echeance', l: 'Échéance (ajoutée au planning)', t: 'date', req: 1 },
      { k: 'statutAction', l: "Statut de l'action", t: 'select', o: ACT_ST },
      {
        k: 'efficacite',
        l: 'Efficacité',
        t: 'select',
        o: ['À évaluer', 'Efficace', 'Partiellement efficace', 'Non efficace'],
      },
    ],
    def: () => ({
      intitule: "Électrisation lors d'interventions sur les armoires électriques",
      type: 'SST',
      normes: ['45001'],
      cause: 'Consignation non systématique',
      consequences: 'Brûlures graves, décès',
      probabilite: 2,
      criticite: 4,
      traitement: 'Réduire',
      processus: ['P09'],
      action: 'Former aux habilitations électriques et imposer la consignation',
      responsable: 'Bertin SOSSA',
      echeance: addDays(45),
      statutAction: 'Mise en œuvre',
      efficacite: 'À évaluer',
      realise: false,
    }),
    save: (s, r, n) => {
      if (n) {
        r.id = 'R' + String(s.db.risques.length).padStart(2, '0')
        logAct(
          s,
          "a généré l'action « " + r.action + ' » avec alerte de suivi au ' + fd(r.echeance),
          'Risques',
          'En cours'
        )
        return 'Risque enregistré — action ajoutée au planning avec alerte de suivi.'
      }
    },
  },

  opportunites: {
    title: 'Fiche opportunité',
    prefix: 'O',
    label: 'intitule',
    mod: 'Opportunités',
    wide: true,
    fields: [
      { k: 'intitule', l: "Intitulé de l'opportunité", req: 1, full: 1 },
      { k: 'type', l: "Type d'opportunité", t: 'select', o: RTYPES.slice(0, 4) },
      { k: 'normes', l: 'Normes', t: 'norms', req: 1 },
      { k: 'origine', l: 'Origine', req: 1 },
      { k: 'benefices', l: 'Bénéfices attendus', t: 'textarea', req: 1 },
      { k: 'probabilite', l: 'Probabilité de réalisation (1 à 4)', t: 'scale', max: 4 },
      { k: 'impact', l: "Niveau d'impact (1 à 4)", t: 'scale', max: 4 },
      { k: 'exploitation', l: "Moyen d'exploitation ou de valorisation", req: 1, full: 1 },
      { k: 'processus', l: 'Processus associés', t: 'multi', o: procOpts, req: 1 },
      { k: 'action', l: 'Action générée', req: 1, full: 1 },
      { k: 'responsable', l: 'Responsable', t: 'select', o: userNames },
      { k: 'echeance', l: 'Échéance', t: 'date', req: 1 },
      { k: 'statutAction', l: "Statut de l'action", t: 'select', o: ACT_ST },
      {
        k: 'efficacite',
        l: 'Efficacité',
        t: 'select',
        o: ['À évaluer', 'Efficace', 'Partiellement efficace', 'Non efficace'],
      },
    ],
    def: () => ({
      intitule: "Panneaux solaires sur la toiture de l'entrepôt",
      type: 'Environnement',
      normes: ['14001'],
      origine: "Programme national d'électrification solaire",
      benefices: 'Réduction de 20 % de la facture électrique',
      probabilite: 3,
      impact: 3,
      exploitation: "Solliciter une subvention et lancer un appel d'offres",
      processus: ['P09'],
      action: 'Étude de dimensionnement',
      responsable: 'Bertin SOSSA',
      echeance: addDays(90),
      statutAction: 'Mise en œuvre',
      efficacite: 'À évaluer',
    }),
    save: (s, r, n) => {
      if (n) r.id = 'O' + String(s.db.opportunites.length).padStart(2, '0')
    },
  },
})
