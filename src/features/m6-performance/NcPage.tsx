/** 6.4 Non-conformités et actions correctives (original l.1682-1685). */
import { DataTable } from '../../components/data/DataTable'
import { NormBadges, StatusBadge } from '../../components/ui/badges'
import { Icon } from '../../components/ui/Icon'
import { PageHead } from '../../components/ui/PageHead'
import { useTabs } from '../../components/ui/Tabs'
import { MOD_FULL } from '../../data/referentiels'
import { openForm } from '../../forms/crud'
import { fd } from '../../lib/dates'
import { procOpts } from '../../lib/lookups'
import { inNorm } from '../../lib/norms'
import { useApp } from '../../store/useApp'
import { NC_CAT, addSource, declareNC, ncDetail } from './nc'
import type { Any } from './shared'

const TABS = [['all', 'Tous les éléments'] as const, ...NC_CAT.map((c) => [c, c] as const)]

export function NcPage() {
  const db = useApp((s) => s.db) as Any
  const norm = useApp((s) => s.ui.norm)
  const [t, tb] = useTabs('nc', TABS)
  const all: Any[] = db.ncs
  const rows = t === 'all' ? all : all.filter((n) => n.categorie === t)
  const N = all.filter((n) => inNorm(n, norm))
  const stats: [string, number][] = [
    ['À valider (pilote)', N.filter((n) => n.statut === 'Déclarée').length],
    ['À approuver (responsable)', N.filter((n) => n.statut === 'Validée pilote').length],
    ['En traitement', N.filter((n) => n.statut === 'En traitement').length],
    ['Clôturées', N.filter((n) => n.statut === 'Clôturée').length],
  ]
  return (
    <>
      <PageHead
        kicker={MOD_FULL.m6}
        title="6.4 Non-conformités et actions correctives"
        desc="Déclarations depuis plusieurs sources, qualification du type d'acte et validation à deux niveaux : pilote puis responsable du système."
        actions={
          <>
            <button className="btn" onClick={() => declareNC('Accident / incident')}>
              Déclarer un accident / incident
            </button>
            <button className="btn" onClick={() => declareNC("Piste d'amélioration")}>
              Créer une piste d'amélioration
            </button>
            <button className="btn primary" onClick={() => openForm('ncs')}>
              <Icon name="plus" size={15} /> Déclarer une non-conformité
            </button>
          </>
        }
      />
      <div className="grid g4 mb">
        {stats.map(([a, b]) => (
          <div key={a} className="card">
            <div className="small muted">{a}</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{b}</div>
          </div>
        ))}
      </div>
      {tb}
      <div className="card">
        <DataTable
          id="ncs"
          cols={[
            {
              l: 'Référence',
              r: (n) => (
                <>
                  <span className="ttl">{n.ref}</span>
                  <br />
                  <span className="ref">{fd(n.date)}</span>
                </>
              ),
            },
            { l: 'Catégorie', k: 'categorie' },
            {
              l: 'Description',
              r: (n) => (
                <>
                  {n.description}
                  <br />
                  <span className="ref">{n.lieu}</span>
                </>
              ),
            },
            { l: 'Source', k: 'source' },
            { l: "Type d'acte", k: 'typeActe' },
            { l: 'Processus', r: (n) => <span className="badge b-grey">{n.processus}</span> },
            { l: 'Statut', r: (n) => <StatusBadge value={n.statut} /> },
            { l: 'Normes', r: (n) => <NormBadges norms={n.normes} /> },
          ]}
          rows={rows}
          onRowClick={ncDetail}
          search={['ref', 'description', 'lieu']}
          filters={[
            { k: 'source', l: 'Source', o: () => db.sourcesNC },
            {
              k: 'statut',
              l: 'Statut',
              o: ['Déclarée', 'Validée pilote', 'En traitement', 'Clôturée', 'Refusée'],
            },
            { k: 'processus', l: 'Processus', o: procOpts },
          ]}
          exportName="Non_conformites"
          extra={
            <button className="btn sm" onClick={addSource}>
              <Icon name="plus" size={14} /> Source
            </button>
          }
        />
      </div>
    </>
  )
}
