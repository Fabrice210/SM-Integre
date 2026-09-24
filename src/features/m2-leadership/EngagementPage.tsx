import { useMemo } from 'react'
import { DataTable } from '../../components/data/DataTable'
import { Progress, StatusBadge } from '../../components/ui/badges'
import { Icon } from '../../components/ui/Icon'
import { PageHead } from '../../components/ui/PageHead'
import { useTabs } from '../../components/ui/Tabs'
import { MOD_FULL } from '../../data/referentiels'
import { openForm } from '../../forms/crud'
import { fd } from '../../lib/dates'
import { useApp } from '../../store/useApp'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

function PlanTab() {
  const planStrat = useApp((s) => s.db.planStrat)
  const rows = useMemo(() => planStrat.slice().reverse() as Any[], [planStrat])
  return (
    <DataTable
      id="ps"
      cols={[
        { l: 'Version', r: (v) => <span className="ttl">{v.version}</span> },
        { l: 'Titre', k: 'titre' },
        {
          l: 'Document',
          r: (v) => (
            <>
              <Icon name="doc" size={14} /> {v.fichier}
            </>
          ),
        },
        { l: 'Validé le', r: (v) => fd(v.dateValidation) },
        { l: 'Validé par', k: 'validePar' },
        { l: 'Statut', r: (v) => <StatusBadge value={v.statut} /> },
      ]}
      rows={rows}
      onRowClick={(i) => openForm('planStrat', i)}
      norm={false}
      onAdd={() => openForm('planStrat')}
      addLabel="Charger un plan stratégique"
      exportName="Plans_strategiques"
    />
  )
}

function EvalTab() {
  const axes = useApp((s) => s.db.axes)
  const objectifs = useApp((s) => s.db.objectifs)
  return (
    <>
      <div className="grid g2">
        {axes.map((a) => (
          <div className="card flat" key={a.id}>
            <div className="btn-row" style={{ justifyContent: 'space-between' }}>
              <span className="badge b-blue">{a.code}</span>
              <button className="btn sm" onClick={() => openForm('axes', a.id)}>
                <Icon name="edit" size={13} /> Évaluer
              </button>
            </div>
            <h3 style={{ fontSize: '14.5px', margin: '8px 0' }}>{a.libelle}</h3>
            <Progress value={a.avancement} />
            <p className="small muted" style={{ margin: '8px 0 0' }}>
              {a.evaluation}
            </p>
            <p className="small" style={{ margin: '6px 0 0' }}>
              {objectifs.filter((o) => o.axe === a.id).length} objectif(s) rattaché(s)
            </p>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <button className="btn sm" onClick={() => openForm('axes')}>
          <Icon name="plus" size={14} /> Ajouter un axe
        </button>
      </div>
    </>
  )
}

function CpTab() {
  const champsPerso = useApp((s) => s.db.champsPerso) as Any[]
  return (
    <DataTable
      id="cp"
      cols={[
        { l: 'Libellé', r: (x) => <span className="ttl">{x.libelle}</span> },
        { l: 'Type', k: 'type' },
        { l: 'Valeur', k: 'valeur' },
        { l: 'Commentaire', k: 'commentaire' },
      ]}
      rows={champsPerso}
      onRowClick={(i) => openForm('champsPerso', i)}
      norm={false}
      onAdd={() => openForm('champsPerso')}
      addLabel="Ajouter un champ"
    />
  )
}

/** PAGES['m2-engagement'] */
export function EngagementPage() {
  const [t, tb] = useTabs('eng', [
    ['plan', 'Plan stratégique'],
    ['eval', 'Évaluation de la mise en œuvre'],
    ['cp', 'Autres politiques (champs personnalisés)'],
  ])
  return (
    <>
      <PageHead
        kicker={MOD_FULL.m2}
        title="2.1 Engagement de la direction"
        desc="Plan stratégique historisé, évaluation de sa mise en œuvre et autres politiques de l'entreprise."
      />
      {tb}
      <div className="card">
        {t === 'plan' ? <PlanTab /> : t === 'eval' ? <EvalTab /> : t === 'cp' ? <CpTab /> : null}
      </div>
    </>
  )
}
