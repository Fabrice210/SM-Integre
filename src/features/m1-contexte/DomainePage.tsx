import { useMemo } from 'react'
import { DataTable, type Column } from '../../components/data/DataTable'
import { StatusBadge } from '../../components/ui/badges'
import { Icon } from '../../components/ui/Icon'
import { PageHead } from '../../components/ui/PageHead'
import { useTabs } from '../../components/ui/Tabs'
import { MOD_FULL } from '../../data/referentiels'
import { openForm } from '../../forms/crud'
import { fd } from '../../lib/dates'
import { exportWord, printDoc } from '../../services/exports'
import { update, useApp } from '../../store/useApp'
import { domaineHTML, saveVersion } from './actions'
import { siteDetail } from './details'
import type { Any } from './util'

const EXCL_COLS: Column<Any>[] = [
  { l: 'Statut', r: (s) => <StatusBadge value={s.statut} /> },
  { l: 'Justification', r: (s) => <span className="small">{s.justification}</span> },
]

function SitesTab() {
  const sites = useApp((s) => s.db.sites) as Any[]
  return (
    <DataTable
      id="sites"
      cols={[
        { l: 'Site', r: (s) => <span className="ttl">{s.nom}</span> },
        { l: 'Adresse', k: 'adresse' },
        { l: 'Activité principale', k: 'activite' },
        ...EXCL_COLS,
      ]}
      rows={sites}
      onRowClick={siteDetail}
      search={['nom', 'adresse']}
      filters={[{ k: 'statut', l: 'Statut', o: ['Inclus', 'Exclu'] }]}
      onAdd={() => openForm('sites')}
      addLabel="Ajouter un site"
      exportName="Sites"
      norm={false}
    />
  )
}

function ActTab() {
  const activites = useApp((s) => s.db.activites) as Any[]
  return (
    <DataTable
      id="act"
      cols={[
        { l: 'Type', k: 'type' },
        { l: 'Libellé', r: (s) => <span className="ttl">{s.libelle}</span> },
        { l: 'Site', k: 'site' },
        ...EXCL_COLS,
      ]}
      rows={activites}
      onRowClick={(i) => openForm('activites', i)}
      search={['libelle']}
      filters={[
        { k: 'type', l: 'Type', o: ['Activité', 'Processus', 'Produit', 'Service'] },
        { k: 'statut', l: 'Statut', o: ['Inclus', 'Exclu'] },
      ]}
      onAdd={() => openForm('activites')}
      addLabel="Ajouter un élément"
      exportName="Activites_couvertes"
      norm={false}
    />
  )
}

function DocTab() {
  const db = useApp((s) => s.db)
  const org = useApp((s) => s.org)
  const activeNorms = useApp((s) => s.activeNorms)
  const auditorAccess = useApp((s) => s.auditorAccess)
  const html = useMemo(() => domaineHTML({ db, org, activeNorms }), [db, org, activeNorms])
  return (
    <>
      <div className="card-h">
        <div className={`note ${auditorAccess ? 'ok' : 'warn'}`}>
          {auditorAccess
            ? 'Document accessible en lecture aux auditeurs lors des revues.'
            : 'Accès auditeurs désactivé.'}{' '}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              update((s) => {
                s.auditorAccess = !s.auditorAccess
              })
            }}
          >
            {auditorAccess ? 'Désactiver' : 'Activer'}
          </a>
        </div>
        <div className="btn-row">
          <button
            className="btn sm"
            onClick={() => saveVersion('domaineVersions', "Domaine d'application")}
          >
            <Icon name="archive" size={14} /> Figer une version
          </button>
          <button
            className="btn sm"
            onClick={() => printDoc("Domaine d'application", domaineHTML())}
          >
            <Icon name="doc" size={14} /> PDF
          </button>
          <button
            className="btn sm"
            onClick={() => exportWord("Domaine d'application", domaineHTML())}
          >
            <Icon name="dl" size={14} /> Word
          </button>
        </div>
      </div>
      <div className="doc-preview" dangerouslySetInnerHTML={{ __html: html }} />
      <p className="small muted">
        Document mis à jour automatiquement à chaque ajout, modification ou exclusion de site et
        d'activité.
      </p>
    </>
  )
}

function VerTab() {
  const versions = useApp((s) => s.db.domaineVersions)
  const rows = useMemo(() => versions.slice().reverse(), [versions])
  return (
    <DataTable
      id="dv"
      cols={[
        { l: 'Version', r: (v) => <span className="ttl">{v.version}</span> },
        { l: 'Date', r: (v) => fd(v.date) },
        { l: 'Auteur', k: 'auteur' },
        { l: 'Commentaire', k: 'commentaire' },
        {
          l: '',
          r: (v) => (
            <button
              className="btn sm"
              onClick={() => printDoc(`Domaine d'application ${v.version}`, domaineHTML())}
            >
              Consulter
            </button>
          ),
        },
      ]}
      rows={rows as Any[]}
      norm={false}
    />
  )
}

/** PAGES['m1-domaine'] */
export function DomainePage() {
  const [t, tb] = useTabs('dom', [
    ['sites', 'Sites'],
    ['act', 'Activités, produits et services'],
    ['doc', 'Document consolidé'],
    ['ver', 'Versions'],
  ])
  return (
    <>
      <PageHead
        kicker={MOD_FULL.m1}
        title="1.3 Domaine d'application"
        desc="Sites, activités, processus, produits et services couverts ; toute exclusion exige une justification."
      />
      {tb}
      <div className="card">
        {t === 'sites' ? (
          <SitesTab />
        ) : t === 'act' ? (
          <ActTab />
        ) : t === 'doc' ? (
          <DocTab />
        ) : t === 'ver' ? (
          <VerTab />
        ) : null}
      </div>
    </>
  )
}
