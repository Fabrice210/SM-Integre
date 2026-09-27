import { go, nav } from '../../app/navigation'
import { pageTitle } from '../../app/pages'
import { MOD_FULL, NORMS } from '../../data/referentiels'
import { initials } from '../../lib/format'
import { computeAlerts, pendingValidations } from '../../services/alerts'
import { exportCurrentPage } from '../../services/exports'
import { currentUser, update, useApp } from '../../store/useApp'
import type { NormFilter } from '../../store/types'
import { Icon } from '../ui/Icon'
import { openPending, openProfile } from './topbarModals'

export function Topbar({ page }: { page: string }) {
  const sigle = useApp((s) => s.org.sigle)
  const norm = useApp((s) => s.ui.norm)
  const activeNorms = useApp((s) => s.activeNorms)
  const { history, histIndex } = useApp((s) => s.ui)
  const user = useApp(currentUser)
  const alerts = useApp((s) => computeAlerts(s.db, s.ui.dismissed).length)
  const pending = useApp((s) => pendingValidations(s.db).length)
  const modId = page.split('-')[0]
  const isMod = modId in MOD_FULL
  const setNorm = (n: NormFilter) =>
    update((s) => {
      s.ui.norm = n
    })

  return (
    <header className="topbar">
      <button className="icon-btn sq menu-btn" onClick={() => update((s) => void (s.ui.sidebar = !s.ui.sidebar))} aria-label="Menu">
        <Icon name="menu" size={16} />
      </button>
      <button className="icon-btn sq" onClick={() => nav(-1)} aria-label="Page précédente" disabled={histIndex <= 0}>
        <Icon name="left" size={16} />
      </button>
      <button className="icon-btn sq" onClick={() => nav(1)} aria-label="Page suivante" disabled={histIndex >= history.length - 1}>
        <Icon name="right" size={16} />
      </button>
      <div className="crumbs">
        {sigle} <Icon name="right" size={12} />{' '}
        {isMod ? (
          <>
            {'Module ' + modId[1]} <Icon name="right" size={12} />
          </>
        ) : null}{' '}
        <b>{pageTitle(page)}</b>
      </div>
      <span className="spacer"></span>
      <div className="norm-switch" role="group" aria-label="Filtre par référentiel">
        <button className={norm === 'all' ? 'on' : ''} onClick={() => setNorm('all')}>
          Tous
        </button>
        {activeNorms.map((n) => (
          <button key={n} className={norm === n ? 'on' : ''} onClick={() => setNorm(n)} title={`${NORMS[n].code} — ${NORMS[n].nom}`}>
            {n}
          </button>
        ))}
        <button className={norm === 'cross' ? 'on' : ''} onClick={() => setNorm('cross')}>
          Vue croisée
        </button>
      </div>
      <button className="icon-btn" onClick={() => go('help')} aria-label="Aide">
        <Icon name="help" size={17} />
      </button>
      <button className="icon-btn" onClick={openPending} aria-label="Validations en attente">
        <Icon name="mail" size={17} />
        {pending ? <span className="dot">{pending}</span> : null}
      </button>
      <button className="icon-btn" onClick={() => update((s) => void (s.ui.notif = !s.ui.notif))} aria-label="Notifications">
        <Icon name="bell" size={17} />
        {alerts ? <span className="dot">{alerts}</span> : null}
      </button>
      <button className="user-chip" onClick={openProfile} aria-label="Mon profil">
        <span className="avatar">{initials(user.nom)}</span>
        <span className="who">
          <b>{user.nom.split(' ')[0]}</b>
          <br />
          <small>{user.roles[0]}</small>
        </span>
      </button>
      <button className="btn primary" onClick={() => exportCurrentPage(page, pageTitle(page))}>
        <Icon name="share" size={15} /> Exporter
      </button>
    </header>
  )
}
