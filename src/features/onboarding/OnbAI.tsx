import { useEffect } from 'react'
import { NormBadges, Progress } from '../../components/ui/badges'
import { Icon } from '../../components/ui/Icon'
import { procName } from '../../lib/lookups'
import { update, useApp } from '../../store/useApp'
import { OnbNav } from './OnbNav'
import { applyAI, DEFAULT_FILES, onbGo, onbOf, runAI, useOnb, type AiProp } from './onbState'

const PHASES = [
  'Import et détection du type de document (OCR)',
  'Structuration : titres, étapes, rôles, enregistrements',
  'Analyse sémantique et identification des processus',
  'Proposition de mapping vers le référentiel',
  'Détection des écarts (gap analysis)',
]

const DECISIONS = ['À revoir', 'Acceptée', 'Modifiée', 'Rejetée']

/** addOnbFiles(fl) de l'original. */
function addOnbFiles(fl: FileList | null) {
  const list = [...(fl ?? [])]
  update((s) => {
    const o = onbOf(s)
    o.files = o.files ?? [...DEFAULT_FILES]
    list.forEach((f) =>
      o.files!.push(`${f.name} (${(f.size / 1048576).toFixed(1).replace('.', ',')} Mo)`)
    )
  })
}

const editProps = (fn: (p: AiProp[]) => void) => update((s) => fn(onbOf(s).props!))

function Idle({ files }: { files: string[] }) {
  return (
    <>
      <div className="file-drop" style={{ padding: 22 }}>
        <Icon name="up" size={28} />
        <div style={{ flex: 1 }}>
          <div className="fname">Glissez vos procédures existantes ici</div>
          <div className="hint">PDF, Word ou scan — jusqu'à 50 Mo au total</div>
        </div>
        <label className="btn">
          Parcourir
          <input type="file" multiple hidden onChange={(e) => addOnbFiles(e.target.files)} />
        </label>
      </div>
      <div className="dsec">
        <h4>Documents prêts à être analysés ({files.length})</h4>
        <div className="linklist">
          {files.map((f, i) => (
            <div key={f + i} className="linkitem" style={{ cursor: 'default' }}>
              <span>
                <Icon name="doc" size={15} /> {f}
              </span>
              <button
                className="btn sm ghost"
                onClick={() => update((s) => void onbOf(s).files!.splice(i, 1))}
              >
                Retirer
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function Running({ aiStep }: { aiStep: number }) {
  return (
    <div className="cfg-list">
      {PHASES.map((p, i) => (
        <div key={p} className="cfg-row">
          {i < aiStep ? (
            <span className="a-ic green" style={{ width: 24, height: 24 }}>
              <Icon name="check" size={14} />
            </span>
          ) : i === aiStep ? (
            <span className="spin"></span>
          ) : (
            <span
              className="a-ic"
              style={{ width: 24, height: 24, background: 'var(--surface-2)' }}
            ></span>
          )}
          <span>{p}</span>
        </div>
      ))}
    </div>
  )
}

function Review({ P, applied }: { P: AiProp[]; applied: boolean }) {
  const conf = Math.round(P.reduce((a, p) => a + p.conf, 0) / P.length)
  const decided = P.every((p) => p.dec !== 'À revoir')
  return (
    <>
      <div className="metric-row">
        <div className="metric">
          <b>{P.filter((p) => p.kind === 'Procédure').length}</b>
          <span>procédures détectées</span>
        </div>
        <div className="metric">
          <b>{P.reduce((a, p) => a + p.ex, 0)}</b>
          <span>exigences mappées</span>
        </div>
        <div className="metric">
          <b>{conf} %</b>
          <span>score de confiance moyen</span>
        </div>
      </div>
      <div className="note warn mb">
        Revue humaine obligatoire : acceptez, modifiez ou rejetez chaque proposition avant
        application. L'IA propose, elle ne décide jamais.
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Proposition de l'IA</th>
              <th>Processus / cible</th>
              <th>Exigences</th>
              <th>Confiance</th>
              <th>Extrait source</th>
              <th>Décision</th>
            </tr>
          </thead>
          <tbody>
            {P.map((p, i) => (
              <tr key={p.t}>
                <td>
                  <b>{p.t}</b>
                  <br />
                  <span className="ref">
                    {p.kind} — {p.src}
                  </span>
                </td>
                <td>{procName(p.proc)}</td>
                <td>
                  <NormBadges norms={p.normes} />
                  <br />
                  <span className="small muted">{p.arts}</span>
                </td>
                <td>
                  <Progress value={p.conf} warnBelow={75} badBelow={55} />
                </td>
                <td className="small muted" style={{ maxWidth: 220 }}>
                  « {p.extrait} »
                </td>
                <td>
                  <select
                    className="sel"
                    value={p.dec}
                    onChange={(e) => editProps((l) => void (l[i].dec = e.target.value))}
                    aria-label="Décision"
                  >
                    {DECISIONS.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {applied ? (
        <div className="note ok" style={{ marginTop: 12 }}>
          {P.filter((p) => p.dec !== 'Rejetée').length} proposition(s) appliquée(s). Chaque champ
          créé est marqué « proposition IA validée » et les documents sources sont rattachés comme
          preuves. Retour arrière possible depuis le journal.
        </div>
      ) : (
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button
            className="btn"
            onClick={() =>
              editProps((l) => l.forEach((p) => p.dec === 'À revoir' && (p.dec = 'Acceptée')))
            }
          >
            Tout accepter
          </button>
          <button className="btn primary" disabled={!decided} onClick={applyAI}>
            <Icon name="check" size={15} /> Appliquer les décisions
          </button>
          {decided ? null : (
            <span className="small muted">Statuez sur chaque ligne pour appliquer.</span>
          )}
        </div>
      )}
    </>
  )
}

/** Étape 5 : auto-configuration IA facultative (onbAI de l'original). */
export function OnbAI() {
  const onb = useOnb()
  // « skipped » sans propositions : l'original planterait (P null) ; on réaffiche l'import
  const st = !onb.ai || (onb.ai === 'skipped' && !onb.props) ? 'idle' : onb.ai
  // S.onb.files || (S.onb.files = […]) : liste initialisée à l'affichage
  useEffect(() => {
    if (!onbOf(useApp.getState()).files) update((s) => void (onbOf(s).files = [...DEFAULT_FILES]))
  }, [])
  const files = onb.files ?? DEFAULT_FILES

  const body =
    st === 'running' ? (
      <Running aiStep={onb.aiStep ?? 0} />
    ) : st === 'idle' || !onb.props ? (
      <Idle files={files} />
    ) : (
      <Review P={onb.props} applied={st === 'applied'} />
    )

  return (
    <>
      <div className="page-kicker">Étape 5 sur 8 — facultative</div>
      <h2>Auto-configuration IA</h2>
      <p className="lead">
        Importez vos procédures existantes : la plateforme les analyse, détecte les procédures et
        propose un mapping vers les exigences des normes choisies.
      </p>
      {body}
      <OnbNav
        prev
        next={st === 'idle' ? runAI : st === 'applied' ? () => onbGo(1) : null}
        nextLbl={st === 'idle' ? "Lancer l'analyse" : 'Continuer'}
        extra={
          st === 'applied' ? null : (
            <button
              className="btn ghost"
              onClick={() => {
                update((s) => void (onbOf(s).ai = 'skipped'))
                onbGo(1)
              }}
            >
              Passer cette étape
            </button>
          )
        }
      />
    </>
  )
}
