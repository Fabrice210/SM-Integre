import type { FormDef } from '../../forms/types'
import { iso, TODAY } from '../../lib/dates'
import { siteOpts, userNames } from '../../lib/lookups'
import { useApp } from '../../store/useApp'

/** Formulaires du module 1 (FORMS.swot, pestel, enjeux, parties, sites, activites, processus). */
export const M1_FORMS: Record<string, FormDef> = {
  swot: {
    title: 'Facteur interne (SWOT)',
    prefix: 'SW',
    label: 'libelle',
    mod: 'Enjeux',
    fields: [
      { k: 'type', l: 'Type de facteur', t: 'select', o: ['Force', 'Faiblesse'] },
      { k: 'libelle', l: 'Libellé', req: 1 },
      { k: 'description', l: 'Description', t: 'textarea', req: 1 },
      { k: 'impact', l: 'Impact sur le SM (1 faible à 5 fort)', t: 'scale' },
      { k: 'normes', l: 'Normes concernées', t: 'norms', req: 1 },
    ],
    def: () => ({
      type: 'Faiblesse',
      libelle: 'Rotation élevée des saisonniers',
      description: 'Perte de savoir-faire à chaque campagne de cajou',
      impact: 3,
      normes: ['9001', '45001'],
    }),
  },
  pestel: {
    title: 'Facteur externe (PESTEL)',
    prefix: 'PE',
    label: 'facteur',
    mod: 'Enjeux',
    fields: [
      {
        k: 'dimension',
        l: 'Dimension PESTEL',
        t: 'select',
        o: [
          'Politique',
          'Économique',
          'Socioculturel',
          'Technologique',
          'Environnemental',
          'Légal',
        ],
      },
      { k: 'qualification', l: 'Qualification', t: 'select', o: ['Positif', 'Négatif'] },
      { k: 'facteur', l: 'Facteur', req: 1, full: 1 },
      { k: 'impact', l: 'Impact (1 à 5)', t: 'scale' },
      { k: 'normes', l: 'Normes concernées', t: 'norms', req: 1 },
    ],
    def: () => ({
      dimension: 'Économique',
      qualification: 'Négatif',
      facteur: 'Hausse du prix du gasoil pour les groupes électrogènes',
      impact: 3,
      normes: ['14001', '9001'],
    }),
  },
  enjeux: {
    title: 'Enjeu',
    prefix: 'EN',
    label: 'libelle',
    mod: 'Enjeux',
    fields: [
      { k: 'libelle', l: "Libellé de l'enjeu", req: 1, full: 1 },
      { k: 'source', l: 'Source', t: 'select', o: ['Interne (SWOT)', 'Externe (PESTEL)'] },
      { k: 'qualification', l: 'Qualification', t: 'select', o: ['Positif', 'Négatif'] },
      { k: 'axes', l: 'Axes de la politique associés', t: 'multi', o: () => axeOpts(), req: 1 },
      { k: 'normes', l: 'Normes', t: 'norms', req: 1 },
      { k: 'date', l: "Date d'identification", t: 'date', req: 1 },
      { k: 'statut', l: 'Statut', t: 'select', o: ['Actif', 'Obsolète'] },
    ],
    def: () => ({
      libelle: "Maintenir la continuité électrique de l'usine",
      source: 'Externe (PESTEL)',
      qualification: 'Négatif',
      axes: ['AX1', 'AX3'],
      normes: ['9001', '14001'],
      date: iso(TODAY),
      statut: 'Actif',
    }),
  },
  parties: {
    title: 'Partie intéressée',
    prefix: 'PI',
    label: 'nom',
    mod: 'Parties intéressées',
    fields: [
      { k: 'nom', l: 'Nom de la partie intéressée', req: 1 },
      { k: 'categorie', l: 'Catégorie', t: 'select', o: ['Interne', 'Externe'] },
      { k: 'normes', l: 'Normes associées', t: 'norms', req: 1 },
      { k: 'exigences', l: 'Exigences et attentes', t: 'textarea', req: 1 },
      { k: 'pouvoir', l: 'Pouvoir (1 à 5)', t: 'scale' },
      { k: 'legitimite', l: 'Légitimité (1 à 5)', t: 'scale' },
      { k: 'urgence', l: 'Urgence (1 à 5)', t: 'scale' },
      { k: 'plan', l: "Plan d'engagement", t: 'textarea', req: 1 },
      {
        k: 'planMisEnOeuvre',
        l: "Plan d'engagement mis en œuvre",
        t: 'toggle',
        lbl: 'Oui, le plan est mis en œuvre',
      },
    ],
    def: () => ({
      nom: "Inspection du travail de l'Atlantique",
      categorie: 'Externe',
      normes: ['45001'],
      exigences: "Respect des règles d'hygiène et de sécurité, tenue des registres obligatoires",
      pouvoir: 5,
      legitimite: 5,
      urgence: 3,
      plan: 'Préparer un dossier réglementaire à jour, rencontre annuelle',
      planMisEnOeuvre: false,
    }),
  },
  sites: {
    title: 'Site',
    prefix: 'S',
    label: 'nom',
    mod: "Domaine d'application",
    fields: [
      { k: 'nom', l: 'Nom du site', req: 1 },
      { k: 'adresse', l: 'Adresse', req: 1 },
      { k: 'activite', l: 'Activité principale', req: 1 },
      { k: 'statut', l: 'Statut', t: 'select', o: ['Inclus', 'Exclu'] },
      {
        k: 'justification',
        l: "Justification (obligatoire en cas d'exclusion)",
        t: 'textarea',
        req: 1,
        check: (v) => String(v).length >= 10,
      },
    ],
    def: () => ({
      nom: 'Agence commerciale de Lomé',
      adresse: 'Boulevard du 13 Janvier, Lomé (Togo)',
      activite: 'Représentation commerciale',
      statut: 'Exclu',
      justification:
        "Bureau de représentation sans activité opérationnelle ; aucune exigence client ne s'y applique.",
    }),
  },
  activites: {
    title: 'Activité, processus, produit ou service',
    prefix: 'AC',
    label: 'libelle',
    mod: "Domaine d'application",
    fields: [
      { k: 'type', l: 'Type', t: 'select', o: ['Activité', 'Processus', 'Produit', 'Service'] },
      { k: 'libelle', l: 'Libellé', req: 1 },
      { k: 'site', l: 'Site', t: 'select', o: () => siteOpts() },
      { k: 'statut', l: 'Statut', t: 'select', o: ['Inclus', 'Exclu'] },
      {
        k: 'justification',
        l: "Justification (obligatoire en cas d'exclusion)",
        t: 'textarea',
        req: 1,
        check: (v) => String(v).length >= 10,
      },
    ],
    def: () => ({
      type: 'Produit',
      libelle: 'Amandes de cajou grillées salées',
      site: 'Usine de Glo-Djigbé',
      statut: 'Inclus',
      justification: 'Nouvelle gamme marché national lancée en 2026',
    }),
  },
  processus: {
    title: 'Fiche processus',
    prefix: 'P',
    label: 'intitule',
    mod: 'Cartographie',
    fields: [
      { k: 'code', l: 'Code', req: 1 },
      { k: 'intitule', l: 'Intitulé', req: 1 },
      { k: 'categorie', l: 'Catégorie', t: 'select', o: ['Pilotage', 'Réalisation', 'Support'] },
      { k: 'proprietaire', l: 'Pilote (propriétaire)', t: 'select', o: userNames },
      { k: 'finalite', l: 'Finalité', t: 'textarea', req: 1 },
      { k: 'entrees', l: 'Entrées', t: 'textarea', req: 1 },
      { k: 'sorties', l: 'Sorties', t: 'textarea', req: 1 },
      { k: 'indicateurs', l: 'Indicateurs associés', req: 1, full: 1 },
      { k: 'normes', l: 'Normes', t: 'norms', req: 1 },
    ],
    def: () => ({
      code: 'P13',
      intitule: 'Recherche de financements',
      categorie: 'Support',
      proprietaire: 'Carine AKPLOGAN',
      finalite: 'Mobiliser les financements des investissements QSE',
      entrees: "Plans d'investissement",
      sorties: 'Conventions de financement',
      indicateurs: 'Montant mobilisé / montant prévu',
      normes: ['9001'],
    }),
    save: (_s, r) => {
      r.id = r.code
    },
  },
}

/** ()=>DB.axes.map(a=>[a.id,a.code+' — '+a.libelle]) */
export const axeOpts = () =>
  useApp.getState().db.axes.map((a) => [a.id, a.code + ' — ' + a.libelle] as [string, string])
