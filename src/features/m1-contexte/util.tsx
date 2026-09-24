import { Fragment, type ReactNode } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Any = any

/** esc() de l'original, pour les documents HTML générés (PDF, Word, aperçu). */
export const esc = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  )

/** Équivalent JSX de arr.map(...).join(sep) (sep texte ou <br/>). */
export function joinNodes(nodes: ReactNode[], sep: ReactNode): ReactNode {
  return nodes.map((n, i) => (
    <Fragment key={i}>
      {i > 0 ? sep : null}
      {n}
    </Fragment>
  ))
}
