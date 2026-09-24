import { update, useApp } from '../../store/useApp'

export type TabList = readonly (readonly [key: string, label: string])[]

/**
 * tabs(key, list, def) de l'original : renvoie [onglet courant, barre d'onglets].
 * L'onglet choisi est mémorisé par clé (S.tabs) et survit aux changements de page.
 */
export function useTabs(key: string, list: TabList, def?: string) {
  const stored = useApp((s) => s.ui.tabs[key])
  const cur = stored || def || list[0][0]
  const bar = (
    <div className="tabs" role="tablist">
      {list.map(([k, l]) => (
        <button
          key={k}
          role="tab"
          aria-selected={cur === k}
          className={cur === k ? 'on' : ''}
          data-k={k}
          onClick={() =>
            update((s) => {
              s.ui.tabs[key] = k
            })
          }
        >
          {l}
        </button>
      ))}
    </div>
  )
  return [cur, bar] as const
}
