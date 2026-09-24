import type { ReactNode } from 'react'
import { Icon } from '../../components/ui/Icon'
import { onbGo } from './onbState'

interface OnbNavProps {
  prev: boolean
  next?: (() => void) | null
  nextLbl?: string
  extra?: ReactNode
}

/** onbNav(prev, next, nextLbl, extra) de l'original : pied de l'étape. */
export function OnbNav({ prev, next, nextLbl = 'Continuer', extra }: OnbNavProps) {
  return (
    <div className="onb-foot">
      <div>
        {prev ? (
          <button className="btn" onClick={() => onbGo(-1)}>
            <Icon name="left" size={15} /> Retour
          </button>
        ) : null}
      </div>
      <div className="btn-row">
        {extra}
        {next ? (
          <button className="btn primary" onClick={next}>
            {nextLbl} <Icon name="arrow" size={15} />
          </button>
        ) : null}
      </div>
    </div>
  )
}
