import { Fragment } from 'react'
import { DataTable } from '../../components/data/DataTable'
import { Icon } from '../../components/ui/Icon'
import { PageHead } from '../../components/ui/PageHead'
import { useTabs } from '../../components/ui/Tabs'
import { DIRECTIONS, ROLES, type User } from '../../data/referentiels'
import { openForm } from '../../forms/crud'
import { initials } from '../../lib/format'
import { useApp } from '../../store/useApp'

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
                r: (u) => (
                  <button
                    className="btn sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      openForm('users', u.id)
                    }}
                  >
                    <Icon name="edit" size={13} /> Modifier
                  </button>
                ),
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
