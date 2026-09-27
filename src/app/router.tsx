import type { ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { LoginPage } from '../features/auth/LoginPage'
import { PasswordForgotPage } from '../features/auth/PasswordForgotPage'
import { PasswordSetPage } from '../features/auth/PasswordSetPage'
import { SignupPage } from '../features/auth/SignupPage'
import { OnboardingPage } from '../features/onboarding/OnboardingPage'
import { API_MODE } from '../services/api'
import { routerRef } from './routerRef'

/** Pages d'authentification servies par le backend : hors mode API, retour à /login. */
const apiOnly = (page: ReactNode) => (API_MODE ? page : <Navigate to="/login" replace />)

/**
 * Routes : /login, /onboarding/1…8, puis chaque page à /<id d'origine>
 * (/dashboard, /m3-risques…) — ids identiques à l'original. En mode API seulement :
 * /inscription, /mot-de-passe-oublie et /definir-mot-de-passe?uid=…&token=…
 * (PASSWORD_SET_PATH du backend, lien des e-mails d'invitation et de réinitialisation).
 */
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/inscription', element: apiOnly(<SignupPage />) },
  { path: '/mot-de-passe-oublie', element: apiOnly(<PasswordForgotPage />) },
  { path: '/definir-mot-de-passe', element: apiOnly(<PasswordSetPage />) },
  { path: '/onboarding/:step', element: <OnboardingPage /> },
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '/:pageId', element: <AppShell /> },
])

routerRef.navigate = (to) => void router.navigate(to)
