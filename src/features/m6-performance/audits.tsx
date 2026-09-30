/** 6.2 Audits — formulaires, circuit de l'audit et fiche (original l.1632-1644). */
import type { ReactNode } from 'react'
import { openDetail } from '../../components/data/Detail'
import { NormBadges, StatusBadge, Workflow } from '../../components/ui/badges'
import { Icon } from '../../components/ui/Icon'
import { NORMS, type NormId } from '../../data/referentiels'
import { FormRenderer } from '../../forms/FormRenderer'
import { readForm } from '../../forms/formControllers'
import type { FieldDef, FormDef } from '../../forms/types'
import { days, fd } from '../../lib/dates'
import { procName, procOpts, procShort } from '../../lib/lookups'
import { API_MODE } from '../../services/api'
import { printDoc, serverDownload } from '../../services/exports'
import { procOwner } from '../../services/metrics'
import { hist, logAct, update, useApp } from '../../store/useApp'
import { closeModal, openModal, toast } from '../../store/useOverlays'
import { addRegistre } from '../../services/registre'
import { act, seg } from '../../services/session'
import { DB, esc, type Any } from './shared'

export const AUD_ST = ['Planifié', 'Plan diffusé', 'En cours', 'Rapport déposé', 'Clôturé']
const auditeursNoms = () => DB(useApp.getState()).auditeurs.map((a: Any) => a.nom)

export const auditsForms: Record<string, FormDef> = {
  audits: {
    title: 'Audit',
    prefix: 'A',
    label: 'titre',
    mod: 'Audits',
    fields: [
      { k: 'ref', l: 'Référence', req: 1 },
      { k: 'titre', l: 'Intitulé', req: 1 },
      { k: 'date', l: 'Date', t: 'date', req: 1 },
      { k: 'perimetre', l: 'Périmètre (processus)', t: 'select', o: procOpts },
      {
        k: 'auditeur',
        l: 'Auditeur',
        t: 'select',
        o: auditeursNoms,
        check: (v, o) => {
          const a = DB(useApp.getState()).auditeurs.find((x: Any) => x.nom === v)
          return !(a && a.independance.includes(o.perimetre))
        },
        err: 'Auditeur non indépendant de ce processus : choisissez-en un autre.',
      },
      { k: 'normes', l: 'Normes auditées (grille fusionnée)', t: 'norms', req: 1 },
    ],
    def: () => ({
      ref: 'AUD-2027-01',
      titre: 'Audit processus Commercialisation & export',
      date: '2027-02-10',
      perimetre: 'P06',
      auditeur: 'Nadège ZINSOU',
      normes: ['9001', '27001'],
      statut: 'Planifié',
      rapport: '—',
      constats: [],
    }),
    save: (_s, _r, n) => {
      if (n) return "Audit ajouté au plan annuel — alerte programmée à J-60 pour l'auditeur."
    },
  },
  auditeurs: {
    title: 'Auditeur',
    prefix: 'AU',
    label: 'nom',
    mod: 'Audits',
    fields: [
      { k: 'nom', l: 'Nom', req: 1 },
      { k: 'qualification', l: 'Qualification', req: 1 },
      { k: 'normes', l: 'Normes maîtrisées', t: 'norms', req: 1 },
      { k: 'disponibilite', l: 'Disponibilité', req: 1 },
      { k: 'independance', l: "Restriction d'indépendance", req: 1, full: 1 },
    ],
    def: () => ({
      nom: 'Hervé DJOSSOU',
      qualification: 'Auditeur interne ISO 27001 (formation 2026)',
      normes: ['27001'],
      disponibilite: 'Disponible au 1er semestre 2027',
      independance: 'Ne peut pas auditer P10',
    }),
  },
}

const CONST_F: FieldDef[] = [
  {
    k: 'type',
    l: 'Type de constat',
    t: 'select',
    o: ['NC majeure', 'NC mineure', 'Observation', 'Point fort'],
  },
  { k: 'processus', l: 'Processus', t: 'select', o: procOpts },
  { k: 'description', l: 'Description', t: 'textarea', req: 1 },
]
const AR_F: FieldDef[] = [
  { k: 'rapport', l: "Rapport d'audit", t: 'file', req: 1 },
  { k: 'compteRendu', l: 'Compte-rendu de la réunion de clôture', t: 'textarea', req: 1 },
]

const findA = (id: string): Any => DB(useApp.getState()).audits.find((y: Any) => y.id === id)

/** audAct(id, a) de l'original. */
export function audAct(id: string, a: 'diff' | 'start' | 'alert') {
  let msg = ''
  const local = () =>
    update((s) => {
      const x = DB(s).audits.find((y: Any) => y.id === id)
      const m = {
        diff: ['Plan diffusé', "Plan d'audit diffusé aux audités et à l'auditeur"],
        start: ['En cours', 'Audit démarré'],
        alert: [x.statut, 'Alerte envoyée à ' + x.auditeur],
      }[a]
      x.statut = m[0]
      hist(s, x, m[1])
      logAct(s, m[1] + ' (' + x.ref + ')', 'Audits')
      msg = m[1]
    })
  const route = { diff: 'diffuser', start: 'demarrer', alert: 'alerter' }[a]
  act<Any>(`/audits/${seg(id)}/${route}/`, undefined, local, (r) => {
    if (r)
      msg = a === 'alert' ? 'Alerte envoyée à ' + r.auditeur : `${r.ref} : statut « ${r.statut} »`
    toast(msg + '.')
    audDetail(id)
  })
}

/** audReport(id) de l'original. */
export function audReport(id: string) {
  const x = findA(id)
  openModal(
    {
      title: 'Déposer le rapport — ' + x.ref,
      body: (
        <div id="arf">
          <FormRenderer
            formId="arf"
            fields={AR_F}
            rec={{
              rapport: 'Rapport_' + x.ref + '.pdf',
              compteRendu: 'Réunion de clôture tenue avec le pilote ; constats acceptés.',
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
              const d = readForm('arf')
              if (!d) return
              const local = () =>
                update((s) => {
                  const x = DB(s).audits.find((y: Any) => y.id === id)
                  x.rapport = d.rapport
                  x.compteRendu = d.compteRendu
                  x.statut = 'Rapport déposé'
                  hist(s, x, 'Rapport déposé')
                  logAct(s, 'a déposé le rapport ' + x.ref, 'Audits')
                })
              const body = { rapport: d.rapport, compteRendu: d.compteRendu }
              act(`/audits/${seg(id)}/rapport/`, body, local, () => {
                closeModal('modal2')
                audDetail(id)
              })
            }}
          >
            Déposer
          </button>
        </>
      ),
    },
    'modal2'
  )
}

/** addConstat(id) de l'original. */
export function addConstat(id: string) {
  const x = findA(id)
  openModal(
    {
      title: 'Ajouter un constat — ' + x.ref,
      body: (
        <div id="csf">
          <FormRenderer
            formId="csf"
            fields={CONST_F}
            rec={{
              type: 'NC mineure',
              processus: x.perimetre,
              description: 'Enregistrements de contrôle non signés sur 3 jours',
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
              const d = readForm('csf')
              if (!d) return
              const local = () =>
                update((s) => {
                  DB(s)
                    .audits.find((y: Any) => y.id === id)
                    .constats.push(d)
                })
              const body = {
                type: d.type,
                processus: d.processus ?? '',
                description: d.description,
              }
              act(`/audits/${seg(id)}/constats/`, body, local, () => {
                closeModal('modal2')
                audDetail(id)
              })
            }}
          >
            Ajouter
          </button>
        </>
      ),
    },
    'modal2'
  )
}

/** audClose(id) de l'original. */
export function audClose(id: string) {
  let n = 0
  const prevus = findA(id).constats.filter((c: Any) => c.type !== 'Point fort').length
  const local = () =>
    update((s) => {
      const x = DB(s).audits.find((y: Any) => y.id === id)
      x.constats
        .filter((c: Any) => c.type !== 'Point fort')
        .forEach((c: Any) => {
          addRegistre(
            s,
            c.type.startsWith('NC') ? 'Non-conformité' : 'Observation',
            c.description,
            'Audit ' + x.ref,
            c.processus,
            x.normes,
            procOwner(s.db, c.processus)
          )
          n++
        })
      x.statut = 'Clôturé'
      hist(s, x, 'Audit clôturé — ' + n + ' action(s) enregistrée(s) au registre')
      logAct(s, 'a clôturé ' + x.ref + ' (' + n + ' action(s) au registre)', 'Audits')
    })
  act(`/audits/${seg(id)}/cloturer/`, undefined, local, (r) => {
    if (r) n = prevus
    toast(n + " action(s) enregistrée(s) automatiquement dans le registre d'amélioration continue.")
    closeModal('drawer')
  })
}

/** audDetail(id) de l'original. */
export function audDetail(id: string) {
  const db = DB(useApp.getState())
  const x = db.audits.find((y: Any) => y.id === id)
  if (!x) return
  const idx = AUD_ST.indexOf(x.statut)
  const d = days(x.date) as number
  const statusActs = (
    {
      Planifié: (
        <>
          <button className="btn" onClick={() => audAct(id, 'alert')}>
            <Icon name="bell" size={15} /> Alerter l'auditeur
          </button>
          <button className="btn primary" onClick={() => audAct(id, 'diff')}>
            <Icon name="send" size={15} /> Diffuser le plan
          </button>
        </>
      ),
      'Plan diffusé': (
        <button className="btn primary" onClick={() => audAct(id, 'start')}>
          Démarrer l'audit
        </button>
      ),
      'En cours': (
        <>
          <button className="btn" onClick={() => addConstat(id)}>
            <Icon name="plus" size={15} /> Ajouter un constat
          </button>
          <button className="btn primary" onClick={() => audReport(id)}>
            <Icon name="up" size={15} /> Déposer le rapport
          </button>
        </>
      ),
      'Rapport déposé': (
        <>
          <button className="btn" onClick={() => addConstat(id)}>
            <Icon name="plus" size={15} /> Ajouter un constat
          </button>
          <button className="btn primary" onClick={() => audClose(id)}>
            <Icon name="check" size={15} /> Clôturer
          </button>
        </>
      ),
      Clôturé: null,
    } as Record<string, ReactNode>
  )[x.statut]
  // Mode API : rapport d'audit PDF produit par le serveur
  const acts = API_MODE ? (
    <>
      <button
        className="btn"
        onClick={() => void serverDownload(`/exports/rapport-audit/${encodeURIComponent(id)}.pdf`)}
      >
        <Icon name="doc" size={15} /> Rapport PDF
      </button>
      {statusActs}
    </>
  ) : (
    statusActs
  )
  openDetail({
    coll: 'audits',
    id,
    title: x.ref + ' · ' + x.titre,
    sub: fd(x.date) + (d > 0 && x.statut !== 'Clôturé' ? ' — J-' + d : ''),
    rows: [
      [
        'Avancement',
        <Workflow key="wf" steps={AUD_ST} current={x.statut === 'Clôturé' ? 5 : idx} />,
      ],
      ['Périmètre', procName(x.perimetre)],
      ['Normes (grille fusionnée)', <NormBadges key="nb" norms={x.normes} />],
      ['Auditeur', x.auditeur],
      ['Rapport', x.rapport],
      [
        'Compte-rendu',
        x.compteRendu ||
          (x.statut === 'Clôturé' ? 'Réunion de clôture tenue, constats acceptés' : '—'),
      ],
    ],
    extra: (
      <>
        <div className="dsec">
          <h4>Grille d'audit générée</h4>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Norme</th>
                  <th>Article</th>
                  <th>Exigence</th>
                </tr>
              </thead>
              <tbody>
                {db.mapping
                  .filter((m: Any) => x.normes.includes(m.norme))
                  .slice(0, 8)
                  .map((m: Any, i: number) => (
                    <tr key={i}>
                      <td>
                        <NormBadges norms={[m.norme]} />
                      </td>
                      <td>§{m.article}</td>
                      <td>{m.libelle}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="dsec">
          <h4>Constats ({x.constats.length})</h4>
          {x.constats.length ? (
            x.constats.map((c: Any, i: number) => (
              <div key={i} className="alert-item">
                <div>
                  <StatusBadge value={c.type} />
                </div>
                <div className="small">
                  {c.description}
                  <br />
                  <span className="muted">{procName(c.processus)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="small muted">Aucun constat saisi.</div>
          )}
        </div>
      </>
    ),
    edit: x.statut !== 'Clôturé',
    acts,
  })
}

/** campaignReport() de l'original. */
export function campaignReport() {
  const A: Any[] = DB(useApp.getState()).audits
  printDoc(
    "Rapport compilé — campagne d'audit 2026",
    `<p>${A.length} audits programmés, ${A.filter((a) => a.statut === 'Clôturé').length} clôturés. ${A.reduce((s, a) => s + a.constats.length, 0)} constats.</p><table><tr><th>Audit</th><th>Date</th><th>Périmètre</th><th>Normes</th><th>Auditeur</th><th>Statut</th><th>Constats</th></tr>${A.map(
      (a) =>
        `<tr><td>${a.ref} ${esc(a.titre)}</td><td>${fd(a.date)}</td><td>${esc(procShort(a.perimetre))}</td><td>${a.normes
          .map((n: NormId) => NORMS[n].code)
          .join(', ')}</td><td>${esc(a.auditeur)}</td><td>${a.statut}</td><td>${
          a.constats.map((c: Any) => c.type + ' : ' + esc(c.description)).join('<br>') || '—'
        }</td></tr>`
    ).join('')}</table>`
  )
}
