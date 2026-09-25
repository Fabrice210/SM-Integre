import { Icon } from '../../components/ui/Icon'
import { NORMS } from '../../data/referentiels'
import { FormRenderer } from '../../forms/FormRenderer'
import { readForm } from '../../forms/formControllers'
import type { FieldDef, Rec } from '../../forms/types'
import { iso, TODAY } from '../../lib/dates'
import { hist, logAct, update, useApp } from '../../store/useApp'
import type { AppState } from '../../store/types'
import { closeModal, openModal, toast } from '../../store/useOverlays'

const POL_F: FieldDef[] = [
  { k: 'orientations', l: 'Orientations (une par ligne)', t: 'textarea', req: 1 },
  { k: 'signataire', l: 'Signataire', req: 1 },
  { k: 'date', l: 'Date de publication', t: 'date', req: 1 },
]

/** genPolResume(orient) : résumé de la politique « rédigé par l'IA » à partir des orientations. */
export function genPolResume(s: Pick<AppState, 'org' | 'activeNorms'>, orient: string): string {
  const os = (orient || '')
    .split('\n')
    .map((o) => o.replace(/^\d+[.)]\s*/, '').trim())
    .filter(Boolean)
  const norms = s.activeNorms.map((n) => NORMS[n].code).join(', ')
  return (
    `Par cette politique, la direction de ${s.org.nom} affirme son engagement en faveur d'un système de management intégré (${norms}). Elle porte ${os.length} orientation(s) prioritaire(s)` +
    (os.length
      ? ` — notamment ${os
          .slice(0, 3)
          .map((o) => o.charAt(0).toLowerCase() + o.slice(1))
          .join(' ; ')}`
      : '') +
    `. La direction s'engage à fournir les ressources nécessaires, à satisfaire aux exigences applicables et à améliorer en continu l'efficacité du système.`
  )
}

/** regenPolResume() */
export function regenPolResume() {
  update((s) => {
    s.db.politique.resume = genPolResume(s, s.db.politique.orientations)
    hist(s, s.db.politique as Rec, "Résumé régénéré par l'IA")
    logAct(s, "a régénéré le résumé de la politique via l'IA", 'Politique SM')
  })
  toast("Résumé de la politique régénéré par l'IA.")
}

/** editPolitique() : nouvelle version de la politique (résumé généré), accusés réinitialisés. */
export function editPolitique() {
  const p = useApp.getState().db.politique
  const publish = () => {
    const d = readForm('polf')
    if (d) {
      update((s) => {
        d.resume = genPolResume(s, d.orientations)
        Object.assign(s.db.politique, d, {
          version: 'v' + (parseInt(s.db.politique.version.slice(1)) + 1),
          statut: 'Publiée',
        })
        s.db.accuses.forEach((a) => {
          a.statut = 'Non lu'
          a.date = '—'
        })
        logAct(
          s,
          'a publié la politique SM ' + s.db.politique.version + " (résumé généré par l'IA)",
          'Politique SM'
        )
      })
      closeModal()
      toast("Politique publiée : résumé généré par l'IA, accusés de lecture réinitialisés.")
    }
  }
  openModal({
    title: 'Rédiger la politique SM',
    sub: "Le résumé et la présentation des orientations sont générés automatiquement par l'IA ; la version précédente reste consultable.",
    wide: true,
    body: (
      <>
        <div className="note mb">
          <Icon name="ai" size={15} /> Résumé rédigé automatiquement par l'IA à partir des
          orientations saisies — aucune saisie manuelle.
        </div>
        <div id="polf">
          <FormRenderer formId="polf" fields={POL_F} rec={{ ...p, date: iso(TODAY) }} />
        </div>
      </>
    ),
    foot: (
      <>
        <button className="btn" onClick={() => closeModal()}>
          Annuler
        </button>
        <button className="btn primary" onClick={publish}>
          <Icon name="send" size={15} /> Publier
        </button>
      </>
    ),
  })
}
