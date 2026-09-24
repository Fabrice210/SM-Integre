import { routerRef } from '../../app/routerRef'
import type { NormId } from '../../data/referentiels'
import type { Seed } from '../../data/seed'
import type { FieldDef, Rec } from '../../forms/types'
import { siteOpts } from '../../lib/lookups'
import type { AppState } from '../../store/types'
import { logAct, update, useApp } from '../../store/useApp'
import { toast } from '../../store/useOverlays'
import { TAILLES } from '../general/forms'

export interface Invite {
  nom: string
  email: string
  roles: string[]
}

export interface AiProp {
  t: string
  kind: string
  src: string
  proc: string
  normes: string[]
  arts: string
  ex: number
  conf: number
  extrait: string
  dec: string
}

/** S.onb de l'original. */
export interface OnbState {
  step: number
  cfg?: number
  ai?: 'idle' | 'running' | 'review' | 'applied' | 'skipped'
  aiStep?: number
  props?: AiProp[] | null
  invites?: Invite[] | null
  prof?: Rec | null
  files?: string[]
}

export const onbOf = (s: AppState) => s.ui.onb as OnbState
export const useOnb = () => useApp((s) => s.ui.onb) as OnbState

export const ONB = [
  'Bienvenue',
  "Profil de l'organisme",
  'Normes applicables',
  'Auto-configuration du noyau',
  'Auto-configuration IA',
  'Collaborateurs et rôles',
  'Récapitulatif',
  'Accès au tableau de bord',
]

export const DEFAULT_FILES = [
  'Manuel_qualite_ABI_2023.pdf (2,4 Mo)',
  'Procedure_achats_v1.docx (380 Ko)',
  'Instruction_decorticage_scan.pdf (6,1 Mo)',
  'Plan_urgence_incendie.pdf (1,1 Mo)',
]

export const PROF_F: FieldDef[] = [
  { k: 'nom', l: 'Raison sociale', req: 1 },
  {
    k: 'secteur',
    l: "Secteur d'activité",
    t: 'select',
    o: [
      "Agro-industrie — transformation de noix de cajou et d'ananas",
      'BTP et génie civil',
      'Santé et établissements de soins',
      'Banque et assurance',
      'Industrie manufacturière',
      'Services et conseil',
      'Logistique et transport',
      'Administration publique',
    ],
  },
  { k: 'taille', l: 'Taille', t: 'select', o: TAILLES },
  { k: 'effectif', l: 'Effectif exact', t: 'number', req: 1 },
  { k: 'ville', l: 'Ville du siège', req: 1 },
  { k: 'rccm', l: 'Numéro RCCM', req: 1 },
  { k: 'ifu', l: 'Numéro IFU', req: 1 },
  { k: 'sites', l: 'Sites concernés', t: 'multi', o: () => siteOpts(), req: 1 },
]

/** cfgItems() de l'original. */
export function cfgItems(db: Seed, activeN: readonly NormId[]): [string, string][] {
  return [
    [
      'Module 1 — Contexte',
      "Grilles SWOT/PESTEL, registre des parties intéressées, domaine d'application, cartographie",
    ],
    [
      'Module 2 — Leadership',
      'Politique SM, fiches de poste, organigramme' +
        (activeN.includes('45001') ? ', consultation des travailleurs (ISO 45001 §5.4)' : ''),
    ],
    [
      'Module 3 — Planification',
      'Objectifs, veille réglementaire, registre unique des risques' +
        (activeN.includes('14001') ? ', gestion des changements (ISO 14001:2026 §6.3)' : '') +
        (activeN.includes('27001') ? ", déclaration d'applicabilité (ISO 27001)" : ''),
    ],
    ['Module 4 — Support', 'Ressources, matrice des compétences, plan de communication'],
    [
      'Module 5 — Maîtrise opérationnelle',
      "GED avec workflow, situations d'urgence" +
        (activeN.includes('45001') ? ' (DUERP en vue filtrée)' : '') +
        ', fiches de maîtrise',
    ],
    [
      'Module 6 — Performance',
      "Indicateurs, programme d'audit à grille fusionnée, revues, NC, registre",
    ],
    [
      'Moteur normatif',
      db.mapping.filter((m) => activeN.includes(m.norme as NormId)).length +
        ' exigences mappées, tableau de couverture en temps réel',
    ],
  ]
}

const onOnboarding = () => window.location.pathname.startsWith('/onboarding')

// Génération des minuteries : une nouvelle exécution annule la précédente
let cfgGen = 0

/** runCfg() de l'original : coche les éléments un à un toutes les 380 ms. */
export function runCfg() {
  const gen = ++cfgGen
  update((s) => void (onbOf(s).cfg = 0))
  const n = cfgItems(useApp.getState().db, useApp.getState().activeNorms).length
  const tick = () => {
    if (gen !== cfgGen || !onOnboarding() || onbOf(useApp.getState()).step !== 3) return
    update((s) => void (onbOf(s).cfg = (onbOf(s).cfg ?? 0) + 1))
    if ((onbOf(useApp.getState()).cfg ?? 0) < n) setTimeout(tick, 380)
  }
  setTimeout(tick, 380)
}

/** onbGo(d) de l'original : étape précédente / suivante (0 à 7). */
export function onbGo(d: number) {
  let step = 0
  update((s) => {
    const o = onbOf(s)
    o.step = step = Math.max(0, Math.min(7, o.step + d))
  })
  routerRef.navigate?.(`/onboarding/${step + 1}`)
  if (step === 3) runCfg()
}

const AI_PROPS: AiProp[] = [
  {
    t: 'Créer la procédure « Achats et évaluation fournisseurs »',
    kind: 'Procédure',
    src: 'Procedure_achats_v1.docx',
    proc: 'P03',
    normes: ['9001', '14001'],
    arts: '8.4 · 6.1.2',
    ex: 6,
    conf: 92,
    extrait: 'Les fournisseurs sont évalués annuellement sur le prix et le délai',
    dec: 'À revoir',
  },
  {
    t: "Créer l'instruction « Sécurité au décorticage »",
    kind: 'Procédure',
    src: 'Instruction_decorticage_scan.pdf',
    proc: 'P05',
    normes: ['45001', '9001'],
    arts: '8.1 · 7.2',
    ex: 5,
    conf: 78,
    extrait: 'Arrêter la machine avant toute intervention sur les lames',
    dec: 'À revoir',
  },
  {
    t: "Créer la fiche d'urgence « Incendie magasin »",
    kind: 'Procédure',
    src: 'Plan_urgence_incendie.pdf',
    proc: 'P11',
    normes: ['14001', '45001'],
    arts: '8.2',
    ex: 4,
    conf: 88,
    extrait: 'Point de rassemblement n°2 devant le poste de garde',
    dec: 'À revoir',
  },
  {
    t: 'Compléter la fiche processus « Transformation » (entrées/sorties)',
    kind: 'Processus',
    src: 'Manuel_qualite_ABI_2023.pdf',
    proc: 'P05',
    normes: ['9001'],
    arts: '4.4',
    ex: 3,
    conf: 84,
    extrait: 'Entrées : lots de noix calibrés ; sorties : amandes conditionnées',
    dec: 'À revoir',
  },
  {
    t: 'Créer le risque « Exposition aux poussières de coques »',
    kind: 'Risque',
    src: 'Instruction_decorticage_scan.pdf',
    proc: 'P05',
    normes: ['45001'],
    arts: '6.1.2',
    ex: 2,
    conf: 61,
    extrait: 'Le port du masque est recommandé lors du vidage des bacs',
    dec: 'À revoir',
  },
  {
    t: 'Signaler un écart : pas de procédure de sauvegarde',
    kind: 'Écart',
    src: 'Manuel_qualite_ABI_2023.pdf',
    proc: 'P10',
    normes: ['27001'],
    arts: 'A.8.13',
    ex: 1,
    conf: 73,
    extrait: 'Aucune mention de sauvegarde ou de restauration des données',
    dec: 'À revoir',
  },
]

let aiGen = 0

/** runAI() de l'original : analyse simulée en 5 phases (520 ms), puis propositions à revoir. */
export function runAI() {
  if (!(onbOf(useApp.getState()).files ?? DEFAULT_FILES).length) {
    toast("Ajoutez au moins un document ou passez l'étape.", 'warn')
    return
  }
  const gen = ++aiGen
  update((s) => {
    const o = onbOf(s)
    o.ai = 'running'
    o.aiStep = 0
  })
  const t = () => {
    if (gen !== aiGen || onbOf(useApp.getState()).ai !== 'running') return
    update((s) => {
      const o = onbOf(s)
      o.aiStep = (o.aiStep ?? 0) + 1
      if (o.aiStep >= 5) {
        o.ai = 'review'
        o.props = structuredClone(AI_PROPS)
      }
    })
    if (onbOf(useApp.getState()).ai === 'running') setTimeout(t, 520)
  }
  setTimeout(t, 520)
}

/** applyAI() de l'original. */
export function applyAI() {
  update((s) => {
    const o = onbOf(s)
    o.ai = 'applied'
    logAct(
      s,
      `a appliqué ${(o.props ?? []).filter((p) => p.dec !== 'Rejetée').length} proposition(s) de l'auto-configuration IA après revue humaine`,
      'Onboarding'
    )
  })
  toast('Décisions appliquées et journalisées.')
}

/** finishOnb() de l'original : l'organisme est configuré, écran final. */
export function finishOnb() {
  update((s) => {
    const o = onbOf(s)
    s.onboarded = true
    if (s.session) s.session.onboarded = true
    ;(o.invites || []).forEach((v) =>
      logAct(s, `a invité ${v.nom} (${v.roles.join(', ')})`, 'Onboarding')
    )
    logAct(s, "a finalisé l'onboarding de l'organisme", 'Onboarding')
    o.step = 7
  })
  routerRef.navigate?.('/onboarding/8')
}
