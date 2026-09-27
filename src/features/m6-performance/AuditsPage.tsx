/** 6.2 Audits (original v2 l.1778-1783). */
import { go } from '../../app/navigation'
import { Calendar } from '../../components/data/Calendar'
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
import type { Any } from './shared'

export function AuditsPage() {
  const db = useApp((s) => s.db) as Any
  const norm = useApp((s) => s.ui.norm)
  const [t, tb] = useTabs('aud', [
    ['plan', 'Planification'],
    ['diff', 'Diffusion & rapports'],
    ['act', 'Actions'],
  ])
  const A: Any[] = db.audits
  const auditeursNoms = () => db.auditeurs.map((a: Any) => a.nom)
  let c = null
  if (t === 'plan')
    c = (
      <>
        <div className="note mb">
          <Icon name="bell" size={14} /> Une alerte automatique est envoyée à l'auditeur environ
          deux mois avant chaque audit (J-60).
        </div>
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
          sub="Plan d'audit annuel — affectation des auditeurs selon leur disponibilité"
        />
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-h">
            <div>
              <h3>Auditeurs — affectation selon disponibilité</h3>
              <div className="sub">Indépendance vérifiée à l'affectation</div>
            </div>
            <button className="btn sm" onClick={() => openForm('auditeurs')}>
              <Icon name="plus" size={14} /> Ajouter un auditeur
            </button>
          </div>
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
            norm={false}
            exportName="Auditeurs"
            collection="auditeurs"
          />
        </div>
      </>
    )
  if (t === 'diff')
    c = (
      <>
        <div className="btn-row mb">
          <button className="btn" onClick={campaignReport}>
            <Icon name="doc" size={15} /> Générer le rapport compilé de campagne
          </button>
        </div>
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
              { l: 'Rapport', r: (a) => a.rapport },
              { l: 'Constats', r: (a) => a.constats.length, cls: 'num' },
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
            collection="audits"
          />
        </div>
      </>
    )
  if (t === 'act') {
    const reg = (db.registre as Any[]).filter(
      (x) => /audit/i.test(x.type) || /AUD-/.test(x.origine)
    )
    c = (
      <>
        <div className="note mb">
          <Icon name="arrow" size={14} /> À la clôture d'un audit, les constats (non-conformités et
          observations) sont enregistrés automatiquement dans le{' '}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              go('m6-registre')
            }}
          >
            registre d'amélioration continue (6.5)
          </a>
          .
        </div>
        <div className="card">
          <DataTable
            id="audact"
            cols={[
              { l: 'Référence', r: (x) => <span className="ttl">{x.ref}</span> },
              { l: 'Type', r: (x) => <span className="badge b-grey">{x.type}</span> },
              { l: 'Action / constat', r: (x) => <span className="small">{x.intitule}</span> },
              { l: 'Origine', k: 'origine' },
              { l: 'Responsable', k: 'responsable' },
              { l: 'Statut', r: (x) => <StatusBadge value={x.statut} /> },
            ]}
            rows={reg}
            onRowClick={() => go('m6-registre')}
            norm={false}
            empty="Aucune action d'audit enregistrée pour le moment."
            exportName="Actions_audit"
          />
        </div>
      </>
    )
  }
  return (
    <>
      <PageHead
        kicker={MOD_FULL.m6}
        title="6.2 Audits"
        desc="Onglets Planification, Diffusion & rapports et Actions : plan annuel, affectation des auditeurs et alertes, diffusion du plan et des rapports avec rapport compilé de campagne, enregistrement automatique des actions au registre 6.5."
        actions={
          <button className="btn primary" onClick={() => openForm('audits')}>
            <Icon name="plus" size={15} /> Planifier un audit
          </button>
        }
      />
      {tb}
      {c}
    </>
  )
}
