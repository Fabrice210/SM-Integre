import { NORMS } from '../data/referentiels'
import { API_MODE, ApiError, fetchFile } from './api'
import { fd, iso, TODAY } from '../lib/dates'
import { currentUser, logAct, update, useApp } from '../store/useApp'
import { toast } from '../store/useOverlays'

const esc = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  )

/** Tableau exportable enregistré au rendu (window._tbl de l'original). */
export interface ExportableTable {
  headers: string[]
  rows: string[][]
  exportName?: string
}
export const tableRegistry: Record<string, ExportableTable> = {}

export function download(name: string, content: string, type: string) {
  saveBlob(name, new Blob([content], { type }))
}

/** Enregistre un fichier côté navigateur (lien de téléchargement temporaire). */
export function saveBlob(name: string, b: Blob) {
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
      [
        t.headers.join(';'),
        ...t.rows.map((r) => r.map((c) => '"' + c.replace(/"/g, '""') + '"').join(';')),
      ].join('\r\n')
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

/**
 * Mode API : télécharge l'export produit par le serveur (`/exports/…`, avec le jeton JWT).
 * Le serveur trace lui-même l'export au journal. Renvoie false hors mode API ou en cas
 * d'échec : l'appelant retombe alors sur l'export local.
 */
export async function serverDownload(path: string): Promise<boolean> {
  if (!API_MODE) return false
  try {
    const { blob, filename } = await fetchFile(path)
    saveBlob(filename, blob)
    toast(`Export « ${filename} » généré par le serveur.`)
    return true
  } catch (e) {
    const why = e instanceof ApiError ? e.message : 'erreur inconnue'
    toast(`Export serveur indisponible (${why}) : export local.`, 'warn')
    return false
  }
}

/** Chemin d'export serveur d'une collection, avec le filtre de norme courant. */
export function collectionExportPath(
  collection: string,
  fmt: 'xlsx' | 'csv' | 'pdf',
  norm?: string
) {
  const q = norm && norm in NORMS ? `?norme=${encodeURIComponent(norm)}` : ''
  return `/exports/${collection}.${fmt}${q}`
}

/**
 * En mode API, `path` est téléchargé depuis le serveur ; sinon (ou en cas d'échec)
 * `local()` produit l'export du navigateur. Hors mode API, `local()` est appelé tout de
 * suite, dans le geste utilisateur (fenêtre d'impression non bloquée).
 */
export function exportVia(path: string | null, local: () => void) {
  if (!API_MODE || !path) return local()
  void serverDownload(path).then((ok) => {
    if (!ok) local()
  })
}

/** Pages dont le bouton « Exporter » a une version serveur. */
const SERVER_PAGES: Record<string, (norm: string) => string> = {
  dashboard: (norm) => `/exports/tableau-de-bord.pdf?norme=${encodeURIComponent(norm)}`,
  'm6-registre': (norm) => collectionExportPath('registre', 'pdf', norm),
}

/** Bouton « Exporter » de la barre du haut. */
export function exportCurrentPage(page: string, title: string) {
  const server = SERVER_PAGES[page]
  exportVia(server ? server(useApp.getState().ui.norm) : null, () => exportPage(title))
}
