import { DataTable } from '../../components/data/DataTable'
import { NormBadges, Progress, StatusBadge } from '../../components/ui/badges'
import { Icon } from '../../components/ui/Icon'
import { PageHead } from '../../components/ui/PageHead'
import { MOD_FULL } from '../../data/referentiels'
import { openForm } from '../../forms/crud'
import { FormRenderer } from '../../forms/FormRenderer'
import { readForm } from '../../forms/formControllers'
import type { FieldDef } from '../../forms/types'
import { fd, iso, TODAY } from '../../lib/dates'
import { printDoc } from '../../services/exports'
import { logAct, update, useApp } from '../../store/useApp'
import { closeModal, openModal, toast } from '../../store/useOverlays'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

const POL_F: FieldDef[] = [
  { k: 'resume', l: 'Résumé de la politique', t: 'textarea', req: 1 },
  { k: 'orientations', l: 'Orientations (une par ligne)', t: 'textarea', req: 1 },
  { k: 'signataire', l: 'Signataire', req: 1 },
  { k: 'date', l: 'Date de publication', t: 'date', req: 1 },
]

/** editPolitique() : nouvelle version de la politique, accusés réinitialisés. */
function editPolitique() {
  const p = useApp.getState().db.politique
  const publish = () => {
    const d = readForm('polf')
    if (d) {
      update((s) => {
        Object.assign(s.db.politique, d, {
          version: 'v' + (parseInt(s.db.politique.version.slice(1)) + 1),
          statut: 'Publiée',
        })
        s.db.accuses.forEach((a) => {
          a.statut = 'Non lu'
          a.date = '—'
        })
        logAct(s, 'a publié la politique SM ' + s.db.politique.version, 'Politique SM')
      })
      closeModal()
      toast('Politique publiée : accusés de lecture réinitialisés.')
    }
  }
  openModal({
    title: 'Rédiger la politique SM',
    sub: 'Une nouvelle version sera créée ; la précédente reste consultable.',
    wide: true,
    body: (
      <div id="polf">
        <FormRenderer formId="polf" fields={POL_F} rec={{ ...p, date: iso(TODAY) }} />
      </div>
    ),
    foot: (
      <>
        <button className="btn" onClick={() => closeModal()}>
          Annuler
        </button>
        <button className="btn primary" onClick={publish}>
          <Icon name="send" size={15} /> Publier
        </button>
      </>
    ),
  })
}

/** PAGES['m2-politique'] */
export function PolitiquePage() {
  const p = useApp((s) => s.db.politique)
  const accuses = useApp((s) => s.db.accuses)
  const preuvesCom = useApp((s) => s.db.preuvesCom) as Any[]
  const activeNorms = useApp((s) => s.activeNorms)
  const lus = accuses.filter((a) => a.statut === 'Lu').length
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
    update((s) => logAct(s, 'a relancé les lecteurs de la politique', 'Politique SM'))
    toast(
      'Relance envoyée à ' +
        accuses.filter((a) => a.statut === 'Non lu').length +
        ' collaborateur(s).'
    )
  }
  return (
    <>
      <PageHead
        kicker={MOD_FULL.m2}
        title="2.2 Politique SM"
        desc="Politique du système de management, preuves de communication et accusé de diffusion."
        actions={
          <button className="btn primary" onClick={editPolitique}>
            <Icon name="edit" size={15} /> Rédiger une nouvelle version
          </button>
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
          </div>
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
        />
      </div>
    </>
  )
}
