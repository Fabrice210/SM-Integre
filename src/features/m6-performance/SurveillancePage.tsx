/** 6.1 Surveillance et mesures (original l.1622-1629). */
import { detailOpeners } from '../../app/detailRegistry'
import { DataTable } from '../../components/data/DataTable'
import { DueDate, Progress, StatusBadge } from '../../components/ui/badges'
import { PageHead } from '../../components/ui/PageHead'
import { useTabs } from '../../components/ui/Tabs'
import { DIRECTIONS, MOD_FULL } from '../../data/referentiels'
import { openForm } from '../../forms/crud'
import { days, fd } from '../../lib/dates'
import { procShort, procOpts, userNames } from '../../lib/lookups'
import { inNorm } from '../../lib/norms'
import { taux } from '../../services/metrics'
import { useApp } from '../../store/useApp'
import { Calendar } from '../../components/data/Calendar'
import type { Any } from './shared'
import { MiniBars, evalPresta, pScore } from './surveillanceForms'

const num = (v: unknown) => String(v).replace('.', ',')

export function SurveillancePage() {
  const db = useApp((s) => s.db) as Any
  const users = useApp((s) => s.users)
  const norm = useApp((s) => s.ui.norm)
  const [t, tb] = useTabs('surv', [
    ['kpi', 'Indicateurs'],
    ['tdb', 'Tableau de bord'],
    ['ext', 'Intervenants externes'],
    ['stat', 'Statistiques de surveillance'],
    ['veille', 'Registre de veille'],
  ])
  const K: Any[] = db.indicateurs
  let c = null
  if (t === 'kpi')
    c = (
      <div className="card">
        <DataTable
          id="kpi"
          cols={[
            {
              l: 'Indicateur',
              r: (k) => (
                <>
                  <span className="ttl">{k.kpi}</span>
                  <br />
                  <span className="ref">Objectif {k.objectif}</span>
                </>
              ),
            },
            { l: 'Cible', r: (k) => `${num(k.cible)} ${k.unite}` },
            { l: 'Moyen de mesure', k: 'moyen' },
            { l: 'Échéance', r: (k) => fd(k.echeance) },
            {
              l: 'Processus / Responsable',
              r: (k) => (
                <>
                  {procShort(k.processus)}
                  <br />
                  <span className="ref">{k.responsable}</span>
                </>
              ),
            },
            { l: 'Action', r: (k) => <span className="small">{k.action}</span> },
            { l: 'Valeur', r: (k) => `${num(k.valeur)} ${k.unite}` },
            {
              l: "Taux d'atteinte",
              r: (k) => (
                <>
                  <Progress value={taux(k)} warnBelow={80} badBelow={60} />
                  {taux(k) < 80 ? <span className="badge b-red">écart significatif</span> : null}
                </>
              ),
            },
          ]}
          rows={K}
          onRowClick={(i) => openForm('indicateurs', i)}
          search={['kpi', 'responsable']}
          filters={[{ k: 'processus', l: 'Processus', o: procOpts }]}
          onAdd={() => openForm('indicateurs')}
          addLabel="Définir un indicateur"
          exportName="Indicateurs"
          norm={false}
        />
      </div>
    )
  if (t === 'tdb')
    c = (
      <div className="grid g3">
        {db.processus
          .filter((p: Any) => K.some((k) => k.processus === p.id))
          .map((p: Any) => {
            const L = K.filter((k) => k.processus === p.id)
            const m = Math.round(L.reduce((a, k) => a + taux(k), 0) / L.length)
            return (
              <div key={p.id} className="card">
                <div className="card-h">
                  <div>
                    <h3 style={{ fontSize: '14.5px' }}>
                      {p.code} · {p.intitule}
                    </h3>
                    <div className="sub">
                      {p.proprietaire} —{' '}
                      {DIRECTIONS.find((d) =>
                        users.find((u) => u.nom === p.proprietaire && u.direction === d)
                      ) || ''}
                    </div>
                  </div>
                  <span className={`badge ${m < 80 ? 'b-amber' : 'b-green'}`}>{m} %</span>
                </div>
                {L.map((k) => (
                  <div key={k.id} className="small" style={{ marginBottom: 8 }}>
                    {k.kpi}
                    <Progress value={taux(k)} warnBelow={80} badBelow={60} />
                  </div>
                ))}
              </div>
            )
          })}
      </div>
    )
  if (t === 'ext')
    c = (
      <div className="card">
        <DataTable
          id="ext"
          cols={[
            {
              l: 'Intervenant',
              r: (p) => (
                <>
                  <span className="ttl">{p.nom}</span>
                  <br />
                  <span className="ref">Depuis le {fd(p.debut)}</span>
                </>
              ),
            },
            { l: 'Catégorie', r: (p) => <StatusBadge value={p.categorie} /> },
            { l: 'Fréquence', k: 'frequence' },
            { l: "Champ d'évaluation", r: (p) => <span className="small">{p.champ}</span> },
            {
              l: 'Processus / Responsable',
              r: (p) => (
                <>
                  {procShort(p.processus)}
                  <br />
                  <span className="ref">{p.responsable}</span>
                </>
              ),
            },
            { l: 'Score', r: (p) => <Progress value={pScore(p)} warnBelow={70} badBelow={60} /> },
            {
              l: '',
              r: (p) => (
                <button
                  className="btn sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    evalPresta(p.id)
                  }}
                >
                  Évaluer
                </button>
              ),
            },
          ]}
          rows={db.prestataires as Any[]}
          onRowClick={(i) => openForm('prestataires', i)}
          search={['nom', 'champ']}
          filters={[
            { k: 'categorie', l: 'Catégorie', o: ['Critique', 'Classique'] },
            { k: 'processus', l: 'Processus', o: procOpts },
            { k: 'responsable', l: 'Responsable', o: userNames },
          ]}
          onAdd={() => openForm('prestataires')}
          addLabel="Ajouter un intervenant"
          exportName="Intervenants_externes"
          norm={false}
        />
      </div>
    )
  if (t === 'stat') {
    const s = db.statsSurv
    c = (
      <>
        <div className="grid g3">
          <div className="card">
            <div className="card-h">
              <h3>Incidents</h3>
              <span className="small muted">Mars à sept. 2026</span>
            </div>
            <MiniBars vals={s.incidents} labels={s.mois} color="var(--red)" />
          </div>
          <div className="card">
            <div className="card-h">
              <h3>Dysfonctionnements</h3>
              <span className="small muted">Mars à sept. 2026</span>
            </div>
            <MiniBars vals={s.dysfonctionnements} labels={s.mois} color="#D08B1E" />
          </div>
          <div className="card">
            <div className="card-h">
              <h3>Déchets produits (t)</h3>
              <span className="small muted">Mars à sept. 2026</span>
            </div>
            <MiniBars vals={s.dechets} labels={s.mois} color="var(--green)" />
          </div>
        </div>
        <p className="small muted">
          Statistiques propres à la surveillance, sans dupliquer les indicateurs suivis dans les
          autres modules.
        </p>
      </>
    )
  }
  if (t === 'veille')
    c = (
      <>
        <div className="note mb">
          Registre de veille partagé avec le module 3.2 : ajoutez un texte, suivez son statut et
          qualifiez un risque de situation d'urgence depuis la fiche du texte.
        </div>
        <Calendar
          events={db.textes
            .filter((x: Any) => inNorm(x, norm))
            .map((x: Any) => ({
              d: x.echeance,
              t: x.intitule.slice(0, 38) + '…',
              s: x.statut === 'Fait' ? 'done' : (days(x.echeance) as number) < 0 ? 'late' : '',
              onClick: () => detailOpeners.txDetail?.(x.id),
              r: x.responsable,
            }))}
          sub="Calendrier de conformité — alerte automatique en cas de délai dépassé"
        />
        <div className="card" style={{ marginTop: 16 }}>
          <DataTable
            id="tx2"
            cols={[
              { l: 'Texte', r: (x) => <span className="ttl">{x.intitule}</span> },
              { l: 'Statut', r: (x) => <StatusBadge value={x.statut} /> },
              { l: 'Échéance', r: (x) => <DueDate date={x.echeance} done={x.statut === 'Fait'} /> },
              {
                l: '',
                r: (x) => (
                  <button
                    className="btn sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      detailOpeners.qualifUrgence?.(x.id)
                    }}
                  >
                    Qualifier en situation d'urgence
                  </button>
                ),
              },
            ]}
            rows={db.textes as Any[]}
            onRowClick={(i) => detailOpeners.txDetail?.(i)}
            onAdd={() => openForm('textes')}
            addLabel="Ajouter un texte"
            exportName="Registre_veille"
          />
        </div>
      </>
    )
  return (
    <>
      <PageHead
        kicker={MOD_FULL.m6}
        title="6.1 Surveillance et mesures"
        desc="Objectifs et KPI avec calcul automatique du taux d'atteinte, évaluation des intervenants externes et statistiques de surveillance."
      />
      {tb}
      {c}
    </>
  )
}
