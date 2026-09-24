import { useMemo, type ReactNode } from 'react'
import { go } from '../../app/navigation'
import { DataTable } from '../../components/data/DataTable'
import { StatusBadge } from '../../components/ui/badges'
import { Icon } from '../../components/ui/Icon'
import { PageHead } from '../../components/ui/PageHead'
import { ALL_N, NORMS, type NormId } from '../../data/referentiels'
import type { Seed } from '../../data/seed'
import { days, fd, iso, TODAY } from '../../lib/dates'
import { inNorm } from '../../lib/norms'
import { computeAlerts } from '../../services/alerts'
import { currentUser, update, useApp } from '../../store/useApp'
import { toast } from '../../store/useOverlays'
import { CrossView } from './CrossView'
import { coverage, openActions } from '../../services/metrics'
import { journalMods, upcoming, withId } from './dashboardData'

type JournalRow = Seed['journal'][number]

const ALERT_IC = { red: 'warn', blue: 'bell', amber: 'clock' } as const

/** PAGES.dashboard de l'original : vue d'ensemble multi-normes. */
export function DashboardPage() {
  const db = useApp((s) => s.db)
  const norm = useApp((s) => s.ui.norm)
  const activeNorms = useApp((s) => s.activeNorms)
  const chart = useApp((s) => s.ui.chart)
  const chartSel = useApp((s) => s.ui.chartSel)
  const dismissed = useApp((s) => s.ui.dismissed)
  const user = useApp(currentUser)

  const cov = coverage(db, activeNorms, norm)
  const acts = useMemo(() => openActions(db, norm), [db, norm])
  const late = acts.filter((a) => (days(a.echeance) ?? 0) < 0).length
  const ncOpen = db.ncs
    .filter((n) => inNorm(n, norm))
    .filter((n) => !['Clôturée', 'Refusée'].includes(n.statut))
  const tx = db.textes.filter((t) => inNorm(t, norm))
  const txOk = tx.length
    ? Math.round((tx.filter((t) => t.statut === 'Fait').length / tx.length) * 100)
    : 0
  const al = useMemo(() => computeAlerts(db, dismissed), [db, dismissed])
  const ch = chart === 'mois' ? db.cloturesMois : db.cloturesAn
  const max = Math.max(...ch.clotures, ...ch.ouvertures)
  const top = Math.ceil(max / 5) * 5 + 5
  const ech = useMemo(() => upcoming(db), [db])

  const desc = `Synthèse du système de management au ${fd(iso(TODAY))} — ${
    norm === 'all'
      ? 'tous référentiels confondus'
      : norm === 'cross'
        ? 'vue croisée des exigences communes et spécifiques'
        : NORMS[norm].code + ' uniquement'
  }.`

  return (
    <>
      <PageHead
        kicker="Vue d'ensemble multi-normes"
        title={'Bonjour ' + user.nom.split(' ')[0]}
        desc={desc}
        actions={
          <>
            <select className="sel" aria-label="Période">
              <option>Ce trimestre</option>
              <option>Ce mois</option>
              <option>Cette année</option>
            </select>
            <button
              className="btn"
              onClick={() => {
                update((s) => {
                  s.ui.norm = 'all'
                  s.ui.chart = 'mois'
                })
                toast('Données actualisées.')
              }}
            >
              <Icon name="refresh" size={15} /> Actualiser
            </button>
          </>
        }
      />
      <div className="grid g-dash mb">
        <div className="card stat hero">
          <div className="stat-top">
            <div className="stat-ic">
              <Icon name="cover" size={19} />
            </div>
            <div>
              <h4>Couverture normative</h4>
              <div className="lbl">Exigences démontrées par une preuve</div>
            </div>
          </div>
          <div className="btn-row">
            <span className="val">{cov} %</span>
            <span className="chip-up">+6 pts ce trimestre</span>
          </div>
          <button className="foot" onClick={() => go('cover')}>
            Voir le détail par exigence <Icon name="arrow" size={15} />
          </button>
        </div>
        <StatCard
          icon="clock"
          title="Actions en cours"
          lbl="Objectifs et traitements de risques"
          val={acts.length}
          badge={<span className="badge b-red">{late} en retard</span>}
          foot="Voir le planning"
          page="m3-objectifs"
        />
        <StatCard
          icon="warn"
          title="Non-conformités ouvertes"
          lbl="NC, incidents et pistes"
          val={ncOpen.length}
          badge={
            <span className="badge b-amber">
              {ncOpen.filter((n) => n.statut === 'Déclarée').length} à valider
            </span>
          }
          foot="Traiter les écarts"
          page="m6-nc"
        />
        <StatCard
          icon="flag"
          title="Conformité réglementaire"
          lbl="Textes évalués conformes"
          val={`${txOk} %`}
          badge={
            <span className={`badge ${txOk < 80 ? 'b-amber' : 'b-green'}`}>
              {tx.filter((t) => t.statut !== 'Fait').length} écart(s)
            </span>
          }
          foot="Ouvrir la veille"
          page="m3-veille"
        />
      </div>
      <div className="grid mb" style={{ gridTemplateColumns: 'minmax(0,.95fr) minmax(0,1.5fr)' }}>
        <div className="card">
          <div className="card-h">
            <div>
              <h3>Référentiels actifs</h3>
              <div className="sub">
                Au {fd(iso(TODAY))} — {activeNorms.length} norme(s)
              </div>
            </div>
            <button className="btn sm" onClick={() => go('settings')}>
              <Icon name="plus" size={14} /> Gérer
            </button>
          </div>
          <div className="grid g2">
            {(ALL_N as NormId[]).map((n) => {
              const on = activeNorms.includes(n)
              const c = coverage(db, activeNorms, n)
              return (
                <div
                  key={n}
                  className="card flat"
                  style={{ padding: 12, cursor: 'pointer' }}
                  onClick={() => (on ? update((s) => void (s.ui.norm = n)) : go('settings'))}
                >
                  <div className="btn-row" style={{ justifyContent: 'space-between' }}>
                    <span className={`norm n${n}`}>{n}</span>
                    <span className="small muted">v{NORMS[n].version.slice(0, 4)}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 18, margin: '8px 0 2px' }}>
                    {on ? c + ' %' : '—'}
                  </div>
                  <div className="small muted">{NORMS[n].nom}</div>
                  <div className="small" style={{ marginTop: 6 }}>
                    {on ? (
                      <span style={{ color: 'var(--green)' }}>● Actif</span>
                    ) : (
                      <span style={{ color: 'var(--red)' }}>● Inactif</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="card">
          <div className="card-h">
            <div>
              <div className="sub">Actions d'amélioration</div>
              <h3 style={{ fontSize: 22, marginTop: 2 }}>
                {ch.clotures.reduce((a, b) => a + b, 0)} actions clôturées
              </h3>
            </div>
            <div className="seg">
              <button
                className={chart === 'mois' ? 'on' : ''}
                onClick={() => update((s) => void ((s.ui.chart = 'mois'), (s.ui.chartSel = 4)))}
              >
                Mensuel
              </button>
              <button
                className={chart === 'an' ? 'on' : ''}
                onClick={() => update((s) => void ((s.ui.chart = 'an'), (s.ui.chartSel = 3)))}
              >
                Annuel
              </button>
            </div>
          </div>
          <div className="bars">
            <div className="yax">
              {[top, Math.round(top * 0.75), Math.round(top * 0.5), Math.round(top * 0.25), 0].map(
                (v, i) => (
                  <span key={i}>{v}</span>
                )
              )}
            </div>
            {[0, 0.25, 0.5, 0.75].map((p) => (
              <div key={p} className="gl" style={{ top: p * 188 }}></div>
            ))}
            {ch.labels.map((l, i) => (
              <div
                key={l}
                className={`bar ${chartSel === i ? 'on' : ''}`}
                onClick={() => update((s) => void (s.ui.chartSel = i))}
              >
                <div className="tip">
                  {l} {chart === 'mois' ? '2026' : ''}
                  <br />
                  Clôturées : <b>{ch.clotures[i]}</b>
                  <br />
                  Ouvertes : <b>{ch.ouvertures[i]}</b>
                </div>
                <i style={{ height: (ch.clotures[i] / top) * 188 }}></i>
                <span>{l}</span>
              </div>
            ))}
          </div>
          <div className="legend" style={{ marginTop: 10 }}>
            <span>
              <i style={{ background: 'var(--green)' }}></i>Actions clôturées (sélection)
            </span>
            <span>
              <i style={{ background: '#CFE3D7' }}></i>Autres périodes — cliquez sur une barre pour
              le détail
            </span>
          </div>
        </div>
      </div>
      {norm === 'cross' ? <CrossView /> : null}
      <div className="grid g2 mb">
        <div className="card">
          <div className="card-h">
            <div>
              <h3>Alertes en cours</h3>
              <div className="sub">Détection automatique des dépassements</div>
            </div>
            <button className="btn sm" onClick={() => update((s) => void (s.ui.notif = true))}>
              Tout voir ({al.length})
            </button>
          </div>
          {al.slice(0, 5).map((a) => (
            <div key={a.key} className="alert-item">
              <div className={`a-ic ${a.lvl}`}>
                <Icon name={ALERT_IC[a.lvl]} size={15} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t">{a.t}</div>
                <div className="d">{a.d}</div>
              </div>
              {/* traiterAlerte(i) : ferme les notifications et ouvre la page de l'alerte */}
              <button className="btn sm" onClick={() => go(a.page)}>
                Traiter
              </button>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-h">
            <div>
              <h3>Échéances proches</h3>
              <div className="sub">30 prochains jours</div>
            </div>
            <button className="btn sm" onClick={() => go('m6-audits')}>
              <Icon name="cal" size={14} /> Calendrier
            </button>
          </div>
          {ech.slice(0, 6).map((e, i) => (
            <div key={i} className="alert-item">
              <div className="a-ic blue">
                <Icon name="cal" size={15} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t">{e.t}</div>
                <div className="d">
                  {e.m} — {e.r}
                </div>
              </div>
              <div className="small" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                {fd(e.d)}
                <br />
                <span className="badge b-amber">J-{days(e.d)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="card-h">
          <h3>Activités récentes</h3>
        </div>
        <DataTable<JournalRow & { id: string }>
          id="journalDash"
          cols={[
            {
              l: 'Activité',
              r: (x) => (
                <>
                  <span className="ttl">{x.u}</span> {x.a}
                </>
              ),
            },
            { l: 'Module', k: 'mod' },
            { l: 'Date', r: (x) => fd(x.d.slice(0, 10)) },
            { l: 'Heure', r: (x) => x.d.slice(11) },
            { l: 'Statut', r: (x) => <StatusBadge value={x.statut} /> },
          ]}
          rows={db.journal.slice(0, 8).map(withId)}
          search={['u', 'a', 'mod']}
          filters={[{ k: 'mod', l: 'Module', o: journalMods }]}
          norm={false}
        />
      </div>
    </>
  )
}

interface StatCardProps {
  icon: 'clock' | 'warn' | 'flag'
  title: string
  lbl: string
  val: number | string
  badge: ReactNode
  foot: string
  page: string
}

function StatCard({ icon, title, lbl, val, badge, foot, page }: StatCardProps) {
  return (
    <div className="card stat">
      <div className="stat-top">
        <div className="stat-ic">
          <Icon name={icon} size={18} />
        </div>
        <div>
          <h4>{title}</h4>
          <div className="lbl">{lbl}</div>
        </div>
      </div>
      <div className="btn-row">
        <span className="val">{val}</span>
        {badge}
      </div>
      <button className="foot" onClick={() => go(page)}>
        {foot} <Icon name="arrow" size={15} />
      </button>
    </div>
  )
}
