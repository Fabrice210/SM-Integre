import { Icon } from '../../components/ui/Icon'
import { readForm } from '../../forms/formControllers'
import { FormRenderer } from '../../forms/FormRenderer'
import type { FieldDef, Rec } from '../../forms/types'
import { fd, iso, TODAY } from '../../lib/dates'
import { printDoc } from '../../services/exports'
import { hist, logAct, update, useApp } from '../../store/useApp'
import { closeModal, openModal, toast } from '../../store/useOverlays'

const esc = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  )

const PREUVE_F: FieldDef[] = [
  { k: 'preuve', l: 'Preuve de réalisation', t: 'file', req: 1 },
  { k: 'dateRealisation', l: 'Date de réalisation effective', t: 'date', req: 1 },
]

/** comDone(id) de l'original : joindre une preuve et passer l'action à « Fait ». */
export function comDone(id: string) {
  const c = useApp.getState().db.communications.find((x) => x.id === id) as Rec | undefined
  if (!c) return
  const onSave = () => {
    const d = readForm('cpf')
    if (d) {
      update((s) => {
        const c = s.db.communications.find((x) => x.id === id) as Rec
        Object.assign(c, d, { statut: 'Fait' })
        hist(s, c, 'Réalisée le ' + fd(d.dateRealisation) + ' — preuve jointe')
        logAct(s, "a joint la preuve de l'action « " + c.objectif + ' »', 'Communication')
      })
      closeModal()
      toast('Action passée à « Fait » — date de réalisation enregistrée.')
    }
  }
  openModal({
    title: 'Joindre une preuve de réalisation',
    sub: c.objectif,
    body: (
      <>
        <div className="note mb">
          <Icon name="check" size={14} /> Renseignez la date de réalisation effective (distincte de la date de délai
          prévue).
        </div>
        <div id="cpf">
          <FormRenderer
            formId="cpf"
            fields={PREUVE_F}
            rec={{ preuve: 'Photo_' + c.id + '_realisation.jpg', dateRealisation: iso(TODAY) }}
          />
        </div>
      </>
    ),
    foot: (
      <>
        <button className="btn" onClick={() => closeModal()}>
          Annuler
        </button>
        <button className="btn primary" onClick={onSave}>
          Enregistrer
        </button>
      </>
    ),
  })
}

/** comReport() de l'original : rapport de communication imprimable (période = S.comPer). */
export function comReport(per: string) {
  const C = useApp.getState().db.communications as Rec[]
  printDoc(
    'Rapport de communication — ' + (per || '2026'),
    `<p>${C.filter((c) => c.statut === 'Fait').length} action(s) réalisée(s) sur ${C.length}.</p><table><tr><th>Objectif</th><th>Qui fait</th><th>Cible</th><th>Moyen</th><th>Date</th><th>Statut</th><th>Preuve</th></tr>${C.map(
      (c) =>
        `<tr><td>${esc(c.objectif)}</td><td>${esc(c.quiFait)}</td><td>${esc(c.cible)}</td><td>${esc(c.moyen)}</td><td>${fd(c.date)}</td><td>${c.statut}</td><td>${esc(c.preuve)}</td></tr>`
    ).join('')}</table>`
  )
}
