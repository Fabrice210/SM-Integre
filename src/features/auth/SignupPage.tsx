import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, fetchAuthConfig, fieldErrors } from '../../services/api'
import { apiSignup } from '../../services/session'
import { toast } from '../../store/useOverlays'
import { AuthField, AuthLayout, AuthSubmit } from './AuthLayout'
import { EMAIL_RE, openSession } from './openSession'

type Key = 'organisation' | 'nom' | 'email' | 'password'
type Values = Record<Key, string>

const CHECKS: Record<Key, [(v: string) => boolean, string]> = {
  organisation: [(v) => v.length > 0, "Indiquez le nom de l'organisme."],
  nom: [(v) => v.length > 0, 'Indiquez votre nom complet.'],
  email: [(v) => EMAIL_RE.test(v), 'Saisissez une adresse email valide.'],
  password: [(v) => v.length >= 8, 'Choisissez un mot de passe de 8 caractères minimum.'],
}

/**
 * Inscription d'un organisme (mode API, si ALLOW_SIGNUP côté serveur) : crée un organisme
 * vierge et son Responsable SM, ouvre la session avec les jetons renvoyés puis l'onboarding.
 */
export function SignupPage() {
  const [v, setV] = useState<Values>({ organisation: '', nom: '', email: '', password: '' })
  const [errors, setErrors] = useState<Partial<Values>>({})
  const [failure, setFailure] = useState<string>()
  const [closed, setClosed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    fetchAuthConfig().then(
      (c) => live && !c.signup && setClosed(true),
      () => undefined
    )
    return () => {
      live = false
    }
  }, [])

  const set = (k: Key) => (x: string) => setV((o) => ({ ...o, [k]: x }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const d = {
      organisation: v.organisation.trim(),
      nom: v.nom.trim(),
      email: v.email.trim(),
      password: v.password,
    }
    const bad: Partial<Values> = {}
    for (const k of Object.keys(CHECKS) as Key[]) if (!CHECKS[k][0](d[k])) bad[k] = CHECKS[k][1]
    setErrors(bad)
    setFailure(undefined)
    if (Object.keys(bad).length) return
    setBusy(true)
    apiSignup(d).then(
      (user) => {
        toast(`Organisme « ${d.organisation} » créé : bienvenue !`)
        openSession((s) => s.users.find((x) => x.id === user.id) || user)
      },
      (err: Error) => {
        setBusy(false)
        if (err instanceof ApiError && err.status === 404) return setClosed(true)
        const f = fieldErrors(err)
        const known: Partial<Values> = {}
        for (const k of Object.keys(CHECKS) as Key[]) if (f[k]) known[k] = f[k]
        setErrors(known)
        if (!Object.keys(known).length) setFailure(err.message)
      }
    )
  }

  return (
    <AuthLayout>
      <h1>{closed ? 'Inscription fermée' : 'Créer un organisme'}</h1>
      {closed ? (
        <div className="note warn" role="alert" id="signupClosed" style={{ marginTop: 14 }}>
          Les inscriptions ne sont pas ouvertes sur cette plateforme. Demandez à votre Responsable
          SM de vous inviter, ou contactez l'exploitant de la plateforme.
        </div>
      ) : (
        <>
          <p className="muted" style={{ margin: '0 0 20px' }}>
            Ouvrez l'espace de votre organisme : vous en serez le Responsable SM et pourrez inviter
            vos collaborateurs pendant la mise en route.
          </p>
          <form onSubmit={submit} noValidate>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <AuthField
                k="organisation"
                label="Organisme"
                value={v.organisation}
                onChange={set('organisation')}
                error={errors.organisation}
                autoComplete="organization"
              />
              <AuthField
                k="nom"
                label="Nom complet"
                value={v.nom}
                onChange={set('nom')}
                error={errors.nom}
                autoComplete="name"
              />
              <AuthField
                k="email"
                label="Adresse email professionnelle"
                type="email"
                value={v.email}
                onChange={set('email')}
                error={errors.email}
                autoComplete="email"
              />
              <AuthField
                k="password"
                label="Mot de passe"
                type="password"
                value={v.password}
                onChange={set('password')}
                error={errors.password}
                autoComplete="new-password"
              />
            </div>
            {failure ? (
              <div className="note warn" style={{ marginTop: 14 }} role="alert">
                {failure}
              </div>
            ) : null}
            <AuthSubmit busy={busy}>Créer l'organisme</AuthSubmit>
          </form>
        </>
      )}
      <p className="small" style={{ marginTop: 14 }}>
        Déjà un compte ? <Link to="/login">Se connecter</Link>
      </p>
    </AuthLayout>
  )
}
