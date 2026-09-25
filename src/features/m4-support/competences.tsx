import { DIRECTIONS } from '../../data/referentiels'
import { openForm } from '../../forms/crud'
import { readForm } from '../../forms/formControllers'
import { FormRenderer } from '../../forms/FormRenderer'
import { FORMS } from '../../forms/registry'
import type { FieldDef, Rec } from '../../forms/types'
import { download, printDoc } from '../../services/exports'
import { logAct, update, useApp } from '../../store/useApp'
import { closeModal, openModal, toast } from '../../store/useOverlays'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const comp = (s: { db: { competences: unknown } }) => s.db.competences as any

/** lvlCycle(ci, k) de l'original : niveau suivant (0 → 4 puis 0). */
export function lvlCycle(ci: number, k: number) {
  update((s) => {
    const C = comp(s)
    const p = C.collaborateurs[ci]
    p.niveaux[k] = (p.niveaux[k] + 1) % 5
    logAct(s, 'a mis à jour le niveau de ' + p.nom + ' en « ' + C.liste[k] + ' »', 'Compétences')
  })
}

/** importMatrix(inp) de l'original : import CSV (Nom;Direction;niveaux…). */
export function importMatrix(inp: HTMLInputElement) {
  const f = inp.files?.[0]
  if (!f) return
  const rd = new FileReader()
  rd.onload = () => {
    const lines = String(rd.result).split(/\r?\n/).filter(Boolean)
    let n = 0
    update((s) => {
      const C = comp(s)
      lines.slice(1).forEach((l) => {
        const c = l.split(/[;,]/)
        if (c.length >= 2) {
          C.collaborateurs.push({
            nom: c[0].trim(),
            direction: c[1].trim(),
            niveaux: C.liste.map((_: string, i: number) => Math.min(4, Number(c[i + 2]) || 0)),
          })
          n++
        }
      })
      logAct(s, 'a importé une matrice de compétences (' + n + ' lignes)', 'Compétences')
    })
    toast(n + ' collaborateur(s) importé(s).')
  }
  rd.readAsText(f)
}

const esc = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  )

/** exportMatrice(fmt) de l'original (v2) : matrice filtrée par direction (S.compDir). */
export function exportMatrice(fmt: 'xls' | 'pdf', dir: string) {
  const C = comp(useApp.getState())
  const P = C.collaborateurs.filter((p: Rec) => !dir || p.direction === dir)
  const head = [
    'Collaborateur',
    'Direction',
    ...C.liste.map((l: string) => l + ' (req. ' + C.requis[l] + ')'),
  ]
  const rows: string[][] = P.map((p: Rec) => [
    p.nom,
    p.direction,
    ...p.niveaux.map(
      (v: number, k: number) => v + (v >= C.requis[C.liste[k]] ? ' (conforme)' : '')
    ),
  ])
  if (fmt === 'xls') {
    const csv =
      '﻿' +
      [
        head.join(';'),
        ...rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(';')),
      ].join('\r\n')
    download('Matrice_competences.csv', csv, 'text/csv;charset=utf-8')
    update((s) => logAct(s, 'a exporté la matrice des compétences (Excel)', 'Compétences'))
    toast('Matrice exportée — présentation simplifiée.')
  } else {
    const html =
      '<table><thead><tr>' +
      head.map((h: string) => `<th>${esc(h)}</th>`).join('') +
      '</tr></thead><tbody>' +
      rows.map((r) => '<tr>' + r.map((c) => `<td>${esc(c)}</td>`).join('') + '</tr>').join('') +
      '</tbody></table>'
    printDoc('Matrice des compétences' + (dir ? ' — ' + dir : ''), html)
  }
}

const COLLAB_F: FieldDef[] = [
  { k: 'nom', l: 'Nom et prénom', req: 1 },
  { k: 'direction', l: 'Direction', t: 'select', o: DIRECTIONS },
]

/** addCollab() de l'original. */
export function addCollab() {
  const onAdd = () => {
    const d = readForm('cf')
    if (d) {
      update((s) => {
        const C = comp(s)
        C.collaborateurs.push({ ...d, niveaux: C.liste.map(() => 1) })
      })
      closeModal()
      toast('Collaborateur ajouté — cliquez sur les niveaux pour les ajuster.')
    }
  }
  openModal({
    title: 'Ajouter un collaborateur à la matrice',
    body: (
      <div id="cf">
        <FormRenderer
          formId="cf"
          fields={COLLAB_F}
          rec={{ nom: 'Bénédicte AGOSSA', direction: 'Direction Industrielle' }}
        />
      </div>
    ),
    foot: (
      <>
        <button className="btn" onClick={() => closeModal()}>
          Annuler
        </button>
        <button className="btn primary" onClick={onAdd}>
          Ajouter
        </button>
      </>
    ),
  })
}

/** planFormation(sid) de l'original : session de formation préremplie depuis un savoir critique. */
export function planFormation(sid: string) {
  const s = useApp.getState().db.savoirs.find((x) => x.id === sid) as Rec
  const F = FORMS.formations
  const old = F.def
  F.def = (st) => ({
    ...old(st),
    theme: s.savoir,
    participants: 'À désigner — transfert de savoir depuis ' + s.detenteurs,
    formateur: s.detenteurs.split(',')[0],
    normes: ['9001'],
  })
  openForm('formations')
  F.def = old
}
