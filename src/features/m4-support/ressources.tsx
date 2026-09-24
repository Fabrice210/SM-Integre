import { openDetail } from '../../components/data/Detail'
import { StatusBadge, Workflow } from '../../components/ui/badges'
import { Icon } from '../../components/ui/Icon'
import type { Rec } from '../../forms/types'
import { days, fd, iso, TODAY } from '../../lib/dates'
import { money } from '../../lib/format'
import { procName } from '../../lib/lookups'
import { hist, logAct, update, useApp } from '../../store/useApp'
import { closeModal, toast } from '../../store/useOverlays'

type ResAct = 'submit' | 'ok' | 'ko' | 'dispo'

/** resAct(id, a) de l'original : circuit de validation d'une demande. */
export function resAct(id: string, a: ResAct) {
  let label = ''
  update((s) => {
    const r = s.db.ressources.find((x) => x.id === id) as Rec
    const m = {
      submit: ['Soumise', 'Soumise au circuit ' + r.circuit],
      ok: ['Validée', 'Validée par le circuit ' + r.circuit],
      ko: ['Refusée', 'Refusée — retour au demandeur'],
      dispo: ['Mise à disposition', 'Mise à disposition confirmée'],
    }[a]
    r.statut = m[0]
    if (a === 'dispo') r.dateReelle = iso(TODAY)
    hist(s, r, m[1])
    logAct(s, m[1] + ' : ' + r.besoin, 'Ressources')
    label = m[1]
  })
  toast(label + '.')
  closeModal('drawer')
}

/** resDetail(id) de l'original. */
export function resDetail(id: string) {
  const r = useApp.getState().db.ressources.find((x) => x.id === id) as Rec | undefined
  if (!r) return
  const late = r.statut !== 'Mise à disposition' && (days(r.dateDemandee) as number) < 0
  const idx = (
    { Brouillon: 0, Soumise: 1, Validée: 2, Refusée: 2, 'Mise à disposition': 4 } as Record<
      string,
      number
    >
  )[r.statut]
  openDetail({
    coll: 'ressources',
    id,
    title: r.besoin,
    sub: 'Demande ' + r.id + ' — ' + r.demandeur,
    rows: [
      [
        'Circuit',
        <Workflow
          steps={[
            'Demande',
            'Validation ' + r.circuit,
            r.statut === 'Refusée' ? 'Refusée' : 'Validée',
            'Mise à disposition',
          ]}
          current={idx}
          ko={r.statut === 'Refusée'}
        />,
      ],
      ['Type', r.type],
      ['Processus', procName(r.processus)],
      ['Bilan disponible', r.disponible],
      ['Justification', r.justification],
      ['Montant', money(r.montant)],
      [
        'Date demandée',
        <>
          {fd(r.dateDemandee)}
          {late ? (
            <>
              {' '}
              <span className="badge b-red">retard de mise à disposition</span>
            </>
          ) : null}
        </>,
      ],
      ['Date réelle', fd(r.dateReelle)],
      ['Statut', <StatusBadge value={r.statut} />],
    ],
    edit: ['Brouillon', 'Refusée'].includes(r.statut),
    acts:
      r.statut === 'Brouillon' || r.statut === 'Refusée' ? (
        <button className="btn primary" onClick={() => resAct(id, 'submit')}>
          <Icon name="send" size={15} /> Soumettre
        </button>
      ) : r.statut === 'Soumise' ? (
        <>
          <button className="btn danger" onClick={() => resAct(id, 'ko')}>
            Refuser
          </button>
          <button className="btn primary" onClick={() => resAct(id, 'ok')}>
            Valider
          </button>
        </>
      ) : r.statut === 'Validée' ? (
        <button className="btn primary" onClick={() => resAct(id, 'dispo')}>
          Confirmer la mise à disposition
        </button>
      ) : null,
  })
}
