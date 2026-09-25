import { Fragment } from 'react'
import { pageTitle } from '../../app/pages'
import { DataTable } from '../../components/data/DataTable'
import { Icon } from '../../components/ui/Icon'
import { PageHead } from '../../components/ui/PageHead'
import { useTabs } from '../../components/ui/Tabs'
import { DIRECTIONS, MOD_FULL } from '../../data/referentiels'
import { openForm } from '../../forms/crud'
import { procOpts } from '../../lib/lookups'
import { exportPage } from '../../services/exports'
import { useApp } from '../../store/useApp'
import { diffuserNoyau } from './diffusion'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

function Organigramme() {
  const postes = useApp((s) => s.db.postes) as Any[]
  const users = useApp((s) => s.users)
  return (
    <div className="card">
      <div className="card-h">
        <div>
          <h3>Organigramme</h3>
          <div className="sub">Généré à partir des directions et des fiches de poste</div>
        </div>
        <div className="btn-row">
          <button className="btn sm" onClick={() => diffuserNoyau('Organigramme')}>
            <Icon name="send" size={14} /> Diffuser
          </button>
          <button className="btn sm" onClick={() => exportPage(pageTitle('m2-roles'))}>
            <Icon name="doc" size={14} /> PDF
          </button>
        </div>
      </div>
      <div className="org">
        <div className="org-node top">
          <b>Direction Générale</b>
          {postes[0].titulaire}
        </div>
        <div className="org-vline"></div>
        <div className="org-row">
          {DIRECTIONS.slice(1).map((d) => (
            <div className="org-col" key={d}>
              <div className="org-node">
                <b>{d.replace('Direction ', 'Dir. ')}</b>
                {(users.find((u) => u.direction === d) || ({} as Any)).nom || ''}
              </div>
              <div className="org-sub">
                {postes
                  .filter((p) => p.direction === d)
                  .map((p) => (
                    <div className="org-node" key={p.id}>
                      <b>{p.intitule}</b>
                      {p.titulaire}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FichesPoste() {
  const postes = useApp((s) => s.db.postes) as Any[]
  return (
    <div className="card">
      <DataTable
        id="fp"
        cols={[
          {
            l: 'Poste',
            r: (x) => (
              <>
                <span className="ttl">{x.intitule}</span>
                <br />
                <span className="ref">{x.titulaire}</span>
              </>
            ),
          },
          { l: 'Direction', k: 'direction' },
          {
            l: 'Processus',
            r: (x) =>
              x.processus.map((p: string, i: number) => (
                <Fragment key={i}>
                  {i > 0 ? ' ' : null}
                  <span className="badge b-grey">{p}</span>
                </Fragment>
              )),
          },
          { l: 'Responsabilités SM', r: (x) => <span className="small">{x.responsabilites}</span> },
          { l: 'Preuve de communication', r: (x) => <span className="small">{x.preuve}</span> },
        ]}
        rows={postes}
        onRowClick={(i) => openForm('postes', i)}
        search={['intitule', 'titulaire', 'responsabilites']}
        filters={[
          { k: 'direction', l: 'Direction', o: DIRECTIONS },
          { k: 'processus', l: 'Processus', o: procOpts },
        ]}
        onAdd={() => openForm('postes')}
        addLabel="Créer une fiche de poste"
        exportName="Fiches_de_poste"
        norm={false}
      />
    </div>
  )
}

/** PAGES['m2-roles'] */
export function RolesPage() {
  const [t, tb] = useTabs('roles', [
    ['fp', 'Fiches de poste'],
    ['org', 'Organigramme'],
  ])
  return (
    <>
      <PageHead
        kicker={MOD_FULL.m2}
        title="2.3 Rôles et responsabilités"
        desc="Fiches de poste, organigramme construit à partir des directions déjà renseignées et preuves de communication des évolutions."
      />
      {tb}
      {t === 'fp' ? <FichesPoste /> : <Organigramme />}
    </>
  )
}
