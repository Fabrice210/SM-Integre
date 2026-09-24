import { Fragment, useMemo } from 'react'
import { DataTable } from '../../components/data/DataTable'
import { NormBadges } from '../../components/ui/badges'
import { Icon } from '../../components/ui/Icon'
import { PageHead } from '../../components/ui/PageHead'
import { useTabs } from '../../components/ui/Tabs'
import { MOD_FULL } from '../../data/referentiels'
import { openForm } from '../../forms/crud'
import { inNorm } from '../../lib/norms'
import { useApp } from '../../store/useApp'
import { exportCarto } from './actions'
import { procDetail } from './details'
import type { Any } from './util'

/** band(cat, cls) : bandeau d'une catégorie de processus. */
function Band({ P, cat, cls }: { P: Any[]; cat: string; cls: string }) {
  const L = P.filter((p) => p.categorie === cat)
  return (
    <div className={`pband ${cls}`}>
      <h5>
        Processus de {cat.toLowerCase()} ({L.length})
      </h5>
      <div className="pflow">
        {L.map((p, i, a) => (
          <Fragment key={p.id}>
            <button className="pnode" onClick={() => procDetail(p.id)}>
              <b>
                {p.code} · {p.intitule}
              </b>
              <small>{p.proprietaire}</small>
            </button>
            {cat === 'Réalisation' && i < a.length - 1 ? (
              <span className="parrow">
                <Icon name="arrow" size={16} />
              </span>
            ) : null}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

/** PAGES['m1-processus'] */
export function ProcessusPage() {
  const [t, tb] = useTabs('proc', [
    ['map', 'Cartographie'],
    ['list', 'Fiches processus'],
  ])
  const processus = useApp((s) => s.db.processus) as Any[]
  const norm = useApp((s) => s.ui.norm)
  const P = useMemo(() => processus.filter((r) => inNorm(r, norm)), [processus, norm])
  return (
    <>
      <PageHead
        kicker={MOD_FULL.m1}
        title="1.4 Cartographie des processus"
        desc="Processus de pilotage, de réalisation et de support, reliés aux risques, objectifs, ressources, documents et actions d'amélioration."
        actions={
          <button className="btn" onClick={exportCarto}>
            <Icon name="doc" size={15} /> Exporter la cartographie (PDF)
          </button>
        }
      />
      {tb}
      {t === 'map' ? (
        <div className="card">
          <div className="pio">
            <div className="io">Exigences des clients et des parties intéressées</div>
            <div className="pmap">
              <Band P={P} cat="Pilotage" cls="pil" />
              <Band P={P} cat="Réalisation" cls="rea" />
              <Band P={P} cat="Support" cls="sup" />
            </div>
            <div className="io">Satisfaction des clients et des parties intéressées</div>
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>
            Cliquez sur un processus pour ouvrir sa fiche et ses liens. Point à compléter avec le
            client : liste exhaustive des processus.
          </p>
        </div>
      ) : (
        <div className="card">
          <DataTable
            id="proc"
            cols={[
              { l: 'Code', k: 'code' },
              { l: 'Processus', r: (p) => <span className="ttl">{p.intitule}</span> },
              {
                l: 'Catégorie',
                r: (p) => (
                  <span
                    className={`badge ${p.categorie === 'Pilotage' ? 'b-blue' : p.categorie === 'Réalisation' ? 'b-green' : 'b-amber'}`}
                  >
                    {p.categorie}
                  </span>
                ),
              },
              { l: 'Pilote', k: 'proprietaire' },
              { l: 'Indicateurs', k: 'indicateurs' },
              { l: 'Normes', r: (p) => <NormBadges norms={p.normes} /> },
            ]}
            rows={processus}
            onRowClick={procDetail}
            search={['intitule', 'code', 'proprietaire']}
            filters={[
              { k: 'categorie', l: 'Catégorie', o: ['Pilotage', 'Réalisation', 'Support'] },
            ]}
            onAdd={() => openForm('processus')}
            addLabel="Créer une fiche processus"
            exportName="Fiches_processus"
          />
        </div>
      )}
    </>
  )
}
