import { NORMS } from '../data/referentiels'
import { fd, iso, TODAY } from '../lib/dates'
import { currentUser, logAct, update, useApp } from '../store/useApp'
import { toast } from '../store/useOverlays'

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** Tableau exportable enregistré au rendu (window._tbl de l'original). */
export interface ExportableTable {
  headers: string[]
  rows: string[][]
  exportName?: string
}
export const tableRegistry: Record<string, ExportableTable> = {}

export function download(name: string, content: string, type: string) {
  const b = new Blob([content], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(b)
  a.download = name
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    URL.revokeObjectURL(a.href)
    a.remove()
  }, 500)
}

/** printDoc(title, html) de l'original : ouvre une fenêtre imprimable (PDF). */
export function printDoc(title: string, html: string) {
  const w = window.open('', '_blank')
  if (!w) {
    toast('Autorisez les fenêtres surgissantes pour générer le PDF.', 'warn')
    return
  }
  const s = useApp.getState()
  const user = currentUser(s)
  w.document.write(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Arial,sans-serif;font-size:12px;color:#15201A;margin:28px}h1{font-size:18px;margin:0}h2{font-size:14px;margin:18px 0 6px}.meta{color:#6D7772;margin:4px 0 16px}table{width:100%;border-collapse:collapse;margin-top:6px}th,td{border:1px solid #D5DBD7;padding:6px 8px;text-align:left;vertical-align:top}th{background:#E6F2EB}.hd{display:flex;justify-content:space-between;border-bottom:2px solid #17693F;padding-bottom:10px;margin-bottom:12px}</style></head><body><div class="hd"><div><h1>${esc(title)}</h1><div class="meta">${esc(s.org.nom)} — généré le ${fd(iso(TODAY))} par ${esc(user.nom)}</div></div><div class="meta">Système de Management intégré<br>${s.activeNorms.map((n) => NORMS[n].code).join(' · ')}</div></div>${html}<script>setTimeout(()=>print(),300)</' + 'script></body></html>`
  )
  w.document.close()
  update((d) => logAct(d, `a généré le PDF « ${title} »`, 'Export'))
}

/** exportTable(id, fmt) de l'original : Excel (CSV) ou PDF. */
export function exportTable(id: string, fmt: 'xls' | 'pdf') {
  const t = tableRegistry[id]
  if (!t) return
  if (fmt === 'xls') {
    const csv =
      '\ufeff' +
      [t.headers.join(';'), ...t.rows.map((r) => r.map((c) => '"' + c.replace(/"/g, '""') + '"').join(';'))].join('\r\n')
    download((t.exportName || id) + '.csv', csv, 'text/csv;charset=utf-8')
    update((d) => logAct(d, `a exporté « ${t.exportName} » (Excel)`, 'Export'))
    toast('Export Excel généré (fichier CSV compatible Excel).')
  } else {
    const html = `<table><thead><tr>${t.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows
      .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
      .join('')}</tbody></table>`
    printDoc(t.exportName || id, html)
  }
}

/** exportWord(title, html) de l'original. */
export function exportWord(title: string, html: string) {
  download(
    title.replace(/\s+/g, '_') + '.doc',
    `<html><head><meta charset="utf-8"><title>${esc(title)}</title></head><body style="font-family:Arial">${html}</body></html>`,
    'application/msword'
  )
  update((d) => logAct(d, `a exporté « ${title} » (Word)`, 'Export'))
  toast('Document Word généré.')
}

/** exportPage() de l'original : imprime le contenu de la page sans les contrôles. */
export function exportPage(title: string) {
  const c = document.getElementById('content')
  if (!c) return
  const clone = c.cloneNode(true) as HTMLElement
  clone.querySelectorAll('button,.toolbar,.tabs,select,input').forEach((x) => x.remove())
  printDoc(title, clone.innerHTML)
}
