import type { ReactNode } from 'react'
import { openAI } from '../../features/ai/openAI'
import { Icon } from './Icon'

interface PageHeadProps {
  kicker?: ReactNode
  title: ReactNode
  /** Peut contenir du balisage (l'original n'échappe pas la description). */
  desc?: ReactNode
  actions?: ReactNode
}

/** head(kicker, title, desc, actions) de l'original. */
export function PageHead({ kicker, title, desc, actions }: PageHeadProps) {
  return (
    <div className="page-head">
      <div>
        {kicker ? <div className="page-kicker">{kicker}</div> : null}
        <h1>{title}</h1>
        {desc ? <p>{desc}</p> : null}
      </div>
      <div className="btn-row">
        {actions}
        <button className="btn" onClick={openAI}>
          <Icon name="ai" size={16} /> Assistant IA
        </button>
      </div>
    </div>
  )
}
