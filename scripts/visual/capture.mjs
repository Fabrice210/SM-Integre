/**
 * Captures du catalogue sur une cible.
 *   node scripts/visual/capture.mjs --target=original|react --out=<dir> [--only=<motif>]
 * Écrit <out>/<scénario>.png et <out>/_report.json (erreurs console, débordements).
 * Un seul Chromium, un contexte par scénario, fermé aussitôt.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { select } from './scenarios.mjs'
import { startOriginalServer, launch, openScreen, runActions, settle, UNFOLD_CSS } from './driver.mjs'

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')))
const target = args.target
const out = args.out
if (!['original', 'react'].includes(target) || !out) {
  console.error('Usage : node scripts/visual/capture.mjs --target=original|react --out=<dir> [--only=<motif>]')
  process.exit(2)
}
mkdirSync(out, { recursive: true })

/** Débordements visibles : défilement horizontal de la page, textes tronqués (ellipsis). */
const probe = () => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
  const label = (e) => (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : e.tagName.toLowerCase())
  const truncated = []
  for (const e of document.querySelectorAll('body *')) {
    if (!vis(e) || e.children.length > 3) continue
    const cs = getComputedStyle(e)
    if (cs.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1) truncated.push(`${label(e)} « ${e.textContent.trim().slice(0, 60)} »`)
  }
  const hscroll = {}
  const doc = document.documentElement
  if (doc.scrollWidth > window.innerWidth) hscroll.page = doc.scrollWidth - window.innerWidth
  for (const sel of ['.content', '.onb-main', '.modal-b', '.drawer .modal-b']) {
    const e = document.querySelector(sel)
    if (e && e.scrollWidth > e.clientWidth + 1) hscroll[sel] = e.scrollWidth - e.clientWidth
  }
  return { hscroll, truncated: truncated.slice(0, 10) }
}

const list = select(args.only)
const stop = target === 'original' ? await startOriginalServer() : async () => {}
const browser = await launch()
const report = {}
let fails = 0
const t0 = Date.now()
try {
  for (const [i, sc] of list.entries()) {
    const { ctx, page, errors } = await openScreen(browser, target, sc).catch((e) => ({ err: e }))
      .then((r) => (r.err ? { ctx: null, errors: ['ouverture : ' + r.err.message.split('\n')[0]] } : r))
    const entry = { errors }
    try {
      if (!ctx) throw new Error(errors[0])
      await runActions(page, sc.actions)
      await settle(page)
      Object.assign(entry, await page.evaluate(probe)) // mesuré avant dépliage : état réel à l'écran
      if (sc.shot === 'full') {
        await page.addStyleTag({ content: UNFOLD_CSS })
        await settle(page)
      }
      await page.screenshot({ path: join(out, sc.name + '.png'), fullPage: sc.shot === 'full', animations: 'disabled', caret: 'hide' })
    } catch (e) {
      fails++
      entry.failed = e.message.split('\n')[0]
      console.error(`ÉCHEC ${sc.name} : ${entry.failed}`)
    } finally {
      if (ctx) await ctx.close()
    }
    report[sc.name] = entry
    if ((i + 1) % 25 === 0) console.log(`${i + 1}/${list.length}`)
  }
} finally {
  await browser.close()
  await stop()
}
writeFileSync(join(out, '_report.json'), JSON.stringify(report, null, 1))
console.log(`${list.length - fails}/${list.length} captures (${target}) dans ${out} en ${Math.round((Date.now() - t0) / 1000)} s`)
process.exit(fails ? 1 : 0)
