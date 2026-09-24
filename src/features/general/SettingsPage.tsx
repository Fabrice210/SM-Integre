import { routerRef } from '../../app/routerRef'
import { Icon } from '../../components/ui/Icon'
import { PageHead } from '../../components/ui/PageHead'
import { ALL_N, NORMS, type NormId } from '../../data/referentiels'
import { readForm } from '../../forms/formControllers'
import { FormRenderer } from '../../forms/FormRenderer'
import { logAct, update, useApp } from '../../store/useApp'
import { toast } from '../../store/useOverlays'
import { ORG_F } from './forms'
import { toggleNorm } from './toggleNorm'

/** saveOrg() de l'original. */
function saveOrg() {
  const d = readForm('orgForm')
  if (!d) {
    toast('Complétez les champs signalés.', 'warn')
    return
  }
  update((s) => {
    Object.assign(s.org, d)
    logAct(s, "a mis à jour le profil de l'organisme", 'Paramètres')
  })
  toast('Profil enregistré.')
}

/** Bouton « Relancer l'onboarding » : retour à l'assistant, étape 1. */
function restartOnboarding() {
  update((s) => {
    s.onboarded = false
    if (s.session) s.session.onboarded = false
    s.ui.onb = { step: 0, cfg: 0, ai: 'idle' }
  })
  routerRef.navigate?.('/onboarding/1')
}

/** PAGES.settings de l'original. */
export function SettingsPage() {
  const org = useApp((s) => s.org)
  const activeNorms = useApp((s) => s.activeNorms)
  const auditorAccess = useApp((s) => s.auditorAccess)
  const erpModule = useApp((s) => s.erpModule)

  return (
    <>
      <PageHead
        kicker="Configuration"
        title="Paramètres"
        desc="Profil de l'organisme, référentiels actifs et options de la plateforme."
      />
      <div className="grid g2">
        <div className="card">
          <div className="card-h">
            <h3>Profil de l'organisme</h3>
          </div>
          <div id="orgForm">
            <FormRenderer formId="orgForm" fields={ORG_F} rec={org} />
          </div>
          <div className="btn-row" style={{ marginTop: 14 }}>
            <button className="btn primary" onClick={saveOrg}>
              <Icon name="check" size={15} /> Enregistrer le profil
            </button>
          </div>
        </div>
        <div>
          <div className="card mb">
            <div className="card-h">
              <div>
                <h3>Référentiels actifs</h3>
                <div className="sub">Le noyau se reconfigure automatiquement</div>
              </div>
            </div>
            {(ALL_N as NormId[]).map((n) => (
              <div key={n} className="cfg-row" style={{ marginBottom: 8 }}>
                <span className={`norm n${n}`}>{n}</span>
                <span>
                  <b>{NORMS[n].code}</b> — {NORMS[n].nom}
                  <br />
                  <span className="small muted">Version {NORMS[n].version}</span>
                </span>
                <label className="toggle st">
                  <input
                    type="checkbox"
                    checked={activeNorms.includes(n)}
                    aria-label={`Activer ${NORMS[n].code}`}
                    onChange={(e) => {
                      const on = e.target.checked
                      update((s) => {
                        toggleNorm(s, n)
                        if (!s.activeNorms.includes(s.ui.norm as NormId)) s.ui.norm = 'all'
                        logAct(s, (on ? 'a activé ' : 'a désactivé ') + NORMS[n].code, 'Paramètres')
                      })
                      toast(`Noyau reconfiguré pour ${NORMS[n].code}.`)
                    }}
                  />
                </label>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="card-h">
              <h3>Options</h3>
            </div>
            <div className="cfg-row" style={{ marginBottom: 8 }}>
              <span>
                <b>Accès des auditeurs externes en lecture</b>
                <br />
                <span className="small muted">Domaine d'application et dossiers d'audit</span>
              </span>
              <label className="toggle st">
                <input
                  type="checkbox"
                  checked={auditorAccess}
                  onChange={(e) => {
                    const on = e.target.checked
                    update((s) => void (s.auditorAccess = on))
                    toast('Accès auditeurs ' + (on ? 'activé' : 'désactivé') + '.')
                  }}
                />
              </label>
            </div>
            <div className="cfg-row" style={{ marginBottom: 8 }}>
              <span>
                <b>Assistant IA contextuel</b>
                <br />
                <span className="small muted">
                  Recherche sémantique limitée aux données de l'organisme
                </span>
              </span>
              <label className="toggle st">
                <input type="checkbox" defaultChecked disabled />
              </label>
            </div>
            <div className="cfg-row" style={{ marginBottom: 8 }}>
              <span>
                <b>Module optionnel Opérations & Ressources</b>
                <br />
                <span className="small muted">
                  À activer uniquement sans ERP existant (post-MVP)
                </span>
              </span>
              <label className="toggle st">
                <input
                  type="checkbox"
                  checked={erpModule}
                  onChange={(e) => {
                    const on = e.target.checked
                    update((s) => void (s.erpModule = on))
                    toast(
                      on
                        ? 'Module optionnel activé — agents IA soumis à validation humaine.'
                        : 'Module optionnel désactivé.'
                    )
                  }}
                />
              </label>
            </div>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn" onClick={restartOnboarding}>
                <Icon name="refresh" size={15} /> Relancer l'onboarding
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
