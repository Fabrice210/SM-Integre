import type { ReactNode } from 'react'
import { Icon } from '../../components/ui/Icon'
import { BRAND_MARK } from '../../components/ui/icons'
import { ALL_N, NORMS, type NormId } from '../../data/referentiels'

/** Cadre des écrans d'authentification (loginView de l'original) : visuel à gauche, formulaire à droite. */
export function AuthLayout({ children }: { children: ReactNode }) {
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
        <div className="box">{children}</div>
      </section>
    </div>
  )
}

interface AuthFieldProps {
  k: string
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  /** Message d'erreur affiché sous le champ (le champ est alors signalé). */
  error?: string
  required?: boolean
  autoComplete?: string
}

/** Champ contrôlé au style des formulaires de l'application (.field / .inp / .errmsg). */
export function AuthField({
  k,
  label,
  type = 'text',
  value,
  onChange,
  error,
  required = true,
  autoComplete,
}: AuthFieldProps) {
  return (
    <div className={`field${error ? ' err' : ''}`} data-f={k}>
      <label htmlFor={'f_' + k}>
        {label}
        {required ? <span className="req"> *</span> : null}
      </label>
      <input
        className="inp"
        id={'f_' + k}
        name={k}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="errmsg">{error}</span>
    </div>
  )
}

/** Bouton principal pleine largeur des écrans d'authentification. */
export function AuthSubmit({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <div className="btn-row" style={{ marginTop: 18 }}>
      <button
        type="submit"
        className="btn primary"
        style={{ flex: 1, justifyContent: 'center', padding: 10 }}
        disabled={busy}
      >
        {children}
      </button>
    </div>
  )
}
