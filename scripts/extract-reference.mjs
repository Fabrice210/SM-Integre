/**
 * Régénère les fichiers dérivés de l'original figé (reference/original.html) :
 *   - src/data/referentiels.ts  (TODAY, NORMS, USERS, ORG, MODS, MOD_FULL, GEN, ST_COL…)
 *   - src/data/seed.ts          (DB : données de démonstration)
 *   - src/app/pageTitles.ts     (PAGES[id].t : titres du fil d'Ariane)
 * À relancer à chaque nouvelle version de l'interface : node scripts/extract-reference.mjs
 * Les textes sont recopiés tels quels (aucune retouche).
 */
import { readFileSync, writeFileSync } from 'node:fs'

const src = readFileSync('reference/original.html', 'utf8')
const L = src.split(/\r?\n/)
const find = (re, from = 0) => L.findIndex((l, i) => i >= from && re.test(l))
const line = (re) => {
  const i = find(re)
  if (i < 0) throw new Error('Introuvable : ' + re)
  return L[i]
}
const block = (startRe, endRe) => {
  const a = find(startRe)
  if (a < 0) throw new Error('Introuvable : ' + startRe)
  const b = find(endRe, a)
  return L.slice(a, b + 1).join('\n')
}
const ex = (s) => s.replace(/^const /, 'export const ')

/* ---------- référentiels ---------- */
writeFileSync(
  'src/data/referentiels.ts',
  `// prettier-ignore
/**
 * Référentiels repris à l'identique de l'original (reference/original.html).
 * Généré par scripts/extract-reference.mjs — ne pas modifier à la main.
 * USERS et ORG servent de valeurs initiales : les versions modifiables vivent
 * dans l'état sauvegardé (store), car l'application permet de les éditer.
 */
${ex(line(/^const TODAY/))}
${ex(block(/^const NORMS = \{/, /^\};/))}
${ex(line(/^const ALL_N/))}

${ex(block(/^const USERS = \[/, /^\];/))}
${ex(line(/^const DIRECTIONS/))}
${ex(line(/^const ROLES/))}
${ex(line(/^const ORG = /))}
${ex(line(/^const MOIS/))}

/** Couleur de badge selon le libellé de statut. */
${ex(block(/^const ST_COL = \{/, /^\};/))}

${ex(block(/^const MODS = \[/, /^\];/))}
${ex(line(/^const MOD_FULL/))}
${ex(line(/^const GEN/))}

export type NormId = '9001' | '14001' | '45001' | '27001'
export type User = (typeof USERS)[number]
export type Org = typeof ORG
`
)

/* ---------- données de démonstration ---------- */
const a = find(/^const DB = \{/)
const b = find(/^\};/, a)
writeFileSync(
  'src/data/seed.ts',
  `// prettier-ignore
/**
 * Données de démonstration, reprises à l'identique de l'original.
 * Généré par scripts/extract-reference.mjs — ne pas modifier à la main.
 * Chargées au premier lancement, puis remplacées par l'état sauvegardé.
 */
${L.slice(a, b + 1).join('\n').replace(/^const DB = /, 'export const seed = ')}

export type Seed = typeof seed
`
)

/* ---------- titres de page ---------- */
const BS = String.fromCharCode(92)
const titles = []
let i = 0
while ((i = src.indexOf('PAGES', i)) >= 0) {
  const m = src.slice(i, i + 80).match(/^PAGES(?:\.([a-zA-Z0-9_]+)|\['([a-z0-9-]+)'\])=\{t:'/)
  i += 5
  if (!m) continue
  let j = i - 5 + m[0].length
  let t = ''
  while (src[j] !== "'") {
    if (src[j] === BS) {
      t += src[j + 1]
      j += 2
    } else t += src[j++]
  }
  titles.push([m[1] || m[2], t])
}
writeFileSync(
  'src/app/pageTitles.ts',
  "/** Titres de page (PAGES[id].t de l'original), affichés dans le fil d'Ariane. Généré par scripts/extract-reference.mjs. */\nexport const PAGE_TITLES: Record<string, string> = {\n" +
    titles.map(([k, v]) => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(v) + ',').join('\n') +
    '\n}\n'
)

console.log(`référentiels, données (lignes ${a + 1}–${b + 1}) et ${titles.length} titres de page régénérés`)
