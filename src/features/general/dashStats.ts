import type { Seed } from '../../data/seed'
import { days } from '../../lib/dates'
import { inNorm } from '../../lib/norms'
import { download, printDoc } from '../../services/exports'
import type { AppState, NormFilter } from '../../store/types'
import { logAct, update, useApp } from '../../store/useApp'
import { toast } from '../../store/useOverlays'
import { NC_CAT } from '../m6-performance/nc'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

/** Filtres du bloc « Par processus » (S.dashProc / S.dashDir de l'original), rangés dans s.ui.filt. */
export const DASH_FILT = 'dashboard'
export const dashFilt = (s: Pick<AppState, 'ui'>) => s.ui.filt[DASH_FILT] ?? {}

/** procDir(p) de l'original : direction du propriétaire du processus. */
function procDir(users: AppState['users'], p: { proprietaire: string }) {
  const u = users.find((x) => x.nom === p.proprietaire)
  return u ? u.direction : '—'
}

export interface ProcRow {
  id: string
  proc: string
  dir: string
  obj: number
  atteints: number
  risque: number
  act: number
  risk: number
}

/** dashProcData() de l'original. */
export function dashProcData(
  db: Seed,
  users: AppState['users'],
  norm: NormFilter,
  f: Record<string, string>
): ProcRow[] {
  const D = db as Any
  const dir = f.dir || ''
  const pid = f.proc || ''
  const inN = (r: Any) => inNorm(r, norm)
  let P = D.processus.filter(inN)
  if (pid) P = P.filter((p: Any) => p.id === pid)
  if (dir) P = P.filter((p: Any) => procDir(users, p) === dir)
  return P.map((p: Any) => {
    const O = D.objectifs.filter((o: Any) => inN(o) && (o.processus || []).includes(p.id))
    const late = (o: Any) =>
      (o.actions || []).some((a: Any) => a.statut !== 'Clôturé' && (days(a.echeance) ?? 0) < 0)
    const atteints = O.filter((o: Any) => o.efficacite === 'Efficace').length
    const risque = O.filter(
      (o: Any) =>
        o.efficacite === 'Non efficace' || o.efficacite === 'Partiellement efficace' || late(o)
    ).length
    let act = 0
    O.forEach((o: Any) =>
      (o.actions || []).forEach((a: Any) => {
        if (a.statut !== 'Clôturé') act++
      })
    )
    const RO = D.risques.filter(
      (r: Any) => inN(r) && (r.processus || []).includes(p.id) && r.statutAction !== 'Clôturé'
    )
    act += RO.length
    return {
      id: p.id,
      proc: p.code + ' · ' + p.intitule,
      dir: procDir(users, p),
      obj: O.length,
      atteints,
      risque,
      act,
      risk: RO.length,
    }
  })
}

/** dashStatSets() de l'original. */
export function dashStatSets(db: Seed, norm: NormFilter) {
  const D = db as Any
  const inN = (r: Any) => inNorm(r, norm)
  const R: Any[] = D.risques.filter(inN)
  const O: Any[] = D.opportunites.filter(inN)
  const roActions = [...R.map((r) => r.statutAction), ...O.map((o) => o.statutAction)]
  const roClos = roActions.filter((x) => x === 'Clôturé').length
  const roMEO = roActions.length ? Math.round((roClos / roActions.length) * 100) : 0
  const T: Any[] = D.textes.filter(inN)
  const tOk = T.filter((t) => t.statut === 'Fait').length
  const tDiff = T.filter((t) => t.diffuse).length
  const tWait = T.filter((t) => t.statut !== 'Fait').length
  const A: Any[] = D.audits.filter(inN)
  const camp = {
    plan: A.filter((a) => a.statut === 'Planifié').length,
    diff: A.filter((a) => /diffus/i.test(a.statut)).length,
    dep: A.filter((a) => /déposé/i.test(a.statut)).length,
    clos: A.filter((a) => a.statut === 'Clôturé').length,
  }
  const regAR: Any[] = D.registre.filter((r: Any) => /audit|revue/i.test(r.type))
  const regClos = regAR.filter((r) => r.statut === 'Clôturé').length
  const regRate = regAR.length ? Math.round((regClos / regAR.length) * 100) : 0
  const N: Any[] = D.ncs.filter(inN)
  const ncDecl = N.filter((n) => n.statut === 'Déclarée').length
  const ncCours = N.filter((n) => ['En traitement', 'Validée pilote'].includes(n.statut)).length
  const ncClos = N.filter((n) => n.statut === 'Clôturée').length
  const Dc: Any[] = D.documents.filter((d: Any) => d.statut !== 'Obsolète')
  // l'original compare days(d.dateRevue)<60 (null<60 est vrai) : même résultat avec ?? 0
  const dWait = Dc.filter(
    (d) =>
      ['Rédaction', 'Vérification', 'Approbation'].includes(d.statut) ||
      (days(d.dateRevue) ?? 0) < 60
  ).length
  const dDiff = Dc.filter((d) => d.statut === 'Diffusé').length
  const dRate = Dc.length ? Math.round((dDiff / Dc.length) * 100) : 0
  return {
    R,
    O,
    roMEO,
    roClos,
    roTot: roActions.length,
    T,
    tOk,
    tDiff,
    tWait,
    camp,
    regRate,
    regClos,
    regTot: regAR.length,
    N,
    ncDecl,
    ncCours,
    ncClos,
    D: Dc,
    dWait,
    dDiff,
    dRate,
  }
}

type Cell = string | number

/** dashStatRows(key) de l'original : lignes exportées par bloc. */
function dashStatRows(key: string, db: Seed, norm: NormFilter): { title: string; rows: Cell[][] } {
  const s = dashStatSets(db, norm)
  if (key === 'risk')
    return {
      title: 'Statistiques — Risques & opportunités',
      rows: [
        ['Risques ouverts', s.R.filter((r) => r.statutAction !== 'Clôturé').length],
        ['Opportunités en cours', s.O.filter((o) => o.statutAction !== 'Clôturé').length],
        ['Actions clôturées', s.roClos + ' / ' + s.roTot],
        ['Taux de mise en œuvre des actions', s.roMEO + ' %'],
      ],
    }
  if (key === 'reg')
    return {
      title: 'Statistiques — Conformité réglementaire',
      rows: [
        ['Textes conformes', s.tOk],
        ['Textes diffusés', s.tDiff],
        ['Textes en attente', s.tWait],
        ['Taux de conformité', (s.T.length ? Math.round((s.tOk / s.T.length) * 100) : 0) + ' %'],
      ],
    }
  if (key === 'aud')
    return {
      title: 'Statistiques — Audits & Revues',
      rows: [
        ['Audits planifiés', s.camp.plan],
        ['Plans diffusés', s.camp.diff],
        ['Rapports déposés', s.camp.dep],
        ['Audits clôturés', s.camp.clos],
        ['Clôture des actions (audit/revue)', s.regRate + ' %'],
      ],
    }
  if (key === 'nc')
    return {
      title: 'Statistiques — Non-conformités',
      rows: [
        ...NC_CAT.map((c) => [c, s.N.filter((n) => n.categorie === c).length]),
        ['Déclarées', s.ncDecl],
        ['En cours', s.ncCours],
        ['Clôturées', s.ncClos],
      ],
    }
  if (key === 'ged')
    return {
      title: 'Statistiques — Documentaire (GED)',
      rows: [
        ['Documents en attente de revue', s.dWait],
        ['Documents diffusés', s.dDiff],
        ['Total documents actifs', s.D.length],
        ['Taux de diffusion contrôlée', s.dRate + ' %'],
      ],
    }
  return { title: 'Statistiques', rows: [] }
}

const esc = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  )

/** exportDash(key, fmt) de l'original : export PDF ou Excel d'un bloc du tableau de bord. */
export function exportDash(key: string, fmt: 'pdf' | 'xls') {
  const st = useApp.getState()
  let title: string
  let rows: Cell[][]
  let head: string[]
  if (key === 'proc') {
    title = 'Tableau de bord — Par processus'
    head = [
      'Processus',
      'Direction',
      'Objectifs',
      'Atteints',
      'À risque',
      'Actions en cours',
      'Risques ouverts',
    ]
    rows = dashProcData(st.db, st.users, st.ui.norm, dashFilt(st)).map((r) => [
      r.proc,
      r.dir,
      r.obj,
      r.atteints,
      r.risque,
      r.act,
      r.risk,
    ])
  } else {
    const d = dashStatRows(key, st.db, st.ui.norm)
    title = d.title
    head = ['Indicateur', 'Valeur']
    rows = d.rows
  }
  if (fmt === 'xls') {
    const csv =
      '﻿' +
      [
        head.join(';'),
        ...rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(';')),
      ].join('\r\n')
    download(title.replace(/[^\wÀ-ÿ]+/g, '_') + '.csv', csv, 'text/csv;charset=utf-8')
    update((s) => logAct(s, 'a exporté « ' + title + ' » (Excel)', 'Export'))
    toast('Export Excel généré (fichier CSV compatible Excel).')
  } else {
    const html =
      '<table><thead><tr>' +
      head.map((h) => `<th>${esc(h)}</th>`).join('') +
      '</tr></thead><tbody>' +
      rows.map((r) => '<tr>' + r.map((c) => `<td>${esc(c)}</td>`).join('') + '</tr>').join('') +
      '</tbody></table>'
    printDoc(title, html)
  }
}
