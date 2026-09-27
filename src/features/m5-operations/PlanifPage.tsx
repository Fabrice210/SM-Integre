/** 5.2 Planification opérationnelle (original l.1591-1594). */
import { DataTable } from '../../components/data/DataTable'
import { DueDate, Progress } from '../../components/ui/badges'
import { PageHead } from '../../components/ui/PageHead'
import { MOD_FULL } from '../../data/referentiels'
import { openForm } from '../../forms/crud'
import type { FormDef } from '../../forms/types'
import { addDays } from '../../lib/dates'
import { procName, procOpts, userNames } from '../../lib/lookups'
import { hist, logAct, update, useApp } from '../../store/useApp'
import { toast } from '../../store/useOverlays'
import { DB, type Any } from '../m6-performance/shared'

const PO_ST = ['Pas fait', 'En cours', 'Fait']

export const planifForms: Record<string, FormDef> = {
  plansOps: {
    title: "Plan d'action opérationnel",
    prefix: 'PO',
    label: 'plan',
    mod: 'Planification opérationnelle',
    fields: [
      { k: 'processus', l: 'Processus', t: 'select', o: procOpts },
      { k: 'plan', l: "Plan d'action", req: 1, full: 1 },
      { k: 'responsable', l: 'Responsable unique', t: 'select', o: userNames },
      { k: 'echeance', l: 'Échéance', t: 'date', req: 1 },
      { k: 'statut', l: 'Statut', t: 'select', o: PO_ST },
    ],
    def: () => ({
      processus: 'P07',
      plan: "Contrôle de l'arrimage des conteneurs avant départ au port",
      responsable: 'Martial ADJIBADÉ',
      echeance: addDays(20),
      statut: 'Pas fait',
    }),
  },
}

function setStatut(id: string, v: string) {
  update((s) => {
    const p = DB(s).plansOps.find((y: Any) => y.id === id)
    p.statut = v
    hist(s, p, 'Statut : ' + v)
    logAct(s, 'a passé « ' + p.plan + ' » à ' + v, 'Planification opérationnelle')
  })
  toast('Statut mis à jour.')
}

export function PlanifPage() {
  const db = useApp((s) => s.db) as Any
  const P: Any[] = db.plansOps
  return (
    <>
      <PageHead
        kicker={MOD_FULL.m5}
        title="5.2 Planification opérationnelle du processus"
        desc="Plans d'action spécifiques à chaque processus, avec un responsable unique et un suivi du statut."
      />
      <div className="card mb">
        <DataTable
          id="po"
          cols={[
            { l: 'Processus', r: (x) => <span className="ttl">{procName(x.processus)}</span> },
            { l: "Plan d'action", k: 'plan' },
            { l: 'Responsable unique', k: 'responsable' },
            { l: 'Échéance', r: (x) => <DueDate date={x.echeance} done={x.statut === 'Fait'} /> },
            {
              l: 'Statut',
              r: (x) => (
                <select
                  className="sel"
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setStatut(x.id, e.target.value)}
                  aria-label="Statut"
                  value={x.statut}
                >
                  {PO_ST.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              ),
            },
          ]}
          rows={P}
          onRowClick={(i) => openForm('plansOps', i)}
          search={['plan', 'responsable']}
          filters={[
            { k: 'processus', l: 'Processus', o: procOpts },
            { k: 'statut', l: 'Statut', o: PO_ST },
          ]}
          onAdd={() => openForm('plansOps')}
          addLabel="Recenser un plan d'action"
          exportName="Planification_operationnelle"
          collection="plansOps"
          norm={false}
        />
      </div>
      <div className="grid g3">
        {db.processus
          .filter((p: Any) => P.some((x) => x.processus === p.id))
          .map((p: Any) => {
            const L = P.filter((x) => x.processus === p.id)
            const done = L.filter((x) => x.statut === 'Fait').length
            return (
              <div key={p.id} className="card flat">
                <h3 style={{ fontSize: 14, margin: '0 0 6px' }}>
                  {p.code} · {p.intitule}
                </h3>
                <Progress value={(done / L.length) * 100} />
                <div className="small muted" style={{ marginTop: 6 }}>
                  {L.length} plan(s) — {done} fait(s)
                </div>
              </div>
            )
          })}
      </div>
    </>
  )
}
