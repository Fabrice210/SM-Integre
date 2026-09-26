/**
 * Oracle des tests de pilotage : exécute le code TS du front (metrics.ts, alerts.ts,
 * dashStats.ts, dashboardData.ts) sur backend/demo/demo.json à la date figée de la
 * démo (TODAY = 2026-09-21) et écrit les valeurs attendues par test_pilotage.py.
 *
 * Régénérer depuis la racine du dépôt (Node >= 22.6) :
 *   TZ=Africa/Porto-Novo node --experimental-strip-types --no-warnings \
 *     backend/apps/pilotage/tests/oracle/front_values.mjs > backend/apps/pilotage/tests/front_values.json
 */
import { register } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

register('./hooks.mjs', import.meta.url)

const ROOT = fileURLToPath(new URL('../../../../../', import.meta.url))
const demo = JSON.parse(readFileSync(ROOT + '/backend/demo/demo.json', 'utf8'))
const db = demo.db
const active = Object.keys(demo.norms)
const metrics = await import(ROOT + '/src/services/metrics.ts')
const alerts = await import(ROOT + '/src/services/alerts.ts')
const stats = await import(ROOT + '/src/features/general/dashStats.ts')
const dd = await import(ROOT + '/src/features/general/dashboardData.ts')
const { days } = await import(ROOT + '/src/lib/dates.ts')

const out = {}
for (const norm of ['all', 'cross', '9001', '14001', '45001', '27001']) {
  const acts = metrics.openActions(db, norm)
  const tx = db.textes.filter((t) => norm === 'all' || norm === 'cross' || !t.normes || t.normes.includes(norm))
  const s = stats.dashStatSets(db, norm)
  out[norm] = {
    cov: metrics.coverage(db, active, norm),
    acts: acts.length,
    late: acts.filter((a) => (days(a.echeance) ?? 0) < 0).length,
    txOk: tx.length ? Math.round((tx.filter((t) => t.statut === 'Fait').length / tx.length) * 100) : 0,
    txEcarts: tx.filter((t) => t.statut !== 'Fait').length,
    stats: {
      risquesOuverts: s.R.filter((r) => r.statutAction !== 'Clôturé').length,
      oppEnCours: s.O.filter((o) => o.statutAction !== 'Clôturé').length,
      roClos: s.roClos, roTot: s.roTot, roMEO: s.roMEO,
      tOk: s.tOk, tDiff: s.tDiff, tWait: s.tWait, tTot: s.T.length,
      camp: s.camp, regRate: s.regRate, regClos: s.regClos, regTot: s.regTot,
      ncCat: Object.fromEntries(['Non-conformité', 'Accident / incident', "Piste d'amélioration", 'Observation'].map((c) => [c, s.N.filter((n) => n.categorie === c).length])),
      ncDecl: s.ncDecl, ncCours: s.ncCours, ncClos: s.ncClos,
      dWait: s.dWait, dDiff: s.dDiff, dTot: s.D.length, dRate: s.dRate,
    },
    proc: stats.dashProcData(db, demo.users, norm, {}),
  }
}
out.matrix = {}
for (const norm of ['all', '45001']) {
  const s = stats.dashStatSets(db, norm)
  const cells = []
  for (const p of [4, 3, 2, 1]) for (const i of [1, 2, 3, 4]) {
    const rc = s.R.filter((r) => r.probabilite === p && r.criticite === i).length
    const oc = s.O.filter((o) => o.probabilite === p && o.impact === i).length
    if (rc || oc) cells.push([p, i, rc, oc])
  }
  out.matrix[norm] = cells
}
out.covByNorm = Object.fromEntries(['9001', '14001', '45001', '27001'].map((n) => [n, metrics.coverage(db, active, n)]))
const al = alerts.computeAlerts(db, [])
out.alerts = al
out.pending = alerts.pendingValidations(db)
out.upcoming = dd.upcoming(db)
out.taux = db.indicateurs.map((k) => [k.id, metrics.taux(k)])
console.log(JSON.stringify(out, null, 1))
