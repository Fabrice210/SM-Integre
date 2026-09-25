import type { ReactNode } from 'react'
import { DataTable } from '../../components/data/DataTable'
import { DueDate, StatusBadge } from '../../components/ui/badges'
import { PageHead } from '../../components/ui/PageHead'
import { MOD_FULL } from '../../data/referentiels'
import { openForm } from '../../forms/crud'
import type { Rec } from '../../forms/types'
import { days, fd } from '../../lib/dates'
import { money } from '../../lib/format'
import { procShort } from '../../lib/lookups'
import { useApp } from '../../store/useApp'
import { resDetail } from './ressources'

type Row = { id: string } & Rec

/** PAGES['m4-ressources'] de l'original. */
export function RessourcesPage() {
  const R = useApp((s) => s.db.ressources) as Row[]
  const tot = R.reduce((a, r) => a + r.montant, 0)
  const kpis: [string, ReactNode][] = [
    ['Demandes', R.length],
    ['Montant total', money(tot)],
    ['En attente de validation', R.filter((r) => r.statut === 'Soumise').length],
    [
      'En retard de mise à disposition',
      R.filter((r) => r.statut !== 'Mise à disposition' && (days(r.dateDemandee) as number) < 0)
        .length,
    ],
  ]
  return (
    <>
      <PageHead
        kicker={MOD_FULL.m4}
        title="4.1 Ressources"
        desc="Planification des besoins (bilan besoin / disponible), demandes liées aux achats RH et finance avec circuit de validation, suivi du délai de mise à disposition."
      />
      <div className="grid g4 mb">
        {kpis.map(([a, b]) => (
          <div key={a} className="card">
            <div className="small muted">{a}</div>
            <div style={{ fontSize: 21, fontWeight: 700 }}>{b}</div>
          </div>
        ))}
      </div>{' '}
      <div className="card">
        <DataTable<Row>
          id="res"
          cols={[
            {
              l: 'Besoin',
              r: (r) => (
                <>
                  <span className="ttl">{r.besoin}</span>
                  <br />
                  <span className="ref">
                    {procShort(r.processus)}
                  </span>
                </>
              ),
            },
            { l: 'Type', k: 'type' },
            { l: 'Bilan disponible', k: 'disponible' },
            { l: 'Montant', r: (r) => money(r.montant), cls: 'num' },
            { l: 'Circuit', k: 'circuit' },
            {
              l: 'Demandée pour',
              r: (r) => <DueDate date={r.dateDemandee} done={r.statut === 'Mise à disposition'} />,
            },
            { l: 'Réelle', r: (r) => fd(r.dateReelle) },
            { l: 'Statut', r: (r) => <StatusBadge value={r.statut} /> },
          ]}
          rows={R}
          onRowClick={resDetail}
          search={['besoin', 'justification']}
          filters={[
            { k: 'type', l: 'Type', o: ['Humaine', 'Matérielle', 'Financière', 'Infrastructure'] },
            {
              k: 'statut',
              l: 'Statut',
              o: ['Brouillon', 'Soumise', 'Validée', 'Refusée', 'Mise à disposition'],
            },
          ]}
          onAdd={() => openForm('ressources')}
          addLabel="Planifier une ressource"
          exportName="Demandes_ressources"
          norm={false}
        />
      </div>
    </>
  )
}
