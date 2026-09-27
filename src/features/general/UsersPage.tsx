import { Fragment } from 'react'
import { DataTable } from '../../components/data/DataTable'
import { Icon } from '../../components/ui/Icon'
import { PageHead } from '../../components/ui/PageHead'
import { useTabs } from '../../components/ui/Tabs'
import { DIRECTIONS, ROLES, type User } from '../../data/referentiels'
import { openForm } from '../../forms/crud'
import { initials } from '../../lib/format'
import { API_MODE, ApiError } from '../../services/api'
import { anonymiseUser } from '../../services/session'
import { currentUser, useApp } from '../../store/useApp'
import { closeModal, openModal, toast } from '../../store/useOverlays'

const ADMIN_ROLES = ['Responsable SM', 'Administrateur système']

/** Compte déjà anonymisé par le serveur (e-mail neutre non routable). */
const isAnonymised = (u: User) => u.email.endsWith('@anonymise.invalid')

/**
 * Mode API : droit à l'effacement exercé par un administrateur (confirmation, option de
 * remplacement du nom dans les données, puis rechargement de l'état du serveur).
 */
function confirmAnonymise(u: User) {
  let busy = false
  openModal(
    {
      title: 'Anonymiser ce compte ?',
      body: (
        <>
          <p>
            Le compte de « {u.nom} » sera désactivé ; son nom, son e-mail, son poste et sa direction
            seront remplacés par des valeurs neutres, ses sessions révoquées et ses préférences de
            notification supprimées. Cette action est irréversible et tracée dans le journal
            d'audit.
          </p>
          <label className="toggle">
            <input type="checkbox" id="anonReplace" />
            <span className="small">
              Remplacer aussi son nom dans les données du registre, le journal et la trace technique
              (sinon l'historique conserve son nom pour la traçabilité ISO)
            </span>
          </label>
        </>
      ),
      foot: (
        <>
          <button className="btn" onClick={() => closeModal('modal2')}>
            Annuler
          </button>
          <button
            className="btn danger"
            onClick={() => {
              if (busy) return
              busy = true
              const replace = (document.getElementById('anonReplace') as HTMLInputElement).checked
              anonymiseUser(u.id, replace)
                .then((r) => {
                  closeModal('modal2')
                  toast(`Compte anonymisé : ${r.nom}.`)
                })
                .catch((e) => {
                  busy = false
                  toast(
                    `Anonymisation impossible : ${e instanceof ApiError ? e.message : 'erreur inconnue'}.`,
                    'warn'
                  )
                })
            }}
          >
            <Icon name="trash" size={15} /> Anonymiser
          </button>
        </>
      ),
    },
    'modal2'
  )
}

const PROFILS = [
  [
    'Dirigeant / Direction générale',
    'Vue stratégique, tous référentiels',
    'Lecture globale, tableaux de bord, validation de la revue de direction, arbitrages',
    'Pilote de processus, Responsable SM',
  ],
  [
    'Responsable SM / QSE',
    'Pilotage opérationnel du SM',
    'Lecture/écriture sur tous les modules, administration des référentiels actifs, validation transverse',
    'Pilote, Auditeur',
  ],
  [
    'Pilote de processus',
    'Un ou plusieurs processus',
    'Écriture sur ses processus, risques, indicateurs, actions ; validation des contributions de son équipe',
    'Copilote, Responsable SM',
  ],
  [
    'Copilote de processus (optionnel)',
    'Suppléance ponctuelle',
    'Mêmes droits que le pilote, activé sur délégation explicite',
    'Pilote (autre processus)',
  ],
  [
    'Auditeur interne',
    'Transverse, en mission',
    'Lecture élargie pendant la campagne, écriture sur les constats',
    'Pilote (non audité par lui-même)',
  ],
  [
    'Collaborateur / Contributeur',
    'Un processus ou une tâche',
    'Déclaration, consultation, soumission pour validation',
    '—',
  ],
  [
    'Administrateur système',
    'Technique',
    'Paramétrage des référentiels, comptes, configuration',
    'Non cumulé avec un rôle métier',
  ],
]

/** PAGES.users de l'original : utilisateurs et matrice des droits. */
export function UsersPage() {
  const users = useApp((s) => s.users)
  const me = useApp((s) => (API_MODE ? currentUser(s) : null))
  const canAnonymise = (u: User) =>
    !!me && me.roles.some((r) => ADMIN_ROLES.includes(r)) && u.id !== me.id && !isAnonymised(u)
  const [t, tb] = useTabs('users', [
    ['list', 'Utilisateurs'],
    ['matrix', 'Matrice des droits'],
  ])
  return (
    <>
      <PageHead
        kicker="Gouvernance applicative"
        title="Utilisateurs et rôles"
        desc="Les profils sont des rôles cumulables, pas des comptes distincts."
      />
      {tb}
      {t === 'list' ? (
        <div className="card">
          <DataTable<User>
            id="users"
            cols={[
              {
                l: 'Utilisateur',
                r: (u) => (
                  <div className="btn-row">
                    <span className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>
                      {initials(u.nom)}
                    </span>
                    <span>
                      <span className="ttl">{u.nom}</span>
                      <br />
                      <span className="ref">{u.email}</span>
                    </span>
                  </div>
                ),
              },
              { l: 'Poste', k: 'poste' },
              { l: 'Direction', k: 'direction' },
              {
                l: 'Rôles',
                r: (u) =>
                  u.roles.map((r, i) => (
                    <Fragment key={r}>
                      {i > 0 ? ' ' : ''}
                      <span className="badge b-green">{r}</span>
                    </Fragment>
                  )),
              },
              {
                l: '',
                r: (u) => {
                  const edit = (
                    <button
                      className="btn sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        openForm('users', u.id)
                      }}
                    >
                      <Icon name="edit" size={13} /> Modifier
                    </button>
                  )
                  if (!canAnonymise(u)) return edit
                  return (
                    <div className="btn-row">
                      {edit}
                      <button
                        className="btn sm danger"
                        title="Droit à l'effacement : anonymiser ce compte"
                        onClick={(e) => {
                          e.stopPropagation()
                          confirmAnonymise(u)
                        }}
                      >
                        <Icon name="trash" size={13} /> Anonymiser
                      </button>
                    </div>
                  )
                },
              },
            ]}
            rows={users}
            search={['nom', 'email', 'poste']}
            filters={[
              { k: 'direction', l: 'Direction', o: DIRECTIONS },
              { k: 'roles', l: 'Rôle', o: ROLES },
            ]}
            onAdd={() => openForm('users')}
            addLabel="Inviter un utilisateur"
            exportName="Utilisateurs"
            collection="users"
            norm={false}
          />
        </div>
      ) : (
        <div className="card">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Profil</th>
                  <th>Portée</th>
                  <th>Droits typiques</th>
                  <th>Cumul possible avec</th>
                </tr>
              </thead>
              <tbody>
                {PROFILS.map((r) => (
                  <tr key={r[0]}>
                    {r.map((c, i) => (
                      <td key={i} className={i ? '' : 'ttl'}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
