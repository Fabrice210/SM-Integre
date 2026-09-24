import { go } from '../../app/navigation'
import { openDetail } from '../../components/data/Detail'
import { DueDate, NormBadges, StatusBadge, statusClass } from '../../components/ui/badges'
import { Block, LinkItem } from '../../components/ui/links'
import type { Rec } from '../../forms/types'
import { procName } from '../../lib/lookups'
import { hist, logAct, update, useApp } from '../../store/useApp'
import { closeModal, toast } from '../../store/useOverlays'
import { BrList } from './BrList'
import { niv, nivLbl } from './helpers'
import { addRegistre } from '../../services/registre'

/** riskRealise(id) de l'original. */
export function riskRealise(id: string) {
  update((s) => {
    const r = s.db.risques.find((x) => x.id === id) as Rec
    r.realise = true
    hist(s, r, 'Risque déclaré réalisé')
    addRegistre(
      s,
      'Risque réalisé',
      r.intitule + ' (' + r.id + ')',
      'Risque ' + r.id,
      r.processus[0],
      r.normes,
      r.responsable
    )
    logAct(s, 'a déclaré le risque ' + r.id + ' réalisé — entrée créée dans le registre', 'Risques')
  })
  closeModal('drawer')
  toast("Entrée générée automatiquement dans le registre d'amélioration continue.")
}

/** riskDetail(id) de l'original. */
export function riskDetail(id: string) {
  const db = useApp.getState().db
  const r = db.risques.find((x) => x.id === id) as Rec | undefined
  if (!r) return
  openDetail({
    coll: 'risques',
    id,
    title: r.id + ' · ' + r.intitule,
    sub: 'Risque ' + r.type,
    rows: [
      ['Cause', r.cause],
      ['Conséquences', r.consequences],
      [
        'Évaluation',
        <>
          Probabilité {r.probabilite} × criticité {r.criticite} = <b>{niv(r)}</b>{' '}
          <StatusBadge value={nivLbl(niv(r))} />
        </>,
      ],
      ['Traitement', r.traitement],
      ['Processus', <BrList items={r.processus.map(procName)} />],
      ['Action générée', r.action],
      ['Responsable', r.responsable],
      ['Échéance', <DueDate date={r.echeance} done={r.statutAction === 'Clôturé'} />],
      ['Statut', <StatusBadge value={r.statutAction} />],
      ['Efficacité', <StatusBadge value={r.efficacite} />],
      ['Normes', <NormBadges norms={r.normes} />],
      [
        'Réalisé',
        r.realise ? (
          <span className={`badge dot ${statusClass('Validé')}`}>Oui — inscrit au registre</span>
        ) : (
          'Non'
        ),
      ],
    ],
    extra: (
      <Block
        title="Situations d'urgence et fiches de maîtrise liées"
        items={[
          ...db.urgences
            .filter((u) => (u.risques as readonly string[]).includes(id))
            .map((u) => (
              <LinkItem
                key={u.id}
                title={u.type}
                sub="Fiche d'urgence"
                onClick={() => go('m5-urgences')}
              />
            )),
          ...db.fichesMaitrise
            .filter((f) => (f.risques as readonly string[]).includes(id))
            .map((f) => (
              <LinkItem
                key={f.id}
                title={f.objet}
                sub="Fiche de maîtrise"
                onClick={() => go('m5-fiches')}
              />
            )),
        ]}
      />
    ),
    obs: true,
    acts: r.realise ? null : (
      <button className="btn" onClick={() => riskRealise(id)}>
        Déclarer le risque réalisé
      </button>
    ),
  })
}

/** oppDetail(id) de l'original. */
export function oppDetail(id: string) {
  const r = useApp.getState().db.opportunites.find((x) => x.id === id) as Rec | undefined
  if (!r) return
  openDetail({
    coll: 'opportunites',
    id,
    title: r.id + ' · ' + r.intitule,
    sub: 'Opportunité ' + r.type,
    rows: [
      ['Origine', r.origine],
      ['Bénéfices', r.benefices],
      [
        'Évaluation',
        <>
          Probabilité {r.probabilite} × impact {r.impact} = <b>{niv(r)}</b>
        </>,
      ],
      ['Exploitation', r.exploitation],
      ['Processus', <BrList items={r.processus.map(procName)} />],
      ['Action', r.action],
      ['Responsable', r.responsable],
      ['Échéance', <DueDate date={r.echeance} done={r.statutAction === 'Clôturé'} />],
      ['Statut', <StatusBadge value={r.statutAction} />],
      ['Efficacité', <StatusBadge value={r.efficacite} />],
      ['Normes', <NormBadges norms={r.normes} />],
    ],
    obs: true,
  })
}
