/** 6.3 Revues (original l.1653-1664). */
import { openDetail } from '../../components/data/Detail'
import { NormBadges, StatusBadge } from '../../components/ui/badges'
import { Icon } from '../../components/ui/Icon'
import { PageHead } from '../../components/ui/PageHead'
import { MOD_FULL } from '../../data/referentiels'
import { openForm } from '../../forms/crud'
import { FormRenderer } from '../../forms/FormRenderer'
import { readForm } from '../../forms/formControllers'
import type { FieldDef, FormDef } from '../../forms/types'
import { addDays, days, fd, iso } from '../../lib/dates'
import { inNorm } from '../../lib/norms'
import { userNames } from '../../lib/lookups'
import { printDoc } from '../../services/exports'
import { taux } from '../../services/metrics'
import { hist, logAct, nextId, update, useApp } from '../../store/useApp'
import type { AppState } from '../../store/types'
import { closeModal, openModal, toast } from '../../store/useOverlays'
import { coverage, openActions } from '../../services/metrics'
import { addRegistre } from '../../services/registre'
import { DB, type Any } from './shared'

const ACT_ST = ['Mise en œuvre', 'En cours', 'Clôturé']

export const revuesForms: Record<string, FormDef> = {
  revues: {
    title: 'Revue',
    prefix: 'RV',
    label: 'ref',
    mod: 'Revues',
    wide: true,
    fields: [
      { k: 'ref', l: 'Référence', req: 1 },
      { k: 'date', l: 'Date de la réunion de pilotage', t: 'date', req: 1 },
      {
        k: 'type',
        l: 'Type de revue',
        t: 'select',
        o: [
          'Revue de direction semestrielle',
          'Revue de direction annuelle',
          'Revue de processus',
          "Revue de sécurité de l'information",
        ],
      },
      { k: 'normes', l: 'Normes couvertes', t: 'norms', req: 1 },
      { k: 'ordreDuJour', l: 'Ordre du jour (un point par ligne)', t: 'textarea', req: 1 },
      { k: 'rapportEntree', l: "Rapport d'entrée", t: 'textarea', req: 1 },
      { k: 'pv', l: 'Procès-verbal', t: 'textarea', req: 1 },
    ],
    def: () => ({
      ref: 'RP-2026-P05',
      date: addDays(21),
      type: 'Revue de processus',
      normes: ['9001', '45001'],
      ordreDuJour:
        "Performance du processus Transformation\nRésultats des audits AUD-2026-02\nAccidents et presqu'accidents\nRessources nécessaires",
      rapportEntree: 'TF1 = 11,2 ; taux de rebut 1,6 % ; 1 NC majeure en traitement',
      pv: 'À rédiger en séance',
      statut: 'Préparée',
      actions: [],
    }),
    save: (_s, r) => {
      if (typeof r.ordreDuJour === 'string')
        r.ordreDuJour = r.ordreDuJour.split('\n').filter(Boolean)
    },
  },
}

/** rapportAuto() de l'original. */
function rapportAuto(s: AppState) {
  const db = DB(s)
  return `Couverture normative : ${coverage(s.db, s.activeNorms, 'all')} %. Indicateurs sous la cible : ${db.indicateurs
    .filter((k: Any) => taux(k) < 80)
    .map((k: Any) => k.kpi)
    .join(
      ', '
    )}. Audits clôturés : ${db.audits.filter((a: Any) => a.statut === 'Clôturé').length}/${db.audits.length}. NC ouvertes : ${
    db.ncs.filter((n: Any) => n.statut !== 'Clôturée').length
  }. Textes non conformes : ${db.textes.filter((t: Any) => t.statut !== 'Fait').length}. Actions en retard : ${
    openActions(s.db, s.ui.norm).filter((a) => (days(a.echeance) as number) < 0).length
  }.`
}

const RA_F: FieldDef[] = [
  { k: 'libelle', l: 'Action décidée', req: 1, full: 1 },
  { k: 'responsable', l: 'Responsable', t: 'select', o: userNames },
  { k: 'echeance', l: 'Échéance', t: 'date', req: 1 },
  { k: 'statut', l: 'Statut', t: 'select', o: ACT_ST },
]

/** revAction(id) de l'original. */
export function revAction(id: string) {
  openModal(
    {
      title: 'Ajouter une action au plan de la revue',
      body: (
        <div id="raf">
          <FormRenderer
            formId="raf"
            fields={RA_F}
            rec={{
              libelle: "Réaliser le test de restauration de l'ERP avant fin octobre",
              responsable: 'Cédric AGBODJAN',
              echeance: addDays(35),
              statut: 'Mise en œuvre',
            }}
          />
        </div>
      ),
      foot: (
        <>
          <button className="btn" onClick={() => closeModal('modal2')}>
            Annuler
          </button>
          <button
            className="btn primary"
            onClick={() => {
              const d = readForm('raf')
              if (!d) return
              update((s) => {
                DB(s)
                  .revues.find((x: Any) => x.id === id)
                  .actions.push(d)
              })
              closeModal('modal2')
              revDetail(id)
            }}
          >
            Ajouter
          </button>
        </>
      ),
    },
    'modal2'
  )
}

/** revClose(id) de l'original. */
export function revClose(id: string) {
  update((s) => {
    const R = DB(s).revues
    const r = R.find((x: Any) => x.id === id)
    r.statut = 'Clôturée'
    r.actions.forEach((a: Any) =>
      addRegistre(s, 'Action de revue', a.libelle, 'Revue ' + r.ref, 'P01', r.normes, a.responsable)
    )
    const d = new Date(r.date)
    d.setMonth(d.getMonth() + 6)
    const nx = {
      id: nextId(s, 'RV'),
      ref: r.ref.replace(/\d{4}/, String(d.getFullYear())) + '-suiv',
      date: iso(d),
      type: r.type,
      normes: r.normes.slice(),
      statut: 'Préparée',
      ordreDuJour: [
        'Suivi des actions de la revue ' + r.ref,
        ...r.ordreDuJour.filter((o: string) => !o.startsWith('Suivi des actions')),
      ],
      rapportEntree: 'Généré automatiquement à la clôture de ' + r.ref + ' — sera complété à J-15.',
      pv: '—',
      actions: [],
    }
    R.push(nx)
    hist(s, r, 'Revue clôturée — ' + r.actions.length + ' action(s) au registre')
    logAct(
      s,
      'a clôturé la revue ' + r.ref + " et généré l'ordre du jour de la revue suivante",
      'Revues'
    )
  })
  toast(
    'Revue clôturée : actions enregistrées au registre, ordre du jour de la revue suivante préparé.'
  )
  closeModal('drawer')
}

function compileRapport(id: string) {
  update((s) => {
    const r = DB(s).revues.find((x: Any) => x.id === id)
    r.rapportEntree = rapportAuto(s)
    hist(s, r, "Rapport d'entrée compilé automatiquement")
  })
  revDetail(id)
}

function printPV(id: string) {
  const r = DB(useApp.getState()).revues.find((x: Any) => x.id === id)
  printDoc(
    'PV ' + r.ref,
    '<h2>Ordre du jour</h2><ol>' +
      r.ordreDuJour.map((o: string) => '<li>' + o + '</li>').join('') +
      "</ol><h2>Rapport d'entrée</h2><p>" +
      r.rapportEntree +
      '</p><h2>PV</h2><p>' +
      r.pv +
      '</p>'
  )
}

/** revDetail(id) de l'original. */
export function revDetail(id: string) {
  const r = DB(useApp.getState()).revues.find((x: Any) => x.id === id)
  if (!r) return
  const open = r.statut !== 'Clôturée'
  openDetail({
    coll: 'revues',
    id,
    title: r.ref + ' · ' + r.type,
    sub: fd(r.date),
    rows: [
      ['Statut', <StatusBadge key="st" value={r.statut} />],
      ['Normes', <NormBadges key="nb" norms={r.normes} />],
      [
        'Ordre du jour',
        <ol key="odj" style={{ margin: 0, paddingLeft: 18 }}>
          {r.ordreDuJour.map((o: string, i: number) => (
            <li key={i}>{o}</li>
          ))}
        </ol>,
      ],
      [
        "Rapport d'entrée",
        <>
          {r.rapportEntree}
          {open ? (
            <>
              <br />
              <button
                className="btn sm"
                style={{ marginTop: 6 }}
                onClick={() => compileRapport(id)}
              >
                <Icon name="ai" size={13} /> Compiler depuis les modules
              </button>
            </>
          ) : null}
        </>,
      ],
      ['Procès-verbal', r.pv],
    ],
    extra: (
      <div className="dsec">
        <div className="card-h">
          <h4 style={{ margin: 0 }}>Plan d'action ({r.actions.length})</h4>
          {open ? (
            <button className="btn sm" onClick={() => revAction(id)}>
              <Icon name="plus" size={13} /> Ajouter une action
            </button>
          ) : null}
        </div>
        {r.actions.length ? (
          r.actions.map((a: Any, i: number) => (
            <div key={i} className="alert-item">
              <div style={{ flex: 1 }}>
                <div className="t">{a.libelle}</div>
                <div className="d">
                  {a.responsable} — {fd(a.echeance)}
                </div>
              </div>
              <StatusBadge value={a.statut} />
            </div>
          ))
        ) : (
          <div className="small muted">Aucune action décidée pour le moment.</div>
        )}
      </div>
    ),
    edit: open,
    acts: open ? (
      <>
        <button className="btn" onClick={() => printPV(id)}>
          <Icon name="doc" size={15} /> PV (PDF)
        </button>
        <button className="btn primary" onClick={() => revClose(id)}>
          <Icon name="check" size={15} /> Clôturer la revue
        </button>
      </>
    ) : null,
  })
}

export function RevuesPage() {
  const revues = useApp((s) => s.db.revues) as Any[]
  const norm = useApp((s) => s.ui.norm)
  return (
    <>
      <PageHead
        kicker={MOD_FULL.m6}
        title="6.3 Revues"
        desc="Ordre du jour, rapport d'entrée, réunion de pilotage, procès-verbal et plan d'action ; l'ordre du jour de la revue suivante est préparé automatiquement."
        actions={
          <button className="btn primary" onClick={() => openForm('revues')}>
            <Icon name="plus" size={15} /> Créer une revue
          </button>
        }
      />
      <div className="grid g2">
        {revues
          .filter((r) => inNorm(r, norm))
          .map((r) => (
            <div
              key={r.id}
              className="card"
              style={{ cursor: 'pointer' }}
              onClick={() => revDetail(r.id)}
            >
              <div className="btn-row" style={{ justifyContent: 'space-between' }}>
                <span className="badge b-blue">{r.ref}</span>
                <StatusBadge value={r.statut} />
              </div>
              <h3 style={{ fontSize: 15, margin: '10px 0 2px' }}>{r.type}</h3>
              <div className="small muted">
                {fd(r.date)} — {r.ordreDuJour.length} points à l'ordre du jour — {r.actions.length}{' '}
                action(s)
              </div>
              <div style={{ marginTop: 8 }}>
                <NormBadges norms={r.normes} />
              </div>
              <hr className="sep" />
              <div className="small">{r.pv === '—' ? r.rapportEntree : r.pv}</div>
            </div>
          ))}
      </div>
    </>
  )
}
