/**
 * Garde-fou « aucun texte perdu, aucun texte inventé ».
 *   node scripts/visual/verify-texts.mjs --target=original [--only=<motif>]
 *     → baseline/texts-original.json (innerText de chaque écran du catalogue)
 *   node scripts/visual/verify-texts.mjs --target=react [--only=<motif>]
 *     → baseline/texts-react.json + baseline/texts-diff.md ; code 1 si différence
 * Le texte est découpé en lignes normalisées (espaces), comparées en multiensembles.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { select } from './scenarios.mjs'
import { startOriginalServer, launch, openScreen, runActions, settle } from './driver.mjs'

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')))
const target = args.target
if (!['original', 'react'].includes(target)) {
  console.error('Usage : node scripts/visual/verify-texts.mjs --target=original|react [--only=<motif>]')
  process.exit(2)
}
mkdirSync('baseline', { recursive: true })

const list = select(args.only)
const stop = target === 'original' ? await startOriginalServer() : async () => {}
const browser = await launch()
const texts = {}
try {
  for (const sc of list) {
    let ctx
    try {
      const o = await openScreen(browser, target, sc)
      ctx = o.ctx
      await runActions(o.page, sc.actions)
      await settle(o.page)
      const raw = await o.page.evaluate(() => document.body.innerText)
      texts[sc.name] = raw.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
    } catch (e) {
      texts[sc.name] = null
      console.error(`ÉCHEC ${sc.name} : ${e.message.split('\n')[0]}`)
    } finally {
      if (ctx) await ctx.close()
    }
  }
} finally {
  await browser.close()
  await stop()
}
writeFileSync(`baseline/texts-${target}.json`, JSON.stringify(texts, null, 1))
console.log(`${Object.keys(texts).length} écrans → baseline/texts-${target}.json`)
if (target === 'original') process.exit(0)

if (!existsSync('baseline/texts-original.json')) {
  console.error('baseline/texts-original.json manquant : lancez d\'abord --target=original')
  process.exit(2)
}
const ref = JSON.parse(readFileSync('baseline/texts-original.json', 'utf8'))
/** Lignes de a absentes de b (avec multiplicité). */
const minus = (a, b) => {
  const left = new Map()
  for (const l of b) left.set(l, (left.get(l) || 0) + 1)
  return a.filter((l) => { const n = left.get(l) || 0; if (n) { left.set(l, n - 1); return false } return true })
}
const md = ['# Écarts de texte original ↔ React', '']
let issues = 0
for (const name of Object.keys(texts)) {
  const o = ref[name]
  const r = texts[name]
  if (!o || !r) { issues++; md.push(`## ${name}`, '', `- ${!o ? 'absent de la référence' : 'échec de capture côté React'}`, ''); continue }
  const lost = minus(o, r)
  const added = minus(r, o)
  if (!lost.length && !added.length) continue
  issues++
  md.push(`## ${name}`, '')
  lost.forEach((l) => md.push(`- PERDU : ${l}`))
  added.forEach((l) => md.push(`- INVENTÉ : ${l}`))
  md.push('')
}
if (!issues) md.push('Aucun écart.')
writeFileSync('baseline/texts-diff.md', md.join('\n'))
console.log(`${issues} écran(s) avec écarts de texte → baseline/texts-diff.md`)
process.exit(issues ? 1 : 0)
