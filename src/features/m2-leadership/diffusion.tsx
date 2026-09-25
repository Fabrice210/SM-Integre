import { Icon } from '../../components/ui/Icon'
import { FormRenderer } from '../../forms/FormRenderer'
import { readForm } from '../../forms/formControllers'
import type { FieldDef } from '../../forms/types'
import { nowStamp } from '../../lib/dates'
import { currentUser, logAct, update } from '../../store/useApp'
import { closeModal, openModal, toast } from '../../store/useOverlays'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

const DIFF_F: FieldDef[] = [
  {
    k: 'canal',
    l: 'Type de diffusion',
    t: 'select',
    o: [
      ['interne', "Interne — dépôt direct dans l'espace du destinataire"],
      ['externe', 'Externe — envoi par email avec pièce jointe'],
    ],
  },
  { k: 'destinataires', l: 'Destinataires', req: 1, full: 1 },
  { k: 'piece', l: 'Pièce jointe (obligatoire en diffusion externe)', t: 'file' },
  { k: 'message', l: "Message d'accompagnement", t: 'textarea' },
]

/** diffuserNoyau(label) : diffusion interne (dépôt direct) ou externe (email + pièce jointe). */
export function diffuserNoyau(label: string) {
  openModal(
    {
      title: 'Diffuser — ' + label,
      sub: "Interne : dépôt direct dans l'espace du destinataire. Externe : envoi par email avec pièce jointe.",
      body: (
        <div id="dnf">
          <FormRenderer
            formId="dnf"
            fields={DIFF_F}
            rec={{
              canal: 'interne',
              destinataires: 'Tous les pilotes de processus',
              piece: '',
              message: 'Veuillez prendre connaissance du document ci-joint.',
            }}
          />
        </div>
      ),
      foot: (
        <>
          <button className="btn" onClick={() => closeModal('modal2')}>
            Annuler
          </button>
          <button className="btn primary" data-l={label} onClick={() => submitDiffusion(label)}>
            <Icon name="send" size={15} /> Diffuser
          </button>
        </>
      ),
    },
    'modal2'
  )
}

/** submitDiffusion(label) */
function submitDiffusion(label: string) {
  const d = readForm('dnf')
  if (!d) return
  if (d.canal === 'externe' && !d.piece) {
    toast('En diffusion externe, la pièce jointe est obligatoire.', 'warn')
    return
  }
  update((s) => {
    const DB = s.db as Any
    ;(DB.diffusions = DB.diffusions || []).unshift({
      d: nowStamp(),
      u: currentUser(s).nom,
      doc: label,
      canal: d.canal,
      destinataires: d.destinataires,
      piece: d.piece || '—',
    })
    logAct(
      s,
      'a diffusé « ' +
        label +
        ' » (' +
        (d.canal === 'interne' ? 'interne — dépôt direct' : 'externe — email + pièce jointe') +
        ') à ' +
        d.destinataires,
      'Diffusion'
    )
  })
  closeModal('modal2')
  toast(
    d.canal === 'interne'
      ? "Document déposé directement dans l'espace des destinataires internes."
      : 'Document envoyé par email avec pièce jointe aux destinataires externes.'
  )
}
