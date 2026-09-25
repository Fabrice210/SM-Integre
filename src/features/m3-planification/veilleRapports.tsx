import { openDetail } from '../../components/data/Detail'
import { StatusBadge } from '../../components/ui/badges'
import { Icon } from '../../components/ui/Icon'
import { readForm } from '../../forms/formControllers'
import { FormRenderer } from '../../forms/FormRenderer'
import type { FieldDef, Rec } from '../../forms/types'
import { fd } from '../../lib/dates'
import { procName } from '../../lib/lookups'
import { hist, logAct, update, useApp } from '../../store/useApp'
import { closeModal, openModal, toast } from '../../store/useOverlays'

/* Veille v2 : rapports de conformité et diffusion tracée des textes (revue 23/09). */

/** rapDetail(id) de l'original. */
export function rapDetail(id: string) {
  const db = useApp.getState().db
  const r = db.rapportsConf.find((x) => x.id === id) as Rec | undefined
  if (!r) return
  const t = db.textes.find((x) => x.id === r.texte)
  openDetail({
    coll: 'rapportsConf',
    id,
    title: r.ref + ' — ' + r.titre,
    sub: 'Rapport de conformité — ' + fd(r.date),
    rows: [
      ['Texte concerné', t ? t.intitule : '—'],
      ['Conclusion', <StatusBadge value={r.statut} />],
      ['Auteur', r.auteur],
      ['Synthèse', r.synthese],
      [
        'Pièces jointes',
        <>
          <Icon name="doc" size={13} /> {r.pieces}
        </>,
      ],
    ],
    del: true,
  })
}

const DIFF_F: FieldDef[] = [
  {
    k: 'mode',
    l: 'Cible de diffusion',
    t: 'select',
    o: [
      ['dest', 'Destinataire / agence'],
      ['proc', "Tous les intéressés d'un processus"],
    ],
  },
  { k: 'destinataire', l: 'Destinataire ou agence' },
  {
    k: 'processus',
    l: 'Processus (diffusion par processus)',
    t: 'select',
    o: () => [
      '—',
      ...useApp
        .getState()
        .db.processus.map((p) => [p.id, p.code + ' — ' + p.intitule] as [string, string]),
    ],
  },
]

/** diffuserTexte(id) de l'original. */
export function diffuserTexte(id: string) {
  const t = useApp.getState().db.textes.find((x) => x.id === id) as Rec | undefined
  if (!t) return
  openModal(
    {
      title: 'Diffuser le texte réglementaire',
      sub: t.intitule.slice(0, 80),
      body: (
        <div id="dtf">
          <FormRenderer
            formId="dtf"
            fields={DIFF_F}
            rec={{ mode: 'dest', destinataire: t.responsable || '', processus: '—' }}
          />
        </div>
      ),
      foot: (
        <>
          <button className="btn" onClick={() => closeModal('modal2')}>
            Annuler
          </button>
          <button className="btn primary" onClick={() => submitDiffTexte(id)}>
            <Icon name="send" size={15} /> Diffuser
          </button>
        </>
      ),
    },
    'modal2'
  )
}

/** submitDiffTexte(id) de l'original. */
function submitDiffTexte(id: string) {
  const d = readForm('dtf')
  if (!d) return
  update((s) => {
    const t = s.db.textes.find((x) => x.id === id) as Rec | undefined
    if (!t) return
    const cible =
      d.mode === 'proc' && d.processus !== '—'
        ? 'tous les intéressés du processus ' + procName(d.processus)
        : d.destinataire || 'destinataire non précisé'
    t.diffuse = true
    t.statutDiff = 'Diffusé'
    t.destinataireDiff = cible
    hist(s, t, 'Texte diffusé à : ' + cible)
    logAct(s, 'a diffusé le texte « ' + t.intitule.slice(0, 50) + '… » à ' + cible, 'Veille')
  })
  closeModal('modal2')
  toast('Texte diffusé — statut « diffusé » enregistré.')
}
