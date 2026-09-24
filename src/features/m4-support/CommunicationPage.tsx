import { useMemo, useState } from 'react'
import { DataTable } from '../../components/data/DataTable'
import { Progress, StatusBadge } from '../../components/ui/badges'
import { Icon } from '../../components/ui/Icon'
import { PageHead } from '../../components/ui/PageHead'
import { MOD_FULL } from '../../data/referentiels'
import { openForm } from '../../forms/crud'
import type { Rec } from '../../forms/types'
import { days, fd } from '../../lib/dates'
import { procName } from '../../lib/lookups'
import { inNorm } from '../../lib/norms'
import { useApp } from '../../store/useApp'
import { comDone, comReport } from './communication'

type Row = { id: string; normes?: readonly string[] } & Rec

/** PAGES['m4-communication'] de l'original (période du rapport = S.comPer, état local). */
export function CommunicationPage() {
  const communications = useApp((s) => s.db.communications) as Row[]
  const norm = useApp((s) => s.ui.norm)
  const C = useMemo(() => communications.filter((x) => inNorm(x, norm)), [communications, norm])
  const [per, setPer] = useState('2026')
  const done = C.filter((c) => c.statut === 'Fait').length

  return (
    <>
      <PageHead
        kicker={MOD_FULL.m4}
        title="4.3 Communication"
        desc="Planification des actions de sensibilisation selon la grille : objectif, qui fait, cible, moyen, date, statut, preuve."
        actions={
          <>
            <select
              className="sel"
              value={per}
              onChange={(e) => setPer(e.target.value)}
              aria-label="Période du rapport"
            >
              {['2026', 'T3 2026', 'T4 2026'].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <button className="btn" onClick={() => comReport(per)}>
              <Icon name="doc" size={15} /> Rapport de communication
            </button>
          </>
        }
      />
      <div className="grid g3 mb">
        <div className="card">
          <div className="small muted">Actions planifiées</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{C.length}</div>
        </div>
        <div className="card">
          <div className="small muted">Réalisées avec preuve</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--green)' }}>{done}</div>
        </div>
        <div className="card">
          <div className="small muted">Taux de réalisation</div>
          <Progress value={(done / Math.max(1, C.length)) * 100} />
        </div>
      </div>{' '}
      <div className="card">
        <DataTable<Row>
          id="com2"
          cols={[
            {
              l: 'Objectif',
              r: (x) => (
                <>
                  <span className="ttl">{x.objectif}</span>
                  <br />
                  <span className="ref">{procName(x.processus)}</span>
                </>
              ),
            },
            { l: 'Qui fait', k: 'quiFait' },
            { l: 'Cible', k: 'cible' },
            { l: 'Moyen', k: 'moyen' },
            { l: 'Date', r: (x) => fd(x.date) },
            {
              l: 'Statut',
              r: (x) => (
                <StatusBadge
                  value={
                    x.statut === 'Pas fait' && (days(x.date) as number) >= 0 ? 'Pas fait' : x.statut
                  }
                />
              ),
            },
            {
              l: 'Preuve',
              r: (x) =>
                x.statut === 'Fait' ? (
                  <>
                    <Icon name="doc" size={13} /> <span className="small">{x.preuve}</span>
                  </>
                ) : (
                  <button
                    className="btn sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      comDone(x.id)
                    }}
                  >
                    Joindre une preuve
                  </button>
                ),
            },
          ]}
          rows={communications}
          onRowClick={(i) => openForm('communications', i)}
          search={['objectif', 'cible']}
          filters={[
            {
              k: 'cible',
              l: 'Cible',
              o: () => [...new Set(communications.map((c) => c.cible as string))],
            },
            {
              k: 'moyen',
              l: 'Moyen',
              o: () => [...new Set(communications.map((c) => c.moyen as string))],
            },
            { k: 'statut', l: 'Statut', o: ['Fait', 'Pas fait'] },
          ]}
          onAdd={() => openForm('communications')}
          addLabel="Créer une action"
          exportName="Plan_de_communication"
        />
      </div>
    </>
  )
}
