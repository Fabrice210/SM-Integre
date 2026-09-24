import { update } from '../../store/useApp'

const GREETING =
  'Bonjour, je réponds à partir des procédures, preuves et enregistrements de votre organisme uniquement. Mes propositions doivent être validées par un humain avant toute application.'

/** openAI() de l'original : ouvre le panneau et accueille l'utilisateur. */
export function openAI() {
  update((s) => {
    s.ui.ai = true
    if (!s.ui.aiMsgs.length) s.ui.aiMsgs = [{ b: 1, t: GREETING }]
  })
  setTimeout(() => document.getElementById('aiIn')?.focus(), 30)
}
