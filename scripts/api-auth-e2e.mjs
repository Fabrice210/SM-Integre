/**
 * Test de bout en bout des pages d'authentification du mode API : inscription d'un
 * organisme, mot de passe oublié, définition du mot de passe par le lien reçu par e-mail.
 *
 * Le script démarre lui-même (et arrête par PID) :
 *   - le backend Django sur API_PORT (8020) avec une base SQLite dédiée (migrate + load_demo),
 *     ALLOW_SIGNUP=true, DEBUG=true (e-mails écrits sur la sortie standard, lue ici) ;
 *   - le front Vite sur WEB_PORT (5190) avec VITE_API_URL pointant sur ce backend.
 *
 * Usage : node scripts/api-auth-e2e.mjs
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
const API_PORT = process.env.API_PORT ?? '8020'
const WEB_PORT = process.env.WEB_PORT ?? '5190'
const WEB = `http://localhost:${WEB_PORT}`
const API = `http://localhost:${API_PORT}/api/v1`
const PYTHON =
  process.env.PYTHON ??
  [join(BACKEND, '.venv/bin/python'), join(ROOT, '../../../backend/.venv/bin/python')].find(
    existsSync
  ) ??
  'python3'
const DIR = process.env.E2E_DIR ?? mkdtempSync(join(tmpdir(), 'sm-auth-e2e-'))
const DEMO_EMAIL = 'f.dossou-yovo@agrobenin.bj'

const env = {
  ...process.env,
  DATABASE_URL: `sqlite:///${join(DIR, 'auth-e2e.sqlite3')}`,
  DEBUG: 'true',
  ALLOW_SIGNUP: 'true',
  CORS_ALLOWED_ORIGINS: WEB,
  FRONTEND_URL: WEB,
  EMAIL_BACKEND: 'django.core.mail.backends.console.EmailBackend',
  PYTHONUNBUFFERED: '1',
}

let failed = 0
function check(cond, msg) {
  console.log(`${cond ? 'OK   ' : 'ÉCHEC'} ${msg}`)
  if (!cond) failed++
}

/* ---------- Serveurs ---------- */

const children = []
let backendOut = ''

function manage(...args) {
  const r = spawnSync(PYTHON, ['manage.py', ...args], { cwd: BACKEND, env, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`manage.py ${args.join(' ')} : ${r.stderr || r.stdout}`)
}

function start(cmd, args, opts, onOut) {
  // Groupe de processus dédié : arrêt par PID (kill(-pid)) du serveur et de ses enfants.
  const child = spawn(cmd, args, { ...opts, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', (b) => onOut?.(b.toString()))
  child.stderr.on('data', (b) => onOut?.(b.toString()))
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

/** Dernier lien de définition du mot de passe écrit par le backend (console) pour `email`. */
async function waitResetLink(email, after, timeout = 10000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    const out = backendOut.slice(after)
    const i = out.lastIndexOf(`To: ${email}`)
    const m = i >= 0 && /(http\S+\?uid=[^&\s]+&token=\S+)/.exec(out.slice(i))
    if (m) return m[1]
    await new Promise((r) => setTimeout(r, 200))
  }
  return null
}

process.on('exit', stopAll)
process.on('SIGINT', () => process.exit(130))

console.log(`Base : ${env.DATABASE_URL}`)
manage('migrate', '--noinput')
manage('load_demo')
start(PYTHON, ['manage.py', 'runserver', API_PORT, '--noreload'], { cwd: BACKEND, env }, (s) => {
  backendOut += s
})
start('npx', ['vite', '--port', WEB_PORT, '--strictPort'], {
  cwd: ROOT,
  env: { ...process.env, VITE_API_URL: API },
})
await waitUrl(`${API}/health/`)
await waitUrl(WEB)

/* ---------- Scénarios ---------- */

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const pageErrors = []
async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => pageErrors.push(e.message))
  return page
}

try {
  const cfg = await (await fetch(`${API}/auth/config/`)).json()
  check(cfg.signup === true, 'GET /auth/config/ : inscription ouverte (ALLOW_SIGNUP=true)')

  // 1. Inscription d'un organisme -> onboarding
  const stamp = Date.now()
  const newEmail = `rsm.${stamp}@coop-e2e.bj`
  const newPwd = 'Coop-E2E-Solide-2026'
  let page = await newPage()
  await page.goto(WEB + '/login')
  await page.getByRole('link', { name: 'Créer un organisme' }).waitFor({ timeout: 10000 })
  check(
    await page.getByRole('link', { name: 'Mot de passe oublié ?' }).isVisible(),
    'Connexion : lien « Mot de passe oublié ? » affiché'
  )
  await page.getByRole('link', { name: 'Créer un organisme' }).click()
  await page.waitForURL(WEB + '/inscription')
  check((await page.locator('h1').textContent()) === 'Créer un organisme', 'Page /inscription')

  // Validation locale puis erreur serveur (e-mail déjà utilisé) affichée sous le champ
  await page.getByRole('button', { name: "Créer l'organisme" }).click()
  check(
    (await page.locator('.field.err').count()) === 4,
    'Inscription : 4 champs obligatoires signalés'
  )
  await page.fill('#f_organisation', `Coopérative E2E ${stamp}`)
  await page.fill('#f_nom', 'Awa KOUASSI')
  await page.fill('#f_email', DEMO_EMAIL)
  await page.fill('#f_password', newPwd)
  await page.getByRole('button', { name: "Créer l'organisme" }).click()
  await page.locator('.field.err[data-f="email"]').waitFor({ timeout: 10000 })
  check(
    /existe déjà/.test(await page.locator('[data-f="email"] .errmsg').textContent()),
    'Inscription : erreur serveur « e-mail déjà utilisé » sous le champ'
  )
  await page.fill('#f_email', newEmail)
  await page.getByRole('button', { name: "Créer l'organisme" }).click()
  await page.waitForURL(/\/onboarding\/1$/, { timeout: 15000 })
  check(true, 'Inscription réussie : arrivée sur /onboarding/1')
  const stored = await page.evaluate(() => localStorage.getItem('sm:refresh'))
  check(!!stored, 'Inscription : jeton de renouvellement conservé (session ouverte)')
  await page.reload()
  await page.waitForURL(/\/onboarding\/1$/)
  check(true, 'Session reprise après rechargement (reste sur l’onboarding)')
  const login = await fetch(`${API}/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: newEmail, password: newPwd }),
  })
  check(login.status === 200, 'Le nouveau Responsable SM peut se connecter (API)')
  await page.context().close()

  // 2. Inscription fermée (404 simulé) -> « Inscription fermée »
  page = await newPage()
  await page.route(`${API}/auth/signup/`, (r) =>
    r.fulfill({
      status: 404,
      contentType: 'application/json',
      body: '{"detail":"Inscription désactivée."}',
    })
  )
  await page.goto(WEB + '/inscription')
  await page.fill('#f_organisation', 'Fermée')
  await page.fill('#f_nom', 'X Y')
  await page.fill('#f_email', `closed.${stamp}@e2e.bj`)
  await page.fill('#f_password', newPwd)
  await page.getByRole('button', { name: "Créer l'organisme" }).click()
  await page.locator('#signupClosed').waitFor({ timeout: 10000 })
  check(
    (await page.locator('h1').textContent()) === 'Inscription fermée',
    'Inscription : 404 -> « Inscription fermée »'
  )
  await page.unroute(`${API}/auth/signup/`)
  await page.route(`${API}/auth/config/`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"signup":false}' })
  )
  await page.goto(WEB + '/login')
  await page.getByRole('link', { name: 'Mot de passe oublié ?' }).waitFor()
  await page.waitForTimeout(500)
  check(
    (await page.getByRole('link', { name: 'Créer un organisme' }).count()) === 0,
    'Connexion : pas de lien d’inscription si /auth/config/ renvoie signup=false'
  )
  await page.context().close()

  // 3. Mot de passe oublié -> lien par e-mail -> nouveau mot de passe -> connexion
  page = await newPage()
  await page.goto(WEB + '/login')
  await page.getByRole('link', { name: 'Mot de passe oublié ?' }).click()
  await page.waitForURL(WEB + '/mot-de-passe-oublie')
  const mark = backendOut.length
  await page.fill('#f_email', DEMO_EMAIL)
  await page.getByRole('button', { name: 'Recevoir le lien' }).click()
  await page.locator('#resetSent').waitFor({ timeout: 10000 })
  check(
    /Si un compte correspond/.test(await page.locator('#resetSent').textContent()),
    'Mot de passe oublié : message neutre affiché'
  )
  const link = await waitResetLink(DEMO_EMAIL, mark)
  check(!!link && link.startsWith(WEB + '/definir-mot-de-passe?'), `Lien reçu par e-mail : ${link}`)

  await page.goto(link)
  check(
    (await page.locator('h1').textContent()) === 'Définir votre mot de passe',
    'Page /definir-mot-de-passe'
  )
  await page.fill('#f_pwd', 'Nouveau-Mdp-E2E-2026')
  await page.fill('#f_pwd2', 'Autre-chose-2026')
  await page.getByRole('button', { name: 'Enregistrer le mot de passe' }).click()
  check(
    await page.locator('.field.err[data-f="pwd2"]').isVisible(),
    'Définition : confirmation différente signalée'
  )
  await page.fill('#f_pwd', 'password123')
  await page.fill('#f_pwd2', 'password123')
  await page.getByRole('button', { name: 'Enregistrer le mot de passe' }).click()
  await page.locator('.field.err[data-f="pwd"]').waitFor({ timeout: 10000 })
  const serverMsg = await page.locator('[data-f="pwd"] .errmsg').textContent()
  check(
    /courant|common/i.test(serverMsg),
    `Définition : erreur serveur affichée (« ${serverMsg} »)`
  )

  const NEW_PWD = 'Nouveau-Mdp-E2E-2026'
  await page.fill('#f_pwd', NEW_PWD)
  await page.fill('#f_pwd2', NEW_PWD)
  await page.getByRole('button', { name: 'Enregistrer le mot de passe' }).click()
  await page.waitForURL(WEB + '/login', { timeout: 10000 })
  check(
    /Mot de passe enregistré/.test(await page.locator('.note.ok').textContent()),
    'Retour sur /login avec le message de succès'
  )

  // Ancien mot de passe refusé, nouveau accepté
  await page.fill('#f_email', DEMO_EMAIL)
  await page.fill('#f_pwd', 'Demo-SM-2026!')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.locator('.field.err[data-f="pwd"]').waitFor({ timeout: 10000 })
  check(true, 'Ancien mot de passe refusé')
  await page.fill('#f_pwd', NEW_PWD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 })
  check(true, `Connexion avec le nouveau mot de passe -> ${new URL(page.url()).pathname}`)

  // Le lien ne sert qu'une fois
  await page.context().close()
  page = await newPage()
  await page.goto(link)
  await page.fill('#f_pwd', 'Encore-Un-Mdp-2026')
  await page.fill('#f_pwd2', 'Encore-Un-Mdp-2026')
  await page.getByRole('button', { name: 'Enregistrer le mot de passe' }).click()
  await page.locator('#linkError').waitFor({ timeout: 10000 })
  check(
    /invalide ou expiré/.test(await page.locator('#linkError').textContent()),
    'Lien réutilisé : « Lien invalide ou expiré » + demande d’un nouveau lien'
  )
  await page.goto(WEB + '/definir-mot-de-passe')
  check((await page.locator('#linkError').count()) === 1, 'Lien incomplet (sans uid/token) signalé')
  await page.context().close()

  check(pageErrors.length === 0, `Aucune erreur JS (${pageErrors.join(' | ') || 'aucune'})`)
} catch (e) {
  failed++
  console.error('ÉCHEC', e)
} finally {
  await browser.close()
  stopAll()
}

console.log(failed ? `\n${failed} échec(s)` : '\nTous les contrôles sont passés.')
process.exit(failed ? 1 : 0)
