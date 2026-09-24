import { useEffect } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { pageExists, PAGES } from '../../app/pages'
import { AiPanel } from '../../features/ai/AiPanel'
import { openAI } from '../../features/ai/openAI'
import { update, useApp } from '../../store/useApp'
import { NotifPanel } from '../overlays/NotifPanel'
import { Icon } from '../ui/Icon'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

/** render() de l'original pour l'écran « app » : barre latérale, barre du haut, page. */
export function AppShell() {
  const { pageId = 'dashboard' } = useParams()
  const session = useApp((s) => s.session)
  const onboarded = useApp((s) => s.onboarded)
  const notif = useApp((s) => s.ui.notif)
  const ai = useApp((s) => s.ui.ai)

  // Arrivée directe par URL : l'historique interne démarre sur cette page (comme go() au login)
  useEffect(() => {
    if (useApp.getState().ui.history.length === 0 && pageExists(pageId))
      update((s) => {
        s.ui.history = [pageId]
        s.ui.histIndex = 0
        const m = pageId.split('-')[0]
        if (/^m\d$/.test(m) && !s.ui.openMods.includes(m)) s.ui.openMods.push(m)
      })
  }, [pageId])

  if (!session) return <Navigate to="/login" replace />
  if (!onboarded) return <Navigate to="/onboarding/1" replace />
  if (!pageExists(pageId)) return <Navigate to="/dashboard" replace />

  const Page = PAGES[pageId]
  return (
    <>
      <div className="shell">
        <Sidebar page={pageId} />
        <div className="main">
          <Topbar page={pageId} />
          <main className="content" id="content">
            {Page ? <Page /> : null}
          </main>
        </div>
      </div>
      {notif ? <NotifPanel /> : null}
      {ai ? (
        <AiPanel />
      ) : (
        <button className="btn dark ai-fab" onClick={openAI}>
          <Icon name="ai" size={16} /> Assistant IA
        </button>
      )}
    </>
  )
}
