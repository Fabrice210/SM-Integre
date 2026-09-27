import { useMemo, type ReactNode } from 'react'
import { Calendar } from '../../components/data/Calendar'
import { DataTable } from '../../components/data/DataTable'
import { NormBadges, StatusBadge } from '../../components/ui/badges'
import { Icon } from '../../components/ui/Icon'
import { PageHead } from '../../components/ui/PageHead'
import { useTabs } from '../../components/ui/Tabs'
import { MOD_FULL } from '../../data/referentiels'
import { openForm } from '../../forms/crud'
import type { Rec } from '../../forms/types'
import { days, fd } from '../../lib/dates'
import { inNorm } from '../../lib/norms'
import { useApp } from '../../store/useApp'
import { declDetail, txDetail } from './veille'
import { rapDetail } from './veilleRapports'

type Row = { id: string; normes?: readonly string[] } & Rec

const CATEGORIES = ['Loi', 'Décret', 'Arrêté', 'Ordonnance', 'Convention', 'Norme', 'Autre']

/** PAGES['m3-veille'] de l'original (v2 : 3.3 Veille réglementaire). */
export function VeillePage() {
  const [t, tb] = useTabs('veille', [
    ['reg', 'Registre réglementaire'],
    ['cal', "Calendrier d'audit de conformité"],
    ['rap', 'Rapports de conformité'],
  ])
  const textes = useApp((s) => s.db.textes) as Row[]
  const rapports = useApp((s) => s.db.rapportsConf) as Row[]
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
            {
              l: 'Catégorie',
              r: (x) => <span className="badge b-grey">{x.categorie || '—'}</span>,
            },
            { l: 'Domaine', k: 'domaine' },
            { l: 'Publié le', r: (x) => fd(x.datePublication) },
            { l: 'Statut', r: (x) => <StatusBadge value={x.statut} /> },
            {
              l: 'Diffusion',
              r: (x) =>
                x.diffuse ? (
                  <span className="badge b-blue">Diffusé</span>
                ) : (
                  <span className="small muted">—</span>
                ),
            },
            { l: 'Justificatif', r: (x) => <span className="small">{x.justificatif}</span> },
            { l: 'Pièces', r: (x) => <span className="small">{x.pieces}</span> },
            { l: 'Normes', r: (x) => <NormBadges norms={x.normes} /> },
          ]}
          rows={textes}
          onRowClick={txDetail}
          search={['intitule', 'domaine']}
          filters={[
            { k: 'statut', l: 'Statut', o: ['Fait', 'Pas fait'] },
            { k: 'categorie', l: 'Catégorie', o: CATEGORIES },
            {
              k: 'domaine',
              l: 'Domaine',
              o: () => [...new Set(textes.map((x) => x.domaine as string))],
            },
          ]}
          onAdd={() => openForm('textes')}
          addLabel="Ajouter un texte"
          exportName="Registre_reglementaire"
          collection="textes"
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
  if (t === 'rap') {
    const soumises = declarations.filter((d) => d.statut === 'Soumise')
    c = (
      <div className="card">
        <DataTable<Row>
          id="rapc"
          cols={[
            { l: 'Référence', r: (x) => <span className="ttl">{x.ref}</span> },
            {
              l: 'Texte concerné',
              r: (x) => (
                <span className="small">
                  {textes.find((tx) => tx.id === x.texte)?.intitule || '—'}
                </span>
              ),
            },
            { l: 'Conclusion', r: (x) => <StatusBadge value={x.statut} /> },
            { l: 'Date', r: (x) => fd(x.date) },
            { l: 'Auteur', k: 'auteur' },
            {
              l: 'Pièces',
              r: (x) => (
                <>
                  <Icon name="doc" size={13} /> {x.pieces}
                </>
              ),
            },
          ]}
          rows={rapports}
          onRowClick={rapDetail}
          norm={false}
          onAdd={() => openForm('rapportsConf')}
          addLabel="Générer un rapport de conformité"
          exportName="Rapports_conformite"
          collection="rapportsConf"
        />
        {soumises.length ? (
          <div className="note warn" style={{ marginTop: 12 }}>
            <Icon name="warn" size={14} /> {soumises.length} écart(s) déclaré(s) en attente de
            décision du Directeur Général —{' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                declDetail(soumises[0].id)
              }}
            >
              ouvrir
            </a>
          </div>
        ) : null}
      </div>
    )
  }
  const ko = T.filter((x) => x.statut !== 'Fait').length

  return (
    <>
      <PageHead
        kicker={MOD_FULL.m3}
        title="3.3 Veille réglementaire"
        desc="Registre des textes légaux (catégorie, statut, justificatif, pièces), diffusion tracée aux intéressés et rapports de conformité générés séquentiellement."
      />
      <div className="grid g4 mb">
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
        <div className="card">
          <div className="small muted">Diffusés</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--blue)' }}>
            {T.filter((x) => x.diffuse).length}
          </div>
        </div>
      </div>
      {tb}
      {c}
    </>
  )
}
