import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NORMS } from '../../data/referentiels'
import { inNorm } from '../../lib/norms'
import { optList, type Opts } from '../../lib/options'
import { collectionExportPath, exportTable, exportVia, tableRegistry } from '../../services/exports'
import { update, useApp } from '../../store/useApp'
import { Icon } from '../ui/Icon'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = { id: string; normes?: readonly string[] } & Record<string, any>

export interface Column<R extends Row> {
  /** En-tête (vide = colonne non exportée). */
  l: string
  k?: string
  /** Rendu de cellule (c.r de l'original). */
  r?: (row: R) => ReactNode
  cls?: string
}

export interface Filter<R extends Row> {
  k: string
  l: string
  o: Opts
  fn?: (row: R, value: string) => boolean
}

interface DataTableProps<R extends Row> {
  id: string
  cols: Column<R>[]
  rows: readonly R[]
  /** Clic sur une ligne (reçoit l'id). */
  onRowClick?: (id: string) => void
  search?: (string | ((row: R) => unknown))[]
  filters?: Filter<R>[]
  onAdd?: () => void
  addLabel?: string
  exportName?: string
  /**
   * Collection affichée telle quelle (clé de db) : en mode API, les boutons Excel / PDF
   * téléchargent l'export du serveur (/exports/<collection>.xlsx|pdf, filtre de norme
   * compris) tant qu'aucune recherche ni aucun filtre local n'est actif.
   */
  collection?: string
  extra?: ReactNode
  /** Filtrer par la norme sélectionnée (défaut : oui). */
  norm?: boolean
  empty?: ReactNode
}

const toText = (node: ReactNode) =>
  renderToStaticMarkup(<>{node}</>)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

/** table({...}) de l'original. */
export function DataTable<R extends Row>({
  id,
  cols,
  rows,
  onRowClick,
  search = [],
  filters = [],
  onAdd,
  addLabel = 'Ajouter',
  exportName,
  collection,
  extra,
  norm = true,
  empty = 'Aucun élément ne correspond à ces critères. Modifiez les filtres ou ajoutez un élément.',
}: DataTableProps<R>) {
  const normFilter = useApp((s) => s.ui.norm)
  const query = useApp((s) => s.ui.search[id] || '')
  const fv = useApp((s) => s.ui.filt[id]) || {}

  let data = norm ? rows.filter((r) => inNorm(r, normFilter)) : rows.slice()
  const q = query.toLowerCase()
  if (q) data = data.filter((r) => search.some((k) => String((typeof k === 'function' ? k(r) : r[k]) ?? '').toLowerCase().includes(q)))
  filters.forEach((f) => {
    const v = fv[f.k]
    if (v) data = data.filter((r) => (f.fn ? f.fn(r, v) : Array.isArray(r[f.k]) ? r[f.k].includes(v) : String(r[f.k]) === v))
  })

  const cell = (c: Column<R>, r: R): ReactNode => (c.r ? c.r(r) : (r[c.k as string] ?? ''))

  // Données exportables (window._tbl de l'original), calculées à la demande
  const exportCols = cols.filter((c) => c.l)
  const register = () => {
    tableRegistry[id] = {
      headers: exportCols.map((c) => c.l),
      rows: data.map((r) => exportCols.map((c) => (c.r ? toText(c.r(r)) : String(r[c.k as string] ?? '')))),
      exportName,
    }
  }

  // Export serveur : seulement si la table montre toute la collection (hors filtre de norme)
  const serverPath = (fmt: 'xlsx' | 'pdf') =>
    collection && !q && !Object.values(fv).some(Boolean)
      ? collectionExportPath(collection, fmt, norm ? normFilter : undefined)
      : null

  return (
    <>
      <div className="toolbar">
        {search.length ? (
          <div className="search">
            <Icon name="search" size={15} />
            <input
              placeholder="Rechercher…"
              value={query}
              aria-label="Rechercher"
              data-sid={id}
              onChange={(e) =>
                update((s) => {
                  s.ui.search[id] = e.target.value
                })
              }
            />
          </div>
        ) : null}
        {filters.map((f) => (
          <select
            key={f.k}
            className="sel"
            aria-label={f.l}
            value={fv[f.k] || ''}
            onChange={(e) =>
              update((s) => {
                ;(s.ui.filt[id] = s.ui.filt[id] || {})[f.k] = e.target.value
              })
            }
          >
            <option value="">{f.l} : tous</option>
            {optList(f.o).map(([a, b]) => (
              <option key={a} value={a}>
                {b}
              </option>
            ))}
          </select>
        ))}
        <span className="spacer" style={{ flex: 1 }}></span>
        {extra}
        {exportName ? (
          <>
            <button
              className="btn sm"
              onClick={() =>
                exportVia(serverPath('xlsx'), () => {
                  register()
                  exportTable(id, 'xls')
                })
              }
            >
              <Icon name="dl" size={14} /> Excel
            </button>
            <button
              className="btn sm"
              onClick={() =>
                exportVia(serverPath('pdf'), () => {
                  register()
                  exportTable(id, 'pdf')
                })
              }
            >
              <Icon name="doc" size={14} /> PDF
            </button>
          </>
        ) : null}
        {onAdd ? (
          <button className="btn primary sm" onClick={onAdd}>
            <Icon name="plus" size={14} /> {addLabel}
          </button>
        ) : null}
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              {cols.map((c, i) => (
                <th key={i}>{c.l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length ? (
              data.map((r) => (
                <tr key={r.id} className={onRowClick ? 'click' : ''} onClick={onRowClick ? () => onRowClick(r.id) : undefined}>
                  {cols.map((c, i) => (
                    <td key={i} className={c.cls || ''}>
                      {cell(c, r)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={cols.length}>
                  <div className="empty">{empty}</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="count-line">
        {data.length} élément(s) affiché(s)
        {normFilter !== 'all' && normFilter !== 'cross' && norm ? ' — filtre ' + NORMS[normFilter].code + ' actif' : ''}
      </div>
    </>
  )
}
