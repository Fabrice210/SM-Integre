import { useEffect } from 'react'
import { go } from '../../app/navigation'
import { NormBadges, StatusBadge } from '../../components/ui/badges'
import { Icon } from '../../components/ui/Icon'
import { ALL_N, NORMS, ROLES, type NormId } from '../../data/referentiels'
import { readForm } from '../../forms/formControllers'
import { FormRenderer } from '../../forms/FormRenderer'
import { siteOpts } from '../../lib/lookups'
import { currentUser, update, useApp } from '../../store/useApp'
import { toast } from '../../store/useOverlays'
import { toggleNorm } from '../general/toggleNorm'
import { OnbNav } from './OnbNav'
import { cfgItems, finishOnb, onbGo, onbOf, PROF_F, useOnb, type Invite } from './onbState'

const h3 = { margin: '0 0 6px', fontSize: 15 }

/** Étape 1 : bienvenue. */
export function StepWelcome() {
  const user = useApp(currentUser)
  const orgNom = useApp((s) => s.org.nom)
  return (
    <>
      <div className="page-kicker">Étape 1 sur 8</div>
      <h2>Bienvenue, {user.nom.split(' ')[0]}</h2>
      <p className="lead">
        En quelques minutes, nous allons configurer l'espace de {orgNom} : profil de l'organisme,
        normes à couvrir, import facultatif de vos procédures existantes et invitation de vos
        collaborateurs clés.
      </p>
      <div className="grid g3">
        {[
          [
            'Un noyau unique',
            "Les 6 modules suivent le cycle PDCA et s'adaptent automatiquement aux normes choisies, sans double saisie.",
          ],
          [
            "L'IA propose, vous décidez",
            "Vos procédures existantes peuvent être analysées ; aucune proposition n'est appliquée sans votre validation.",
          ],
          [
            'Traçabilité native',
            "Chaque action, validation et preuve est horodatée et consultable dans le journal d'audit.",
          ],
        ].map(([t, d]) => (
          <div key={t} className="card flat">
            <h3 style={h3}>{t}</h3>
            <p className="muted small" style={{ margin: 0 }}>
              {d}
            </p>
          </div>
        ))}
      </div>
      <OnbNav prev={false} next={() => onbGo(1)} nextLbl="Commencer la configuration" />
    </>
  )
}

/** saveProf() de l'original. */
function saveProf() {
  const d = readForm('profForm')
  if (!d) {
    toast('Complétez le profil.', 'warn')
    return
  }
  update((s) => {
    onbOf(s).prof = d
    Object.assign(s.org, {
      nom: d.nom,
      secteur: d.secteur,
      taille: d.taille,
      effectif: d.effectif,
      ville: d.ville,
      rccm: d.rccm,
      ifu: d.ifu,
    })
  })
  onbGo(1)
}

/** Étape 2 : profil de l'organisme. */
export function StepProfile() {
  const prof = useOnb().prof
  const org = useApp((s) => s.org)
  const sites = useApp((s) => s.db.sites)
  const p = prof || {
    secteur: org.secteur,
    taille: org.taille,
    effectif: org.effectif,
    nom: org.nom,
    ville: org.ville,
    sites: sites.map((x) => x.nom),
    rccm: org.rccm,
    ifu: org.ifu,
  }
  return (
    <>
      <div className="page-kicker">Étape 2 sur 8</div>
      <h2>Profil de l'organisme</h2>
      <p className="lead">
        Ces informations alimentent le Module 1 (Contexte) et le document « Domaine d'application ».
      </p>
      <div id="profForm">
        <FormRenderer formId="profForm" fields={PROF_F} rec={p} />
      </div>
      <OnbNav prev next={saveProf} />
    </>
  )
}

/** Étape 3 : normes applicables. */
export function StepNorms() {
  const activeN = useApp((s) => s.activeNorms)
  const mapping = useApp((s) => s.db.mapping)
  return (
    <>
      <div className="page-kicker">Étape 3 sur 8</div>
      <h2>Normes applicables</h2>
      <p className="lead">
        Sélectionnez les référentiels à couvrir. Le noyau fusionne les exigences communes (structure
        harmonisée) et isole les exigences spécifiques à chaque norme.
      </p>
      <div className="norm-cards">
        {(ALL_N as NormId[]).map((n) => (
          <button
            key={n}
            className={`norm-card ${activeN.includes(n) ? 'on' : ''}`}
            onClick={() => update((s) => toggleNorm(s, n))}
            aria-pressed={activeN.includes(n)}
          >
            <span className="sq" style={{ background: NORMS[n].couleur }}>
              {n}
            </span>
            <span>
              <h4>
                {NORMS[n].code} — {NORMS[n].nom}
              </h4>
              <p>Version appliquée : {NORMS[n].version}</p>
              <p>
                {mapping.filter((m) => m.norme === n).length} exigences cartographiées dans le
                moteur normatif
              </p>
            </span>
          </button>
        ))}
      </div>
      <div className="note" style={{ marginTop: 14 }}>
        {activeN.length} norme(s) sélectionnée(s). Vous pourrez en ajouter ou en retirer à tout
        moment depuis les Paramètres : l'ajout d'une norme ajoute des données de mapping, jamais un
        nouveau module.
      </div>
      <OnbNav
        prev
        next={
          activeN.length ? () => onbGo(1) : () => toast('Sélectionnez au moins une norme.', 'warn')
        }
      />
    </>
  )
}

const pending = { width: 24, height: 24, background: 'var(--surface-2)' }

/** Étape 4 : auto-configuration du noyau (runCfg). */
export function StepSetup() {
  const activeN = useApp((s) => s.activeNorms)
  const db = useApp((s) => s.db)
  const cfg = useOnb().cfg ?? 0
  const items = cfgItems(db, activeN)
  const done = cfg >= items.length
  return (
    <>
      <div className="page-kicker">Étape 4 sur 8</div>
      <h2>Auto-configuration du noyau</h2>
      <p className="lead">
        Le noyau active les champs, workflows et tableaux de bord correspondant à :{' '}
        {activeN.map((n) => NORMS[n].code).join(', ')}.
      </p>
      <div className="cfg-list">
        {items.map((it, i) => (
          <div key={it[0]} className="cfg-row">
            {i < cfg ? (
              <span className="a-ic green" style={{ width: 24, height: 24 }}>
                <Icon name="check" size={14} />
              </span>
            ) : i === cfg ? (
              <span className="spin"></span>
            ) : (
              <span className="a-ic" style={pending}></span>
            )}
            <span>
              <b>{it[0]}</b>
              <br />
              <span className="muted small">{it[1]}</span>
            </span>
            <span className="st">
              <StatusBadge value={i < cfg ? 'Terminé' : i === cfg ? 'En cours' : 'En attente'} />
            </span>
          </div>
        ))}
      </div>
      <OnbNav
        prev
        next={done ? () => onbGo(1) : null}
        nextLbl={done ? 'Continuer' : 'Configuration en cours…'}
      />
    </>
  )
}

/** Modifie la liste d'invitations (S.onb.invites) puis re-rend. */
const editInvites = (fn: (l: Invite[]) => void) => update((s) => fn(onbOf(s).invites!))

/** Étape 6 : collaborateurs et rôles. */
export function StepInvites() {
  const invites = useOnb().invites
  const users = useApp((s) => s.users)
  // S.onb.invites = S.onb.invites || USERS.slice(1, 8)… (initialisé à l'affichage)
  useEffect(() => {
    if (!onbOf(useApp.getState()).invites)
      update(
        (s) =>
          void (onbOf(s).invites = s.users
            .slice(1, 8)
            .map((u) => ({ nom: u.nom, email: u.email, roles: u.roles.slice() })))
      )
  }, [])
  const list =
    invites ||
    users.slice(1, 8).map((u) => ({ nom: u.nom, email: u.email, roles: u.roles.slice() }))
  return (
    <>
      <div className="page-kicker">Étape 6 sur 8</div>
      <h2>Invitez vos collaborateurs clés</h2>
      <p className="lead">
        Attribuez un ou plusieurs rôles à chaque personne. Un email d'invitation leur sera envoyé
        après confirmation.
      </p>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Nom et prénom</th>
              <th>Email</th>
              <th>Rôles (cumulables)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((v, i) => (
              <tr key={i}>
                <td>
                  <input
                    className="inp"
                    value={v.nom}
                    onChange={(e) => editInvites((l) => void (l[i].nom = e.target.value))}
                    aria-label="Nom"
                  />
                </td>
                <td>
                  <input
                    className="inp"
                    type="email"
                    value={v.email}
                    onChange={(e) => editInvites((l) => void (l[i].email = e.target.value))}
                    aria-label="Email"
                  />
                </td>
                <td>
                  <div className="chips">
                    {ROLES.map((r) => (
                      <label key={r} className={`chipbox ${v.roles.includes(r) ? 'on' : ''}`}>
                        <input
                          type="checkbox"
                          checked={v.roles.includes(r)}
                          onChange={(e) => {
                            const on = e.target.checked
                            // invRole(i, r, on) de l'original
                            editInvites((l) => {
                              const a = l[i].roles
                              if (on && !a.includes(r)) a.push(r)
                              if (!on) a.splice(a.indexOf(r), 1)
                            })
                          }}
                        />
                        {r}
                      </label>
                    ))}
                  </div>
                </td>
                <td>
                  <button
                    className="icon-btn sq"
                    onClick={() => editInvites((l) => void l.splice(i, 1))}
                    aria-label="Retirer"
                  >
                    <Icon name="x" size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10 }}>
        <button
          className="btn sm"
          onClick={() =>
            editInvites(
              (l) =>
                void l.push({
                  nom: 'Irène DOSSOU',
                  email: 'i.dossou@agrobenin.bj',
                  roles: ['Collaborateur'],
                })
            )
          }
        >
          <Icon name="plus" size={14} /> Ajouter un collaborateur
        </button>
      </div>
      <div className="note" style={{ marginTop: 12 }}>
        Le rôle « Copilote de processus » est facultatif : activez-le uniquement lorsqu'un pilote
        délègue explicitement.
      </div>
      <OnbNav prev next={() => onbGo(1)} />
    </>
  )
}

/** Étape 7 : récapitulatif. */
export function StepRecap() {
  const onb = useOnb()
  const org = useApp((s) => s.org)
  const activeN = useApp((s) => s.activeNorms)
  const prof = onb.prof || {}
  const acc = (onb.props || []).filter((p) => p.dec === 'Acceptée' || p.dec === 'Modifiée').length
  return (
    <>
      <div className="page-kicker">Étape 7 sur 8</div>
      <h2>Récapitulatif</h2>
      <p className="lead">Vérifiez la configuration avant de confirmer.</p>
      <div className="grid g2">
        <div className="card">
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Organisme</h3>
          <dl className="kv">
            <dt>Raison sociale</dt>
            <dd>{prof.nom || org.nom}</dd>
            <dt>Secteur</dt>
            <dd>{prof.secteur || org.secteur}</dd>
            <dt>Taille</dt>
            <dd>{prof.taille || org.taille}</dd>
            <dt>Sites</dt>
            <dd>{(prof.sites || siteOpts()).join(', ')}</dd>
          </dl>
        </div>
        <div className="card">
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Référentiels et configuration</h3>
          <dl className="kv">
            <dt>Normes actives</dt>
            <dd>
              <NormBadges norms={activeN} />
            </dd>
            <dt>Modules configurés</dt>
            <dd>6 modules, 23 sous-parties</dd>
            <dt>Auto-configuration IA</dt>
            <dd>
              {onb.ai === 'applied'
                ? acc + ' proposition(s) validée(s) et appliquée(s)'
                : 'Étape passée — configuration manuelle'}
            </dd>
            <dt>Invitations</dt>
            <dd>{(onb.invites || []).length} collaborateur(s)</dd>
          </dl>
        </div>
      </div>
      <OnbNav prev next={finishOnb} nextLbl="Confirmer et créer l'espace" />
    </>
  )
}

/** Étape 8 : espace prêt, accès au tableau de bord. */
export function StepFinal() {
  const invites = useOnb().invites
  return (
    <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 520 }}>
      <div
        className="a-ic green"
        style={{ width: 64, height: 64, margin: '0 auto 16px', borderRadius: 18 }}
      >
        <Icon name="check" size={30} />
      </div>
      <h2>Votre espace est prêt</h2>
      <p className="lead" style={{ margin: '0 auto 22px' }}>
        {(invites || []).length} invitations ont été envoyées. Le tableau de bord multi-normes
        affiche vos indicateurs, alertes et échéances.
      </p>
      <button
        className="btn primary"
        style={{ padding: '10px 18px' }}
        onClick={() => {
          update((s) => {
            s.ui.history = []
            s.ui.histIndex = -1
          })
          go('dashboard')
        }}
      >
        Accéder au tableau de bord <Icon name="arrow" size={15} />
      </button>
    </div>
  )
}
