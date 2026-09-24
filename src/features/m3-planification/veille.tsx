import { openDetail } from '../../components/data/Detail'
import { DueDate, NormBadges, StatusBadge, Workflow } from '../../components/ui/badges'
import { Icon } from '../../components/ui/Icon'
import { Block, LinkItem } from '../../components/ui/links'
import { go } from '../../app/navigation'
import { NORMS, type NormId } from '../../data/referentiels'
import { openForm } from '../../forms/crud'
import { FORMS } from '../../forms/registry'
import type { Rec } from '../../forms/types'
import { addDays, fd, iso, TODAY } from '../../lib/dates'
import { currentUser, hist, logAct, nextId, update, useApp } from '../../store/useApp'
import { closeModal, openDrawer, toast } from '../../store/useOverlays'
import { addRegistre } from '../../services/registre'

const db = () => useApp.getState().db

/** declAct(id, act) de l'original : circuit de la déclaration au DG. */
export function declAct(id: string, act: 'submit' | 'ok' | 'ko') {
  let msg: [string, 'ok' | 'warn'] | null = null
  update((s) => {
    const d = s.db.declarations.find((x) => x.id === id) as Rec
    if (act === 'submit') {
      d.statut = 'Soumise'
      d.commentaireDG = 'En attente de décision du Directeur Général'
      hist(s, d, 'Soumise au Directeur Général')
      logAct(s, 'a soumis la déclaration « ' + d.objet + ' » au DG', 'Veille', 'En attente')
      msg = ['Déclaration soumise : le Directeur Général est notifié.', 'ok']
    }
    if (act === 'ok') {
      d.statut = 'Validée'
      d.commentaireDG = 'Validée le ' + fd(iso(TODAY)) + ' — liée au registre des non-conformités'
      hist(s, d, 'Validée par le DG')
      const t = (s.db.textes.find((x) => x.id === d.texte) as Rec | undefined) || {
        normes: ['9001'],
        responsable: currentUser(s).nom,
      }
      const nc = {
        id: nextId(s, 'NC'),
        ref: 'NC-2026-0' + (30 + s.db.ncs.length),
        categorie: 'Non-conformité',
        source: 'Veille réglementaire',
        description: d.objet,
        typeActe: 'Conformité',
        cause: d.cause,
        action: d.planAction,
        lieu: s.org.nom,
        processus: 'P02',
        normes: t.normes,
        statut: 'En traitement',
        n1: 'Validé',
        n2: 'Approuvé',
        date: iso(TODAY),
        declarant: d.auteur,
        origine: 'Déclaration ' + d.id,
      }
      ;(s.db.ncs as unknown as Rec[]).unshift(nc)
      addRegistre(
        s,
        'Non-conformité',
        d.objet,
        'Veille réglementaire (' + d.id + ')',
        'P02',
        t.normes,
        t.responsable
      )
      logAct(
        s,
        'a validé la déclaration « ' + d.objet + ' » — écart lié au module Non-conformités',
        'Veille'
      )
      msg = [
        'Déclaration validée : écart créé dans le module 6.4 et mise en conformité planifiée.',
        'ok',
      ]
    }
    if (act === 'ko') {
      d.statut = 'Refusée'
      d.commentaireDG = "Refusée — complément demandé sur le plan d'action"
      hist(s, d, "Refusée par le DG, retour à l'auteur")
      logAct(s, 'a refusé la déclaration « ' + d.objet + ' »', 'Veille', 'Refusé')
      msg = ["Déclaration refusée et renvoyée à l'auteur.", 'warn']
    }
  })
  if (msg) toast(...(msg as [string, 'ok' | 'warn']))
  closeModal('drawer')
}

/** declDetail(id) de l'original. */
export function declDetail(id: string) {
  const d = db().declarations.find((x) => x.id === id) as Rec | undefined
  if (!d) return
  const idx = ({ Brouillon: 0, Soumise: 1, Validée: 2, Refusée: 2 } as Record<string, number>)[
    d.statut
  ]
  openDrawer({
    title: d.objet,
    sub: 'Déclaration ' + d.id + ' — ' + fd(d.date) + ' — ' + d.auteur,
    body: (
      <>
        <Workflow
          steps={['Rédaction', 'Soumise au DG', d.statut === 'Refusée' ? 'Refusée' : 'Validée']}
          current={d.statut === 'Validée' ? 3 : idx}
          ko={d.statut === 'Refusée'}
        />
        <dl className="kv" style={{ marginTop: 12 }}>
          <dt>Texte</dt>
          <dd>{(db().textes.find((t) => t.id === d.texte) as Rec | undefined)?.intitule || '—'}</dd>
          <dt>Cause</dt>
          <dd>{d.cause}</dd>
          <dt>Impact</dt>
          <dd>{d.impact}</dd>
          <dt>Plan d'action</dt>
          <dd>{d.planAction}</dd>
          <dt>Statut</dt>
          <dd>
            <StatusBadge value={d.statut} />
          </dd>
          <dt>Décision du DG</dt>
          <dd>{d.commentaireDG}</dd>
        </dl>
      </>
    ),
    foot:
      d.statut === 'Brouillon' || d.statut === 'Refusée' ? (
        <>
          <button className="btn" onClick={() => openForm('declarations', id)}>
            <Icon name="edit" size={15} /> Modifier
          </button>
          <button className="btn primary" onClick={() => declAct(id, 'submit')}>
            <Icon name="send" size={15} /> Soumettre au DG
          </button>
        </>
      ) : d.statut === 'Soumise' ? (
        <>
          <button className="btn danger" onClick={() => declAct(id, 'ko')}>
            Refuser
          </button>
          <button className="btn primary" onClick={() => declAct(id, 'ok')}>
            <Icon name="check" size={15} /> Valider (DG)
          </button>
        </>
      ) : (
        <button className="btn" onClick={() => go('m6-nc')}>
          Voir la non-conformité liée
        </button>
      ),
  })
}

/** txDetail(id) de l'original. */
export function txDetail(id: string) {
  const x = db().textes.find((t) => t.id === id) as Rec | undefined
  if (!x) return
  openDetail({
    coll: 'textes',
    id,
    title: x.intitule,
    sub: x.domaine,
    rows: [
      ['Publié le', fd(x.datePublication)],
      [
        'Source',
        <a href={x.lien} target="_blank" rel="noopener">
          {x.lien}
        </a>,
      ],
      ['Statut', <StatusBadge value={x.statut} />],
      ['Justificatif', x.justificatif],
      ['Pièces jointes', x.pieces],
      ['Prochaine évaluation', <DueDate date={x.echeance} done={x.statut === 'Fait'} />],
      ['Responsable', x.responsable],
      ['Normes', <NormBadges norms={x.normes} />],
    ],
    extra: (
      <Block
        title="Déclarations liées"
        items={db()
          .declarations.filter((d) => d.texte === id)
          .map((d) => (
            <LinkItem key={d.id} title={d.objet} sub={d.statut} onClick={() => declDetail(d.id)} />
          ))}
      />
    ),
    obs: true,
    acts: (
      <>
        {x.statut === 'Pas fait' ? (
          <button
            className="btn"
            onClick={() => {
              closeModal('drawer')
              openDecl(id)
            }}
          >
            Déclarer l'écart au DG
          </button>
        ) : null}
        <button className="btn" onClick={() => qualifUrgence(id)}>
          Qualifier en situation d'urgence
        </button>
      </>
    ),
  })
}

/** openDecl(tid) de l'original : formulaire de déclaration prérempli depuis le texte. */
export function openDecl(tid: string) {
  const t = db().textes.find((x) => x.id === tid) as Rec
  const F = FORMS.declarations
  const old = F.def
  F.def = (s) => ({
    ...old(s),
    texte: tid,
    objet: 'Non-conformité : ' + t.intitule.slice(0, 70),
    cause: t.justificatif,
    impact:
      'Exposition à une sanction et atteinte à la conformité ' +
      t.normes.map((n: NormId) => NORMS[n].code).join(', '),
    planAction: 'Mettre en conformité avant le ' + fd(addDays(30)),
  })
  openForm('declarations')
  F.def = old
}

/** qualifUrgence(tid) de l'original : crée un risque « Situation d'urgence ». */
export function qualifUrgence(tid: string) {
  let rid = ''
  update((s) => {
    const t = s.db.textes.find((x) => x.id === tid) as Rec
    const r: Rec = {
      id: 'R' + String(s.db.risques.length + 1).padStart(2, '0'),
      intitule: "Situation d'urgence liée à : " + t.intitule.slice(0, 60),
      cause: t.justificatif,
      consequences: 'Accident, pollution ou sanction réglementaire',
      type: "Situation d'urgence",
      normes: t.normes,
      probabilite: 2,
      criticite: 4,
      traitement: 'Réduire',
      processus: ['P11'],
      action: "Créer la fiche de situation d'urgence et planifier un exercice",
      responsable: t.responsable,
      echeance: addDays(60),
      statutAction: 'Mise en œuvre',
      efficacite: 'À évaluer',
      realise: false,
    }
    hist(s, r, "Qualifié en situation d'urgence depuis le registre de veille")
    ;(s.db.risques as unknown as Rec[]).push(r)
    logAct(
      s,
      "a qualifié un risque de situation d'urgence depuis la veille (" + r.id + ')',
      'Veille'
    )
    rid = r.id
  })
  closeModal('drawer')
  toast('Risque ' + rid + " créé et typé « Situation d'urgence ».")
}
