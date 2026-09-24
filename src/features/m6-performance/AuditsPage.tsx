/** 6.2 Audits (original l.1645-1650). */
import { DataTable } from '../../components/data/DataTable'
import { NormBadges, StatusBadge } from '../../components/ui/badges'
import { Icon } from '../../components/ui/Icon'
import { PageHead } from '../../components/ui/PageHead'
import { useTabs } from '../../components/ui/Tabs'
import { MOD_FULL } from '../../data/referentiels'
import { openForm } from '../../forms/crud'
import { days, fd } from '../../lib/dates'
import { procShort } from '../../lib/lookups'
import { inNorm } from '../../lib/norms'
import { useApp } from '../../store/useApp'
import { AUD_ST, audDetail, campaignReport } from './audits'
import { Calendar } from '../../components/data/Calendar'
import type { Any } from './shared'

export function AuditsPage() {
  const db = useApp((s) => s.db) as Any
  const norm = useApp((s) => s.ui.norm)
  const [t, tb] = useTabs('aud', [
    ['plan', 'Plan annuel'],
    ['list', 'Liste des audits'],
    ['aud', 'Auditeurs'],
  ])
  const A: Any[] = db.audits
  const auditeursNoms = () => db.auditeurs.map((a: Any) => a.nom)
  let c = null
  if (t === 'plan')
    c = (
      <Calendar
        events={A.filter((a) => inNorm(a, norm)).map((a) => ({
          d: a.date,
          t: a.ref + ' ' + a.titre,
          s:
            a.statut === 'Clôturé'
              ? 'done'
              : (days(a.date) as number) < 0 && ['Planifié', 'Plan diffusé'].includes(a.statut)
                ? 'late'
                : '',
          onClick: () => audDetail(a.id),
          r: a.auditeur,
        }))}
        sub="Plan d'audit annuel généré à partir des audits planifiés"
      />
    )
  if (t === 'list')
    c = (
      <div className="card">
        <DataTable
          id="aud"
          cols={[
            { l: 'Référence', r: (a) => <span className="ttl">{a.ref}</span> },
            { l: 'Audit', k: 'titre' },
            { l: 'Date', r: (a) => fd(a.date) },
            { l: 'Périmètre', r: (a) => procShort(a.perimetre) },
            { l: 'Auditeur', k: 'auditeur' },
            { l: 'Statut', r: (a) => <StatusBadge value={a.statut} /> },
            { l: 'Constats', r: (a) => a.constats.length, cls: 'num' },
            { l: 'Normes', r: (a) => <NormBadges norms={a.normes} /> },
          ]}
          rows={A}
          onRowClick={audDetail}
          search={['titre', 'ref', 'auditeur']}
          filters={[
            { k: 'statut', l: 'Statut', o: AUD_ST },
            { k: 'auditeur', l: 'Auditeur', o: auditeursNoms },
          ]}
          onAdd={() => openForm('audits')}
          addLabel="Planifier un audit"
          exportName="Programme_audit"
        />
      </div>
    )
  if (t === 'aud')
    c = (
      <div className="card">
        <DataTable
          id="auds"
          cols={[
            { l: 'Auditeur', r: (a) => <span className="ttl">{a.nom}</span> },
            { l: 'Qualification', k: 'qualification' },
            { l: 'Normes', r: (a) => <NormBadges norms={a.normes} /> },
            { l: 'Disponibilité', k: 'disponibilite' },
            { l: 'Indépendance', k: 'independance' },
            {
              l: 'Audits affectés',
              r: (a) => A.filter((x) => x.auditeur === a.nom).length,
              cls: 'num',
            },
          ]}
          rows={db.auditeurs as Any[]}
          onRowClick={(i) => openForm('auditeurs', i)}
          onAdd={() => openForm('auditeurs')}
          addLabel="Ajouter un auditeur"
          exportName="Auditeurs"
        />
      </div>
    )
  return (
    <>
      <PageHead
        kicker={MOD_FULL.m6}
        title="6.2 Audits"
        desc="Planification et plan annuel, affectation des auditeurs selon leur disponibilité, alertes, dépôt des rapports et enregistrement automatique des actions au registre."
        actions={
          <>
            <button className="btn" onClick={campaignReport}>
              <Icon name="doc" size={15} /> Rapport compilé de la campagne
            </button>
            <button className="btn primary" onClick={() => openForm('audits')}>
              <Icon name="plus" size={15} /> Planifier un audit
            </button>
          </>
        }
      />
      {tb}
      {c}
    </>
  )
}
