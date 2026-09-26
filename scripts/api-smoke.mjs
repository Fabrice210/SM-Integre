/**
 * Test de fumée du mode API (front branché sur le backend Django).
 *
 * Prérequis :
 *   cd backend && .venv/bin/python manage.py migrate && .venv/bin/python manage.py load_demo
 *   CORS_ALLOWED_ORIGINS=http://localhost:5174 .venv/bin/python manage.py runserver 8000
 *   VITE_API_URL=http://localhost:8000/api/v1 npm run dev
 *
 * Usage : node scripts/api-smoke.mjs [http://localhost:5174]
 *
 * Vérifie : erreur serveur à la connexion, connexion réelle + onboarding (PATCH
 * /settings/), modification / création / suppression d'un processus persistées après
 * rechargement, journal envoyé au serveur, 404 d'une collection pas encore servie
 * gérée sans plantage, déconnexion (jetons purgés).
 */
import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:5174'
const API = process.env.API_URL ?? 'http://localhost:8000/api/v1'
const EMAIL = process.env.SM_EMAIL ?? 'f.dossou-yovo@agrobenin.bj'
const PWD = process.env.SM_PASSWORD ?? 'Demo-SM-2026!'

let failed = 0
function check(cond, msg) {
  console.log(`${cond ? 'OK   ' : 'ÉCHEC'} ${msg}`)
  if (!cond) failed++
}

// CHROMIUM_PATH : navigateur préinstallé si la version de Playwright n'a pas le sien
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
const pageErrors = []
const calls = []
page.on('pageerror', (e) => pageErrors.push(e.message))
page.on('response', (r) => {
  if (r.url().startsWith(API))
    calls.push(`${r.request().method()} ${r.url().slice(API.length)} ${r.status()}`)
})
const waitCall = (method, path, status) =>
  page.waitForResponse(
    (r) =>
      r.request().method() === method &&
      r.url() === API + path &&
      (!status || r.status() === status),
    { timeout: 10000 }
  )
const toasts = () => page.locator('.toast').allTextContents()

/** Appel direct à l'API, hors navigateur (contrôle de ce que le serveur a enregistré). */
let token
async function server(path, method = 'GET') {
  token ??= (
    await (
      await fetch(API + '/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PWD }),
      })
    ).json()
  ).access
  const r = await fetch(API + path, { method, headers: { Authorization: `Bearer ${token}` } })
  return r.status === 204 ? null : r.json()
}
const serverGet = (path) => server(path)

/** Modification du store depuis la page (serveur de dev Vite : même module que l'app). */
const storeUpdate = (fn) =>
  page.evaluate(
    (src) => import('/src/store/useApp.ts').then((m) => m.update(new Function('s', src))),
    fn
  )

try {
  await server('/processus/P13/', 'DELETE') // reste éventuel d'un passage précédent

  // 1. Mauvais mot de passe : message du serveur dans le style d'erreur du formulaire
  await page.goto(BASE + '/login')
  check((await page.inputValue('#f_pwd')) === '', 'mode API : identifiants non préremplis')
  await page.fill('#f_email', EMAIL)
  await page.fill('#f_pwd', 'mauvais-mot-de-passe')
  await page.click('button:has-text("Se connecter")')
  await page.waitForSelector('.field.err[data-f="pwd"]')
  const err = await page.textContent('[data-f="pwd"] .errmsg')
  check(!/8 caractères/.test(err), `erreur serveur affichée : « ${err} »`)

  // 2. Connexion réelle -> bootstrap -> onboarding (organisme pas encore configuré)
  await page.fill('#f_pwd', PWD)
  await page.click('button:has-text("Se connecter")')
  await page.waitForURL(/\/(onboarding|dashboard)/)
  check(
    calls.some((c) => c.startsWith('POST /auth/login/ 200')),
    'POST /auth/login/ 200'
  )
  check(
    calls.some((c) => c.startsWith('GET /bootstrap/ 200')),
    'GET /bootstrap/ 200'
  )
  if (page.url().includes('/onboarding')) {
    for (let i = 0; i < 30 && !page.url().includes('/dashboard'); i++) {
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
      await page.waitForTimeout(400)
    }
    if (!page.url().includes('/dashboard'))
      console.log(page.url(), await page.locator('button').allTextContents())
    check(page.url().includes('/dashboard'), 'onboarding terminé')
    await page.waitForTimeout(500)
    check(
      calls.some((c) => c.startsWith('PATCH /settings/ 200')),
      'onboarded envoyé : PATCH /settings/ 200'
    )
  }

  // 3. Rechargement complet sur /m1-processus : reprise de session (refresh + bootstrap)
  await page.goto(BASE + '/m1-processus')
  await page.waitForSelector('.pnode')
  check(page.url().endsWith('/m1-processus'), 'session reprise après rechargement')

  // 4. Modification d'un processus via l'interface
  const stamp = 'Finalité modifiée ' + Date.now()
  await page.locator('.pnode').first().click()
  await page.click('button:has-text("Modifier")')
  await page.fill('[data-f="finalite"] .inp', stamp)
  const put = waitCall('PUT', '/processus/P01/')
  await page.click('#saveBtn')
  check((await put).status() === 200, 'PUT /processus/P01/ 200')
  await page.waitForTimeout(500)
  check(
    calls.some((c) => c.startsWith('POST /journal/ 201')),
    'journal : POST /journal/ 201'
  )

  await page.reload()
  await page.waitForSelector('.pnode')
  await page.locator('.pnode').first().click()
  check(
    await page.locator(`.drawer :text("${stamp}")`).isVisible(),
    'modification persistée après rechargement (écran)'
  )
  const p01 = await serverGet('/processus/P01/')
  check(
    p01.finalite === stamp && Array.isArray(p01.hist),
    'modification persistée côté serveur (+ hist)'
  )
  await page.keyboard.press('Escape')

  // 5. Création d'une fiche processus (id fourni par le client : le code)
  await page.click('button:has-text("Fiches processus")')
  await page.click('button:has-text("Créer une fiche processus")')
  const code = await page.inputValue('[data-f="code"] .inp')
  let post = waitCall('POST', '/processus/')
  await page.click('#saveBtn')
  let created = await (await post).json()
  check(created.id === code, `POST /processus/ 201 -> id client ${created.id}`)

  // 6. Conflit : l'élément est supprimé côté serveur, puis modifié à l'écran
  //    -> PUT 404 sur une collection servie : toast + rechargement (bootstrap)
  await server(`/processus/${code}/`, 'DELETE')
  await page.locator('tr', { hasText: 'Recherche de financements' }).first().click()
  await page.click('.drawer button:has-text("Modifier")')
  const conflict = waitCall('PUT', `/processus/${code}/`)
  const reload = waitCall('GET', '/bootstrap/')
  await page.click('#saveBtn')
  check((await conflict).status() === 404, `PUT /processus/${code}/ 404 (supprimé ailleurs)`)
  check((await reload).status() === 200, 'rechargement GET /bootstrap/ après refus')
  await page.waitForTimeout(300)
  check(
    (await toasts()).some((t) => t.startsWith('Modification refusée par le serveur')),
    'toast d’erreur affiché'
  )
  check(
    (await page.locator('tr', { hasText: 'Recherche de financements' }).count()) === 0,
    'écran resynchronisé avec le serveur'
  )

  // 7. Recréation puis suppression (via le store : pas de bouton Supprimer sur un processus)
  await page.click('button:has-text("Créer une fiche processus")')
  post = waitCall('POST', '/processus/')
  await page.click('#saveBtn')
  created = await (await post).json()
  check(created.id === code, `POST /processus/ 201 (recréation ${code})`)
  const del = waitCall('DELETE', `/processus/${code}/`)
  await storeUpdate(`s.db.processus = s.db.processus.filter((p) => p.id !== '${code}')`)
  check((await del).status() === 204, `DELETE /processus/${code}/ 204`)
  const list = await serverGet('/processus/')
  check(!list.some((p) => p.id === code), 'suppression persistée côté serveur')

  // 8. Collection pas encore servie par le backend : 404 gérée (toast, pas de plantage)
  const served = Object.keys((await serverGet('/bootstrap/')).db)
  if (!served.includes('parties')) {
    await page.goto(BASE + '/m1-parties')
    await page.locator('.content tbody tr.click').first().click()
    await page.click('.drawer button:has-text("Modifier")')
    await page.click('#saveBtn')
    await page.waitForTimeout(1000)
    check(
      calls.some((c) => /^PUT \/parties\/.+ 404$/.test(c)),
      'PUT /parties/… 404 (non servie)'
    )
    check(
      (await toasts()).some((t) => t.includes("n'est pas encore géré par le serveur")),
      'toast d’avertissement affiché'
    )
    check(page.url().endsWith('/m1-parties'), 'app toujours utilisable')
  } else console.log('(parties déjà servie par le backend : test 404 sauté)')

  // 9. Déconnexion : jetons purgés, retour à la connexion
  await page.goto(BASE + '/dashboard')
  await page.waitForSelector('.content')
  await page.click('.nav-item:has-text("Déconnexion")')
  await page.waitForURL(/\/login/)
  await page.waitForTimeout(800)
  const left = await page.evaluate(
    () => localStorage.getItem('sm:refresh') || sessionStorage.getItem('sm:refresh')
  )
  check(!left, 'jetons purgés à la déconnexion')
  await page.goto(BASE + '/dashboard')
  await page.waitForURL(/\/login/)
  check(true, 'après déconnexion, /dashboard renvoie à /login')

  check(pageErrors.length === 0, `aucune erreur JS (${pageErrors.join(' | ')})`)
} catch (e) {
  failed++
  console.error('ÉCHEC', e)
  await page.screenshot({ path: 'test-results/api-smoke-failure.png' }).catch(() => {})
} finally {
  console.log('\nAppels API :\n  ' + calls.join('\n  '))
  await browser.close()
}
process.exit(failed ? 1 : 0)
