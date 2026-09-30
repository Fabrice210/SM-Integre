/** 5.3 Situations d'urgence (original l.1597-1607). */
import { Fragment } from 'react'
import { openDetail } from '../../components/data/Detail'
import { StatusBadge } from '../../components/ui/badges'
import { Icon } from '../../components/ui/Icon'
import { Block, LinkItem } from '../../components/ui/links'
import { PageHead } from '../../components/ui/PageHead'
import { MOD_FULL } from '../../data/referentiels'
import { go } from '../../app/navigation'
import { openForm } from '../../forms/crud'
import { FormRenderer } from '../../forms/FormRenderer'
import { readForm } from '../../forms/formControllers'
import type { FieldDef, FormDef } from '../../forms/types'
import { addDays, days, fd } from '../../lib/dates'
import { riskOpts, siteOpts } from '../../lib/lookups'
import { hist, logAct, update, useApp } from '../../store/useApp'
import { closeModal, openModal, toast } from '../../store/useOverlays'
import { addRegistre } from '../../services/registre'
import { act, seg } from '../../services/session'
import { DB, type Any } from '../m6-performance/shared'

export const urgencesForms: Record<string, FormDef> = {
  urgences: {
    title: "Fiche de situation d'urgence",
    prefix: 'SU',
    label: 'type',
    mod: "Situations d'urgence",
    wide: true,
    fields: [
      { k: 'type', l: "Type de situation d'urgence", req: 1, full: 1 },
      { k: 'procedure', l: 'Procédure de référence', req: 1 },
      { k: 'responsables', l: 'Responsables', req: 1 },
      { k: 'consignes', l: 'Consignes', t: 'textarea', req: 1 },
      { k: 'moyens', l: 'Moyens de secours', t: 'textarea', req: 1 },
      { k: 'risques', l: 'Risques associés (Module 3)', t: 'multi', o: riskOpts, req: 1 },
      { k: 'sites', l: "Sites d'application (Module 1.3)", t: 'multi', o: siteOpts, req: 1 },
    ],
    def: () => ({
      type: "Inondation de l'entrepôt de Porto-Novo",
      procedure: 'PR-HSE-11 Plan inondation',
      responsables: 'Martial ADJIBADÉ',
      consignes: "Surélever les palettes, couper l'électricité, évacuer le personnel",
      moyens: 'Pompes de relevage, sacs de sable, palettes hautes',
      risques: ['R06'],
      sites: ['Entrepôt de Porto-Novo'],
      exercices: [],
    }),
    save: (_s, r, n) => {
      if (n) r.exercices = []
    },
  },
}

const EX_F: FieldDef[] = [
  { k: 'date', l: "Date de l'exercice", t: 'date', req: 1 },
  { k: 'participants', l: 'Participants', req: 1 },
  { k: 'scenario', l: 'Scénario', t: 'textarea', req: 1 },
  { k: 'procedure', l: 'Procédure / instruction jointe', t: 'file', req: 1 },
]
const CR_F: FieldDef[] = [
  { k: 'compteRendu', l: "Compte-rendu de l'exercice", t: 'textarea', req: 1 },
  { k: 'actions', l: "Actions correctives issues du retour d'expérience", t: 'textarea', req: 1 },
  {
    k: 'creer',
    l: "Créer ces actions dans le registre d'amélioration",
    t: 'toggle',
    lbl: 'Oui, des actions correctives sont nécessaires',
  },
]

const findU = (id: string): Any => DB(useApp.getState()).urgences.find((x: Any) => x.id === id)
const exStatut = (e: Any) =>
  e.statut === 'Planifié' && (days(e.date) as number) < 0 ? 'En retard' : e.statut

/** addExercice(uid) de l'original. */
export function addExercice(uid_: string) {
  const u = findU(uid_)
  openModal(
    {
      title: 'Planifier un exercice de simulation',
      sub: u.type,
      body: (
        <div id="exf">
          <FormRenderer
            formId="exf"
            fields={EX_F}
            rec={{
              date: addDays(40),
              participants: 'Équipiers EPI et personnel de jour',
              scenario: 'Déclenchement de la situation « ' + u.type + ' » en heures ouvrées',
              procedure: u.procedure.split(' ')[0] + '.pdf',
            }}
          />
        </div>
      ),
      foot: (
        <>
          <button className="btn" onClick={() => closeModal('modal2')}>
            Annuler
          </button>
          <button
            className="btn primary"
            onClick={() => {
              const d = readForm('exf')
              if (!d) return
              const local = () =>
                update((s) => {
                  const u = DB(s).urgences.find((x: Any) => x.id === uid_)
                  u.exercices.push({ ...d, statut: 'Planifié', compteRendu: '—', actions: '—' })
                  hist(s, u, 'Exercice planifié le ' + fd(d.date))
                  logAct(
                    s,
                    'a planifié un exercice : ' + u.type,
                    "Situations d'urgence",
                    'Planifié'
                  )
                })
              act(`/urgences/${seg(uid_)}/exercices/`, d, local, () => {
                closeModal('modal2')
                toast('Exercice planifié — participants notifiés.')
                urgDetail(uid_)
              })
            }}
          >
            Planifier
          </button>
        </>
      ),
    },
    'modal2'
  )
}

/** crExercice(uid, i) de l'original. */
export function crExercice(uid_: string, i: number) {
  const u = findU(uid_)
  openModal(
    {
      title: 'Enregistrer le compte-rendu',
      sub: u.type + ' — ' + fd(u.exercices[i].date),
      body: (
        <div id="crf">
          <FormRenderer
            formId="crf"
            fields={CR_F}
            rec={{
              compteRendu:
                'Évacuation réalisée en 4 min 10 s. Alarme audible partout sauf à la chambre froide.',
              actions:
                'Installer un flash lumineux dans la chambre froide — Bertin SOSSA — 30 jours',
              creer: true,
            }}
          />
        </div>
      ),
      foot: (
        <>
          <button className="btn" onClick={() => closeModal('modal2')}>
            Annuler
          </button>
          <button
            className="btn primary"
            onClick={() => {
              const d = readForm('crf')
              if (!d) return
              const local = () =>
                update((s) => {
                  const u = DB(s).urgences.find((x: Any) => x.id === uid_)
                  Object.assign(u.exercices[i], {
                    compteRendu: d.compteRendu,
                    actions: d.actions,
                    statut: 'Réalisé',
                  })
                  if (d.creer)
                    addRegistre(
                      s,
                      'Action corrective',
                      d.actions,
                      'Exercice : ' + u.type,
                      'P11',
                      ['45001', '14001'],
                      u.responsables.split(' (')[0]
                    )
                  hist(s, u, 'Compte-rendu enregistré')
                  logAct(
                    s,
                    "a enregistré le compte-rendu de l'exercice " + u.type,
                    "Situations d'urgence"
                  )
                })
              const body = { compteRendu: d.compteRendu, actions: d.actions, creer: !!d.creer }
              act(`/urgences/${seg(uid_)}/exercices/${i}/compte-rendu/`, body, local, () => {
                closeModal('modal2')
                toast(
                  d.creer
                    ? 'Compte-rendu enregistré et actions correctives créées.'
                    : 'Compte-rendu enregistré.'
                )
                urgDetail(uid_)
              })
            }}
          >
            Enregistrer
          </button>
        </>
      ),
    },
    'modal2'
  )
}

/** urgDetail(id) de l'original. */
export function urgDetail(id: string) {
  const db = DB(useApp.getState())
  const u = db.urgences.find((x: Any) => x.id === id)
  if (!u) return
  openDetail({
    coll: 'urgences',
    id,
    title: u.type,
    sub: u.procedure,
    rows: [
      ['Consignes', u.consignes],
      ['Moyens de secours', u.moyens],
      ['Responsables', u.responsables],
      [
        'Sites',
        u.sites.map((x: string, j: number) => (
          <Fragment key={j}>
            {j > 0 ? <br /> : null}
            {x}
          </Fragment>
        )),
      ],
    ],
    extra: (
      <>
        <Block
          title="Risques associés"
          items={u.risques.map((r: string) => {
            const k = db.risques.find((x: Any) => x.id === r)
            return (
              <LinkItem
                key={r}
                title={r + ' · ' + (k ? k.intitule : '')}
                sub={k ? k.type : ''}
                onClick={() => go('m3-risques')}
              />
            )
          })}
        />
        <div className="dsec">
          <div className="card-h">
            <h4 style={{ margin: 0 }}>Exercices de simulation ({u.exercices.length})</h4>
            <button className="btn sm" onClick={() => addExercice(id)}>
              <Icon name="plus" size={13} /> Planifier un exercice
            </button>
          </div>
          {u.exercices.map((e: Any, i: number) => (
            <div key={i} className="card flat" style={{ marginBottom: 8, padding: 12 }}>
              <div className="btn-row" style={{ justifyContent: 'space-between' }}>
                <b>{fd(e.date)}</b>
                <StatusBadge value={exStatut(e)} />
              </div>
              <div className="small" style={{ marginTop: 4 }}>
                {e.scenario}
                <br />
                <span className="muted">
                  Participants : {e.participants} — Procédure jointe : {e.procedure}
                </span>
              </div>
              {e.statut === 'Réalisé' ? (
                <div className="small" style={{ marginTop: 6 }}>
                  <b>Compte-rendu :</b> {e.compteRendu}
                  <br />
                  <b>Actions :</b> {e.actions}
                </div>
              ) : (
                <button
                  className="btn sm"
                  style={{ marginTop: 8 }}
                  onClick={() => crExercice(id, i)}
                >
                  Enregistrer le compte-rendu
                </button>
              )}
            </div>
          ))}
        </div>
      </>
    ),
    obs: true,
  })
}

export function UrgencesPage() {
  const db = useApp((s) => s.db) as Any
  const U: Any[] = db.urgences
  const late: string[] = []
  U.forEach((u) =>
    u.exercices.forEach((e: Any) => {
      if (e.statut === 'En retard' || (e.statut === 'Planifié' && (days(e.date) as number) < 0))
        late.push(u.type)
    })
  )
  return (
    <>
      <PageHead
        kicker={MOD_FULL.m5}
        title="5.3 Situations d'urgence"
        desc="Fiches par type de situation, liées aux risques et aux sites, exercices de simulation avec compte-rendu et actions correctives."
        actions={
          <button className="btn primary" onClick={() => openForm('urgences')}>
            <Icon name="plus" size={15} /> Créer une fiche
          </button>
        }
      />
      {late.length ? (
        <div className="note warn mb">
          <Icon name="warn" size={15} /> Exercice(s) non réalisé(s) dans les délais :{' '}
          {late.join(', ')}.
        </div>
      ) : null}
      <div className="grid g3">
        {U.filter((u) => !u.obsolete).map((u) => {
          const nx = u.exercices
            .filter((e: Any) => e.statut !== 'Réalisé')
            .sort((a: Any, b: Any) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
          return (
            <div
              key={u.id}
              className="card"
              style={{ cursor: 'pointer' }}
              onClick={() => urgDetail(u.id)}
            >
              <div className="btn-row" style={{ justifyContent: 'space-between' }}>
                <div className="stat-ic">
                  <Icon name="warn" size={18} />
                </div>
                <span className="small muted">{u.exercices.length} exercice(s)</span>
              </div>
              <h3 style={{ fontSize: 15, margin: '10px 0 4px' }}>{u.type}</h3>
              <div className="small muted">{u.procedure}</div>
              <div className="small" style={{ marginTop: 8 }}>
                {u.sites.join(', ')}
              </div>
              <div style={{ marginTop: 8 }}>
                {u.risques.map((r: string, j: number) => (
                  <Fragment key={r + j}>
                    {j > 0 ? ' ' : null}
                    <span className="badge b-grey">{r}</span>
                  </Fragment>
                ))}
              </div>
              <hr className="sep" />
              <div className="small">
                {nx ? (
                  <>
                    Prochain exercice : <b>{fd(nx.date)}</b> <StatusBadge value={exStatut(nx)} />
                  </>
                ) : (
                  'Aucun exercice planifié'
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
