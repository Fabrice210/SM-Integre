import { openDetail } from '../../components/data/Detail'
import { DueDate, NormBadges, Progress, StatusBadge } from '../../components/ui/badges'
import { Icon } from '../../components/ui/Icon'
import { readForm } from '../../forms/formControllers'
import { FormRenderer } from '../../forms/FormRenderer'
import type { Rec } from '../../forms/types'
import { addDays, fd } from '../../lib/dates'
import { axeName, procName } from '../../lib/lookups'
import { hist, logAct, update, useApp } from '../../store/useApp'
import { closeModal, openModal } from '../../store/useOverlays'
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
    update((s) => {
      const o = s.db.objectifs.find((x) => x.id === oid) as Rec
      if (i >= 0) Object.assign(o.actions[i], d)
      else o.actions.push(d)
      hist(s, o, (i >= 0 ? 'Action modifiée' : 'Action ajoutée') + ' : ' + d.libelle)
      logAct(s, "a mis à jour le plan d'action de " + o.code, 'Objectifs')
    })
    closeModal('modal2')
    objDetail(oid)
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
