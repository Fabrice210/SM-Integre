import { useMemo } from 'react'
import { DataTable } from '../../components/data/DataTable'
import { StatusBadge } from '../../components/ui/badges'
import { Icon } from '../../components/ui/Icon'
import { PageHead } from '../../components/ui/PageHead'
import { useTabs } from '../../components/ui/Tabs'
import { MOD_FULL } from '../../data/referentiels'
import { openForm } from '../../forms/crud'
import { days, fd } from '../../lib/dates'
import { useApp } from '../../store/useApp'
import { planifierAnnee, repDetail, reuDetail } from './consultationActions'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

/** mand(m) : fin de mandat avec J-n (≤ 60 jours) ou « échu ». Comparaisons JS d'origine (null → 0). */
function Mandat({ m }: { m: Any }) {
  const d = days(m.mandatFin) as number
  return (
    <>
      {fd(m.mandatFin)}
      {d <= 60 && d >= 0 ? (
        <>
          {' '}
          <span className="badge b-amber">J-{d}</span>
        </>
      ) : d < 0 ? (
        <>
          {' '}
          <span className="badge b-red">échu</span>
        </>
      ) : null}
    </>
  )
}

/** PAGES['m2-consultation'] */
export function ConsultationPage() {
  const [t, tb] = useTabs('cons', [
    ['rep', 'Représentants des travailleurs'],
    ['com', 'Comité hygiène et santé'],
    ['reu', 'Réunions de consultation'],
  ])
  const representants = useApp((s) => s.db.representants) as Any[]
  const comite = useApp((s) => s.db.comite) as Any[]
  const reunions = useApp((s) => s.db.reunions) as Any[]
  const soon = useMemo(
    () =>
      [...representants, ...comite].filter((m) => {
        const d = days(m.mandatFin)
        return d !== null && d >= 0 && d <= 60
      }),
    [representants, comite]
  )
  let c = null
  if (t === 'rep')
    c = (
      <DataTable
        id="rep"
        cols={[
          {
            l: 'Nom',
            r: (x) => (
              <span className="ttl">
                {x.nom} {x.prenom}
              </span>
            ),
          },
          { l: 'Fonction', k: 'fonction' },
          {
            l: 'Qualité du lien',
            r: (x) => <span className="badge b-grey">{x.qualiteLien || '—'}</span>,
          },
          { l: 'Suppléant', r: (x) => x.suppleant || '—' },
          { l: 'Début', r: (x) => fd(x.mandatDebut) },
          { l: 'Fin de mandat', r: (x) => <Mandat m={x} /> },
          {
            l: 'État',
            r: (x) => <StatusBadge value={x.statut === 'Révoqué' ? 'Révoqué' : 'Actif'} />,
          },
        ]}
        rows={representants}
        onRowClick={repDetail}
        norm={false}
        onAdd={() => openForm('representants')}
        addLabel="Ajouter un représentant"
        exportName="Representants"
        collection="representants"
      />
    )
  if (t === 'com')
    c = (
      <DataTable
        id="com"
        cols={[
          {
            l: 'Nom',
            r: (x) => (
              <span className="ttl">
                {x.nom} {x.prenom}
              </span>
            ),
          },
          { l: 'Date de naissance', r: (x) => fd(x.dateNaissance) },
          { l: 'Rôle', k: 'role' },
          { l: 'Fin de mandat', r: (x) => <Mandat m={x} /> },
        ]}
        rows={comite}
        onRowClick={(i) => openForm('comite', i)}
        norm={false}
        onAdd={() => openForm('comite')}
        addLabel="Ajouter un membre"
        exportName="Comite_HS"
        collection="comite"
      />
    )
  if (t === 'reu')
    c = (
      <DataTable
        id="reu"
        cols={[
          { l: 'Date', r: (x) => fd(x.datePrevue || x.date) },
          { l: 'Objet', r: (x) => <span className="ttl">{x.objet}</span> },
          { l: 'Participants', r: (x) => <span className="badge b-grey">{x.participants}</span> },
          { l: 'Compte rendu', r: (x) => <span className="small">{x.compteRendu || '—'}</span> },
          { l: 'Statut', r: (x) => <StatusBadge value={x.statut || 'Planifiée'} /> },
        ]}
        rows={reunions}
        onRowClick={reuDetail}
        norm={false}
        onAdd={() => openForm('reunions')}
        addLabel="Planifier une réunion"
        exportName="Reunions_consultation"
        collection="reunions"
        extra={
          <button className="btn sm" onClick={planifierAnnee}>
            <Icon name="cal" size={14} /> Planification globale de l'année
          </button>
        }
      />
    )
  return (
    <>
      <PageHead
        kicker={MOD_FULL.m2}
        title="2.4 Consultation et participation"
        desc="Représentants des travailleurs, comité hygiène et santé, réunions de consultation et suivi des actions décidées."
      />
      {soon.length ? (
        <div className="note warn mb">
          <Icon name="warn" size={15} /> {soon.length} mandat(s) arrivent à échéance dans moins de
          60 jours :{' '}
          {soon.map((m) => m.prenom + ' ' + m.nom + ' (' + fd(m.mandatFin) + ')').join(', ')}. Une
          alerte a été envoyée au DRH.
        </div>
      ) : null}
      {tb}
      <div className="card">{c}</div>
    </>
  )
}
