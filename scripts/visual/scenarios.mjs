/**
 * Catalogue des scénarios visuels, commun à l'original et à l'app React.
 * Un scénario = un écran de départ (screen) + des actions utilisateur (actions)
 * exprimées uniquement par des sélecteurs/textes identiques sur les deux cibles.
 *   shot: 'full'     → contenu déplié (voir UNFOLD_CSS dans driver.mjs), capture pleine page
 *   shot: 'viewport' → état superposé capturé tel qu'affiché dans la fenêtre
 * Onglets, formulaires et lignes cliquables relevés sur l'original (1440 px).
 */

export const WIDTHS = [1440, 1100, 900, 390]
const HEIGHT = (w) => (w === 390 ? 844 : 900)

export const APP_PAGES = [
  'dashboard', 'cover', 'journal', 'users', 'settings', 'help',
  'm1-enjeux', 'm1-parties', 'm1-domaine', 'm1-processus',
  'm2-engagement', 'm2-politique', 'm2-roles', 'm2-consultation',
  'm3-objectifs', 'm3-veille', 'm3-risques',
  'm4-ressources', 'm4-competences', 'm4-communication',
  'm5-ged', 'm5-planif', 'm5-urgences', 'm5-fiches',
  'm6-surveillance', 'm6-audits', 'm6-revues', 'm6-nc', 'm6-registre',
]

/** Onglets de la première barre `.content .tabs` (le premier est actif par défaut). */
const TABS = {
  users: ['Utilisateurs', 'Matrice des droits'],
  'm1-enjeux': ['Facteurs internes (SWOT)', 'Facteurs externes (PESTEL)', 'Enjeux identifiés', 'Historique des versions'],
  'm1-parties': ['Registre', 'Synthèse par criticité'],
  'm1-domaine': ['Sites', 'Activités, produits et services', 'Document consolidé', 'Versions'],
  'm1-processus': ['Cartographie', 'Fiches processus'],
  'm2-engagement': ['Plan stratégique', 'Évaluation de la mise en œuvre', 'Autres politiques (champs personnalisés)'],
  'm2-roles': ['Fiches de poste', 'Organigramme'],
  'm2-consultation': ['Représentants des travailleurs', 'Comité hygiène et santé', 'Réunions de consultation'],
  'm3-objectifs': ['Liste des objectifs', 'Vue par processus', 'Vue par axe stratégique', 'Suivi des actions'],
  'm3-veille': ['Registre réglementaire', "Calendrier d'audit de conformité", 'Déclarations au DG'],
  'm3-risques': ['Risques', 'Opportunités', 'Cartographie commune', 'Reporting statistique'],
  'm4-competences': ['Matrice des compétences', 'Savoirs critiques', 'Plan de formation et évaluations'],
  'm5-ged': ['Documents', 'Bibliothèque de modèles', 'Archives'],
  'm6-surveillance': ['Indicateurs', 'Tableau de bord', 'Intervenants externes', 'Statistiques de surveillance', 'Registre de veille'],
  'm6-audits': ['Plan annuel', 'Liste des audits', 'Auditeurs'],
  'm6-nc': ['Tous les éléments', 'Non-conformité', 'Accident / incident', "Piste d'amélioration", 'Observation'],
}

/** Premier bouton `.content .btn.primary` qui ouvre un formulaire de création (modale). */
const CREATE = {
  users: 'Inviter un utilisateur',
  'm1-parties': 'Créer une fiche',
  'm1-domaine': 'Ajouter un site',
  'm2-engagement': 'Charger un plan stratégique',
  'm2-politique': 'Rédiger une nouvelle version',
  'm2-roles': 'Créer une fiche de poste',
  'm2-consultation': 'Ajouter un représentant',
  'm3-objectifs': 'Définir un objectif',
  'm3-veille': 'Ajouter un texte',
  'm3-risques': 'Créer une fiche risque',
  'm4-ressources': 'Planifier une ressource',
  'm4-communication': 'Créer une action',
  'm5-ged': 'Créer une fiche documentaire',
  'm5-planif': "Recenser un plan d'action",
  'm5-urgences': 'Créer une fiche',
  'm5-fiches': 'Créer une fiche',
  'm6-surveillance': 'Définir un indicateur',
  'm6-audits': 'Planifier un audit',
  'm6-revues': 'Créer une revue',
  'm6-nc': 'Déclarer une non-conformité',
}

/** Pages ayant au moins une ligne `.content .tbl tbody tr.click` à l'affichage par défaut. */
const ROWS = [
  'm1-parties', 'm1-domaine', 'm2-engagement', 'm2-politique', 'm2-roles', 'm2-consultation',
  'm3-objectifs', 'm3-veille', 'm3-risques', 'm4-ressources', 'm4-communication',
  'm5-ged', 'm5-planif', 'm5-fiches', 'm6-surveillance', 'm6-nc', 'm6-registre',
]

const NORM_BTNS = ['Tous', '9001', '14001', '45001', '27001', 'Vue croisée']

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function build() {
  const list = []
  const add = (name, width, screen, extra = {}) =>
    list.push({ name: `${name}@${width}`, width, height: HEIGHT(width), screen, actions: [], shot: 'full', ...extra })

  for (const w of WIDTHS) {
    add('login', w, { kind: 'login' })
    for (let s = 0; s < 8; s++) add(`onboarding-${s + 1}`, w, { kind: 'onb', step: s })
    for (const p of APP_PAGES) add(p, w, { kind: 'app', page: p })
  }

  const W = 1440
  for (const [p, tabs] of Object.entries(TABS)) {
    tabs.slice(1).forEach((t, i) =>
      add(`${p}--tab-${i + 2}-${slug(t)}`, W, { kind: 'app', page: p }, { actions: [{ sel: '.content .tabs button', text: t }] }))
  }
  for (const [p, t] of Object.entries(CREATE)) {
    add(`${p}--create`, W, { kind: 'app', page: p }, {
      shot: 'viewport', actions: [{ sel: '.content .btn.primary', text: t, waitFor: '.modal' }],
    })
  }
  for (const p of ROWS) {
    add(`${p}--row-1`, W, { kind: 'app', page: p }, {
      shot: 'viewport', actions: [{ sel: '.content .tbl tbody tr.click', waitFor: '.drawer, .modal' }],
    })
  }
  add('dashboard--notifications', W, { kind: 'app', page: 'dashboard' }, {
    shot: 'viewport', actions: [{ sel: '.topbar button[aria-label="Notifications"]', waitFor: '.notif-panel' }],
  })
  add('dashboard--ai', W, { kind: 'app', page: 'dashboard' }, {
    shot: 'viewport', actions: [{ sel: '.ai-fab', waitFor: '.ai-panel' }],
  })
  for (const n of NORM_BTNS) {
    add(`dashboard--norm-${slug(n)}`, W, { kind: 'app', page: 'dashboard' }, { actions: [{ sel: '.norm-switch button', text: n }] })
  }
  for (const p of APP_PAGES) {
    add(`${p}--menu`, 390, { kind: 'app', page: p }, {
      shot: 'viewport', actions: [{ sel: '.topbar .menu-btn', waitFor: '.sidebar.open' }],
    })
  }
  return list
}

export const SCENARIOS = build()

/** Filtre --only=<motif> (sous-chaîne ou expression régulière sur le nom). */
export function select(only) {
  if (!only) return SCENARIOS
  const re = new RegExp(only)
  return SCENARIOS.filter((s) => re.test(s.name))
}
