import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { confirmPassword, fieldErrors } from '../../services/api'
import { toast } from '../../store/useOverlays'
import { AuthField, AuthLayout, AuthSubmit } from './AuthLayout'

/**
 * Définition du mot de passe (mode API) depuis le lien reçu par e-mail
 * (invitation ou mot de passe oublié) : /definir-mot-de-passe?uid=…&token=…
 */
export function PasswordSetPage() {
  const [params] = useSearchParams()
  const uid = params.get('uid') ?? ''
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [errors, setErrors] = useState<{ pwd?: string; pwd2?: string }>({})
  const [linkErr, setLinkErr] = useState<string | null>(
    uid && token ? null : 'Lien incomplet : ouvrez le lien reçu par e-mail tel quel.'
  )
  const [failure, setFailure] = useState<string>()
  const [busy, setBusy] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const bad: typeof errors = {}
    if (pwd.length < 8) bad.pwd = 'Choisissez un mot de passe de 8 caractères minimum.'
    if (pwd2 !== pwd) bad.pwd2 = 'Les deux mots de passe ne correspondent pas.'
    setErrors(bad)
    setFailure(undefined)
    if (bad.pwd || bad.pwd2) return
    setBusy(true)
    confirmPassword(uid, token, pwd)
      .then(
        (r) => {
          toast('Mot de passe enregistré.')
          navigate('/login', { replace: true, state: { notice: r.detail } })
        },
        (err: Error) => {
          // Erreurs DRF (clés camelCase ; `uid` est renvoyé sous `id`)
          const f = fieldErrors(err)
          if (f.token || f.id) setLinkErr(f.token || f.id)
          else if (f.password) setErrors({ pwd: f.password })
          else setFailure(err.message)
        }
      )
      .finally(() => setBusy(false))
  }

  return (
    <AuthLayout>
      <h1>Définir votre mot de passe</h1>
      <p className="muted" style={{ margin: '0 0 20px' }}>
        Choisissez le mot de passe de votre compte SM Intégré.
      </p>
      {linkErr ? (
        <div className="note warn" role="alert" id="linkError">
          {linkErr} <Link to="/mot-de-passe-oublie">Demander un nouveau lien</Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <AuthField
              k="pwd"
              label="Nouveau mot de passe"
              type="password"
              value={pwd}
              onChange={setPwd}
              error={errors.pwd}
              autoComplete="new-password"
            />
            <AuthField
              k="pwd2"
              label="Confirmation du mot de passe"
              type="password"
              value={pwd2}
              onChange={setPwd2}
              error={errors.pwd2}
              autoComplete="new-password"
            />
          </div>
          <p className="small muted" style={{ margin: '10px 0 0' }}>
            8 caractères minimum ; évitez un mot de passe courant ou proche de votre nom.
          </p>
          {failure ? (
            <div className="note warn" style={{ marginTop: 14 }} role="alert">
              {failure}
            </div>
          ) : null}
          <AuthSubmit busy={busy}>Enregistrer le mot de passe</AuthSubmit>
        </form>
      )}
      <p className="small" style={{ marginTop: 14 }}>
        <Link to="/login">← Retour à la connexion</Link>
      </p>
    </AuthLayout>
  )
}
