import { useState } from 'react'
import { go } from '../../app/navigation'
import { GEN, MODS } from '../../data/referentiels'
import { openAI } from '../../features/ai/openAI'
import { logout } from '../../features/auth/logout'
import { computeAlerts } from '../../services/alerts'
import { update, useApp } from '../../store/useApp'
import { Icon } from '../ui/Icon'
import { BRAND_MARK, type IconName } from '../ui/icons'

/** Barre latérale : marque, recherche d'écran, modules pliables, pages générales, carte IA. */
export function Sidebar({ page }: { page: string }) {
  const open = useApp((s) => s.ui.sidebar)
  const openMods = useApp((s) => s.ui.openMods)
  const orgName = useApp((s) => s.org.nom)
  const journalCount = useApp((s) => s.db.journal.length)
  const alertCount = useApp((s) => computeAlerts(s.db, s.ui.dismissed).length)
  const [q, setQ] = useState('')
  const query = q.toLowerCase().trim()

  const toggleMod = (id: string) =>
    update((s) => {
      const i = s.ui.openMods.indexOf(id)
      if (i >= 0) s.ui.openMods.splice(i, 1)
      else s.ui.openMods.push(id)
    })

  return (
    <nav className={`sidebar ${open ? 'open' : ''}`} aria-label="Navigation principale">
      <div className="brand">
        <div className="brand-mark">
          <Icon path={BRAND_MARK} size={20} />
        </div>
        <div>
          <div className="brand-name">SM Intégré</div>
          <div className="brand-sub">{orgName}</div>
        </div>
      </div>
      <div className="side-search">
        <Icon name="search" size={15} />
        <input id="sideSearch" placeholder="Rechercher un écran" aria-label="Rechercher un écran" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="kbd">⌘ K</span>
      </div>
      <div className="nav-group">Menu principal</div>
      <button className={`nav-item ${page === 'dashboard' ? 'active' : ''}`} onClick={() => go('dashboard')}>
        <Icon name="dash" /> Tableau de bord <span className="count">{alertCount}</span>
      </button>
      <div className="nav-group">Modules du système</div>
      {MODS.map((m) => {
        // sideFilter() de l'original : masque les sous-pages qui ne correspondent pas
        const visible = m.subs.filter(([, l]) => !query || l.toLowerCase().includes(query))
        const isOpen = openMods.includes(m.id) || (Boolean(query) && visible.length > 0)
        return (
          <div key={m.id} className={`nav-mod ${isOpen ? 'open' : ''}`} data-mod={m.id} style={visible.length ? undefined : { display: 'none' }}>
            <button className="nav-item" onClick={() => toggleMod(m.id)} aria-expanded={openMods.includes(m.id)}>
              <Icon name={m.ic as IconName} />{' '}
              <span>
                {m.n}. {m.l}
              </span>
              <Icon name="right" size={14} className="chev" />
            </button>
            <div className="nav-sub">
              {m.subs.map(([id, l]) => (
                <button
                  key={id}
                  className={`nav-item ${page === id ? 'active' : ''}`}
                  data-lbl={l.toLowerCase()}
                  onClick={() => go(id)}
                  style={!query || l.toLowerCase().includes(query) ? undefined : { display: 'none' }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        )
      })}
      <div className="nav-group">Général</div>
      {GEN.map(([id, l, ic]) => (
        <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => go(id)}>
          <Icon name={ic as IconName} /> {l}
          {id === 'journal' ? <span className="count">{journalCount}</span> : null}
        </button>
      ))}
      <button className="nav-item" onClick={logout}>
        <Icon name="out" /> Déconnexion
      </button>
      <div className="side-card" style={{ marginTop: 16 }}>
        <h4>
          <Icon name="ai" size={16} /> Assistant IA
        </h4>
        <p>Posez une question sur vos procédures, preuves et indicateurs.</p>
        <div className="btn-row">
          <button className="btn primary sm" onClick={openAI}>
            Ouvrir
          </button>
          <button className="btn sm ghost" onClick={() => go('help')}>
            En savoir plus
          </button>
        </div>
      </div>
    </nav>
  )
}
