/** 5.1 GED — fiche document, circuit de validation, versions et diffusion (original l.1564-1581). */
import { useState, type ReactNode } from 'react'
import { openDetail } from '../../components/data/Detail'
import { DueDate, NormBadges, StatusBadge, Workflow } from '../../components/ui/badges'
import { Icon } from '../../components/ui/Icon'
import { FormRenderer } from '../../forms/FormRenderer'
import { readForm } from '../../forms/formControllers'
import type { FieldDef } from '../../forms/types'
import { TODAY, fd, iso } from '../../lib/dates'
import { procName } from '../../lib/lookups'
import { currentUser, hist, logAct, update, useApp } from '../../store/useApp'
import { closeModal, openModal, toast } from '../../store/useOverlays'
import { DB, type Any } from '../m6-performance/shared'

const findDoc = (id: string): Any => DB(useApp.getState()).documents.find((x: Any) => x.id === id)

/** docAct(id, a) de l'original. */
export function docAct(id: string, a: string) {
  let refus: string | null = null
  if (a === 'refuse') {
    refus = prompt(
      "Motif du refus (renvoyé à l'auteur) :",
      'Préciser les responsabilités et les enregistrements associés'
    )
    if (refus === null) return
  }
  let msg = ''
  let ref = ''
  update((s) => {
    const d = DB(s).documents.find((x: Any) => x.id === id)
    if (a === 'submit') {
      d.statut = 'Vérification'
      msg = 'soumis à vérification — vérificateur notifié'
    }
    if (a === 'verify') {
      d.statut = 'Approbation'
      msg = 'vérifié — approbateur notifié'
    }
    if (a === 'approve') {
      d.statut = 'Diffusé'
      d.version = d.versions.at(-1).v
      d.accuses = 0
      msg = 'approuvé et diffusé ; la version précédente est archivée'
    }
    if (a === 'refuse') {
      d.statut = 'Rédaction'
      d.refus = refus
      msg = "refusé et renvoyé à l'auteur — motif : " + refus
    }
    ref = d.ref
    hist(s, d, 'Document ' + msg)
    logAct(s, `a ${msg.split(' ')[0]} le document ${d.ref}`, 'GED', d.statut)
  })
  toast(`${ref} ${msg}.`)
  docDetail(id)
}

const NV_F: FieldDef[] = [
  { k: 'contenu', l: 'Contenu de la nouvelle version', t: 'textarea', req: 1 },
  { k: 'motif', l: 'Motif de la modification', req: 1, full: 1 },
]

/** newVersion(id) de l'original. */
export function newVersion(id: string) {
  const d = findDoc(id)
  const last = d.versions.at(-1)
  openModal({
    title: 'Ouvrir une nouvelle version — ' + d.ref,
    sub: "La version diffusée reste en vigueur jusqu'à l'approbation de la nouvelle.",
    body: (
      <div id="nvf">
        <FormRenderer
          formId="nvf"
          fields={NV_F}
          rec={{
            contenu:
              last.contenu + '\nAjout : revue annuelle obligatoire par le pilote du processus.',
            motif: 'Mise à jour après la revue documentaire 2026',
          }}
        />
      </div>
    ),
    foot: (
      <>
        <button className="btn" onClick={() => closeModal()}>
          Annuler
        </button>
        <button
          className="btn primary"
          onClick={() => {
            const x = readForm('nvf')
            if (!x) return
            update((s) => {
              const d = DB(s).documents.find((y: Any) => y.id === id)
              const v = String(parseInt(d.versions.at(-1).v) + 1)
              d.versions.push({
                v,
                date: iso(TODAY),
                auteur: currentUser(s).nom,
                contenu: x.contenu,
              })
              d.statut = 'Rédaction'
              hist(s, d, 'Version ' + v + ' ouverte : ' + x.motif)
              logAct(s, 'a ouvert la version ' + v + ' de ' + d.ref, 'GED', 'Brouillon')
            })
            closeModal()
            docDetail(id)
          }}
        >
          Créer la version
        </button>
      </>
    ),
  })
}

/** diffHTML(a, b) de l'original. */
function Diff({ a, b }: { a: string; b: string }) {
  const A = a.split('\n'),
    B = b.split('\n')
  return (
    <>
      {A.filter((l) => !B.includes(l)).map((l, i) => (
        <div key={'d' + i} className="diff-del">
          − {l}
        </div>
      ))}
      {B.map((l, i) =>
        A.includes(l) ? (
          <div key={'b' + i}>{'  ' + l}</div>
        ) : (
          <div key={'b' + i} className="diff-add">
            + {l}
          </div>
        )
      )}
    </>
  )
}

function CompareBody({ doc }: { doc: Any }) {
  const [va, setVa] = useState<string>(doc.versions.at(-2).v)
  const [vb, setVb] = useState<string>(doc.versions.at(-1).v)
  const a = doc.versions.find((v: Any) => v.v === va),
    b = doc.versions.find((v: Any) => v.v === vb)
  const opt = doc.versions.map((v: Any) => (
    <option key={v.v} value={v.v}>
      Version {v.v} — {fd(v.date)}
    </option>
  ))
  return (
    <>
      <div className="btn-row mb">
        <select className="sel" id="va" value={va} onChange={(e) => setVa(e.target.value)}>
          {opt}
        </select>
        <Icon name="arrow" size={15} />
        <select className="sel" id="vb" value={vb} onChange={(e) => setVb(e.target.value)}>
          {opt}
        </select>
      </div>
      <div
        className="doc-preview"
        id="diff"
        style={{ fontFamily: 'ui-monospace,monospace', fontSize: '12.5px' }}
      >
        <Diff a={a.contenu} b={b.contenu} />
      </div>
      <div className="legend" style={{ marginTop: 8 }}>
        <span>
          <i style={{ background: '#DDF1E4' }}></i>Ajouté
        </span>
        <span>
          <i style={{ background: '#F8DEDA' }}></i>Supprimé
        </span>
      </div>
    </>
  )
}

/** compareDoc(id) de l'original. */
export function compareDoc(id: string) {
  const d = findDoc(id)
  if (d.versions.length < 2) {
    toast('Une seule version existe pour ce document.', 'warn')
    return
  }
  openModal(
    { title: 'Comparer deux versions — ' + d.ref, wide: true, body: <CompareBody doc={d} /> },
    'modal2'
  )
}

const DF_F: FieldDef[] = [
  { k: 'diffusion', l: 'Liste de diffusion', req: 1, full: 1 },
  { k: 'accuse', l: 'Exiger un accusé de lecture', t: 'toggle', lbl: 'Oui' },
]

/** diffuser(id) de l'original. */
export function diffuser(id: string) {
  const d = findDoc(id)
  openModal(
    {
      title: 'Diffusion contrôlée — ' + d.ref,
      body: (
        <div id="dff">
          <FormRenderer formId="dff" fields={DF_F} rec={{ diffusion: d.diffusion, accuse: true }} />
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
              const x = readForm('dff')
              if (!x) return
              update((s) => {
                const d = DB(s).documents.find((y: Any) => y.id === id)
                d.diffusion = x.diffusion
                d.accuses = 0
                hist(s, d, 'Diffusé à : ' + x.diffusion)
                logAct(s, 'a diffusé ' + d.ref, 'GED')
              })
              closeModal('modal2')
              toast('Diffusion envoyée, accusés de lecture attendus.')
              docDetail(id)
            }}
          >
            <Icon name="send" size={15} /> Diffuser
          </button>
        </>
      ),
    },
    'modal2'
  )
}

/** docDetail(id) de l'original. */
export function docDetail(id: string) {
  const d = findDoc(id)
  if (!d) return
  const idx = (
    { Rédaction: 0, Vérification: 1, Approbation: 2, Diffusé: 4, Refusé: 0, Obsolète: 4 } as Record<
      string,
      number
    >
  )[d.statut]
  const acts =
    (
      {
        Rédaction: (
          <button className="btn primary" onClick={() => docAct(id, 'submit')}>
            <Icon name="send" size={15} /> Soumettre à vérification
          </button>
        ),
        Vérification: (
          <>
            <button className="btn danger" onClick={() => docAct(id, 'refuse')}>
              Refuser
            </button>
            <button className="btn primary" onClick={() => docAct(id, 'verify')}>
              Valider la vérification
            </button>
          </>
        ),
        Approbation: (
          <>
            <button className="btn danger" onClick={() => docAct(id, 'refuse')}>
              Refuser
            </button>
            <button className="btn primary" onClick={() => docAct(id, 'approve')}>
              <Icon name="check" size={15} /> Approuver et diffuser
            </button>
          </>
        ),
        Diffusé: (
          <>
            <button className="btn" onClick={() => diffuser(id)}>
              Diffusion contrôlée
            </button>
            <button className="btn primary" onClick={() => newVersion(id)}>
              Nouvelle version
            </button>
          </>
        ),
      } as Record<string, ReactNode>
    )[d.statut] || null
  const versions: Any[] = d.versions.slice().reverse()
  openDetail({
    coll: 'documents',
    id,
    title: d.ref + ' · ' + d.intitule,
    sub: d.type + ' — version ' + d.versions.at(-1).v,
    rows: [
      [
        'Workflow',
        <>
          <Workflow
            steps={['Rédaction', 'Vérification', 'Approbation', 'Diffusion']}
            current={idx}
          />
          {d.refus && d.statut === 'Rédaction' ? (
            <div className="note warn">Refus précédent : {d.refus}</div>
          ) : null}
        </>,
      ],
      ['Statut', <StatusBadge value={d.statut} />],
      ['Propriétaire', d.proprietaire],
      ['Processus', procName(d.processus)],
      ['Normes', <NormBadges norms={d.normes} />],
      ['Créé le', fd(d.dateCreation)],
      ['Date de version', fd(d.dateVersion || (d.versions && d.versions.at(-1).date))],
      ['Rédacteur', d.redacteur || (d.versions && d.versions.at(-1).auteur) || '—'],
      ['Approbateur', d.approbateur || '—'],
      ['Prochaine revue', <DueDate date={d.dateRevue} done={d.statut === 'Obsolète'} />],
      ["Droits d'accès", d.droits],
      ['Diffusion', d.diffusion],
    ],
    extra: (
      <div className="dsec">
        <div className="card-h">
          <h4 style={{ margin: 0 }}>Versions ({d.versions.length})</h4>
          <button className="btn sm" onClick={() => compareDoc(id)}>
            Comparer deux versions
          </button>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Version</th>
                <th>Date</th>
                <th>Auteur</th>
                <th>État</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v, i) => (
                <tr key={v.v + '-' + i}>
                  <td>v{v.v}</td>
                  <td>{fd(v.date)}</td>
                  <td>{v.auteur}</td>
                  <td>
                    {i === 0 ? (
                      <StatusBadge value={d.statut} />
                    ) : (
                      <span className="badge dot b-grey">Archivée</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="doc-preview" style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>
          {d.versions.at(-1).contenu}
        </div>
      </div>
    ),
    obs: d.statut !== 'Obsolète',
    acts,
  })
}
