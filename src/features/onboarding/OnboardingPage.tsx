import { useEffect } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Icon } from '../../components/ui/Icon'
import { BRAND_MARK } from '../../components/ui/icons'
import { update, useApp } from '../../store/useApp'
import { OnbAI } from './OnbAI'
import { ONB, onbOf, runCfg, useOnb } from './onbState'
import {
  StepFinal,
  StepInvites,
  StepNorms,
  StepProfile,
  StepRecap,
  StepSetup,
  StepWelcome,
} from './steps'

function OnbStep({ s }: { s: number }) {
  if (s === 0) return <StepWelcome />
  if (s === 1) return <StepProfile />
  if (s === 2) return <StepNorms />
  if (s === 3) return <StepSetup />
  if (s === 4) return <OnbAI />
  if (s === 5) return <StepInvites />
  if (s === 6) return <StepRecap />
  return <StepFinal />
}

/** Assistant d'onboarding en 8 étapes (onbView de l'original), /onboarding/1…8. */
export function OnboardingPage() {
  const { step: param } = useParams()
  const session = useApp((s) => s.session)
  const onb = useOnb()
  const n = Number(param)
  const valid = Number.isInteger(n) && n >= 1 && n <= 8
  const s = valid ? n - 1 : onb.step

  // L'URL fait foi (retour arrière du navigateur, arrivée directe) : l'état de l'assistant la suit
  useEffect(() => {
    if (!valid || onbOf(useApp.getState()).step === n - 1) return
    update((st) => void (onbOf(st).step = n - 1))
    if (n - 1 === 3) runCfg()
  }, [valid, n])

  if (!session) return <Navigate to="/login" replace />
  if (!valid) return <Navigate to={`/onboarding/${onb.step + 1}`} replace />

  return (
    <div className="onb">
      <aside className="onb-side">
        <div className="brand" style={{ padding: 0 }}>
          <div className="brand-mark">
            <Icon path={BRAND_MARK} size={20} />
          </div>
          <div>
            <div className="brand-name">Mise en route</div>
            <div className="brand-sub">Première connexion</div>
          </div>
        </div>
        <ol className="steps">
          {ONB.map((l, i) => (
            <li key={l} className={i < s ? 'done' : i === s ? 'cur' : ''}>
              <span className="c">{i < s ? '✓' : i + 1}</span>
              {l}
            </li>
          ))}
        </ol>
        <div className="side-card">
          <h4>Besoin d'aide ?</h4>
          <p>
            Votre consultant peut configurer l'espace avec vous. Chaque étape reste modifiable dans
            les Paramètres.
          </p>
        </div>
      </aside>
      <section className="onb-main">
        <OnbStep s={s} />
      </section>
    </div>
  )
}
