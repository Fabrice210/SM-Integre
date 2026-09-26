import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './styles/index.css'
import './app/features'
import { router } from './app/router'
import { OverlayRoot } from './components/overlays/OverlayRoot'
import { API_MODE } from './services/api'
import { restoreSession } from './services/session'

const render = () =>
  createRoot(document.getElementById('app')!).render(
    <StrictMode>
      <RouterProvider router={router} />
      <OverlayRoot />
    </StrictMode>
  )

// Mode API : reprise de la session serveur (jeton de renouvellement) avant le premier rendu.
if (API_MODE) void restoreSession().finally(render)
else render()
