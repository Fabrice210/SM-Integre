import { useMemo } from 'react'
import { DataTable } from '../../components/data/DataTable'
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
        {L.map((p) => (
          <button key={p.id} className="pnode" onClick={() => procDetail(p.id)}>
            <b>
              {p.code} · {p.intitule}
            </b>
            <small>{p.proprietaire}</small>
          </button>
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
              { l: 'Copilote(s)', r: (p) => (p.copilote || []).join(', ') || '—' },
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
