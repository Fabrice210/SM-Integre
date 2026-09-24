import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { pageTitle } from '../../app/pages'
import { Icon } from '../../components/ui/Icon'
import { update, useApp } from '../../store/useApp'
import { AI_CTX, aiAnswer } from './aiAnswer'

const DEFAULT_Q = 'Quelles actions sont en retard ?'

/** Panneau de l'assistant IA (aiPanel() + aiAsk() de l'original). */
export function AiPanel() {
  const { pageId = 'dashboard' } = useParams()
  const msgs = useApp((s) => s.ui.aiMsgs)
  const input = useRef<HTMLInputElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const k = pageId.split('-')[0]
  const sug = AI_CTX[k] || AI_CTX[pageId] || AI_CTX.other

  // aiAsk() fait défiler le fil jusqu'à la dernière réponse
  useEffect(() => {
    if (body.current) body.current.scrollTop = body.current.scrollHeight
  }, [msgs.length])

  const aiAsk = (raw: string) => {
    const q = (raw || '').trim()
    if (!q) return
    update((s) => {
      s.ui.aiMsgs.push({ b: 0, t: q })
      s.ui.aiMsgs.push({ b: 1, t: aiAnswer(q.toLowerCase(), s) })
    })
    // Le re-rendu de l'original recrée le champ avec sa question par défaut
    if (input.current) input.current.value = DEFAULT_Q
  }

  return (
    <aside className="ai-panel" role="dialog" aria-label="Assistant IA">
      <div className="ai-h">
        <div>
          <b>
            <Icon name="ai" size={16} /> Assistant IA
          </b>
          <div className="small muted">Contexte : {pageTitle(pageId)}</div>
        </div>
        <button
          className="icon-btn sq"
          onClick={() => update((s) => void (s.ui.ai = false))}
          aria-label="Fermer"
        >
          <Icon name="x" size={15} />
        </button>
      </div>
      <div className="ai-b" id="aiBody" ref={body}>
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.b ? 'bot' : 'me'}`}>
            {m.t}
          </div>
        ))}
        <div className="ai-sugg">
          {sug.map((s) => (
            <button key={s} onClick={() => aiAsk(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="ai-f">
        <input
          className="inp"
          id="aiIn"
          ref={input}
          defaultValue={DEFAULT_Q}
          onKeyDown={(e) => {
            if (e.key === 'Enter') aiAsk(e.currentTarget.value)
          }}
          aria-label="Votre question"
        />
        <button
          className="btn primary"
          onClick={() => aiAsk(input.current?.value ?? '')}
          aria-label="Envoyer"
        >
          <Icon name="send" size={15} />
        </button>
      </div>
      <div className="ai-note">
        Démonstration : réponses calculées à partir des données de la plateforme. Isolation stricte
        par organisme.
      </div>
    </aside>
  )
}
