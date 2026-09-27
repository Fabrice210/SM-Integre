/**
 * Pilote commun aux scripts visuels : serveur HTTP de l'original, ouverture
 * d'un scénario sur l'une des deux cibles, feuille de style de « dépliage ».
 *
 * Défilement interne : la coque de l'app fait 100vh et le contenu défile dans
 * `.content` (et `.onb-main` pour l'onboarding). Pour les écrans de base
 * (shot: 'full'), on injecte UNFOLD_CSS — identique sur les deux cibles — qui
 * retire les hauteurs fixes et le défilement vertical interne, puis on prend une
 * capture pleine page : tout le contenu apparaît dans une seule image. Le
 * débordement horizontal reste rogné (overflow-x: clip), comme à l'écran avec
 * scrollLeft = 0, pour que la largeur de l'image reste celle de la fenêtre. Les états
 * superposés (modale, tiroir, panneaux, barre latérale mobile) sont capturés
 * tels qu'affichés dans la fenêtre (shot: 'viewport'), sans dépliage.
 *
 * Écart VOULU (v2, demande client) : l'app React est plein écran à toutes les
 * largeurs (src/styles/fullscreen.css). On injecte la même règle, FULLSCREEN_CSS,
 * dans l'ORIGINAL uniquement, avant toute capture, pour ne pas compter cet écart.
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, extname, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const REACT_BASE = process.env.REACT_BASE ?? 'http://localhost:4180'
const ORIG_PORT = 4190

export const UNFOLD_CSS = `
.shell{height:auto!important;min-height:100vh!important;overflow-x:clip!important;overflow-y:visible!important}
.main,.content{overflow-x:clip!important;overflow-y:visible!important}
.content{flex:none!important}
.onb-main{max-height:none!important;overflow-x:clip!important;overflow-y:visible!important}
`

/** Copie de src/styles/fullscreen.css — cible original seulement. */
export const FULLSCREEN_CSS = '.shell{margin:0;height:100vh;border-radius:0;box-shadow:none}'

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.woff2': 'font/woff2', '.js': 'text/javascript' }

/** Sert reference/ sur 127.0.0.1:4190 ; renvoie une fonction d'arrêt. */
export async function startOriginalServer() {
  const dir = join(ROOT, 'reference')
  const srv = createServer(async (req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    const file = resolve(dir, '.' + (p === '/' ? '/original.html' : p))
    if (!file.startsWith(dir)) { res.writeHead(403).end(); return }
    try {
      const buf = await readFile(file)
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }).end(buf)
    } catch { res.writeHead(404).end() }
  })
  await new Promise((ok, ko) => srv.once('error', ko).listen(ORIG_PORT, '127.0.0.1', ok))
  return () => new Promise((ok) => srv.close(ok))
}

export async function launch() {
  return chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb'] })
}

const REACT_ROUTE = (s) => (s.kind === 'login' ? '/login' : s.kind === 'onb' ? `/onboarding/${s.step + 1}` : `/${s.page}`)

/** Amène l'écran de départ du scénario ; renvoie { ctx, page, errors }. */
export async function openScreen(browser, target, sc) {
  const ctx = await browser.newContext({
    viewport: { width: sc.width, height: sc.height },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    locale: 'fr-FR',
    timezoneId: 'Africa/Porto-Novo',
  })
  await ctx.addInitScript(() => { window.setInterval = () => 0 })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })

  const s = sc.screen
  if (target === 'original') {
    await page.goto(`http://127.0.0.1:${ORIG_PORT}/original.html`, { waitUntil: 'load' })
    await page.addStyleTag({ content: FULLSCREEN_CSS })
    await page.evaluate((s) => {
      /* global S, render, go, runCfg */
      if (s.kind === 'login') { S.screen = 'login'; render() }
      else if (s.kind === 'onb') {
        S.onboarded = false; S.screen = 'onboarding'
        S.onb = { step: s.step, cfg: 0, ai: 'idle', props: null, invites: null, prof: null }
        render(); if (s.step === 3) runCfg()
      } else { S.onboarded = true; S.screen = 'app'; S.history = []; S.hist_i = -1; go(s.page) }
    }, s)
  } else if (target === 'react') {
    if (s.kind !== 'login') {
      await ctx.addInitScript((onb) => {
        localStorage.setItem('sm:session', JSON.stringify({ userId: 'u1', onboarded: onb }))
      }, s.kind === 'app')
    }
    await page.goto(REACT_BASE + REACT_ROUTE(s), { waitUntil: 'load' })
  } else throw new Error('cible inconnue : ' + target)

  // Écran prêt : conteneur caractéristique présent.
  const ready = s.kind === 'login' ? '.auth' : s.kind === 'onb' ? '.onb-main' : '.content .page-head, .content h1'
  await page.waitForSelector(ready, { timeout: 15000 })
  // Étape 4 : l'auto-configuration s'anime jusqu'au bouton « Continuer ».
  if (s.kind === 'onb' && s.step === 3) {
    await page.waitForFunction(() => [...document.querySelectorAll('.onb-foot .btn.primary')].some((b) => b.textContent.trim() === 'Continuer'), null, { timeout: 20000 })
  }
  return { ctx, page, errors }
}

/** Joue les actions utilisateur du scénario (mêmes sélecteurs sur les deux cibles). */
export async function runActions(page, actions = []) {
  for (const a of actions) {
    let loc = page.locator(a.sel)
    if (a.text != null) loc = loc.filter({ hasText: new RegExp('^\\s*' + a.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$') })
    loc = loc.nth(a.nth ?? 0)
    await loc.click({ timeout: 8000 })
    if (a.waitFor) await page.waitForSelector(a.waitFor, { timeout: 8000 })
  }
  await page.mouse.move(0, 0)
}

/** Stabilise la page : polices chargées, deux frames, focus différé des modales (30 ms). */
export async function settle(page) {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(120)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
}
