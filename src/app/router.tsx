import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { LoginPage } from '../features/auth/LoginPage'
import { OnboardingPage } from '../features/onboarding/OnboardingPage'
import { routerRef } from './routerRef'

/**
 * Routes : /login, /onboarding/1…8, puis chaque page à /<id d'origine>
 * (/dashboard, /m3-risques…) — ids identiques à l'original.
 */
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/onboarding/:step', element: <OnboardingPage /> },
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '/:pageId', element: <AppShell /> },
])

routerRef.navigate = (to) => void router.navigate(to)
