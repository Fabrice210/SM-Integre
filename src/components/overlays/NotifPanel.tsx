import { useMemo } from 'react'
import { go } from '../../app/navigation'
import { computeAlerts, type Alert } from '../../services/alerts'
import { logAct, update, useApp } from '../../store/useApp'
import { toast } from '../../store/useOverlays'
import { Icon } from '../ui/Icon'

const ICON: Record<Alert['lvl'], 'warn' | 'bell' | 'clock'> = { red: 'warn', blue: 'bell', amber: 'clock' }

/** notifPanel(alerts) de l'original, avec traiter / relancer / archiver. */
export function NotifPanel() {
  // Sélectionner les sources puis calculer : un sélecteur qui renvoie un nouveau tableau boucle à l'infini
  const db = useApp((s) => s.db)
  const dismissed = useApp((s) => s.ui.dismissed)
  const alerts = useMemo(() => computeAlerts(db, dismissed), [db, dismissed])
  const close = () => update((s) => void (s.ui.notif = false))

  const traiter = (a: Alert) => {
    close()
    go(a.page)
  }
  const relancer = (a: Alert) => {
    update((s) => logAct(s, `a relancé ${a.resp} : ${a.t}`, 'Alertes', 'Relance'))
    toast(`Relance envoyée à ${a.resp} (notification + email).`)
  }
  const archiver = (a: Alert) => {
    update((s) => {
      s.ui.dismissed.push(a.key)
      logAct(s, `a archivé l'alerte « ${a.t} »`, 'Alertes')
    })
    toast('Alerte archivée.')
  }

  return (
    <div className="notif-panel" role="dialog" aria-label="Notifications">
      <div className="card-h">
        <div>
          <h3>Alertes et notifications</h3>
          <div className="sub">Surveillance automatique des échéances — {alerts.length} en cours</div>
        </div>
        <button className="icon-btn sq" onClick={close} aria-label="Fermer">
          <Icon name="x" size={15} />
        </button>
      </div>
      {alerts.length ? (
        alerts.map((a, i) => (
          <div key={a.key + i} className="alert-item">
            <div className={`a-ic ${a.lvl}`}>
              <Icon name={ICON[a.lvl]} size={15} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t">{a.t}</div>
              <div className="d">{a.d}</div>
              <div className="d">Responsable notifié : {a.resp}</div>
              <div className="btn-row" style={{ marginTop: 6 }}>
                <button className="btn sm primary" onClick={() => traiter(a)}>
                  Traiter
                </button>
                <button className="btn sm" onClick={() => relancer(a)}>
                  Relancer
                </button>
                <button className="btn sm ghost" onClick={() => archiver(a)}>
                  Archiver
                </button>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="empty">Aucune alerte : toutes les échéances sont respectées.</div>
      )}
    </div>
  )
}
