import { useMemo } from 'react'
import { DataTable } from '../../components/data/DataTable'
import { NormBadges, Progress, StatusBadge } from '../../components/ui/badges'
import { Icon } from '../../components/ui/Icon'
import { PageHead } from '../../components/ui/PageHead'
import { MOD_FULL } from '../../data/referentiels'
import { openForm } from '../../forms/crud'
import { fd } from '../../lib/dates'
import { API_MODE } from '../../services/api'
import { printDoc } from '../../services/exports'
import { acknowledgePolicy, act } from '../../services/session'
import { logAct, update, useApp } from '../../store/useApp'
import { toast } from '../../store/useOverlays'
import { diffuserNoyau } from './diffusion'
import { editPolitique, regenPolResume } from './politiqueActions'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

/** PAGES['m2-politique'] */
export function PolitiquePage() {
  const p = useApp((s) => s.db.politique)
  const accuses = useApp((s) => s.db.accuses)
  const preuvesCom = useApp((s) => s.db.preuvesCom) as Any[]
  const activeNorms = useApp((s) => s.activeNorms)
  const diffusions = useApp((s) => (s.db as Any).diffusions) as Any[] | undefined
  const diffs = useMemo(
    () => (diffusions || []).filter((x) => /Politique/.test(x.doc)),
    [diffusions]
  )
  const lus = accuses.filter((a) => a.statut === 'Lu').length
  // Mode API : l'utilisateur connecté accuse lui-même lecture (action du serveur).
  const me = useApp((s) => s.users.find((u) => u.id === s.session?.userId))
  const monAccuse = me ? accuses.find((a) => a.collaborateur === me.nom) : undefined
  const peutAccuser = API_MODE && !!me && monAccuse?.statut !== 'Lu'
  const accuser = () =>
    acknowledgePolicy().then(
      () => toast('Lecture de la politique ' + p.version + ' enregistrée.'),
      (e: Error) => toast('Accusé de lecture non enregistré : ' + e.message, 'warn')
    )
  const genAccuse = () =>
    printDoc(
      `Accusé de diffusion — politique SM ${p.version}`,
      '<table><tr><th>Collaborateur</th><th>Statut</th><th>Date de lecture</th></tr>' +
        accuses
          .map(
            (a) =>
              '<tr><td>' +
              a.collaborateur +
              '</td><td>' +
              a.statut +
              '</td><td>' +
              a.date +
              '</td></tr>'
          )
          .join('') +
        '</table>'
    )
  const relancer = () => {
    const local = () =>
      update((s) => logAct(s, 'a relancé les lecteurs de la politique', 'Politique SM'))
    act<{ relances: number }>('/accuses/relancer/', undefined, local, (r) =>
      toast(
        'Relance envoyée à ' +
          (r ? r.relances : accuses.filter((a) => a.statut === 'Non lu').length) +
          ' collaborateur(s).'
      )
    )
  }
  return (
    <>
      <PageHead
        kicker={MOD_FULL.m2}
        title="2.2 Politique SM"
        desc="Politique du système de management, preuves de communication et accusé de diffusion."
        actions={
          <>
            <button className="btn" onClick={() => diffuserNoyau(`Politique SM ${p.version}`)}>
              <Icon name="send" size={15} /> Diffuser
            </button>
            <button className="btn primary" onClick={editPolitique}>
              <Icon name="edit" size={15} /> Rédiger une nouvelle version
            </button>
          </>
        }
      />
      <div className="grid g-side mb">
        <div className="card">
          <div className="card-h">
            <div>
              <h3>Politique du système de management intégré</h3>
              <div className="sub">
                {p.version} — publiée le {fd(p.date)} — {p.signataire}
              </div>
            </div>
            <StatusBadge value={p.statut} />
          </div>
          <div className="btn-row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="badge b-violet">
              <Icon name="ai" size={12} /> Résumé généré par l'IA
            </span>
            <button className="btn sm ghost" onClick={regenPolResume}>
              <Icon name="refresh" size={12} /> Régénérer
            </button>
          </div>
          <p style={{ maxWidth: '75ch' }}>{p.resume}</p>
          <ol style={{ paddingLeft: 18, maxWidth: '75ch' }}>
            {p.orientations.split('\n').map((o, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                {o.replace(/^\d+\.\s*/, '')}
              </li>
            ))}
          </ol>
          <div>
            <NormBadges norms={activeNorms} />
          </div>
        </div>
        <div className="card">
          <div className="card-h">
            <div>
              <h3>Accusé de diffusion</h3>
              <div className="sub">
                {lus} lecture(s) sur {accuses.length}
              </div>
            </div>
          </div>
          <Progress value={(lus / accuses.length) * 100} />
          <div style={{ marginTop: 10 }}>
            {accuses.map((a) => (
              <div
                key={a.id}
                className="btn-row"
                style={{
                  justifyContent: 'space-between',
                  padding: '5px 0',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                <span className="small">{a.collaborateur}</span>
                <span>
                  <StatusBadge value={a.statut} />{' '}
                  <span className="small muted">{a.date === '—' ? '' : fd(a.date)}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn sm" onClick={genAccuse}>
              <Icon name="doc" size={14} /> Générer l'accusé
            </button>
            <button className="btn sm" onClick={relancer}>
              Relancer les non-lus
            </button>
            {peutAccuser ? (
              <button className="btn sm primary" onClick={accuser}>
                <Icon name="check" size={14} /> J'accuse lecture
              </button>
            ) : null}
          </div>
          {diffs.length ? (
            <div className="dsec" style={{ marginTop: 12 }}>
              <h4 style={{ fontSize: 13 }}>Historique de diffusion</h4>
              {diffs.slice(0, 4).map((x, i) => (
                <div
                  key={i}
                  className="small"
                  style={{ padding: '5px 0', borderTop: '1px solid var(--line)' }}
                >
                  {x.d} —{' '}
                  <b>{x.canal === 'interne' ? 'Interne — dépôt direct' : 'Externe — email'}</b> →{' '}
                  {x.destinataires}
                  {x.canal === 'externe' ? ' · ' + x.piece : ''}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="card">
        <div className="card-h">
          <h3>Preuves de communication</h3>
        </div>
        <DataTable
          id="pc"
          cols={[
            { l: 'Objet', r: (x) => <span className="ttl">{x.objet}</span> },
            { l: 'Date', r: (x) => fd(x.date) },
            { l: 'Support', k: 'support' },
            { l: 'Lieu ou canal', k: 'lieu' },
            { l: 'Personnes touchées', k: 'personnes', cls: 'num' },
            {
              l: 'Preuve',
              r: (x) => (
                <>
                  <Icon name="doc" size={14} /> {x.preuve}
                </>
              ),
            },
          ]}
          rows={preuvesCom}
          onRowClick={(i) => openForm('preuvesCom', i)}
          norm={false}
          onAdd={() => openForm('preuvesCom')}
          addLabel="Associer une preuve"
          exportName="Preuves_communication_politique"
          collection="preuvesCom"
        />
      </div>
    </>
  )
}
