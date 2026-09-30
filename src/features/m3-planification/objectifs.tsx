import { openDetail } from '../../components/data/Detail'
import { DueDate, NormBadges, Progress, StatusBadge } from '../../components/ui/badges'
import { Icon } from '../../components/ui/Icon'
import { readForm } from '../../forms/formControllers'
import { FormRenderer } from '../../forms/FormRenderer'
import type { FieldDef, Rec } from '../../forms/types'
import { addDays, fd } from '../../lib/dates'
import { axeName, procName } from '../../lib/lookups'
import { act, seg } from '../../services/session'
import { hist, logAct, nextId, update, useApp } from '../../store/useApp'
import { closeModal, openModal, toast } from '../../store/useOverlays'
import { BrList } from './BrList'
import { ACT_F, objProg } from './helpers'

/** objDetail(id) de l'original. */
export function objDetail(id: string) {
  const o = useApp.getState().db.objectifs.find((x) => x.id === id) as Rec | undefined
  if (!o) return
  openDetail({
    coll: 'objectifs',
    id,
    title: o.code + ' · ' + o.libelle,
    sub: axeName(o.axe),
    rows: [
      ['Indicateur', o.kpi],
      ['Cible', o.cible],
      ['Délai', fd(o.delai)],
      ['Processus', <BrList items={o.processus.map(procName)} />],
      ['Normes', <NormBadges norms={o.normes} />],
      ['Avancement', <Progress value={objProg(o)} />],
      ['Efficacité', <StatusBadge value={o.efficacite} />],
    ],
    extra: (
      <div className="dsec">
        <div className="card-h">
          <h4 style={{ margin: 0 }}>Plan d'action ({o.actions.length})</h4>
          <button className="btn sm" onClick={() => editAction(id, -1)}>
            <Icon name="plus" size={13} /> Ajouter une action
          </button>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Action</th>
                <th>Responsable</th>
                <th>Échéance</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {o.actions.map((a: Rec, i: number) => (
                <tr key={i} className="click" onClick={() => editAction(id, i)}>
                  <td>
                    {a.libelle}
                    <br />
                    <span className="ref">{a.observation}</span>
                  </td>
                  <td>{a.responsable}</td>
                  <td>
                    <DueDate date={a.echeance} done={a.statut === 'Clôturé'} />
                  </td>
                  <td>
                    <StatusBadge value={a.statut} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ),
    del: true,
  })
}

/** editAction(oid, i) de l'original : ajout (i = -1) ou modification d'une action. */
export function editAction(oid: string, i: number) {
  const o = useApp.getState().db.objectifs.find((x) => x.id === oid) as Rec | undefined
  if (!o) return
  const a =
    i >= 0
      ? o.actions[i]
      : {
          libelle: "Installer des compteurs d'eau divisionnaires",
          responsable: 'Bertin SOSSA',
          echeance: addDays(60),
          statut: 'Mise en œuvre',
          observation: 'Devis demandé à deux fournisseurs',
        }
  const onSave = () => {
    const d = readForm('actf')
    if (!d) return
    const local = () =>
      update((s) => {
        const o = s.db.objectifs.find((x) => x.id === oid) as Rec
        if (i >= 0) Object.assign(o.actions[i], d)
        else o.actions.push(d)
        hist(s, o, (i >= 0 ? 'Action modifiée' : 'Action ajoutée') + ' : ' + d.libelle)
        logAct(s, "a mis à jour le plan d'action de " + o.code, 'Objectifs')
      })
    const done = () => {
      closeModal('modal2')
      objDetail(oid)
    }
    // Modification : PATCH fusionne avec l'action existante (comme Object.assign).
    if (i >= 0) act(`/objectifs/${seg(oid)}/actions/${i}/`, d, local, done, 'PATCH')
    else act(`/objectifs/${seg(oid)}/actions/`, d, local, done)
  }
  openModal(
    {
      title: (i >= 0 ? 'Modifier' : 'Ajouter') + ' une action — ' + o.code,
      body: (
        <div id="actf">
          <FormRenderer formId="actf" fields={ACT_F} rec={a} />
        </div>
      ),
      foot: (
        <>
          <button className="btn" onClick={() => closeModal('modal2')}>
            Annuler
          </button>
          <button className="btn primary" onClick={onSave}>
            Enregistrer
          </button>
        </>
      ),
    },
    'modal2'
  )
}

const IMP_F: FieldDef[] = [
  { k: 'fichier', l: 'Fichier du tableau de bord (Excel, CSV)', t: 'file', req: 1 },
  {
    k: 'remplace',
    l: "Mode d'import",
    t: 'toggle',
    lbl: 'Compléter la liste existante sans la supprimer',
  },
]

/** importObjectifs() de l'original (v2) : import d'un tableau de bord existant. */
export function importObjectifs() {
  openModal({
    title: 'Importer un tableau de bord des objectifs',
    sub: 'Rendez consultable dans la plateforme un tableau de bord des objectifs déjà existant.',
    body: (
      <>
        <div className="note mb">
          <Icon name="up" size={15} /> Les objectifs importés restent modifiables et sont rattachés
          aux processus et aux normes.
        </div>
        <div id="impf">
          <FormRenderer
            formId="impf"
            fields={IMP_F}
            rec={{ fichier: 'Tableau_de_bord_objectifs_2026.xlsx', remplace: true }}
          />
        </div>
      </>
    ),
    foot: (
      <>
        <button className="btn" onClick={() => closeModal()}>
          Annuler
        </button>
        <button className="btn primary" onClick={doImportObjectifs}>
          <Icon name="check" size={15} /> Importer
        </button>
      </>
    ),
  })
}

/** doImportObjectifs() de l'original. */
function doImportObjectifs() {
  const d = readForm('impf')
  if (!d) return
  let n = 0
  const ax = useApp.getState().db.axes[0]?.id || 'AX1'
  const imp = [
    {
      code: 'OB-06',
      axe: ax,
      libelle: "Atteindre 95 % de livraisons à l'heure",
      kpi: "Taux de livraison à l'heure",
      cible: '95 %',
      delai: addDays(180),
      efficacite: 'Non évaluée',
      processus: ['P07'],
      normes: ['9001'],
    },
    {
      code: 'OB-07',
      axe: ax,
      libelle: 'Réduire le taux de rebut au conditionnement à 1 %',
      kpi: 'Taux de rebut',
      cible: '1 %',
      delai: addDays(210),
      efficacite: 'Non évaluée',
      processus: ['P05'],
      normes: ['9001'],
    },
  ]
  const local = () =>
    update((s) => {
      const list = s.db.objectifs as unknown as Rec[]
      imp.forEach((o) => {
        if (list.some((x) => x.code === o.code)) return
        list.push({ id: nextId(s, 'OB'), ...o, actions: [], importe: true })
        n++
      })
      logAct(s, 'a importé un tableau de bord des objectifs (' + n + ' objectif(s))', 'Objectifs')
    })
  act<{ importes: number }>('/objectifs/import/', { objectifs: imp }, local, (r) => {
    if (r) n = r.importes
    update((s) => {
      s.ui.tabs.obj = 'list'
    })
    closeModal()
    toast(
      n
        ? n + ' objectif(s) importé(s) et consultables dans la plateforme.'
        : 'Ces objectifs sont déjà présents dans la plateforme.'
    )
  })
}
