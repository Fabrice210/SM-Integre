import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { fieldErrors, requestPasswordReset } from '../../services/api'
import { AuthField, AuthLayout, AuthSubmit } from './AuthLayout'
import { EMAIL_RE } from './openSession'

/** Mot de passe oublié (mode API) : demande d'un lien par e-mail, réponse neutre. */
export function PasswordForgotPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string>()
  const [failure, setFailure] = useState<string>()
  const [sent, setSent] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = email.trim()
    setFailure(undefined)
    if (!EMAIL_RE.test(v)) return setError('Saisissez une adresse email valide.')
    setError(undefined)
    setBusy(true)
    requestPasswordReset(v)
      .then(
        (r) => setSent(r.detail),
        (err: Error) => {
          const f = fieldErrors(err)
          if (f.email) setError(f.email)
          else setFailure(err.message)
        }
      )
      .finally(() => setBusy(false))
  }

  return (
    <AuthLayout>
      <h1>Mot de passe oublié</h1>
      <p className="muted" style={{ margin: '0 0 20px' }}>
        Indiquez l'adresse de votre compte : nous vous enverrons un lien pour choisir un nouveau mot
        de passe.
      </p>
      {sent ? (
        <div className="note ok" role="status" id="resetSent">
          {sent} Pensez à vérifier vos courriers indésirables ; le lien ne sert qu'une fois.
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <AuthField
              k="email"
              label="Adresse email professionnelle"
              type="email"
              value={email}
              onChange={setEmail}
              error={error}
              autoComplete="email"
            />
          </div>
          {failure ? (
            <div className="note warn" style={{ marginTop: 14 }} role="alert">
              {failure}
            </div>
          ) : null}
          <AuthSubmit busy={busy}>Recevoir le lien</AuthSubmit>
        </form>
      )}
      <p className="small" style={{ marginTop: 14 }}>
        <Link to="/login">← Retour à la connexion</Link>
      </p>
    </AuthLayout>
  )
}
