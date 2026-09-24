import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './styles/index.css'
import './app/features'
import { router } from './app/router'
import { OverlayRoot } from './components/overlays/OverlayRoot'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <OverlayRoot />
  </StrictMode>
)
