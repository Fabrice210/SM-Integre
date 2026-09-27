import { detailOpeners } from '../../app/detailRegistry'
import { go } from '../../app/navigation'
import { ApiError, askAssistant, type AssistantTurn } from '../../services/api'
import { update, useApp } from '../../store/useApp'
import type { AiMessage, AiSource } from '../../store/types'
import { aiAnswer } from './aiAnswer'

/** Page (et fiche détaillée, si elle existe) de chaque collection citée par l'assistant. */
const SOURCE_LINKS: Record<string, { page: string; fn?: string }> = {
  processus: { page: 'm1-processus', fn: 'procDetail' },
  enjeux: { page: 'm1-enjeux', fn: 'enjDetail' },
  swot: { page: 'm1-enjeux' },
  pestel: { page: 'm1-enjeux' },
  analyseVersions: { page: 'm1-enjeux' },
  parties: { page: 'm1-parties', fn: 'piDetail' },
  sites: { page: 'm1-domaine', fn: 'siteDetail' },
  activites: { page: 'm1-domaine' },
  domaineVersions: { page: 'm1-domaine' },
  axes: { page: 'm2-engagement' },
  planStrat: { page: 'm2-engagement' },
  politique: { page: 'm2-politique' },
  accuses: { page: 'm2-politique' },
  diffusions: { page: 'm2-politique' },
  preuvesCom: { page: 'm2-politique' },
  postes: { page: 'm2-roles' },
  representants: { page: 'm2-consultation', fn: 'repDetail' },
  reunions: { page: 'm2-consultation', fn: 'reuDetail' },
  comite: { page: 'm2-consultation' },
  objectifs: { page: 'm3-objectifs', fn: 'objDetail' },
  fichesMaitrise: { page: 'm3-fiches', fn: 'fmDetail' },
  textes: { page: 'm3-veille', fn: 'txDetail' },
  declarations: { page: 'm3-veille', fn: 'declDetail' },
  rapportsConf: { page: 'm3-veille', fn: 'rapDetail' },
  risques: { page: 'm3-risques', fn: 'riskDetail' },
  opportunites: { page: 'm3-risques', fn: 'oppDetail' },
  ressources: { page: 'm4-ressources', fn: 'resDetail' },
  competences: { page: 'm4-competences' },
  savoirs: { page: 'm4-competences' },
  formations: { page: 'm4-competences' },
  communications: { page: 'm4-communication' },
  documents: { page: 'm5-ged', fn: 'docDetail' },
  modeles: { page: 'm5-ged' },
  plansOps: { page: 'm5-planif' },
  urgences: { page: 'm5-urgences', fn: 'urgDetail' },
  indicateurs: { page: 'm6-surveillance' },
  prestataires: { page: 'm6-surveillance' },
  statsSurv: { page: 'm6-surveillance' },
  audits: { page: 'm6-audits', fn: 'audDetail' },
  auditeurs: { page: 'm6-audits' },
  revues: { page: 'm6-revues', fn: 'revDetail' },
  ncs: { page: 'm6-nc', fn: 'ncDetail' },
  registre: { page: 'm6-registre', fn: 'regDetail' },
}

/** Ouvre la page (et la fiche) d'une source ; false si la collection n'a pas de page connue. */
export function sourceLink(s: AiSource): (() => void) | null {
  const link = SOURCE_LINKS[s.collection]
  if (!link) return null
  return () => {
    go(link.page)
    if (link.fn) {
      const open = link.fn
      setTimeout(() => detailOpeners[open]?.(s.id), 50)
    }
  }
}

const WAIT = 'Recherche dans les données de votre organisme…'
const HISTORY = 10

/** Échanges précédents (hors messages en attente), au format de l'API. */
function history(msgs: AiMessage[]): AssistantTurn[] {
  return msgs
    .filter((m) => !m.wait && m.t)
    .slice(-HISTORY)
    .map((m) => ({ role: m.b ? 'assistant' : 'user', content: m.t }))
}

/**
 * Mode API : la question part au serveur (POST /assistant/ask/). Si l'assistant distant
 * n'est pas configuré ou indisponible (503 `fallback`) ou si le serveur est injoignable,
 * la réponse vient du moteur local, comme en mode local.
 */
export async function askRemote(q: string, pageId: string) {
  const prev = history(useApp.getState().ui.aiMsgs)
  let at = -1
  update((s) => {
    s.ui.aiMsgs.push({ b: 0, t: q })
    at = s.ui.aiMsgs.push({ b: 1, t: WAIT, wait: true }) - 1
  })
  let msg: AiMessage
  try {
    const r = await askAssistant(q, pageId, prev)
    msg = { b: 1, t: r.reponse, src: r.sources }
  } catch (e) {
    const fallback =
      e instanceof ApiError &&
      (e.status === 0 ||
        (e.status === 503 && !!(e.data as { fallback?: boolean } | undefined)?.fallback))
    msg = fallback
      ? { b: 1, t: aiAnswer(q.toLowerCase(), useApp.getState()) }
      : { b: 1, t: e instanceof ApiError ? e.message : "L'assistant n'a pas pu répondre." }
  }
  update((s) => {
    if (s.ui.aiMsgs[at]?.wait) s.ui.aiMsgs[at] = msg
    else s.ui.aiMsgs.push(msg)
  })
}
