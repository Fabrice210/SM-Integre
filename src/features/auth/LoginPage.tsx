import { useRef, useState } from 'react'
import { go } from '../../app/navigation'
import { routerRef } from '../../app/routerRef'
import { Icon } from '../../components/ui/Icon'
import { BRAND_MARK } from '../../components/ui/icons'
import { ALL_N, NORMS, type NormId } from '../../data/referentiels'
import { logAct, update, useApp } from '../../store/useApp'
import { toast } from '../../store/useOverlays'

/** Contrôles de doLogin() de l'original. */
const CHECKS: Record<string, (v: string) => boolean> = {
  email: (v) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v),
  pwd: (v) => v.length >= 8,
}

/** doLogin() de l'original : valide, ouvre la session puis onboarding ou tableau de bord. */
function doLogin(form: HTMLElement, setErrors: (e: Set<string>) => void) {
  const val = (k: string) =>
    form.querySelector<HTMLInputElement>(`[data-f="${k}"] .inp`)!.value.trim()
  const bad = new Set<string>()
  const d = { email: val('email'), pwd: val('pwd'), org: val('org') }
  ;(['email', 'pwd'] as const).forEach((k) => {
    if (!d[k] || !CHECKS[k](d[k])) bad.add(k)
  })
  setErrors(bad)
  if (bad.size) {
    toast('Identifiants invalides : vérifiez les champs signalés.', 'warn')
    return
  }
  let onboarded = false
  update((s) => {
    const u = s.users.find((x) => x.email === d.email) || s.users[0]
    s.session = { userId: u.id, onboarded: s.onboarded }
    logAct(s, "s'est connecté(e)", 'Session')
    onboarded = s.onboarded
    if (!s.onboarded)
      s.ui.onb = { step: 0, cfg: 0, ai: 'idle', props: null, invites: null, prof: null }
    else {
      s.ui.history = []
      s.ui.histIndex = -1
    }
  })
  if (!onboarded) routerRef.navigate?.('/onboarding/1')
  else go('dashboard')
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

/** Écran de connexion (loginView de l'original). */
export function LoginPage() {
  const orgNom = useApp((s) => s.org.nom)
  const form = useRef<HTMLDivElement>(null)
  const [errors, setErrors] = useState<Set<string>>(new Set())
  const login = () => doLogin(form.current!, setErrors)

  return (
    <div className="auth">
      <section className="auth-art">
        <div className="brand" style={{ padding: 0 }}>
          <div className="brand-mark" style={{ background: '#fff', color: 'var(--green)' }}>
            <Icon path={BRAND_MARK} size={20} />
          </div>
          <div>
            <div className="brand-name">SM Intégré</div>
            <div className="brand-sub" style={{ color: 'rgba(255,255,255,.75)' }}>
              Plateforme de digitalisation des systèmes de management
            </div>
          </div>
        </div>
        <h2>Un seul noyau pour piloter tous vos référentiels.</h2>
        <p>
          Contexte, leadership, planification, support, maîtrise opérationnelle et amélioration
          continue : chaque enregistrement est saisi une fois et rattaché aux normes concernées.
        </p>
        <div className="auth-norms">
          {(ALL_N as NormId[]).map((n) => (
            <span key={n}>
              {NORMS[n].code} — {NORMS[n].nom}
            </span>
          ))}
        </div>
      </section>
      <section className="auth-form">
        <div className="box">
          <h1>Connexion</h1>
          <p className="muted" style={{ margin: '0 0 20px' }}>
            Accédez à l'espace de votre organisme.
          </p>
          <div
            className="form-grid"
            style={{ gridTemplateColumns: '1fr' }}
            id="loginForm"
            ref={form}
          >
            <Field
              k="email"
              l="Adresse email professionnelle"
              t="email"
              err="Saisissez une adresse email valide."
              bad={errors.has('email')}
              value="f.dossou-yovo@agrobenin.bj"
            />
            <Field
              k="pwd"
              l="Mot de passe"
              t="password"
              err="Saisissez votre mot de passe (8 caractères minimum)."
              bad={errors.has('pwd')}
              value="Qse@Cotonou2026"
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
              onClick={login}
            >
              Se connecter
            </button>
          </div>
          <p className="small muted" style={{ marginTop: 14 }}>
            Première connexion ? L'onboarding guidé démarre automatiquement après authentification.{' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                update((s) => void (s.onboarded = false))
                login()
              }}
            >
              Relancer l'onboarding
            </a>
          </p>
          <div className="note" style={{ marginTop: 14 }}>
            Prototype de démonstration — les identifiants préremplis sont valides.
          </div>
        </div>
      </section>
    </div>
  )
}
