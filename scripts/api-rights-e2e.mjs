/**
 * Droits fins par processus (réglage `droitsParProcessus`), de bout en bout : interface
 * réelle, API réelle.
 *
 *   1. le réglage est désactivé par défaut ; un administrateur (Responsable SM) l'active
 *      depuis la page Paramètres (case « Droits par processus », PATCH /settings/) ;
 *   2. Serge KOUTON (Pilote de processus, pilote de P04 et P05) modifie le risque R01
 *      (P05) : accepté ;
 *   3. il modifie le risque R03 (P10) puis le déclare réalisé : refusés (403), refus
 *      signalé, écran et store revenus à l'état du serveur, aucune entrée de registre ;
 *   4. la case n'est pas proposée au pilote ; réglage remis à « désactivé » : le pilote
 *      modifie de nouveau R03 (comportement d'origine).
 *
 * Le script démarre lui-même (et arrête par PID) le backend Django sur API_PORT (8040)
 * avec une base SQLite dédiée (migrate + load_demo) et le front Vite sur WEB_PORT (5200).
 *
 * Usage : CHROMIUM_PATH=… node scripts/api-rights-e2e.mjs
 * Variables : PYTHON (défaut backend/.venv/bin/python), E2E_DIR (dossier de la base),
 * CHROMIUM_PATH (navigateur préinstallé), API_PORT, WEB_PORT.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BACKEND = join(ROOT, 'backend')
const API_PORT = process.env.API_PORT ?? '8040'
const WEB_PORT = process.env.WEB_PORT ?? '5200'
const WEB = `http://localhost:${WEB_PORT}`
const API = `http://localhost:${API_PORT}/api/v1`
const PYTHON =
  process.env.PYTHON ??
  [join(BACKEND, '.venv/bin/python'), join(ROOT, '../../../backend/.venv/bin/python')].find(
    existsSync
  ) ??
  'python3'
const DIR = process.env.E2E_DIR ?? mkdtempSync(join(tmpdir(), 'sm-rights-e2e-'))
const PWD = 'Demo-SM-2026!'
const ADMIN = 'f.dossou-yovo@agrobenin.bj' // Responsable SM
const PILOTE = 's.kouton@agrobenin.bj' // Pilote de processus : P04, P05

const env = {
  ...process.env,
  DATABASE_URL: `sqlite:///${join(DIR, 'rights-e2e.sqlite3')}`,
  DEBUG: 'true',
  DEMO_PASSWORD: PWD,
  CORS_ALLOWED_ORIGINS: WEB,
  FRONTEND_URL: WEB,
  PYTHONUNBUFFERED: '1',
}

let failed = 0
function check(cond, msg) {
  console.log(`${cond ? 'OK   ' : 'ÉCHEC'} ${msg}`)
  if (!cond) failed++
  return cond
}
const section = (t) => console.log(`\n== ${t}`)

/* ---------- Serveurs (arrêtés par PID) ---------- */

const children = []

function manage(...args) {
  const r = spawnSync(PYTHON, ['manage.py', ...args], { cwd: BACKEND, env, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`manage.py ${args.join(' ')} : ${r.stderr || r.stdout}`)
}

function start(cmd, args, opts) {
  // Groupe de processus dédié : arrêt par PID (kill(-pid)) du serveur et de ses enfants.
  const child = spawn(cmd, args, { ...opts, detached: true, stdio: ['ignore', 'ignore', 'pipe'] })
  child.stderr.on('data', () => {})
  children.push(child)
  return child
}

function stopAll() {
  for (const c of children) {
    try {
      process.kill(-c.pid, 'SIGTERM')
    } catch {
      /* déjà arrêté */
    }
  }
}

async function waitUrl(url, timeout = 60000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    try {
      const r = await fetch(url)
      if (r.status < 500) return
    } catch {
      /* pas encore prêt */
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`${url} injoignable`)
}

process.on('exit', stopAll)
process.on('SIGINT', () => process.exit(130))

console.log(`Base : ${env.DATABASE_URL}`)
manage('migrate', '--noinput')
manage('load_demo')
start(PYTHON, ['manage.py', 'runserver', API_PORT, '--noreload'], { cwd: BACKEND, env })
start('npx', ['vite', '--port', WEB_PORT, '--strictPort'], {
  cwd: ROOT,
  env: { ...process.env, VITE_API_URL: API },
})
await waitUrl(`${API}/health/`)
await waitUrl(WEB)

/* ---------- Lecture directe de l'API (administrateur) ---------- */

let token
async function server(path, method = 'GET', body) {
  token ??= (
    await (
      await fetch(API + '/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ADMIN, password: PWD }),
      })
    ).json()
  ).access
  const r = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await r.text()
  return { status: r.status, data: text ? JSON.parse(text) : null }
}
const serverGet = async (path) => (await server(path)).data

/* ---------- Navigateur ---------- */

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const pageErrors = []
let page

async function newSession() {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  page = await ctx.newPage()
  page.on('pageerror', (e) => pageErrors.push(e.message))
  return ctx
}

const waitCall = (method, path, timeout = 10000) =>
  page.waitForResponse(
    (r) => {
      if (r.request().method() !== method || !r.url().startsWith(API)) return false
      const p = r.url().slice(API.length)
      return path instanceof RegExp ? path.test(p) : p === path
    },
    { timeout }
  )
const settle = (ms = 400) => page.waitForTimeout(ms)
const toasts = () => page.locator('.toast').allTextContents()
const clearToasts = () =>
  page.evaluate(() =>
    import('/src/store/useOverlays.ts').then((m) => m.useOverlays.setState({ toasts: [] }))
  )
const storeState = (fn) =>
  page.evaluate(
    (src) =>
      import('/src/store/useApp.ts').then((m) => new Function('s', src)(m.useApp.getState())),
    fn
  )
const idle = () =>
  page.evaluate(async () => {
    const m = await import('/src/services/sync.ts')
    for (let i = 0; i < 400 && !m.isIdle(); i++) await new Promise((r) => setTimeout(r, 50))
    if (!m.isIdle()) throw new Error('écritures toujours en attente')
  })

async function uiLogin(email) {
  await page.goto(WEB + '/login')
  await page.fill('#f_email', email)
  await page.fill('#f_pwd', PWD)
  await page.click('button:has-text("Se connecter")')
  await page.waitForURL(/\/(onboarding|dashboard)/)
  for (let i = 0; i < 30 && page.url().includes('/onboarding'); i++) {
    const btn = page
      .locator(
        [
          'button:has-text("Accéder au tableau de bord")',
          'button:has-text("Commencer la configuration")',
          'button:has-text("Confirmer et créer l\'espace")',
          'button:has-text("Passer cette étape")',
          '.onb-main button:has-text("Continuer"):not([disabled])',
        ].join(', ')
      )
      .first()
    if (await btn.isVisible().catch(() => false)) await btn.click()
    await settle(300)
  }
  await page.waitForURL(/\/dashboard/)
  await page.waitForSelector('.content')
}

async function goto(pageId) {
  await page.evaluate(
    (id) => import('/src/app/routerRef.ts').then((m) => m.routerRef.navigate('/' + id)),
    pageId
  )
  await page.waitForURL(new RegExp('/' + pageId + '$'))
  await page.waitForSelector('.content')
}

/** Ouvre la fiche d'un risque (tableau du registre des risques). */
async function openRisk(id) {
  await goto('m3-risques')
  await page.keyboard.press('Escape').catch(() => {})
  await page.locator('.content tr', { hasText: id }).first().click()
  await page.locator('.drawer').first().waitFor()
}

/** Modifie l'intitulé d'un risque par son formulaire ; renvoie la réponse du PUT. */
async function editRiskTitle(id, title) {
  await openRisk(id)
  await page.click('.drawer button:has-text("Modifier")')
  await page.locator('.modal').first().waitFor()
  await settle(150)
  await page.fill('.modal [data-f="intitule"] .inp', title)
  const put = waitCall('PUT', `/risques/${id}/`)
  await page.click('.modal #saveBtn')
  return put
}

const box = 'input[aria-label="Droits par processus"]'

try {
  section('Réglage par défaut et activation par un administrateur')
  {
    const s = await serverGet('/settings/')
    check(
      s.droitsParProcessus === false,
      'GET /settings/ : droitsParProcessus désactivé par défaut'
    )
    const ctx = await newSession()
    await uiLogin(ADMIN)
    await goto('settings')
    check(
      await page.locator(box).isVisible(),
      'case « Droits par processus » visible (administrateur)'
    )
    check(!(await page.locator(box).isChecked()), 'case décochée (état du serveur)')
    const patch = waitCall('PATCH', '/settings/')
    await page.check(box)
    const pr = await patch
    check(pr.status() === 200, `PATCH /settings/ ${pr.status()}`)
    check(
      JSON.parse(pr.request().postData() ?? '{}').droitsParProcessus === true,
      'corps envoyé : {droitsParProcessus: true}'
    )
    await idle()
    check(
      (await serverGet('/settings/')).droitsParProcessus === true,
      'réglage enregistré côté serveur'
    )
    await ctx.close()
  }

  section('Pilote : élément de son processus accepté')
  const r01 = await serverGet('/risques/R01/')
  const r03 = await serverGet('/risques/R03/')
  check(
    r01.processus.includes('P05') && !r03.processus.some((p) => ['P04', 'P05'].includes(p)),
    `démo : R01 (${r01.processus}) à Serge KOUTON, R03 (${r03.processus}) à un autre pilote`
  )
  const pctx = await newSession()
  await uiLogin(PILOTE)
  {
    const ok = await editRiskTitle('R01', 'R01 revu par le pilote')
    check(ok.status() === 200, `PUT /risques/R01/ ${ok.status()}`)
    await idle()
    check(
      (await serverGet('/risques/R01/')).intitule === 'R01 revu par le pilote',
      'modification enregistrée côté serveur'
    )
  }

  section('Pilote : élément d’un autre processus refusé, écran revenu à l’état du serveur')
  {
    await clearToasts()
    const reload = waitCall('GET', '/bootstrap/')
    const ko = await editRiskTitle('R03', 'Tentative hors processus')
    check(ko.status() === 403, `PUT /risques/R03/ refusé (${ko.status()})`)
    check((await reload).status() === 200, 'rechargement de l’état du serveur')
    await settle(500)
    const t = await toasts()
    check(
      t.some((x) => /refusée/.test(x) && /processus/.test(x)),
      `refus signalé : « ${t.find((x) => /refusée/.test(x)) ?? t.join(' | ')} »`
    )
    check((await serverGet('/risques/R03/')).intitule === r03.intitule, 'serveur inchangé')
    check(
      (await storeState("return s.db.risques.find((x) => x.id === 'R03').intitule")) ===
        r03.intitule,
      'store resynchronisé'
    )
    await page.keyboard.press('Escape').catch(() => {})
    await goto('m3-risques')
    check(
      (await page.locator('.content tr', { hasText: 'Tentative hors processus' }).count()) === 0 &&
        (await page.locator('.content tr', { hasText: r03.intitule }).count()) > 0,
      'écran revenu à l’état du serveur'
    )

    // Action métier (risque déclaré réalisé -> registre) : refusée aussi.
    const before = (await serverGet('/registre/')).length
    await clearToasts()
    await openRisk('R03')
    // Première écriture de l'update (fiche risque ou entrée de registre, toutes deux sur P10).
    const first = page.waitForResponse(
      (r) =>
        r.url().startsWith(API) &&
        /^(PUT \/risques\/R03\/|POST \/registre\/)/.test(
          `${r.request().method()} ${r.url().slice(API.length)}`
        )
    )
    const reload2 = waitCall('GET', '/bootstrap/')
    await page.click('.drawer button:has-text("Déclarer le risque réalisé")')
    const fr = await first
    check(
      fr.status() === 403,
      `risque R03 déclaré réalisé : refusé (${fr.request().method()} ${fr.url().slice(API.length)} ${fr.status()})`
    )
    await reload2
    await idle()
    await settle(500)
    check((await serverGet('/risques/R03/')).realise !== true, 'R03 non réalisé côté serveur')
    check((await serverGet('/registre/')).length === before, 'aucune entrée de registre créée')
    check(
      (await storeState("return s.db.risques.find((x) => x.id === 'R03').realise")) !== true,
      'store resynchronisé (R03 non réalisé)'
    )
  }

  section('Pilote : pas de réglage proposé ; désactivation -> comportement d’origine')
  {
    await goto('settings')
    check((await page.locator(box).count()) === 0, 'case absente pour un pilote')
    const off = await server('/settings/', 'PATCH', { droitsParProcessus: false })
    check(off.status === 200 && off.data.droitsParProcessus === false, 'réglage désactivé (API)')
    // Rechargement de l'état : le pilote reprend l'écran à jour.
    await page.reload()
    await page.waitForSelector('.content')
    const ok = await editRiskTitle('R03', 'R03 revu sans droits par processus')
    check(ok.status() === 200, `PUT /risques/R03/ ${ok.status()} (réglage désactivé)`)
    await idle()
  }
  await pctx.close()
} catch (e) {
  failed++
  console.error('ÉCHEC (exception)', e)
} finally {
  check(pageErrors.length === 0, `aucune erreur de page (${pageErrors.join(' | ')})`)
  await browser.close()
  stopAll()
}

console.log(failed ? `\n${failed} échec(s)` : '\nTout est OK')
process.exit(failed ? 1 : 0)
