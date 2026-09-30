/**
 * Actions métier branchées sur les routes du serveur (mode API).
 *
 * Chaque action est déclenchée par le code de l'écran (fonction de la fiche, bouton de la
 * modale ou du tiroir) ; on vérifie que la route d'action du serveur est appelée, que l'état
 * est rechargé (GET /bootstrap/), puis ce que le serveur a réellement enregistré.
 *
 * Prérequis : ceux de scripts/api-e2e.mjs (base de démo neuve : load_demo --reset).
 * Usage : API_URL=http://localhost:8010/api/v1 node scripts/api-actions-e2e.mjs http://localhost:5180
 */
import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:5180'
const API = process.env.API_URL ?? 'http://localhost:8010/api/v1'
const PWD = process.env.SM_PASSWORD ?? 'Demo-SM-2026!'
const ADMIN = 'f.dossou-yovo@agrobenin.bj'
const STAMP = Date.now().toString(36)

let failed = 0
function check(cond, msg) {
  console.log(`${cond ? 'OK   ' : 'ÉCHEC'} ${msg}`)
  if (!cond) failed++
  return cond
}
const section = (t) => console.log(`\n== ${t}`)

/* ---------- Lecture directe de l'API ---------- */

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
const get = async (path) => (await server(path)).data
const one = (coll, id) => get(`/${coll}/${id}/`)

/* ---------- Navigateur ---------- */

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await ctx.newPage()
page.on('dialog', (d) => d.accept(d.defaultValue())) // prompt() (motifs) : valeur proposée
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(e.message))

const settle = (ms = 250) => page.waitForTimeout(ms)
const idle = () =>
  page.evaluate(async () => {
    const m = await import('/src/services/sync.ts')
    for (let i = 0; i < 400 && !m.isIdle(); i++) await new Promise((r) => setTimeout(r, 50))
  })
const closeAll = async () => {
  await page.evaluate(() =>
    import('/src/store/useOverlays.ts').then((m) => {
      m.closeModal('modal2')
      m.closeModal()
      m.closeModal('drawer')
      m.useOverlays.setState({ toasts: [] })
    })
  )
  await settle(80)
}
const toasts = () => page.locator('.toast').allTextContents()
/** Appelle une fonction exportée par un module de l'écran (même instance que l'application). */
const call = (mod, fn, ...args) =>
  page.evaluate(([mod, fn, args]) => import(mod).then((m) => void m[fn](...args)), [mod, fn, args])
const F = (p) => '/src/features/' + p
const fill = (k, v) => page.locator(`.modal [data-f="${k}"] .inp`).last().fill(v)
const clickModal = async () => {
  await page.locator('.modal').last().waitFor()
  await settle(150)
  await page.locator('.modal .btn.primary').last().click()
}
const clickDrawer = (text) => page.locator('.drawer button', { hasText: text }).first().click()

/**
 * Déclenche une action et attend sa route serveur puis le rechargement ; `verify` renvoie
 * true (ou un texte d'erreur) d'après l'état lu directement sur le serveur.
 */
async function step(name, path, trigger, verify, { method = 'POST', expect = [200, 201] } = {}) {
  await closeAll()
  const match = (r) => {
    if (r.request().method() !== method || !r.url().startsWith(API)) return false
    const p = r.url().slice(API.length)
    return path instanceof RegExp ? path.test(p) : p === path
  }
  const res = page.waitForResponse(match, { timeout: 12000 }).catch(() => null)
  const ok = expect.some((s) => s < 400)
  const reload = ok
    ? page
        .waitForResponse((r) => r.url() === API + '/bootstrap/', { timeout: 12000 })
        .catch(() => null)
    : null
  try {
    await trigger()
  } catch (e) {
    check(false, `${name} : ${e.message.split('\n')[0]}`)
    return false
  }
  const r = await res
  if (!r) return check(false, `${name} : ${method} ${path} jamais appelée`)
  const body = expect.includes(r.status()) ? '' : ' ' + (await r.text()).slice(0, 200)
  if (!check(expect.includes(r.status()), `${name} : ${method} ${path} -> ${r.status()}${body}`))
    return false
  if (reload) await reload
  await idle()
  await settle(150)
  if (!verify) return true
  const v = await verify(await r.json().catch(() => null))
  return check(v === true, `${name} : état du serveur${v === true ? '' : ' — ' + v}`)
}

try {
  await page.goto(BASE + '/login')
  await page.fill('#f_email', ADMIN)
  await page.fill('#f_pwd', PWD)
  await page.click('button:has-text("Se connecter")')
  await page.waitForURL(/\/(onboarding|dashboard)/)
  if (page.url().includes('/onboarding')) {
    await page.evaluate(() =>
      import('/src/store/useApp.ts').then((m) =>
        m.update((s) => {
          s.onboarded = true
          if (s.session) s.session.onboarded = true
        })
      )
    )
    await idle()
    await page.evaluate(() =>
      import('/src/app/routerRef.ts').then((m) => m.routerRef.navigate('/dashboard'))
    )
  }
  await page.waitForSelector('.content')
  const journal0 = (await get('/journal/')).length

  section('Module 1 — Contexte')
  {
    await step('enjeux générés', '/enjeux/generer/', () =>
      call(F('m1-contexte/actions.tsx'), 'genEnjeux')
    )
    const v0 = (await get('/analyse-versions/')).length
    await step(
      "version de l'analyse figée",
      '/analyse-versions/figer/',
      async () => {
        await call(F('m1-contexte/actions.tsx'), 'saveVersion', 'analyseVersions', 'Enjeux')
        await clickModal()
      },
      async () => (await get('/analyse-versions/')).length === v0 + 1 || 'aucune version ajoutée'
    )
    const pi = (await get('/parties/'))[0]
    await step(
      "plan d'engagement basculé",
      `/parties/${pi.id}/basculer-plan/`,
      async () => {
        await call(F('m1-contexte/details.tsx'), 'piDetail', pi.id)
        await clickDrawer(/Déclarer le plan mis en œuvre|Repasser à traiter/)
      },
      async () =>
        (await one('parties', pi.id)).planMisEnOeuvre === !pi.planMisEnOeuvre || 'plan inchangé'
    )
  }

  section('Module 2 — Leadership')
  {
    const rep = (await get('/representants/')).find((r) => r.statut !== 'Révoqué')
    await step(
      'mandat révoqué',
      `/representants/${rep.id}/revoquer/`,
      async () => {
        await call(F('m2-leadership/consultationActions.tsx'), 'repDetail', rep.id)
        await clickDrawer('Révoquer le mandat')
      },
      async () => (await one('representants', rep.id)).statut === 'Révoqué' || 'statut inchangé'
    )
    await step(
      'mandat réactivé',
      `/representants/${rep.id}/reactiver/`,
      async () => {
        await call(F('m2-leadership/consultationActions.tsx'), 'repDetail', rep.id)
        await clickDrawer('Réactiver le mandat')
      },
      async () => (await one('representants', rep.id)).statut === 'Actif' || 'statut inchangé'
    )
    const r0 = (await get('/reunions/')).length
    await step(
      'réunions planifiées',
      '/reunions/planifier-annee/',
      () => call(F('m2-leadership/consultationActions.tsx'), 'planifierAnnee'),
      async (d) => (await get('/reunions/')).length === r0 + d.planifiees || 'nombre de réunions'
    )
    const reu = (await get('/reunions/')).find((r) => r.statut === 'Planifiée')
    await step(
      'réunion réalisée',
      `/reunions/${reu.id}/realiser/`,
      async () => {
        await call(F('m2-leadership/consultationActions.tsx'), 'marquerReunionFaite', reu.id)
        await page.locator('.modal').last().waitFor()
        await fill('compteRendu', `Compte rendu E2E ${STAMP}`)
        await fill('planAction', 'Action, responsable, échéance')
        await fill('preuve1', 'PV_e2e.pdf')
        await fill('preuve2', 'Presence_e2e.pdf')
        await clickModal()
      },
      async () => {
        const r = await one('reunions', reu.id)
        return (r.statut === 'Réalisée' && r.preuve2 === 'Presence_e2e.pdf') || 'réunion inchangée'
      }
    )
    await step('résumé de la politique régénéré', '/politique/regenerer-resume/', () =>
      call(F('m2-leadership/politiqueActions.tsx'), 'regenPolResume')
    )
    await step('lecteurs relancés', '/accuses/relancer/', async () => {
      await page.evaluate(() =>
        import('/src/app/routerRef.ts').then((m) => m.routerRef.navigate('/m2-politique'))
      )
      await page.click('button:has-text("Relancer les non-lus")')
    })
  }

  section('Module 3 — Planification')
  {
    const ob = (await get('/objectifs/'))[0]
    const n0 = ob.actions.length
    await step(
      'action ajoutée à un objectif',
      `/objectifs/${ob.id}/actions/`,
      async () => {
        await call(F('m3-planification/objectifs.tsx'), 'editAction', ob.id, -1)
        await page.locator('.modal').last().waitFor()
        await fill('libelle', `Action E2E ${STAMP}`)
        await clickModal()
      },
      async () => (await one('objectifs', ob.id)).actions.length === n0 + 1 || "pas d'action ajoutée"
    )
    await step(
      "action d'objectif modifiée",
      `/objectifs/${ob.id}/actions/${n0}/`,
      async () => {
        await call(F('m3-planification/objectifs.tsx'), 'editAction', ob.id, n0)
        await page.locator('.modal').last().waitFor()
        await fill('libelle', `Action E2E modifiée ${STAMP}`)
        await clickModal()
      },
      async () => {
        const a = (await one('objectifs', ob.id)).actions
        return (a.length === n0 + 1 && a[n0].libelle.includes('modifiée')) || 'action non modifiée'
      },
      { method: 'PATCH' }
    )
    await step(
      'objectifs importés',
      '/objectifs/import/',
      async () => {
        await call(F('m3-planification/objectifs.tsx'), 'importObjectifs')
        await clickModal()
      },
      async () =>
        (await get('/objectifs/')).some((o) => o.code === 'OB-06' && o.importe) || 'OB-06 absent'
    )
    const risk = (await get('/risques/')).find((r) => !r.realise)
    const g0 = (await get('/registre/')).length
    await step(
      'risque déclaré réalisé',
      `/risques/${risk.id}/realise/`,
      () => call(F('m3-planification/risques.tsx'), 'riskRealise', risk.id),
      async () =>
        ((await one('risques', risk.id)).realise && (await get('/registre/')).length === g0 + 1) ||
        'risque ou registre inchangé'
    )
    const tx = (await get('/textes/'))[0]
    const decl = (
      await server('/declarations/', 'POST', {
        texte: tx.id,
        objet: `Déclaration E2E ${STAMP}`,
        cause: 'Cause',
        impact: 'Impact',
        planAction: 'Plan',
      })
    ).data
    await step(
      'déclaration soumise',
      `/declarations/${decl.id}/soumettre/`,
      () => call(F('m3-planification/veille.tsx'), 'declAct', decl.id, 'submit'),
      async () => (await one('declarations', decl.id)).statut === 'Soumise' || 'statut inchangé'
    )
    // Le Responsable SM n'est pas le Directeur Général : le serveur refuse, l'écran le dit.
    await step(
      'décision refusée à un non-dirigeant',
      `/declarations/${decl.id}/decision/`,
      () => call(F('m3-planification/veille.tsx'), 'declAct', decl.id, 'ok'),
      async () => {
        const t = (await toasts()).join(' | ')
        if (!/refusée par le serveur/.test(t)) return 'refus non signalé : ' + t
        return (await one('declarations', decl.id)).statut === 'Soumise' || 'statut modifié'
      },
      { expect: [403] }
    )
    await step(
      'texte diffusé',
      `/textes/${tx.id}/diffuser/`,
      async () => {
        await call(F('m3-planification/veilleRapports.tsx'), 'diffuserTexte', tx.id)
        await clickModal()
      },
      async () => (await one('textes', tx.id)).diffuse === true || 'texte non diffusé'
    )
    const k0 = (await get('/risques/')).length
    await step(
      "risque de situation d'urgence créé",
      `/textes/${tx.id}/qualifier-urgence/`,
      () => call(F('m3-planification/veille.tsx'), 'qualifUrgence', tx.id),
      async () => (await get('/risques/')).length === k0 + 1 || 'aucun risque créé'
    )
    const fm = (await get('/fiches-maitrise/'))[0]
    await step(
      'fiche de maîtrise mise à jour',
      `/fiches-maitrise/${fm.id}/mettre-a-jour/`,
      () => call(F('m3-planification/fiches.tsx'), 'fmUpdate', fm.id),
      async () => (await one('fiches-maitrise', fm.id)).derniereMaj !== fm.derniereMaj || 'date'
    )
  }

  section('Module 4 — Support')
  {
    const base = (await get('/ressources/'))[0]
    const res = (
      await server('/ressources/', 'POST', {
        ...base,
        id: undefined,
        besoin: `Ressource E2E ${STAMP}`,
        statut: 'Brouillon',
        demandeur: 'Gildas HOUNKPATIN',
        dateReelle: '—',
      })
    ).data
    const RES = [
      ['submit', 'soumettre', 'Soumise'],
      ['ok', 'valider', 'Validée'],
      ['dispo', 'mise-a-disposition', 'Mise à disposition'],
    ]
    for (const [a, route, statut] of RES)
      await step(
        `ressource : ${statut}`,
        `/ressources/${res.id}/${route}/`,
        () => call(F('m4-support/ressources.tsx'), 'resAct', res.id, a),
        async () => (await one('ressources', res.id)).statut === statut || 'statut inchangé'
      )
    const c0 = (await get('/competences/')).collaborateurs.length
    await step(
      'collaborateur ajouté à la matrice',
      '/competences/collaborateurs/',
      async () => {
        await call(F('m4-support/competences.tsx'), 'addCollab')
        await clickModal()
      },
      async () => (await get('/competences/')).collaborateurs.length === c0 + 1 || 'matrice'
    )
    await step(
      'matrice importée (CSV)',
      '/competences/import/',
      () =>
        page.evaluate((stamp) =>
          import('/src/features/m4-support/competences.tsx').then((m) => {
            const inp = document.createElement('input')
            inp.type = 'file'
            const dt = new DataTransfer()
            const csv = `Nom;Direction;n1;n2\nImport E2E ${stamp};Direction Industrielle;2;3\n`
            dt.items.add(new File([csv], 'matrice.csv', { type: 'text/csv' }))
            inp.files = dt.files
            m.importMatrix(inp)
          }),
          STAMP
        ),
      async () =>
        (await get('/competences/')).collaborateurs.some((p) => p.nom === `Import E2E ${STAMP}`) ||
        'ligne importée absente'
    )
    const com = (await get('/communications/')).find((c) => c.statut !== 'Fait')
    await step(
      'action de communication réalisée',
      `/communications/${com.id}/realiser/`,
      async () => {
        await call(F('m4-support/communication.tsx'), 'comDone', com.id)
        await clickModal()
      },
      async () => (await one('communications', com.id)).statut === 'Fait' || 'statut inchangé'
    )
  }

  section('Module 5 — Maîtrise opérationnelle')
  {
    const docs = await get('/documents/')
    const red = docs.find((d) => d.statut === 'Rédaction')
    if (check(!!red, 'un document en rédaction existe dans la démo')) {
      const DOC = [
        ['submit', 'soumettre', 'Vérification'],
        ['verify', 'verifier', 'Approbation'],
        ['refuse', 'refuser', 'Rédaction'],
        ['submit', 'soumettre', 'Vérification'],
        ['verify', 'verifier', 'Approbation'],
        ['approve', 'approuver', 'Diffusé'],
      ]
      for (const [a, route, statut] of DOC)
        await step(
          `document : ${route} -> ${statut}`,
          `/documents/${red.id}/${route}/`,
          () => call(F('m5-operations/gedDetail.tsx'), 'docAct', red.id, a),
          async () => (await one('documents', red.id)).statut === statut || 'statut inchangé'
        )
      const v0 = (await one('documents', red.id)).versions.length
      await step(
        'document : diffusion contrôlée',
        `/documents/${red.id}/diffuser/`,
        async () => {
          await call(F('m5-operations/gedDetail.tsx'), 'diffuser', red.id)
          await page.locator('.modal').last().waitFor()
          await fill('diffusion', `Liste E2E ${STAMP}`)
          await clickModal()
        },
        async () => (await one('documents', red.id)).diffusion.includes(STAMP) || 'liste inchangée'
      )
      await step(
        'document : nouvelle version',
        `/documents/${red.id}/nouvelle-version/`,
        async () => {
          await call(F('m5-operations/gedDetail.tsx'), 'newVersion', red.id)
          await page.locator('.modal').last().waitFor()
          await fill('contenu', `Contenu E2E ${STAMP}`)
          await fill('motif', 'Mise à jour E2E')
          await clickModal()
        },
        async () => (await one('documents', red.id)).versions.length === v0 + 1 || 'version absente'
      )
      await step(
        'document : classé obsolète',
        `/documents/${red.id}/obsolete/`,
        () => call('/src/forms/crud.tsx', 'markObsolete', 'documents', red.id),
        async () => (await one('documents', red.id)).statut === 'Obsolète' || 'statut inchangé'
      )
    }
    const urg = (await get('/urgences/'))[0]
    const e0 = urg.exercices.length
    await step(
      'exercice planifié',
      `/urgences/${urg.id}/exercices/`,
      async () => {
        await call(F('m5-operations/UrgencesPage.tsx'), 'addExercice', urg.id)
        await clickModal()
      },
      async () => (await one('urgences', urg.id)).exercices.length === e0 + 1 || 'exercice absent'
    )
    await step(
      "compte rendu d'exercice",
      `/urgences/${urg.id}/exercices/${e0}/compte-rendu/`,
      async () => {
        await call(F('m5-operations/UrgencesPage.tsx'), 'crExercice', urg.id, e0)
        await page.locator('.modal').last().waitFor()
        await fill('compteRendu', `Compte rendu E2E ${STAMP}`)
        await fill('actions', 'Revoir le point de rassemblement')
        await clickModal()
      },
      async () =>
        (await one('urgences', urg.id)).exercices[e0].statut === 'Réalisé' || 'exercice non réalisé'
    )
  }

  section('Module 6 — Performance')
  {
    const aud = (await get('/audits/')).find((a) => a.statut === 'Planifié')
    if (check(!!aud, 'un audit planifié existe dans la démo')) {
      const A = F('m6-performance/audits.tsx')
      const st = async (s) => (await one('audits', aud.id)).statut === s || 'statut inchangé'
      await step("audit : alerte à l'auditeur", `/audits/${aud.id}/alerter/`, () =>
        call(A, 'audAct', aud.id, 'alert')
      )
      await step(
        'audit : plan diffusé',
        `/audits/${aud.id}/diffuser/`,
        () => call(A, 'audAct', aud.id, 'diff'),
        () => st('Plan diffusé')
      )
      await step(
        'audit : démarré',
        `/audits/${aud.id}/demarrer/`,
        () => call(A, 'audAct', aud.id, 'start'),
        () => st('En cours')
      )
      const c0 = (await one('audits', aud.id)).constats.length
      await step(
        'audit : constat ajouté',
        `/audits/${aud.id}/constats/`,
        async () => {
          await call(A, 'addConstat', aud.id)
          await clickModal()
        },
        async () => (await one('audits', aud.id)).constats.length === c0 + 1 || 'constat absent'
      )
      await step(
        'audit : rapport déposé',
        `/audits/${aud.id}/rapport/`,
        async () => {
          await call(A, 'audReport', aud.id)
          await page.locator('.modal').last().waitFor()
          await fill('rapport', 'Rapport_e2e.pdf')
          await fill('compteRendu', `Réunion de clôture E2E ${STAMP}`)
          await clickModal()
        },
        () => st('Rapport déposé')
      )
      const g0 = (await get('/registre/')).length
      await step(
        'audit : clôturé, constats au registre',
        `/audits/${aud.id}/cloturer/`,
        () => call(A, 'audClose', aud.id),
        async () =>
          ((await one('audits', aud.id)).statut === 'Clôturé' &&
            (await get('/registre/')).length > g0) ||
          'audit ou registre inchangé'
      )
    }
    const nc = (await get('/ncs/')).find((n) => n.statut === 'Déclarée')
    if (check(!!nc, 'une non-conformité déclarée existe dans la démo')) {
      const NC = [
        ['v1', 'valider-pilote', 'Validée pilote'],
        ['v2', 'approuver', 'En traitement'],
        ['close', 'cloturer', 'Clôturée'],
      ]
      for (const [a, route, statut] of NC)
        await step(
          `non-conformité : ${statut}`,
          `/ncs/${nc.id}/${route}/`,
          () => call(F('m6-performance/nc.tsx'), 'ncAct', nc.id, a),
          async () => (await one('ncs', nc.id)).statut === statut || 'statut inchangé'
        )
    }
    const reg = (await get('/registre/')).find((g) => g.statut === 'En cours')
    await step('registre : responsable relancé', `/registre/${reg.id}/relancer/`, async () => {
      await call(F('m6-performance/RegistrePage.tsx'), 'regDetail', reg.id)
      await clickDrawer('Relancer le responsable')
    })
    await step(
      'registre : entrée clôturée',
      `/registre/${reg.id}/cloturer/`,
      async () => {
        await call(F('m6-performance/RegistrePage.tsx'), 'regDetail', reg.id)
        await clickDrawer('Clôturer')
      },
      async () => (await one('registre', reg.id)).statut === 'Clôturé' || 'statut inchangé'
    )
    const rev = (await get('/revues/')).find((r) => r.statut === 'Préparée')
    if (check(!!rev, 'une revue préparée existe dans la démo')) {
      const R = F('m6-performance/RevuesPage.tsx')
      await step(
        'revue : action ajoutée',
        `/revues/${rev.id}/actions/`,
        async () => {
          await call(R, 'revAction', rev.id)
          await clickModal()
        },
        async () =>
          (await one('revues', rev.id)).actions.length === rev.actions.length + 1 || 'action absente'
      )
      await step(
        "revue : rapport d'entrée compilé",
        `/revues/${rev.id}/compiler-rapport/`,
        async () => {
          await call(R, 'revDetail', rev.id)
          await clickDrawer('Compiler depuis les modules')
        },
        async () =>
          /Couverture normative/.test((await one('revues', rev.id)).rapportEntree) || 'rapport'
      )
      const n0 = (await get('/revues/')).length
      await step(
        'revue : clôturée, revue suivante créée',
        `/revues/${rev.id}/cloturer/`,
        () => call(R, 'revClose', rev.id),
        async () =>
          ((await one('revues', rev.id)).statut === 'Clôturée' &&
            (await get('/revues/')).length === n0 + 1) ||
          'revue ou suivante'
      )
    }
    const pr = (await get('/prestataires/'))[0]
    await step(
      'intervenant externe évalué',
      `/prestataires/${pr.id}/evaluer/`,
      async () => {
        await call(F('m6-performance/surveillanceForms.tsx'), 'evalPresta', pr.id)
        await clickModal()
      },
      async () => {
        const t = (await toasts()).join(' | ')
        return /Score : \d+ %/.test(t) || 'score non affiché : ' + t
      }
    )
  }

  section('Journal et erreurs')
  const journal = await get('/journal/')
  check(journal.length > journal0 + 25, `journal alimenté par le serveur (+${journal.length - journal0})`)
  check(pageErrors.length === 0, `aucune erreur JavaScript (${pageErrors.slice(0, 2).join(' | ')})`)
} catch (e) {
  check(false, e.stack?.split('\n').slice(0, 3).join(' ') ?? String(e))
} finally {
  await browser.close()
}
console.log(failed ? `\n${failed} échec(s)` : '\nTout est OK')
process.exit(failed ? 1 : 0)
