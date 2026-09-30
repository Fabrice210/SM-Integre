import { Fragment } from 'react'
import { openDetail } from '../../components/data/Detail'
import { StatusBadge } from '../../components/ui/badges'
import { Icon } from '../../components/ui/Icon'
import { FormRenderer } from '../../forms/FormRenderer'
import { readForm } from '../../forms/formControllers'
import type { FieldDef } from '../../forms/types'
import { addDays, fd, iso, TODAY } from '../../lib/dates'
import { act, seg } from '../../services/session'
import { hist, logAct, nextId, update, useApp } from '../../store/useApp'
import { closeModal, openModal, toast } from '../../store/useOverlays'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

const brLines = (lines: string[]) =>
  lines.map((l, i) => (
    <Fragment key={i}>
      {i > 0 ? <br /> : null}
      {l}
    </Fragment>
  ))

/** repDetail(id) : fiche d'un représentant, révocation / réactivation du mandat. */
export function repDetail(id: string) {
  const r: Any = useApp.getState().db.representants.find((x) => x.id === id)
  if (!r) return
  const setStatut = (statut: string) => {
    const local = () =>
      update((s) => {
        const r: Any = s.db.representants.find((x) => x.id === id)
        r.statut = statut
        hist(s, r, statut === 'Actif' ? 'Mandat réactivé' : 'Mandat révoqué')
        logAct(
          s,
          (statut === 'Actif' ? 'a réactivé le mandat de ' : 'a révoqué le mandat de ') +
            r.prenom +
            ' ' +
            r.nom,
          'Consultation'
        )
      })
    const route = statut === 'Actif' ? 'reactiver' : 'revoquer'
    act(`/representants/${seg(id)}/${route}/`, undefined, local, () => repDetail(id))
  }
  openDetail({
    coll: 'representants',
    id,
    title: r.nom + ' ' + r.prenom,
    sub: r.fonction,
    rows: [
      ['Qualité du lien', r.qualiteLien || '—'],
      ['Délégué suppléant', r.suppleant || '—'],
      ['Début de mandat', fd(r.mandatDebut)],
      ['Fin de mandat', fd(r.mandatFin)],
      ['État', <StatusBadge value={r.statut === 'Révoqué' ? 'Révoqué' : 'Actif'} />],
    ],
    del: true,
    acts:
      r.statut === 'Révoqué' ? (
        <button className="btn" onClick={() => setStatut('Actif')}>
          Réactiver le mandat
        </button>
      ) : (
        <button className="btn danger" onClick={() => setStatut('Révoqué')}>
          Révoquer le mandat
        </button>
      ),
  })
}

const RF_FIELDS: FieldDef[] = [
  { k: 'compteRendu', l: 'Compte rendu', t: 'textarea', req: 1 },
  {
    k: 'planAction',
    l: "Plan d'action de suivi (action, responsable, échéance)",
    t: 'textarea',
    req: 1,
  },
  { k: 'statutPlan', l: 'Statut du plan', t: 'select', o: ['À faire', 'En cours', 'Clôturé'] },
  { k: 'preuve1', l: 'Preuve 1 (PV, feuille de présence…)', t: 'file', req: 1 },
  { k: 'preuve2', l: 'Preuve 2', t: 'file', req: 1 },
]

/** marquerReunionFaite(id) : compte rendu, plan d'action et deux preuves. */
export function marquerReunionFaite(id: string) {
  const m: Any = useApp.getState().db.reunions.find((x) => x.id === id)
  if (!m) return
  const submit = () => {
    const d = readForm('rf')
    if (!d) return
    const local = () =>
      update((s) => {
        const m: Any = s.db.reunions.find((x) => x.id === id)
        Object.assign(m, d, { statut: 'Réalisée', date: m.date || iso(TODAY) })
        hist(s, m, 'Réunion marquée réalisée (2 preuves jointes)')
        logAct(s, 'a marqué la réunion « ' + m.objet + ' » comme réalisée', 'Consultation')
      })
    act(`/reunions/${seg(id)}/realiser/`, d, local, () => {
      closeModal('modal2')
      toast('Réunion enregistrée comme réalisée avec 2 preuves jointes.')
    })
  }
  openModal(
    {
      title: 'Marquer la réunion comme réalisée',
      sub: m.objet,
      body: (
        <div id="rf">
          <FormRenderer
            formId="rf"
            fields={RF_FIELDS}
            rec={{
              compteRendu: m.compteRendu || '',
              planAction: m.planAction || '',
              statutPlan: m.statutPlan || 'À faire',
              preuve1: m.preuve1 || '',
              preuve2: m.preuve2 || '',
            }}
          />
        </div>
      ),
      foot: (
        <>
          <button className="btn" onClick={() => closeModal('modal2')}>
            Annuler
          </button>
          <button className="btn primary" onClick={submit}>
            <Icon name="check" size={15} /> Enregistrer comme réalisée
          </button>
        </>
      ),
    },
    'modal2'
  )
}

/** reuDetail(id) : fiche d'une réunion de consultation. */
export function reuDetail(id: string) {
  const m: Any = useApp.getState().db.reunions.find((x) => x.id === id)
  if (!m) return
  const preuves = [m.preuve1, m.preuve2].filter(Boolean)
  openDetail({
    coll: 'reunions',
    id,
    title: m.objet,
    sub: (m.statut || 'Planifiée') + ' — ' + m.participants,
    rows: [
      ['Date ' + (m.statut === 'Réalisée' ? 'de tenue' : 'prévue'), fd(m.datePrevue || m.date)],
      ['Participants', m.participants],
      ['Ordre du jour', brLines(String(m.ordreDuJour || m.objet).split('\n'))],
      ['Compte rendu', m.compteRendu || '—'],
      ["Plan d'action de suivi", m.planAction || '—'],
      ['Preuves jointes', preuves.length ? brLines(preuves) : '—'],
      ['Statut', <StatusBadge value={m.statut || 'Planifiée'} />],
    ],
    del: true,
    acts:
      m.statut !== 'Réalisée' ? (
        <button
          className="btn primary"
          onClick={() => {
            closeModal('drawer')
            marquerReunionFaite(id)
          }}
        >
          <Icon name="check" size={15} /> Marquer comme réalisée
        </button>
      ) : null,
  })
}

/** planifierAnnee() : calendrier annuel des réunions de consultation. */
export function planifierAnnee() {
  const base: [string, string, string][] = [
    ['Revue trimestrielle T1 — conditions de travail', 'Comité HS (CHSS)', addDays(30)],
    ['Consultation semestrielle des délégués du personnel', 'Délégués du personnel', addDays(120)],
    ['Assemblée générale du personnel', 'Tout le personnel', addDays(200)],
    ['Revue trimestrielle T4 — bilan SST', 'Comité HS (CHSS)', addDays(300)],
  ]
  let n = 0
  const local = () =>
    update((s) => {
      base.forEach(([o, p, d]) => {
        if (s.db.reunions.some((x) => x.objet === o)) return
        ;(s.db.reunions as Any[]).push({
          id: nextId(s, 'RC'),
          objet: o,
          datePrevue: d,
          date: d,
          participants: p,
          ordreDuJour: 'À préciser lors de la préparation',
          statut: 'Planifiée',
          compteRendu: '',
          planAction: '',
          statutPlan: 'À faire',
          preuve1: '',
          preuve2: '',
        })
        n++
      })
      logAct(s, 'a établi la planification annuelle des réunions de consultation', 'Consultation')
    })
  act<{ planifiees: number }>('/reunions/planifier-annee/', undefined, local, (r) => {
    if (r) n = r.planifiees
    toast(
      n ? n + " réunion(s) planifiée(s) pour l'année." : 'Le calendrier annuel est déjà en place.'
    )
  })
}
