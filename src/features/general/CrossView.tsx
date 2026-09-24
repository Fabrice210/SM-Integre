import { Fragment, useMemo } from 'react'
import { NORMS } from '../../data/referentiels'
import { useApp } from '../../store/useApp'

/** crossView() de l'original : exigences communes et spécifiques par fonction du noyau. */
export function CrossView() {
  const mapping = useApp((s) => s.db.mapping)
  const activeNorms = useApp((s) => s.activeNorms)
  const mods = useMemo(() => [...new Set(mapping.map((m) => m.module))], [mapping])
  return (
    <div className="card mb">
      <div className="card-h">
        <div>
          <h3>Vue croisée — exigences communes et spécifiques</h3>
          <div className="sub">
            Structure harmonisée ISO : une même fonction du noyau couvre plusieurs normes
          </div>
        </div>
        <div className="legend">
          <span>
            <i style={{ background: 'var(--green)' }}></i>Commune
          </span>
          <span>
            <i style={{ background: 'var(--amber)' }}></i>Spécifique
          </span>
        </div>
      </div>
      <div className="tbl-wrap">
        <table className="tbl mx">
          <thead>
            <tr>
              <th>Fonction du noyau</th>
              {activeNorms.map((n) => (
                <th key={n}>{NORMS[n].code}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mods.map((md) => (
              <tr key={md}>
                <td className="ttl">{md}</td>
                {activeNorms.map((n) => {
                  const L = mapping.filter((m) => m.module === md && m.norme === n)
                  return (
                    <td key={n}>
                      {L.length ? (
                        L.map((m, i) => (
                          <Fragment key={m.id}>
                            {i > 0 ? ' ' : ''}
                            <span
                              className={`badge ${m.type === 'Commune' ? 'b-green' : 'b-amber'}`}
                              title={m.libelle}
                            >
                              §{m.article}
                            </span>
                          </Fragment>
                        ))
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
