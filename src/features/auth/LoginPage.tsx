import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { API_MODE, fetchAuthConfig } from '../../services/api'
import { apiLogin } from '../../services/session'
import { update, useApp } from '../../store/useApp'
import { toast } from '../../store/useOverlays'
import { AuthLayout } from './AuthLayout'
import { EMAIL_RE, openSession } from './openSession'

/** Contrôles de doLogin() de l'original. */
const CHECKS: Record<string, (v: string) => boolean> = {
  email: (v) => EMAIL_RE.test(v),
  pwd: (v) => v.length >= 8,
}

/** doLogin() de l'original : valide, ouvre la session puis onboarding ou tableau de bord. */
function doLogin(
  form: HTMLElement,
  setErrors: (e: Set<string>) => void,
  setServerErr: (msg: string | null) => void,
  relaunch = false
) {
  const val = (k: string) =>
    form.querySelector<HTMLInputElement>(`[data-f="${k}"] .inp`)!.value.trim()
  const bad = new Set<string>()
  const d = { email: val('email'), pwd: val('pwd'), org: val('org') }
  ;(['email', 'pwd'] as const).forEach((k) => {
    if (!d[k] || !CHECKS[k](d[k])) bad.add(k)
  })
  setErrors(bad)
  setServerErr(null)
  if (bad.size) {
    toast('Identifiants invalides : vérifiez les champs signalés.', 'warn')
    return
  }
  if (API_MODE) {
    // Connexion réelle : jetons JWT puis état du serveur (services/session.ts)
    const remember = form.querySelector<HTMLInputElement>('#remember')?.checked ?? true
    apiLogin(d.email, d.pwd, remember).then(
      (user) => {
        if (relaunch) update((s) => void (s.onboarded = false))
        openSession((s) => s.users.find((x) => x.id === user.id) || user)
      },
      (e: Error) => {
        setErrors(new Set(['pwd']))
        setServerErr(e.message)
        toast(e.message, 'warn')
      }
    )
    return
  }
  openSession((s) => s.users.find((x) => x.email === d.email) || s.users[0])
}

interface FieldProps {
  k: string
  l: string
  t: string
  err: string
  bad: boolean
  value: string
}

/** fieldHTML() de l'original pour un champ obligatoire. */
function Field({ k, l, t, err, bad, value }: FieldProps) {
  return (
    <div className={`field${bad ? ' err' : ''}`} data-f={k}>
      <label htmlFor={'f_' + k}>
        {l}
        <span className="req"> *</span>
      </label>
      <input className="inp" id={'f_' + k} name={k} type={t} defaultValue={value} />
      <span className="errmsg">{err}</span>
    </div>
  )
}

/** Inscription ouverte côté serveur (GET /auth/config/) ; false hors mode API ou en cas d'erreur. */
function useSignupOpen() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!API_MODE) return
    let live = true
    fetchAuthConfig().then(
      (c) => live && setOpen(c.signup),
      () => undefined
    )
    return () => {
      live = false
    }
  }, [])
  return open
}

/** Écran de connexion (loginView de l'original). */
export function LoginPage() {
  const orgNom = useApp((s) => s.org.nom)
  const form = useRef<HTMLDivElement>(null)
  const [errors, setErrors] = useState<Set<string>>(new Set())
  const [serverErr, setServerErr] = useState<string | null>(null)
  const login = (relaunch = false) => doLogin(form.current!, setErrors, setServerErr, relaunch)
  // Message transmis par une autre page d'authentification (mot de passe défini…)
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  const signupOpen = useSignupOpen()

  return (
    <AuthLayout>
      <h1>Connexion</h1>
      <p className="muted" style={{ margin: '0 0 20px' }}>
        Accédez à l'espace de votre organisme.
      </p>
      {API_MODE && notice ? (
        <div className="note ok" style={{ margin: '0 0 16px' }} role="status">
          {notice}
        </div>
      ) : null}
      <div className="form-grid" style={{ gridTemplateColumns: '1fr' }} id="loginForm" ref={form}>
        <Field
          k="email"
          l="Adresse email professionnelle"
          t="email"
          err="Saisissez une adresse email valide."
          bad={errors.has('email')}
          value={API_MODE ? '' : 'f.dossou-yovo@agrobenin.bj'}
        />
        <Field
          k="pwd"
          l="Mot de passe"
          t="password"
          err={serverErr ?? 'Saisissez votre mot de passe (8 caractères minimum).'}
          bad={errors.has('pwd')}
          value={API_MODE ? '' : 'Qse@Cotonou2026'}
        />
        <div className="field" data-f="org">
          <label htmlFor="f_org">Organisme</label>
          <select className="inp" id="f_org" name="org" defaultValue={orgNom}>
            <option value={orgNom}>{orgNom}</option>
            <option value="Cabinet QUALIS Afrique (consultant)">
              Cabinet QUALIS Afrique (consultant)
            </option>
          </select>
          <span className="errmsg">Ce champ est obligatoire.</span>
        </div>
        <label className="toggle">
          <input type="checkbox" id="remember" defaultChecked />
          <span className="small">Rester connecté(e) sur cet appareil</span>
        </label>
      </div>
      <div className="btn-row" style={{ marginTop: 18 }}>
        <button
          className="btn primary"
          style={{ flex: 1, justifyContent: 'center', padding: 10 }}
          onClick={() => login()}
        >
          Se connecter
        </button>
      </div>
      {API_MODE ? (
        <p className="small" style={{ marginTop: 12, textAlign: 'center' }}>
          <Link to="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
        </p>
      ) : null}
      <p className="small muted" style={{ marginTop: 14 }}>
        Première connexion ? L'onboarding guidé démarre automatiquement après authentification.{' '}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault()
            if (API_MODE) return login(true)
            update((s) => void (s.onboarded = false))
            login()
          }}
        >
          Relancer l'onboarding
        </a>
      </p>
      {API_MODE ? (
        signupOpen ? (
          <p className="small muted" style={{ marginTop: 10 }}>
            Votre organisme n'a pas encore d'espace ?{' '}
            <Link to="/inscription">Créer un organisme</Link>
          </p>
        ) : null
      ) : (
        <div className="note" style={{ marginTop: 14 }}>
          Prototype de démonstration — les identifiants préremplis sont valides.
        </div>
      )}
    </AuthLayout>
  )
}
