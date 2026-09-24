import { useMemo } from 'react'
import { DataTable } from '../../components/data/DataTable'
import { NormBadges, StatusBadge } from '../../components/ui/badges'
import { Icon } from '../../components/ui/Icon'
import { PageHead } from '../../components/ui/PageHead'
import { useTabs } from '../../components/ui/Tabs'
import { MOD_FULL } from '../../data/referentiels'
import { openForm } from '../../forms/crud'
import { fd } from '../../lib/dates'
import { inNorm } from '../../lib/norms'
import { useApp } from '../../store/useApp'
import { toast } from '../../store/useOverlays'
import { exportAnalyse, genEnjeux, saveVersion } from './actions'
import { enjDetail } from './details'
import { joinNodes, type Any } from './util'

interface QItem {
  id: string
  t: string
  i: number
  go: () => void
}

/** q(cls, titre, items, add) : quadrant de la grille SWOT. */
function Quadrant({
  cls,
  titre,
  items,
  add,
}: {
  cls: string
  titre: string
  items: QItem[]
  add?: () => void
}) {
  return (
    <div className={`swq ${cls}`}>
      <h5>
        {titre}{' '}
        <span className="btn-row">
          <span className="small muted">{items.length}</span>
          {add ? (
            <button className="btn sm" onClick={add}>
              <Icon name="plus" size={13} />
            </button>
          ) : null}
        </span>
      </h5>
      <ul>
        {items.map((x) => (
          <li key={x.id} onClick={x.go}>
            <span>{x.t}</span>
            <span className="small muted">{x.i}/5</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SwotTab() {
  const swot = useApp((s) => s.db.swot)
  const pestel = useApp((s) => s.db.pestel)
  const norm = useApp((s) => s.ui.norm)
  const sw = useMemo(() => swot.filter((r) => inNorm(r, norm)), [swot, norm])
  const pe = useMemo(() => pestel.filter((r) => inNorm(r, norm)), [pestel, norm])
  const fromSw = (type: string) =>
    sw
      .filter((s) => s.type === type)
      .map((s) => ({ id: s.id, t: s.libelle, i: s.impact, go: () => openForm('swot', s.id) }))
  const fromPe = (q: string) =>
    pe
      .filter((p) => p.qualification === q)
      .map((p) => ({ id: p.id, t: p.facteur, i: p.impact, go: () => openForm('pestel', p.id) }))
  return (
    <div className="card">
      <div className="card-h">
        <div>
          <h3>Grille SWOT interactive</h3>
          <div className="sub">
            Forces et faiblesses saisies ici ; opportunités et menaces issues des facteurs externes
            qualifiés (PESTEL).
          </div>
        </div>
      </div>
      <div className="swot">
        <Quadrant cls="f" titre="Forces" items={fromSw('Force')} add={() => openForm('swot')} />
        <Quadrant
          cls="w"
          titre="Faiblesses"
          items={fromSw('Faiblesse')}
          add={() => openForm('swot')}
        />
        <Quadrant cls="o" titre="Opportunités (PESTEL positif)" items={fromPe('Positif')} />
        <Quadrant cls="t" titre="Menaces (PESTEL négatif)" items={fromPe('Négatif')} />
      </div>
    </div>
  )
}

const DIMS = [
  'Politique',
  'Économique',
  'Socioculturel',
  'Technologique',
  'Environnemental',
  'Légal',
]

function PestelTab() {
  const pestel = useApp((s) => s.db.pestel)
  const enjeux = useApp((s) => s.db.enjeux)
  const norm = useApp((s) => s.ui.norm)
  const pe = useMemo(() => pestel.filter((r) => inNorm(r, norm)), [pestel, norm])
  return (
    <div className="card">
      <div className="card-h">
        <div>
          <h3>Matrice PESTEL</h3>
          <div className="sub">
            Qualifiez chaque facteur (positif / négatif) puis générez les enjeux associés aux axes
            de la politique.
          </div>
        </div>
        <div className="btn-row">
          <button className="btn sm" onClick={() => openForm('pestel')}>
            <Icon name="plus" size={14} /> Ajouter un facteur
          </button>
          <button className="btn primary sm" onClick={genEnjeux}>
            <Icon name="ai" size={14} /> Générer les enjeux
          </button>
        </div>
      </div>
      <div className="pestel">
        {DIMS.map((d) => {
          const L = pe.filter((p) => p.dimension === d)
          return (
            <div className="pcol" key={d}>
              <h5>
                <span className="big">{d[0]}</span>
                {d}
              </h5>
              {L.length ? (
                L.map((p) => (
                  <div
                    key={p.id}
                    className={`pf ${p.qualification === 'Négatif' ? 'neg' : ''}`}
                    onClick={() => openForm('pestel', p.id)}
                  >
                    {p.facteur}
                    <div className="small muted" style={{ marginTop: 3 }}>
                      {p.qualification} · impact {p.impact}/5{' '}
                      {enjeux.some((e) => e.origine === p.id) ? '· enjeu généré' : ''}
                    </div>
                  </div>
                ))
              ) : (
                <div className="small muted">Aucun facteur. Ajoutez-en un.</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EnjTab() {
  const enjeux = useApp((s) => s.db.enjeux)
  const axes = useApp((s) => s.db.axes)
  return (
    <div className="card">
      <DataTable
        id="enjeux"
        cols={[
          { l: 'Enjeu', r: (e) => <span className="ttl">{e.libelle}</span> },
          { l: 'Source', k: 'source' },
          { l: 'Qualification', r: (e) => <StatusBadge value={e.qualification} /> },
          {
            l: 'Axes de la politique',
            r: (e) =>
              joinNodes(
                e.axes.map((a: string) => <span className="badge b-blue">{a}</span>),
                ' '
              ),
          },
          { l: 'Normes', r: (e) => <NormBadges norms={e.normes} /> },
          { l: 'Identifié le', r: (e) => fd(e.date) },
          { l: 'Statut', r: (e) => <StatusBadge value={e.statut} /> },
        ]}
        rows={enjeux as Any[]}
        onRowClick={enjDetail}
        search={['libelle']}
        filters={[
          { k: 'source', l: 'Source', o: ['Interne (SWOT)', 'Externe (PESTEL)'] },
          { k: 'axes', l: 'Axe', o: axes.map((a) => [a.id, a.code] as [string, string]) },
        ]}
        onAdd={() => openForm('enjeux')}
        addLabel="Ajouter un enjeu"
        exportName="Enjeux"
        extra={
          <button className="btn sm" onClick={genEnjeux}>
            <Icon name="ai" size={14} /> Générer depuis PESTEL
          </button>
        }
      />
    </div>
  )
}

function VerTab() {
  const versions = useApp((s) => s.db.analyseVersions)
  const nbF = useApp((s) => s.db.swot.length + s.db.pestel.length)
  const nbE = useApp((s) => s.db.enjeux.length)
  const rows = useMemo(() => versions.slice().reverse(), [versions])
  const compare = (v: Any) =>
    toast(
      `Écart avec la version actuelle : ${nbF - v.facteurs >= 0 ? '+' : ''}${nbF - v.facteurs} facteur(s), ${nbE - v.enjeux >= 0 ? '+' : ''}${nbE - v.enjeux} enjeu(x).`
    )
  return (
    <div className="card">
      <DataTable
        id="av"
        cols={[
          { l: 'Version', r: (v) => <span className="ttl">{v.version}</span> },
          { l: 'Date', r: (v) => fd(v.date) },
          { l: 'Auteur', k: 'auteur' },
          { l: 'Commentaire', k: 'commentaire' },
          { l: 'Facteurs', k: 'facteurs', cls: 'num' },
          { l: 'Enjeux', k: 'enjeux', cls: 'num' },
          {
            l: 'Comparaison',
            r: (v) => (
              <button className="btn sm" onClick={() => compare(v)}>
                Comparer à l'actuelle
              </button>
            ),
          },
        ]}
        rows={rows as Any[]}
        norm={false}
        onAdd={() => saveVersion('analyseVersions', 'Enjeux')}
        addLabel="Enregistrer une version"
      />
    </div>
  )
}

/** PAGES['m1-enjeux'] */
export function EnjeuxPage() {
  const [t, tb] = useTabs('enjeux', [
    ['swot', 'Facteurs internes (SWOT)'],
    ['pestel', 'Facteurs externes (PESTEL)'],
    ['enj', 'Enjeux identifiés'],
    ['ver', 'Historique des versions'],
  ])
  return (
    <>
      <PageHead
        kicker={MOD_FULL.m1}
        title="1.1 Enjeux"
        desc="Facteurs internes (grille SWOT) et externes (matrice PESTEL), enjeux associés aux axes de la politique, historisés dans le temps."
        actions={
          <button className="btn" onClick={exportAnalyse}>
            <Icon name="doc" size={15} /> Exporter l'analyse (PDF)
          </button>
        }
      />
      {tb}
      {t === 'swot' ? (
        <SwotTab />
      ) : t === 'pestel' ? (
        <PestelTab />
      ) : t === 'enj' ? (
        <EnjTab />
      ) : t === 'ver' ? (
        <VerTab />
      ) : null}
    </>
  )
}
