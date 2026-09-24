import { useMemo, type ReactNode } from 'react'
import { DataTable } from '../../components/data/DataTable'
import { NormBadges, StatusBadge } from '../../components/ui/badges'
import { PageHead } from '../../components/ui/PageHead'
import { useTabs } from '../../components/ui/Tabs'
import { MOD_FULL } from '../../data/referentiels'
import { openForm } from '../../forms/crud'
import type { Rec } from '../../forms/types'
import { days, fd } from '../../lib/dates'
import { inNorm } from '../../lib/norms'
import { useApp } from '../../store/useApp'
import { Calendar } from '../../components/data/Calendar'
import { declDetail, txDetail } from './veille'

type Row = { id: string; normes?: readonly string[] } & Rec

/** PAGES['m3-veille'] de l'original. */
export function VeillePage() {
  const [t, tb] = useTabs('veille', [
    ['reg', 'Registre réglementaire'],
    ['cal', "Calendrier d'audit de conformité"],
    ['dec', 'Déclarations au DG'],
  ])
  const textes = useApp((s) => s.db.textes) as Row[]
  const declarations = useApp((s) => s.db.declarations) as Row[]
  const norm = useApp((s) => s.ui.norm)
  const T = useMemo(() => textes.filter((x) => inNorm(x, norm)), [textes, norm])

  let c: ReactNode = null
  if (t === 'reg')
    c = (
      <div className="card">
        <DataTable<Row>
          id="tx"
          cols={[
            {
              l: 'Texte',
              r: (x) => (
                <>
                  <span className="ttl">{x.intitule}</span>
                  <br />
                  <a
                    href={x.lien}
                    target="_blank"
                    rel="noopener"
                    onClick={(e) => e.stopPropagation()}
                    className="small"
                  >
                    Source officielle
                  </a>
                </>
              ),
            },
            { l: 'Domaine', k: 'domaine' },
            { l: 'Publié le', r: (x) => fd(x.datePublication) },
            { l: 'Statut', r: (x) => <StatusBadge value={x.statut} /> },
            { l: 'Justificatif', r: (x) => <span className="small">{x.justificatif}</span> },
            { l: 'Pièces', r: (x) => <span className="small">{x.pieces}</span> },
            { l: 'Normes', r: (x) => <NormBadges norms={x.normes} /> },
          ]}
          rows={textes}
          onRowClick={txDetail}
          search={['intitule', 'domaine']}
          filters={[
            { k: 'statut', l: 'Statut', o: ['Fait', 'Pas fait'] },
            {
              k: 'domaine',
              l: 'Domaine',
              o: () => [...new Set(textes.map((x) => x.domaine as string))],
            },
          ]}
          onAdd={() => openForm('textes')}
          addLabel="Ajouter un texte"
          exportName="Registre_reglementaire"
        />
      </div>
    )
  if (t === 'cal')
    c = (
      <Calendar
        events={T.map((x) => ({
          d: x.echeance,
          t: x.intitule.slice(0, 38) + '…',
          s: x.statut === 'Fait' ? 'done' : (days(x.echeance) as number) < 0 ? 'late' : '',
          onClick: () => txDetail(x.id),
          r: x.responsable,
        }))}
        sub="Évaluations de conformité planifiées selon les échéances des textes, avec responsable affecté."
      />
    )
  if (t === 'dec')
    c = (
      <div className="card">
        <DataTable<Row>
          id="dec"
          cols={[
            { l: 'Objet', r: (x) => <span className="ttl">{x.objet}</span> },
            { l: 'Auteur', k: 'auteur' },
            { l: 'Date', r: (x) => fd(x.date) },
            { l: 'Cause', r: (x) => <span className="small">{x.cause}</span> },
            { l: 'Statut', r: (x) => <StatusBadge value={x.statut} /> },
            { l: 'Décision', r: (x) => <span className="small">{x.commentaireDG}</span> },
          ]}
          rows={declarations}
          onRowClick={declDetail}
          norm={false}
          onAdd={() => openForm('declarations')}
          addLabel="Créer une déclaration"
          exportName="Declarations_DG"
        />
      </div>
    )
  const ko = T.filter((x) => x.statut !== 'Fait').length

  return (
    <>
      <PageHead
        kicker={MOD_FULL.m3}
        title="3.2 Veille et mise en conformité"
        desc="Registre des textes légaux, statut de conformité avec preuves, calendrier d'évaluation et circuit de déclaration au Directeur Général."
      />
      <div className="grid g3 mb">
        <div className="card">
          <div className="small muted">Textes suivis</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{T.length}</div>
        </div>
        <div className="card">
          <div className="small muted">Conformes</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--green)' }}>
            {T.length - ko}
          </div>
        </div>
        <div className="card">
          <div className="small muted">Non conformes</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--red)' }}>{ko}</div>
        </div>
      </div>
      {tb}
      {c}
    </>
  )
}
