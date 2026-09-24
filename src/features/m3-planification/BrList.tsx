import { Fragment } from 'react'

/** Liste séparée par des retours à la ligne (…join('<br>') de l'original). */
export function BrList({ items }: { items: string[] }) {
  return (
    <>
      {items.map((x, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {x}
        </Fragment>
      ))}
    </>
  )
}
