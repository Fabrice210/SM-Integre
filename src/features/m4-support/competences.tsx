import { DIRECTIONS } from '../../data/referentiels'
import { openForm } from '../../forms/crud'
import { readForm } from '../../forms/formControllers'
import { FormRenderer } from '../../forms/FormRenderer'
import { FORMS } from '../../forms/registry'
import type { FieldDef, Rec } from '../../forms/types'
import { logAct, update, useApp } from '../../store/useApp'
import { closeModal, openModal, toast } from '../../store/useOverlays'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const comp = (s: { db: { competences: unknown } }) => s.db.competences as any

/** lvlCycle(ci, k) de l'original : niveau suivant (0 → 4 puis 0). */
export function lvlCycle(ci: number, k: number) {
  update((s) => {
    const C = comp(s)
    const p = C.collaborateurs[ci]
    p.niveaux[k] = (p.niveaux[k] + 1) % 5
    logAct(s, 'a mis à jour le niveau de ' + p.nom + ' en « ' + C.liste[k] + ' »', 'Compétences')
  })
}

/** importMatrix(inp) de l'original : import CSV (Nom;Direction;niveaux…). */
export function importMatrix(inp: HTMLInputElement) {
  const f = inp.files?.[0]
  if (!f) return
  const rd = new FileReader()
  rd.onload = () => {
    const lines = String(rd.result).split(/\r?\n/).filter(Boolean)
    let n = 0
    update((s) => {
      const C = comp(s)
      lines.slice(1).forEach((l) => {
        const c = l.split(/[;,]/)
        if (c.length >= 2) {
          C.collaborateurs.push({
            nom: c[0].trim(),
            direction: c[1].trim(),
            niveaux: C.liste.map((_: string, i: number) => Math.min(4, Number(c[i + 2]) || 0)),
          })
          n++
        }
      })
      logAct(s, 'a importé une matrice de compétences (' + n + ' lignes)', 'Compétences')
    })
    toast(n + ' collaborateur(s) importé(s).')
  }
  rd.readAsText(f)
}

const COLLAB_F: FieldDef[] = [
  { k: 'nom', l: 'Nom et prénom', req: 1 },
  { k: 'direction', l: 'Direction', t: 'select', o: DIRECTIONS },
]

/** addCollab() de l'original. */
export function addCollab() {
  const onAdd = () => {
    const d = readForm('cf')
    if (d) {
      update((s) => {
        const C = comp(s)
        C.collaborateurs.push({ ...d, niveaux: C.liste.map(() => 1) })
      })
      closeModal()
      toast('Collaborateur ajouté — cliquez sur les niveaux pour les ajuster.')
    }
  }
  openModal({
    title: 'Ajouter un collaborateur à la matrice',
    body: (
      <div id="cf">
        <FormRenderer
          formId="cf"
          fields={COLLAB_F}
          rec={{ nom: 'Bénédicte AGOSSA', direction: 'Direction Industrielle' }}
        />
      </div>
    ),
    foot: (
      <>
        <button className="btn" onClick={() => closeModal()}>
          Annuler
        </button>
        <button className="btn primary" onClick={onAdd}>
          Ajouter
        </button>
      </>
    ),
  })
}

/** planFormation(sid) de l'original : session de formation préremplie depuis un savoir critique. */
export function planFormation(sid: string) {
  const s = useApp.getState().db.savoirs.find((x) => x.id === sid) as Rec
  const F = FORMS.formations
  const old = F.def
  F.def = (st) => ({
    ...old(st),
    theme: s.savoir,
    participants: 'À désigner — transfert de savoir depuis ' + s.detenteurs,
    formateur: s.detenteurs.split(',')[0],
    normes: ['9001'],
  })
  openForm('formations')
  F.def = old
}
