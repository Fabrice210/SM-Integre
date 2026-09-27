import { useMemo } from 'react'
import { DataTable } from '../../components/data/DataTable'
import { StatusBadge } from '../../components/ui/badges'
import { PageHead } from '../../components/ui/PageHead'
import type { Seed } from '../../data/seed'
import { useApp } from '../../store/useApp'
import { journalMods, withId } from './dashboardData'

type JournalRow = Seed['journal'][number] & { id: string }

const journalUsers = () => [...new Set(useApp.getState().db.journal.map((j) => j.u))]

/** PAGES.journal de l'original : traçabilité non modifiable. */
export function JournalPage() {
  const journal = useApp((s) => s.db.journal)
  const rows = useMemo(() => journal.map(withId), [journal])
  return (
    <>
      <PageHead
        kicker="Traçabilité"
        title="Journal d'audit"
        desc="Toutes les créations, modifications, validations, exports et propositions IA sont horodatées. Le journal est non modifiable."
      />
      <div className="card">
        <DataTable<JournalRow>
          id="journal"
          cols={[
            { l: 'Date et heure', r: (x) => x.d },
            { l: 'Utilisateur', r: (x) => <span className="ttl">{x.u}</span> },
            { l: 'Action', k: 'a' },
            { l: 'Module', k: 'mod' },
            { l: 'Statut', r: (x) => <StatusBadge value={x.statut} /> },
          ]}
          rows={rows}
          search={['u', 'a', 'mod']}
          filters={[
            { k: 'mod', l: 'Module', o: journalMods },
            { k: 'u', l: 'Utilisateur', o: journalUsers },
          ]}
          exportName="Journal_audit"
          collection="journal"
          norm={false}
        />
      </div>
    </>
  )
}
