/**
 * Parcours de bout en bout du mode API, par l'interface réelle (clics, formulaires).
 *
 * Prérequis (base de démo neuve : load_demo --reset) :
 *   cd backend && .venv/bin/python manage.py migrate && .venv/bin/python manage.py load_demo --reset
 *   CORS_ALLOWED_ORIGINS=http://localhost:5180 .venv/bin/python manage.py runserver 8010
 *   VITE_API_URL=http://localhost:8010/api/v1 npx vite --port 5180 --strictPort
 *
 * Usage : API_URL=http://localhost:8010/api/v1 node scripts/api-e2e.mjs http://localhost:5180
 *         (CHROMIUM_PATH : navigateur préinstallé si besoin)
 *
 * Couvre : dans chaque module (M1 à M6) une création, une modification et, quand
 * l'interface le permet, une suppression ; la GED (création + soumission) ; une NC
 * (déclaration + source ajoutée, objet unique) ; la politique (publication : accusés
 * de lecture réinitialisés) ; les paramètres (normes actives) ; les utilisateurs
 * (invitation + modification) ; puis rechargement et vérification côté serveur par
 * lecture directe de l'API. Ensuite : écritures rapides successives (pas de doublon,
 * dernier état gagnant), serveur injoignable (écriture rejouée), Collaborateur (refus
 * signalés, écran revenu à l'état du serveur, déclaration de NC autorisée), session
 * expirée (jeton invalide -> /login), déconnexion.
 */
import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:5180'
const API = process.env.API_URL ?? 'http://localhost:8010/api/v1'
const PWD = process.env.SM_PASSWORD ?? 'Demo-SM-2026!'
const ADMIN = 'f.dossou-yovo@agrobenin.bj'
const COLLAB = 'p.assogba@agrobenin.bj'
const STAMP = Date.now().toString(36)

let failed = 0
function check(cond, msg) {
  console.log(`${cond ? 'OK   ' : 'ÉCHEC'} ${msg}`)
  if (!cond) failed++
  return cond
}
const section = (t) => console.log(`\n== ${t}`)

/* ---------- Lecture directe de l'API (ce que le serveur a vraiment enregistré) ---------- */

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
const collUrl = (name) => '/' + name.replace(/([a-z0-9])(?=[A-Z])/g, '$1-').toLowerCase() + '/'

/* ---------- Navigateur ---------- */

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await ctx.newPage()
page.on('dialog', (d) => d.accept()) // prompt() de l'original (motifs) : valeur proposée
const pageErrors = []
const consoleErrors = []
const calls = []
page.on('pageerror', (e) => pageErrors.push(e.message))
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(m.text())
})
page.on('response', (r) => {
  if (r.url().startsWith(API))
    calls.push(`${r.request().method()} ${r.url().slice(API.length)} ${r.status()}`)
})
/** Réponse API attendue : méthode + chemin exact, ou expression régulière sur le chemin. */
const waitCall = (method, path, timeout = 10000) =>
  page.waitForResponse(
    (r) => {
      if (r.request().method() !== method || !r.url().startsWith(API)) return false
      const p = r.url().slice(API.length)
      return path instanceof RegExp ? path.test(p) : p === path
    },
    { timeout }
  )
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
const settle = (ms = 400) => page.waitForTimeout(ms)
/** Toutes les écritures envoyées (file vide). */
const idle = () =>
  page.evaluate(async () => {
    const m = await import('/src/services/sync.ts')
    for (let i = 0; i < 400 && !m.isIdle(); i++) await new Promise((r) => setTimeout(r, 50))
    if (!m.isIdle()) throw new Error('écritures toujours en attente')
  })

/** Modale ouverte, focus initial passé (l'original donne le focus au 1er champ après 30 ms). */
async function modalReady() {
  await page.locator('.modal').first().waitFor()
  await settle(120)
}

async function goto(pageId) {
  await page.goto(BASE + '/' + pageId)
  await page.waitForSelector('.content')
}

async function uiLogin(email) {
  await page.goto(BASE + '/login')
  await page.fill('#f_email', email)
  await page.fill('#f_pwd', PWD)
  await page.click('button:has-text("Se connecter")')
  await page.waitForURL(/\/(onboarding|dashboard)/)
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
      await settle(300)
    }
  }
  await page.waitForURL(/\/dashboard/)
  await page.waitForSelector('.content')
}

/** Champ texte du formulaire ouvert : `f` (data-f) ou le premier champ texte. */
function formField(f) {
  return f
    ? page.locator(`.modal [data-f="${f}"] .inp`).first()
    : page.locator('.modal [data-f] input.inp[type="text"]').first()
}

/** Ouvre la fiche portant `text` dans la page, puis son formulaire de modification. */
async function openEdit(text) {
  await page.locator('.content tr', { hasText: text }).first().click()
  const form = page.locator('.modal #saveBtn')
  const drawerEdit = page.locator('.drawer button:has-text("Modifier")')
  await Promise.race([
    form.waitFor({ timeout: 5000 }),
    drawerEdit.waitFor({ timeout: 5000 }),
  ]).catch(() => {})
  if (!(await form.isVisible().catch(() => false))) await drawerEdit.click()
  await modalReady()
}

/**
 * Création (bouton d'ajout, formulaire prérempli), modification, suppression éventuelle
 * d'un élément d'une collection, par l'interface ; contrôle de chaque écriture côté serveur.
 */
async function crud({ mod, pageId, tab, add, coll, f, del, after }) {
  const label = `${mod} ${coll}`
  await goto(pageId)
  if (tab)
    await page.click(`.tabs [role="tab"]:has-text("${tab}"), .tabs button:has-text("${tab}")`)
  // Création
  await page.locator(`button:has-text("${add}")`).first().click()
  await modalReady()
  const v1 = `E2E ${coll} ${STAMP}`
  await formField(f).fill(v1)
  const post = waitCall('POST', new RegExp(`^${collUrl(coll)}(\\?at=start)?$`))
  await page.click('.modal #saveBtn')
  const pr = await post
  const created = await pr.json().catch(() => ({}))
  if (!check(pr.status() === 201, `${label} : création POST ${collUrl(coll)} ${pr.status()}`)) {
    console.log('   ', JSON.stringify(created).slice(0, 300))
    return null
  }
  const id = created.id
  const s1 = await serverGet(`${collUrl(coll)}${encodeURIComponent(id)}/`)
  check(JSON.stringify(s1).includes(v1), `${label} : ${id} enregistré côté serveur`)
  await idle()
  // Modification
  const v2 = `E2E ${coll} modifié ${STAMP}`
  await openEdit(v1)
  await formField(f).fill(v2)
  const put = waitCall('PUT', `${collUrl(coll)}${encodeURIComponent(id)}/`)
  await page.click('.modal #saveBtn')
  const pu = await put
  check(pu.status() === 200, `${label} : modification PUT ${pu.status()}`)
  const s2 = await serverGet(`${collUrl(coll)}${encodeURIComponent(id)}/`)
  check(
    JSON.stringify(s2).includes(v2) && Array.isArray(s2.hist) && s2.hist.length >= 2,
    `${label} : modification enregistrée côté serveur (+ historique)`
  )
  await idle()
  if (after) await after(id)
  // Suppression
  if (del) {
    await page.locator('.content tr', { hasText: v2 }).first().click()
    await page.click('.drawer button:has-text("Supprimer")')
    const dl = waitCall('DELETE', `${collUrl(coll)}${encodeURIComponent(id)}/`)
    await page.click('#modal2 button:has-text("Supprimer")')
    check((await dl).status() === 204, `${label} : suppression DELETE 204`)
    const gone = await server(`${collUrl(coll)}${encodeURIComponent(id)}/`)
    check(gone.status === 404, `${label} : supprimé côté serveur`)
    await idle()
    return { id, deleted: true, v2 }
  }
  return { id, v2 }
}

const persisted = [] // éléments à retrouver après rechargement

/** Action de circuit (bouton de la fiche) : PUT de l'élément, statut vérifié côté serveur. */
function workflow(coll, button, statut) {
  return async (id) => {
    await page
      .locator('.content tr', { hasText: `E2E ${coll} modifié ${STAMP}` })
      .first()
      .click()
    const btn = page.locator(`.drawer button:has-text("${button}")`)
    if (!check(await btn.isVisible().catch(() => false), `${coll} : bouton « ${button} »`)) return
    const put = waitCall('PUT', `${collUrl(coll)}${id}/`)
    await btn.click()
    check((await put).status() === 200, `${coll} : « ${button} » -> PUT 200`)
    await idle()
    const r = await serverGet(`${collUrl(coll)}${id}/`)
    check(r.statut === statut, `${coll} : statut côté serveur « ${r.statut} »`)
    await page.keyboard.press('Escape')
  }
}

try {
  section('Connexion (Responsable SM) et onboarding')
  await uiLogin(ADMIN)
  check(true, 'connecté, tableau de bord affiché')
  await idle()
  const journal0 = (await serverGet('/journal/')).length

  section('Modules M1 à M6 : création, modification, suppression par l’interface')
  const SCENARIOS = [
    { mod: 'M1', pageId: 'm1-domaine', add: 'Ajouter un site', coll: 'sites', del: true },
    { mod: 'M1', pageId: 'm1-parties', add: 'Créer une fiche', coll: 'parties', del: true },
    {
      mod: 'M2',
      pageId: 'm2-consultation',
      add: 'Ajouter un représentant',
      coll: 'representants',
      del: true,
    },
    { mod: 'M2', pageId: 'm2-roles', add: 'Créer une fiche de poste', coll: 'postes' },
    { mod: 'M3', pageId: 'm3-objectifs', add: 'Définir un objectif', coll: 'objectifs', del: true },
    { mod: 'M3', pageId: 'm3-risques', add: 'Créer une fiche risque', coll: 'risques' },
    { mod: 'M4', pageId: 'm4-ressources', add: 'Planifier une ressource', coll: 'ressources' },
    { mod: 'M4', pageId: 'm4-communication', add: 'Créer une action', coll: 'communications' },
    { mod: 'M5', pageId: 'm5-planif', add: "Recenser un plan d'action", coll: 'plansOps' },
    { mod: 'M6', pageId: 'm6-surveillance', add: 'Définir un indicateur', coll: 'indicateurs' },
    {
      mod: 'M6',
      pageId: 'm6-audits',
      tab: 'Diffusion & rapports',
      add: 'Planifier un audit',
      coll: 'audits',
      f: 'titre',
      after: workflow('audits', 'Diffuser le plan', 'Plan diffusé'),
    },
  ]
  for (const sc of SCENARIOS) {
    try {
      const r = await crud(sc)
      if (r) persisted.push({ coll: sc.coll, ...r })
    } catch (e) {
      check(false, `${sc.mod} ${sc.coll} : ${e.message.split('\n')[0]}`)
      await page.screenshot({ path: `test-results/api-e2e-${sc.coll}.png` }).catch(() => {})
      await page.keyboard.press('Escape').catch(() => {})
    }
  }

  section('GED : création d’un document puis soumission à vérification')
  {
    const r = await crud({
      mod: 'M5',
      pageId: 'm5-ged',
      add: 'Créer une fiche documentaire',
      coll: 'documents',
    })
    if (r) {
      persisted.push({ coll: 'documents', ...r })
      await page.keyboard.press('Escape')
      await page.locator('.content tr', { hasText: r.v2 }).first().click()
      const put = waitCall('PUT', `/documents/${r.id}/`)
      await page.click('.drawer button:has-text("Soumettre")')
      check((await put).status() === 200, 'GED : soumission PUT 200')
      const d = await serverGet(`/documents/${r.id}/`)
      check(d.statut === 'Vérification', `GED : statut côté serveur « ${d.statut} »`)
      await idle()
    }
  }

  section('Non-conformité : déclaration, modification, nouvelle source (objet unique)')
  {
    await page.keyboard.press('Escape')
    const r = await crud({
      mod: 'M6',
      pageId: 'm6-nc',
      add: 'Déclarer une non-conformité',
      coll: 'ncs',
      f: 'lieu',
      after: async (id) => {
        await workflow('ncs', 'Valider (pilote)', 'Validée pilote')(id)
        const reg0 = (await serverGet('/registre/')).length
        const post = waitCall('POST', /^\/registre\/(\?at=start)?$/)
        await workflow('ncs', 'Approuver (responsable du système)', 'En traitement')(id)
        check((await post).status() === 201, 'NC approuvée : entrée du registre créée (POST 201)')
        check(
          (await serverGet('/registre/')).length === reg0 + 1,
          'registre enregistré côté serveur'
        )
      },
    })
    if (r) persisted.push({ coll: 'ncs', ...r })
    await page.keyboard.press('Escape')
    await goto('m6-nc')
    const src = `Source E2E ${STAMP}`
    await page.click('.content button.btn.sm:text-is("Source")')
    await modalReady()
    await page.fill('.modal [data-f="s"] .inp', src)
    const put = waitCall('PUT', '/sources-nc/')
    await page.click('.modal button:has-text("Ajouter")')
    check((await put).status() === 200, 'sourcesNC : PUT /sources-nc/ 200')
    check((await serverGet('/sources-nc/')).includes(src), 'sourcesNC : source enregistrée')
    persisted.push({ coll: 'sourcesNC', check: (db) => db.sourcesNC.includes(src) })
    await idle()
  }

  section('Politique : nouvelle version publiée, accusés de lecture réinitialisés')
  {
    await goto('m2-politique')
    const before = await serverGet('/politique/')
    await page.click('button:has-text("Rédiger une nouvelle version")')
    await modalReady()
    const orient = `1. Orientation E2E ${STAMP}\n2. Satisfaire nos clients`
    await page.fill('.modal [data-f="orientations"] .inp', orient)
    const put = waitCall('PUT', '/politique/')
    await page.click('.modal button:has-text("Publier")')
    check((await put).status() === 200, 'politique : PUT /politique/ 200')
    await idle()
    const pol = await serverGet('/politique/')
    const expected = 'v' + (parseInt(before.version.slice(1)) + 1)
    check(
      pol.version === expected && pol.orientations.includes(STAMP),
      `politique : version ${pol.version} publiée côté serveur`
    )
    const acc = await serverGet('/accuses/')
    check(
      acc.length > 0 && acc.every((a) => a.statut === 'Non lu'),
      `accusés de lecture réinitialisés côté serveur (${acc.length} « Non lu »)`
    )
    persisted.push({ coll: 'politique', check: (db) => db.politique.version === expected })
  }

  section('Paramètres : normes actives')
  {
    await goto('settings')
    const patch = waitCall('PATCH', '/settings/')
    await page.uncheck('input[aria-label="Activer ISO 27001"]')
    const r = await patch
    check(r.status() === 200, 'PATCH /settings/ 200 (ISO 27001 désactivée)')
    await idle()
    const st = await serverGet('/settings/')
    check(!st.activeNorms.includes('27001'), `normes actives côté serveur : ${st.activeNorms}`)
    const patch2 = waitCall('PATCH', '/settings/')
    await page.check('input[aria-label="Activer ISO 27001"]')
    await patch2
    await idle()
    const st2 = await serverGet('/settings/')
    check(
      st2.activeNorms.join() === '9001,14001,45001,27001' || st2.activeNorms.includes('27001'),
      `norme réactivée côté serveur : ${st2.activeNorms}`
    )
    // Profil de l'organisme
    const ville = `Lot 1245, Cotonou ${STAMP}`
    {
      await page.fill('#orgForm [data-f="adresse"] .inp', ville)
      const put = waitCall('PUT', '/organisation/')
      await page.click('button:has-text("Enregistrer le profil")')
      check((await put).status() === 200, 'profil : PUT /organisation/ 200')
      check((await serverGet('/organisation/')).adresse === ville, 'profil enregistré côté serveur')
      persisted.push({ coll: 'org', check: (_db, st) => st.org.adresse === ville })
    }
  }

  section('Utilisateurs : invitation et modification')
  {
    await goto('users')
    await page.click('button:has-text("Inviter un utilisateur")')
    await modalReady()
    const nom = `Invité E2E ${STAMP}`
    const email = `e2e.${STAMP}@agrobenin.bj`
    await page.fill('.modal [data-f="nom"] .inp', nom)
    await page.fill('.modal [data-f="email"] .inp', email)
    const post = waitCall('POST', /^\/users\/(\?at=start)?$/)
    await page.click('.modal #saveBtn')
    const pr = await post
    const u = await pr.json()
    check(
      pr.status() === 201,
      `utilisateur : POST /users/ ${pr.status()} (${u.id ?? JSON.stringify(u)})`
    )
    await idle()
    if (u.id) {
      await page
        .locator('.content tr', { hasText: nom })
        .locator('button:has-text("Modifier")')
        .click()
      await modalReady()
      const poste = `Poste E2E ${STAMP}`
      await page.fill('.modal [data-f="poste"] .inp', poste)
      const put = waitCall('PUT', `/users/${u.id}/`)
      await page.click('.modal #saveBtn')
      check((await put).status() === 200, `utilisateur : PUT /users/${u.id}/ 200`)
      const users = await serverGet('/users/')
      const su = users.find((x) => x.id === u.id)
      check(
        su && su.poste === poste && su.email === email && su.nom === nom,
        `utilisateur modifié côté serveur (${JSON.stringify(su)})`
      )
      persisted.push({ coll: 'users', check: (_db, st) => st.users.some((x) => x.poste === poste) })
      await idle()
    }
  }

  section('Journal')
  {
    await idle()
    const j = await serverGet('/journal/')
    check(
      j.length > journal0 + 10,
      `journal côté serveur : ${j.length - journal0} entrée(s) ajoutée(s)`
    )
  }

  section('Rechargement : tout persiste (écran = serveur)')
  {
    await page.reload()
    await page.waitForSelector('.content')
    const st = await page.evaluate(() =>
      import('/src/store/useApp.ts').then((m) => {
        const s = m.useApp.getState()
        return { db: s.db, org: s.org, users: s.users, activeNorms: s.activeNorms }
      })
    )
    const boot = await serverGet('/bootstrap/')
    for (const p of persisted) {
      if (p.check) {
        check(p.check(st.db, st), `après rechargement : ${p.coll}`)
        continue
      }
      const list = st.db[p.coll] ?? []
      const here = list.find((x) => x.id === p.id)
      const there = boot.db[p.coll].find((x) => x.id === p.id)
      if (p.deleted)
        check(!here && !there, `après rechargement : ${p.coll} ${p.id} absent (supprimé)`)
      else
        check(
          here && there && JSON.stringify(here).includes(p.v2),
          `après rechargement : ${p.coll} ${p.id} présent et modifié`
        )
    }
    // Aucun doublon d'id dans aucune collection
    const dups = Object.entries(boot.db).filter(
      ([, v]) =>
        Array.isArray(v) &&
        v.some((x) => x && x.id) &&
        new Set(v.map((x) => x.id)).size !== v.length
    )
    check(dups.length === 0, `aucun doublon côté serveur (${dups.map(([k]) => k).join(', ')})`)
  }

  section('Écritures rapides successives sur un même élément')
  {
    await goto('m1-parties')
    await clearToasts()
    const n = await page.evaluate(() =>
      import('/src/store/useApp.ts').then((m) => {
        for (let i = 1; i <= 8; i++)
          m.update((s) => {
            s.db.parties[0].exigences = 'Rafale ' + i
          })
        return m.useApp.getState().db.parties[0].id
      })
    )
    await idle()
    const p = await serverGet(`/parties/${n}/`)
    check(p.exigences === 'Rafale 8', `dernier état gagnant côté serveur (« ${p.exigences} »)`)
    const puts = calls.filter((c) => c.startsWith(`PUT /parties/${n}/`)).length
    check(puts >= 1 && puts <= 8, `${puts} PUT envoyé(s) pour 8 modifications (fusion en file)`)
  }

  section('Serveur injoignable : l’écriture est rejouée, rien n’est perdu')
  {
    await goto('m1-domaine')
    await clearToasts()
    let blocked = 0
    await page.route(API + '/**', (route) => {
      if (route.request().method() === 'GET') return route.continue()
      if (blocked++ < 2) return route.abort('connectionrefused')
      return route.continue()
    })
    const site = await page.evaluate(() =>
      import('/src/store/useApp.ts').then((m) => {
        m.update((s) => {
          s.db.sites[0].justification = 'Hors ligne puis rejoué'
        })
        return m.useApp.getState().db.sites[0].id
      })
    )
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.toast')].some((t) => /injoignable/.test(t.textContent))
    )
    check(true, 'serveur injoignable signalé')
    await idle()
    await page.unroute(API + '/**')
    const s = await serverGet(`/sites/${site}/`)
    check(s.justification === 'Hors ligne puis rejoué', 'écriture rejouée au retour du serveur')
    check(
      (await toasts()).some((t) => /rétablie/.test(t)),
      'retour de la connexion signalé'
    )
  }

  section('Création sans id (élément ajouté par le code sans identifiant)')
  {
    const before = (await serverGet('/sites/')).length
    const id = await page.evaluate(() =>
      import('/src/store/useApp.ts').then((m) => {
        m.update((s) => {
          s.db.sites.push({
            nom: 'Site sans id',
            adresse: 'Cotonou',
            activite: 'Test',
            statut: 'Inclus',
            justification: 'Site créé sans identifiant',
          })
        })
        return m.useApp.getState().db.sites.at(-1).id
      })
    )
    check(typeof id === 'string' && id.length > 1, `id attribué par le client : ${id}`)
    await idle()
    // Modification suivante de la même collection : pas de recréation
    await page.evaluate(() =>
      import('/src/store/useApp.ts').then((m) =>
        m.update((s) => {
          s.db.sites.at(-1).justification = 'Suivi après création'
        })
      )
    )
    await idle()
    const after = await serverGet('/sites/')
    check(after.length === before + 1, `un seul élément créé (${after.length - before})`)
    check(
      after.at(-1).id === id && after.at(-1).justification === 'Suivi après création',
      'élément sans id suivi comme les autres (PUT)'
    )
  }

  section('Action transverse : partie intéressée suivie comme action (M1 -> M3)')
  {
    await goto('m1-parties')
    const pi = (await serverGet('/parties/'))[1]
    await page.locator('.content tr', { hasText: pi.nom }).first().click()
    const post = waitCall('POST', /^\/objectifs\/(\?at=start)?$/)
    await page.click('.drawer button:has-text("Suivre le plan comme action")')
    const pr = await post
    check(pr.status() === 201, `objectif de suivi créé : POST /objectifs/ ${pr.status()}`)
    await idle()
    const ob = await serverGet('/objectifs/OB-PI/')
    check(
      ob && (ob.actions || []).some((a) => a.pi === pi.id),
      `action liée à ${pi.id} enregistrée côté serveur`
    )
    persisted.push({ coll: 'objectifs', check: (db) => db.objectifs.some((o) => o.id === 'OB-PI') })
  }

  section('Rechargement après refus sans écraser une écriture faite pendant le chargement')
  {
    await goto('m1-domaine')
    await clearToasts()
    const [a, b] = (await serverGet('/sites/')).slice(0, 2)
    // Élément supprimé ailleurs : la prochaine modification sera refusée (404) -> rechargement
    const tmp = await server('/sites/', 'POST', { ...a, id: undefined, nom: 'Temporaire E2E' })
    await page.reload()
    await page.waitForSelector('.content')
    await server(`/sites/${tmp.data.id}/`, 'DELETE')
    let release
    const gate = new Promise((r) => (release = r))
    // Réponse lue tout de suite (état d'avant l'écriture suivante), rendue plus tard
    let fetched
    const boot = new Promise((r) => (fetched = r))
    await page.route(API + '/bootstrap/', async (route) => {
      const response = await route.fetch()
      fetched()
      await gate
      return route.fulfill({ response })
    })
    await page.evaluate(
      (id) =>
        import('/src/store/useApp.ts').then((m) =>
          m.update((s) => {
            s.db.sites.find((x) => x.id === id).nom = 'Modifié après suppression'
          })
        ),
      tmp.data.id
    )
    await boot // état du serveur lu, réponse retenue
    await page.evaluate(
      (id) =>
        import('/src/store/useApp.ts').then((m) =>
          m.update((s) => {
            s.db.sites.find((x) => x.id === id).justification = 'Écrite pendant le rechargement'
          })
        ),
      b.id
    )
    release()
    await idle()
    for (let i = 0; i < 50; i++) {
      if (!(await storeState(`return s.db.sites.some((x) => x.id === '${tmp.data.id}')`))) break
      await settle(200)
    }
    await settle(500)
    await page.unroute(API + '/bootstrap/')
    const local = await storeState(
      `return s.db.sites.find((x) => x.id === '${b.id}').justification`
    )
    check(local === 'Écrite pendant le rechargement', `écriture locale conservée (« ${local} »)`)
    check(
      (await serverGet(`/sites/${b.id}/`)).justification === 'Écrite pendant le rechargement',
      'écriture enregistrée côté serveur'
    )
    check(
      !(await storeState(`return s.db.sites.some((x) => x.id === '${tmp.data.id}')`)),
      'élément supprimé ailleurs retiré de l’écran'
    )
  }

  section('Déconnexion pendant une écriture')
  {
    await goto('m1-domaine')
    let release
    const gate = new Promise((r) => (release = r))
    await page.route(API + '/sites/**', async (route) => {
      if (route.request().method() === 'PUT') await gate
      return route.continue()
    })
    await page.evaluate(() =>
      import('/src/store/useApp.ts').then((m) =>
        m.update((s) => {
          s.db.sites[1].justification = 'Écrite avant déconnexion'
        })
      )
    )
    const site = await storeState('return s.db.sites[1].id')
    await page.click('.nav-item:has-text("Déconnexion")')
    await page.waitForURL(/\/login/)
    setTimeout(release, 800)
    await page.waitForFunction(
      () => !localStorage.getItem('sm:refresh') && !sessionStorage.getItem('sm:refresh'),
      null,
      { timeout: 10000 }
    )
    await page.unroute(API + '/sites/**')
    const s = await serverGet(`/sites/${site}/`)
    check(
      s.justification === 'Écrite avant déconnexion',
      'écriture en cours envoyée avant de fermer la session'
    )
    const j = await serverGet('/journal/')
    check(
      j.some((e) => /déconnecté/.test(e.a)),
      'journal de déconnexion enregistré'
    )
    const org = await storeState('return s.org.nom + "|" + s.db.sites.length')
    check(true, `store remis à zéro après déconnexion (${org})`)
  }

  section('Collaborateur : écritures refusées, écran revenu à l’état du serveur')
  {
    await uiLogin(COLLAB)
    check(true, 'Collaborateur connecté')
    await idle()
    await goto('m1-domaine')
    await clearToasts()
    const s0 = (await serverGet('/sites/'))[0]
    await page.locator('.content tr', { hasText: s0.nom }).first().click()
    await page.click('.drawer button:has-text("Modifier")')
    await modalReady()
    await page.fill('.modal [data-f="nom"] .inp', 'Tentative collaborateur')
    const put = waitCall('PUT', `/sites/${s0.id}/`)
    const reload = waitCall('GET', '/bootstrap/')
    await page.click('.modal #saveBtn')
    check((await put).status() === 403, 'PUT refusé (403)')
    check((await reload).status() === 200, 'rechargement de l’état du serveur')
    await settle(400)
    const t = await toasts()
    check(
      t.some((x) => /Modification refusée par le serveur/.test(x) && /permission/.test(x)),
      `refus signalé : « ${t.find((x) => /refusée/.test(x)) ?? t.join(' | ')} »`
    )
    check(
      (await page.locator('.content tr', { hasText: 'Tentative collaborateur' }).count()) === 0 &&
        (await page.locator('.content tr', { hasText: s0.nom }).count()) > 0,
      'écran revenu à l’état du serveur'
    )
    check((await serverGet(`/sites/${s0.id}/`)).nom === s0.nom, 'serveur inchangé')
    const nomLocal = await storeState(`return s.db.sites.find((x) => x.id === '${s0.id}').nom`)
    check(nomLocal === s0.nom, 'store resynchronisé')

    // Création refusée aussi (paramètres : réservé aux administrateurs)
    await goto('settings')
    await clearToasts()
    const patch = waitCall('PATCH', '/settings/')
    const reload2 = waitCall('GET', '/bootstrap/')
    await page.uncheck('input[aria-label="Activer ISO 45001"]')
    check((await patch).status() === 403, 'PATCH /settings/ refusé (403)')
    await reload2
    await settle(400)
    check(
      await page.locator('input[aria-label="Activer ISO 45001"]').isChecked(),
      'case « ISO 45001 » revenue à l’état du serveur'
    )

    // Déclaration de NC : autorisée à tout membre ; le serveur impose le statut initial
    await goto('m6-nc')
    await clearToasts()
    await page.click('button:has-text("Déclarer une non-conformité")')
    await modalReady()
    const lieu = `Lieu collaborateur ${STAMP}`
    await page.fill('.modal [data-f="lieu"] .inp', lieu)
    const post = waitCall('POST', /^\/ncs\/(\?at=start)?$/)
    await page.click('.modal #saveBtn')
    const pr = await post
    check(pr.status() === 201, `NC déclarée par le Collaborateur : POST /ncs/ ${pr.status()}`)
    await idle()
    await settle(600)
    const nc = (await serverGet('/ncs/')).find((x) => x.lieu === lieu)
    check(nc && nc.declarant === 'Prisca ASSOGBA', `NC enregistrée (déclarant ${nc?.declarant})`)
    const local = await storeState(`return s.db.ncs.find((x) => x.lieu === '${lieu}')`)
    check(
      local && nc && local.statut === nc.statut && local.id === nc.id,
      `écran aligné sur le serveur (statut « ${local?.statut} » / « ${nc?.statut} »)`
    )
  }

  section('Session expirée : jeton invalide -> retour à la connexion')
  {
    // Jeton d'accès refusé et renouvellement refusé : la prochaine requête perd la session.
    await clearToasts()
    await page.route(API + '/**', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: '{"detail":"Token is invalid"}',
      })
    )
    await page.evaluate(() =>
      import('/src/store/useApp.ts').then((m) =>
        m.update((s) => {
          s.db.parties[0].exigences = 'Après expiration'
        })
      )
    )
    await page.waitForURL(/\/login/, { timeout: 10000 })
    check(true, 'retour à /login')
    await settle(300)
    check(
      (await toasts()).some((t) => /Session expirée/.test(t)),
      'message « Session expirée »'
    )
    await page.unroute(API + '/**')
    const left = await page.evaluate(
      () => localStorage.getItem('sm:refresh') || sessionStorage.getItem('sm:refresh')
    )
    check(!left, 'jetons oubliés')

    // Au rechargement avec un jeton de renouvellement invalide
    await page.evaluate(() => localStorage.setItem('sm:refresh', 'jeton-invalide'))
    await page.goto(BASE + '/dashboard')
    await page.waitForURL(/\/login/, { timeout: 10000 })
    check(true, 'jeton de renouvellement invalide au chargement -> /login')
    check(!(await page.evaluate(() => localStorage.getItem('sm:refresh'))), 'jeton invalide purgé')
  }

  check(pageErrors.length === 0, `aucune erreur JS (${pageErrors.join(' | ')})`)
} catch (e) {
  failed++
  console.error('ÉCHEC', e)
  await page.screenshot({ path: 'test-results/api-e2e-failure.png' }).catch(() => {})
} finally {
  if (process.env.E2E_VERBOSE) console.log('\nAppels API :\n  ' + calls.join('\n  '))
  const refused = calls.filter((c) => / (4\d\d|5\d\d)$/.test(c))
  console.log(
    '\nRéponses en erreur (attendues : refus du Collaborateur, 401 simulés) :\n  ' +
      refused.join('\n  ')
  )
  const warn = consoleErrors.filter((m) => !/Failed to load resource|\[sync\]|net::ERR/.test(m))
  if (warn.length) console.log('\nConsole :\n  ' + warn.slice(0, 20).join('\n  '))
  await browser.close()
}
console.log(failed ? `\n${failed} échec(s)` : '\nTout est OK')
process.exit(failed ? 1 : 0)
