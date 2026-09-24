import { Icon } from '../components/ui/Icon'
import { hist, logAct, nextId, update, useApp } from '../store/useApp'
import type { AppState } from '../store/types'
import { closeModal, openModal, toast } from '../store/useOverlays'
import { FormRenderer } from './FormRenderer'
import { readForm } from './formControllers'
import { FORMS } from './registry'
import type { Rec } from './types'

/** Liste cible d'une collection (F.list() ou s.db[coll]). */
export function listOf(s: AppState, coll: string): Rec[] {
  const F = FORMS[coll]
  return F?.list ? F.list(s) : ((s.db as unknown as Record<string, Rec[]>)[coll] ?? [])
}

/** findRec(coll, id) de l'original. */
export function findRec(s: AppState, coll: string, id: string): Rec | undefined {
  return listOf(s, coll).find((x) => x.id === id)
}

const labelOf = (coll: string, r: Rec) => r[FORMS[coll]?.label || 'intitule'] || r.nom || r.libelle || r.id

/** openForm(coll, id) de l'original : formulaire de création ou de modification. */
export function openForm(coll: string, id?: string) {
  const F = FORMS[coll]
  const state = useApp.getState()
  const cur = id ? findRec(state, coll, id) : undefined
  const rec = cur ? { ...cur } : F.def(state)
  const fields = typeof F.fields === 'function' ? F.fields(rec, !cur) : F.fields
  const formId = `form-${coll}`

  const onSave = () => {
    const data = readForm(formId)
    if (!data) {
      toast('Complétez les champs signalés en rouge.', 'warn')
      return
    }
    let res: string | void | null = null
    update((s) => {
      let r: Rec
      if (cur) {
        r = findRec(s, coll, id!)!
        Object.assign(r, data)
        hist(s, r, 'Modification')
      } else {
        r = { id: nextId(s, F.prefix || 'X'), ...rec, ...data }
        hist(s, r, 'Création')
        listOf(s, coll).unshift(r)
      }
      res = F.save ? F.save(s, r, !cur) : null
      logAct(s, `a ${cur ? 'modifié' : 'créé'} « ${labelOf(coll, r)} » (${F.title})`, F.mod || F.title)
    })
    closeModal()
    closeModal('drawer')
    toast(res || (cur ? 'Modifications enregistrées.' : F.title + ' enregistré(e).'))
  }

  openModal({
    title: (cur ? 'Modifier — ' : 'Nouveau — ') + F.title,
    sub: cur
      ? 'Les modifications sont historisées dans le journal.'
      : F.sub || 'Formulaire prérempli avec un exemple : adaptez les valeurs puis enregistrez.',
    wide: F.wide,
    body: <FormRenderer formId={formId} fields={fields} rec={rec} />,
    foot: (
      <>
        <button className="btn" onClick={() => closeModal()}>
          Annuler
        </button>
        <button className="btn primary" id="saveBtn" onClick={onSave}>
          <Icon name="check" size={16} /> {cur ? 'Enregistrer les modifications' : 'Enregistrer'}
        </button>
      </>
    ),
  })
}

/** delRec(coll, id) de l'original : confirmation puis suppression tracée. */
export function delRec(coll: string, id: string) {
  const r = findRec(useApp.getState(), coll, id)
  if (!r) return
  openModal(
    {
      title: 'Supprimer cet élément ?',
      body: (
        <p>
          « {labelOf(coll, r)} » sera retiré de la liste. L'action est tracée dans le journal d'audit.
        </p>
      ),
      foot: (
        <>
          <button className="btn" onClick={() => closeModal('modal2')}>
            Annuler
          </button>
          <button className="btn danger" onClick={() => doDel(coll, id)}>
            <Icon name="trash" size={15} /> Supprimer
          </button>
        </>
      ),
    },
    'modal2'
  )
}

function doDel(coll: string, id: string) {
  update((s) => {
    const list = listOf(s, coll)
    const i = list.findIndex((x) => x.id === id)
    const r = list[i]
    list.splice(i, 1)
    logAct(s, `a supprimé « ${r[FORMS[coll]?.label || 'intitule'] || r.nom || r.id} »`, FORMS[coll]?.mod || coll)
  })
  closeModal('modal2')
  closeModal('drawer')
  toast('Élément supprimé.')
}

/** markObsolete(coll, id) de l'original. */
export function markObsolete(coll: string, id: string) {
  update((s) => {
    const r = findRec(s, coll, id)!
    r.statut = 'Obsolète'
    r.obsolete = true
    hist(s, r, 'Classé obsolète (traçabilité conservée)')
    logAct(s, `a classé obsolète « ${r.intitule || r.titre || r.id} »`, coll)
  })
  closeModal('drawer')
  toast("Élément classé obsolète — il reste consultable dans l'historique.")
}
