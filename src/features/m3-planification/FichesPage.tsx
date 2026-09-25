/** 3.2 Fiche de maîtrise opérationnelle (déplacée du Module 5 en v2). */
import { Fragment } from 'react'
import { DataTable } from '../../components/data/DataTable'
import { DueDate } from '../../components/ui/badges'
import { PageHead } from '../../components/ui/PageHead'
import { MOD_FULL } from '../../data/referentiels'
import { openForm } from '../../forms/crud'
import { procName, procOpts } from '../../lib/lookups'
import { useApp } from '../../store/useApp'
import { fmDetail, type Any } from './fiches'

export function FichesPage() {
  const db = useApp((s) => s.db) as Any
  return (
    <>
      <PageHead
        kicker={MOD_FULL.m3}
        title="3.2 Fiche de maîtrise opérationnelle"
        desc="Une fiche par processus ou activité à risque, liée au processus et aux risques, avec alerte automatique à l'approche de l'échéance de mise à jour. (Rattachée au Module 3 lors de la revue du 25/09.)"
      />
      <div className="card">
        <DataTable
          id="fm"
          cols={[
            {
              l: 'Activité à risque',
              r: (f) => (
                <>
                  <span className="ttl">{f.objet}</span>
                  <br />
                  <span className="ref">{procName(f.processus)}</span>
                </>
              ),
            },
            { l: 'Critères opérationnels', r: (f) => <span className="small">{f.criteres}</span> },
            { l: 'Moyens de maîtrise', r: (f) => <span className="small">{f.moyens}</span> },
            { l: 'Responsable', k: 'responsable' },
            {
              l: 'Risques',
              r: (f) =>
                f.risques.map((r: string, j: number) => (
                  <Fragment key={r + j}>
                    {j > 0 ? ' ' : null}
                    <span className="badge b-grey">{r}</span>
                  </Fragment>
                )),
            },
            { l: 'Prochaine mise à jour', r: (f) => <DueDate date={f.prochaineMaj} /> },
          ]}
          rows={db.fichesMaitrise as Any[]}
          onRowClick={fmDetail}
          search={['objet', 'criteres']}
          filters={[{ k: 'processus', l: 'Processus', o: procOpts }]}
          onAdd={() => openForm('fichesMaitrise')}
          addLabel="Créer une fiche"
          exportName="Fiches_maitrise_operationnelle"
          norm={false}
        />
      </div>
    </>
  )
}
