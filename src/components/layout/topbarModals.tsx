import { detailOpeners } from '../../app/detailRegistry'
import { go } from '../../app/navigation'
import { logout } from '../../features/auth/logout'
import { API_MODE, ApiError } from '../../services/api'
import { exportMyData } from '../../services/session'
import { pendingValidations } from '../../services/alerts'
import { currentUser, update, useApp } from '../../store/useApp'
import { closeModal, openModal, toast } from '../../store/useOverlays'
import { Icon } from '../ui/Icon'

/** openPending() de l'original : validations en attente. */
export function openPending() {
  const L = pendingValidations(useApp.getState().db)
  openModal({
    title: 'Validations en attente',
    sub: 'Éléments soumis à un circuit de validation',
    body: L.length ? (
      <div className="linklist">
        {L.map((x, i) => (
          <button
            key={i}
            className="linkitem"
            onClick={() => {
              closeModal()
              go(x.page)
              setTimeout(() => detailOpeners[x.detail.fn]?.(x.detail.id), 50)
            }}
          >
            <span>
              <b>{x.t}</b>
              <br />
              <span className="muted">{x.d}</span>
            </span>
            <Icon name="arrow" size={15} />
          </button>
        ))}
      </div>
    ) : (
      <div className="empty">Aucune validation en attente.</div>
    ),
  })
}

/** openProfile() de l'original : profil + simulation d'un autre utilisateur. */
export function openProfile() {
  const s = useApp.getState()
  const u = currentUser(s)
  openModal({
    title: 'Mon profil',
    sub: 'Les rôles sont cumulables : un même compte peut porter plusieurs rôles.',
    body: (
      <>
        <div className="kv">
          <dt>Nom</dt>
          <dd>{u.nom}</dd>
          <dt>Email</dt>
          <dd>{u.email}</dd>
          <dt>Poste</dt>
          <dd>{u.poste}</dd>
          <dt>Direction</dt>
          <dd>{u.direction}</dd>
          <dt>Rôles</dt>
          <dd>
            {u.roles.map((r, i) => (
              <span key={r}>
                {i > 0 ? ' ' : null}
                <span className="badge b-green">{r}</span>
              </span>
            ))}
          </dd>
          <dt>Organisme</dt>
          <dd>{s.org.nom}</dd>
        </div>
        <hr className="sep" />
        <div className="field">
          <label htmlFor="simU">Simuler la vue d'un autre utilisateur (démonstration)</label>
          <select className="inp" id="simU" defaultValue={u.id}>
            {s.users.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nom} — {x.roles.join(', ')}
              </option>
            ))}
          </select>
        </div>
      </>
    ),
    foot: (
      <>
        {API_MODE ? (
          <button
            className="btn"
            title="Droit d'accès et à la portabilité : fichier JSON de vos données personnelles"
            onClick={() => {
              exportMyData()
                .then((f) => toast(`Vos données personnelles ont été exportées (${f}).`))
                .catch((e) =>
                  toast(
                    `Export impossible : ${e instanceof ApiError ? e.message : 'erreur inconnue'}.`,
                    'warn'
                  )
                )
            }}
          >
            <Icon name="dl" size={15} /> Exporter mes données
          </button>
        ) : null}
        <button
          className="btn danger"
          onClick={() => {
            closeModal()
            logout()
          }}
        >
          <Icon name="out" size={15} /> Se déconnecter
        </button>
        <button
          className="btn primary"
          onClick={() => {
            const id = (document.getElementById('simU') as HTMLSelectElement).value
            update((d) => {
              if (d.session) d.session.userId = id
            })
            closeModal()
            toast('Vous naviguez en tant que ' + currentUser(useApp.getState()).nom + '.')
          }}
        >
          Appliquer
        </button>
      </>
    ),
  })
}
