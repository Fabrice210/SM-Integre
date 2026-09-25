import { useMemo, useState, type ReactNode } from 'react'
import { DataTable } from '../../components/data/DataTable'
import { NormBadges, StatusBadge } from '../../components/ui/badges'
import { Icon } from '../../components/ui/Icon'
import { PageHead } from '../../components/ui/PageHead'
import { useTabs } from '../../components/ui/Tabs'
import { DIRECTIONS, MOD_FULL } from '../../data/referentiels'
import { openForm } from '../../forms/crud'
import type { Rec } from '../../forms/types'
import { fd } from '../../lib/dates'
import { download } from '../../services/exports'
import { competenceGaps } from '../../services/metrics'
import { useApp } from '../../store/useApp'
import { addCollab, exportMatrice, importMatrix, lvlCycle, planFormation } from './competences'

type Row = { id: string } & Rec
interface Collab {
  nom: string
  direction: string
  niveaux: number[]
}

const LVL_LBL = ['Non acquis', 'Notions', 'Autonome accompagné', 'Autonome', 'Expert / formateur']

/** Onglet « Matrice des compétences » (filtre direction = S.compDir, état local). */
function Matrice({ dir, setDir }: { dir: string; setDir: (d: string) => void }) {
  const db = useApp((s) => s.db)
  const C = db.competences as unknown as {
    liste: string[]
    requis: Record<string, number>
    collaborateurs: Collab[]
  }
  const P = C.collaborateurs.filter((p) => !dir || p.direction === dir)
  const gaps = useMemo(() => competenceGaps(db), [db])
  const model = () =>
    download(
      'Modele_matrice_competences.csv',
      '﻿Nom;Direction;' +
        C.liste.join(';') +
        '\r\nExemple NOM;Direction Industrielle;' +
        C.liste.map(() => 2).join(';'),
      'text/csv'
    )
  return (
    <div className="card">
      <div className="toolbar">
        <select
          className="sel"
          value={dir}
          onChange={(e) => setDir(e.target.value)}
          aria-label="Direction"
        >
          <option value="">Direction : toutes</option>
          {DIRECTIONS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <span style={{ flex: 1 }}></span>
        <button className="btn sm" onClick={addCollab}>
          <Icon name="plus" size={14} /> Ajouter un collaborateur
        </button>
        <label className="btn sm">
          <Icon name="up" size={14} /> Importer une matrice (CSV)
          <input
            type="file"
            accept=".csv,.txt"
            hidden
            onChange={(e) => {
              importMatrix(e.target)
              e.target.value = ''
            }}
          />
        </label>
        <button className="btn sm" onClick={model}>
          <Icon name="dl" size={14} /> Modèle d'import
        </button>
        <button className="btn sm" onClick={() => exportMatrice('xls', dir)}>
          <Icon name="dl" size={14} /> Exporter (Excel)
        </button>
        <button className="btn sm" onClick={() => exportMatrice('pdf', dir)}>
          <Icon name="doc" size={14} /> Exporter (PDF)
        </button>
      </div>{' '}
      <div className="tbl-wrap">
        <table className="tbl mx">
          <thead>
            <tr>
              <th>Collaborateur</th>
              {C.liste.map((l) => (
                <th key={l} style={{ whiteSpace: 'normal', minWidth: 92 }}>
                  {l}
                  <br />
                  <span className="muted">requis {C.requis[l]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {P.map((p) => {
              const ci = C.collaborateurs.indexOf(p)
              return (
                <tr key={ci}>
                  <td>
                    <span className="ttl">{p.nom}</span>
                    <br />
                    <span className="ref">{p.direction}</span>
                  </td>
                  {p.niveaux.map((v, k) => (
                    <td key={k}>
                      <button
                        className={`lvl l${v}`}
                        onClick={() => lvlCycle(ci, k)}
                        title="Cliquer pour changer le niveau"
                        aria-label={`Niveau ${v}`}
                      >
                        {v}
                      </button>
                    </td>
                  ))}
                </tr>
              )
            })}
            <tr>
              <td className="ttl">Collaborateurs au niveau requis</td>
              {gaps.map((g) => (
                <td key={g.comp}>
                  {g.critique ? (
                    <span className="badge b-red">{g.couverts}</span>
                  ) : (
                    <span className="badge b-green">{g.couverts}</span>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>{' '}
      <div className="legend" style={{ marginTop: 10 }}>
        {[0, 1, 2, 3, 4].map((v) => (
          <span key={v}>
            <span className={`lvl l${v}`} style={{ width: 22, height: 20, cursor: 'default' }}>
              {v}
            </span>{' '}
            {LVL_LBL[v]}
          </span>
        ))}
      </div>{' '}
      {gaps.some((g) => g.critique) ? (
        <div className="note warn" style={{ marginTop: 12 }}>
          Compétences critiques non couvertes (moins de 2 personnes au niveau requis) :{' '}
          {gaps
            .filter((g) => g.critique)
            .map((g) => g.comp)
            .join(', ')}
          .
        </div>
      ) : null}
    </div>
  )
}

/** PAGES['m4-competences'] de l'original. */
export function CompetencesPage() {
  const [t, tb] = useTabs('comp', [
    ['mx', 'Matrice des compétences'],
    ['sc', 'Savoirs critiques'],
    ['fo', 'Plan de formation et évaluations'],
  ])
  const [dir, setDir] = useState('')
  const savoirs = useApp((s) => s.db.savoirs) as Row[]
  const formations = useApp((s) => s.db.formations) as Row[]

  let c: ReactNode = null
  if (t === 'mx') c = <Matrice dir={dir} setDir={setDir} />
  if (t === 'sc')
    c = (
      <div className="card">
        <DataTable<Row>
          id="sc"
          cols={[
            { l: 'Savoir critique', r: (x) => <span className="ttl">{x.savoir}</span> },
            { l: 'Détenteurs', k: 'detenteurs' },
            { l: 'Couverture', k: 'couverture' },
            { l: 'Situation', r: (x) => <StatusBadge value={x.criticite} /> },
            { l: 'Plan de formation thématique', k: 'action' },
            {
              l: '',
              r: (x) =>
                x.criticite === 'Critique' ? (
                  <button
                    className="btn sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      planFormation(x.id)
                    }}
                  >
                    Planifier une formation
                  </button>
                ) : (
                  ''
                ),
            },
          ]}
          rows={savoirs}
          onRowClick={(i) => openForm('savoirs', i)}
          norm={false}
          onAdd={() => openForm('savoirs')}
          addLabel="Ajouter un savoir critique"
          exportName="Savoirs_critiques"
        />
      </div>
    )
  if (t === 'fo')
    c = (
      <div className="card">
        <DataTable<Row>
          id="fo"
          cols={[
            {
              l: 'Thème',
              r: (x) => (
                <>
                  <span className="ttl">{x.theme}</span>
                  <br />
                  <span className="ref">{x.formateur}</span>
                </>
              ),
            },
            { l: 'Date', r: (x) => fd(x.date) },
            { l: 'Participants', k: 'participants' },
            { l: 'Statut', r: (x) => <StatusBadge value={x.statut} /> },
            {
              l: 'Évaluation post-formation',
              r: (x) => (
                <>
                  {fd(x.evaluationDate)}
                  <br />
                  <span className="ref">{x.evaluationResponsable || '—'}</span>
                </>
              ),
            },
            { l: 'Résultat', r: (x) => <span className="small">{x.resultat}</span> },
            { l: 'Normes', r: (x) => <NormBadges norms={x.normes} /> },
          ]}
          rows={formations}
          onRowClick={(i) => openForm('formations', i)}
          search={['theme', 'participants']}
          filters={[{ k: 'statut', l: 'Statut', o: ['Planifiée', 'Réalisée', 'Reportée'] }]}
          onAdd={() => openForm('formations')}
          addLabel="Planifier une session"
          exportName="Plan_de_formation"
        />
      </div>
    )

  return (
    <>
      <PageHead
        kicker={MOD_FULL.m4}
        title="4.2 Compétences"
        desc="Matrice des compétences par direction (saisie ou import), savoirs critiques, plan de formation et évaluations post-formation."
      />
      {tb}
      {c}
    </>
  )
}
