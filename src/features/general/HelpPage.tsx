import { Icon } from '../../components/ui/Icon'
import { PageHead } from '../../components/ui/PageHead'
import { readForm } from '../../forms/formControllers'
import { FormRenderer } from '../../forms/FormRenderer'
import { logAct, update } from '../../store/useApp'
import { toast } from '../../store/useOverlays'
import { SUP_F } from './forms'

const GUIDES = [
  [
    'Consulter un module',
    "Choisissez un module dans le menu, puis une sous-partie : la liste des éléments s'affiche. Cliquez sur une ligne pour ouvrir le détail, ses liens et son historique.",
  ],
  [
    'Créer ou modifier un élément',
    "Utilisez « Ajouter » : le formulaire est prérempli avec un exemple. À l'enregistrement, si une validation est requise, l'élément suit le circuit : soumission, décision du valideur, refus avec retour à l'auteur ou validation avec mise à jour du registre concerné.",
  ],
  [
    'Surveiller les échéances',
    'Les dépassements déclenchent une alerte, notifiée au responsable. Depuis la cloche : traiter, relancer si non clôturé, archiver une fois clôturé.',
  ],
  [
    'Exporter et partager',
    "Chaque liste propose un export Excel et PDF. Le bouton « Exporter » en haut à droite génère le PDF de l'écran courant. La couverture normative produit un dossier d'audit en un clic.",
  ],
  [
    'Filtrer par référentiel',
    'Le sélecteur en haut de page filtre toutes les listes sur une norme ; « Vue croisée » affiche les exigences communes et spécifiques.',
  ],
  [
    'Assistant IA',
    'Disponible sur chaque écran avec des suggestions adaptées. Il ne modifie jamais vos données sans validation humaine.',
  ],
]

const SUP_REC = {
  objet: 'Question sur le workflow GED',
  message:
    'Bonjour, comment ajouter un second vérificateur dans le circuit de validation des procédures ? Merci.',
  prio: 'Normale',
}

/** PAGES.help de l'original : guide d'utilisation et contact du support. */
export function HelpPage() {
  return (
    <>
      <PageHead
        kicker="Guide d'utilisation"
        title="Centre d'aide"
        desc="Les parcours communs à tous les modules."
      />
      <div className="grid g2">
        {GUIDES.map(([t, d]) => (
          <div key={t} className="card">
            <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t}</h3>
            <p className="muted" style={{ margin: 0 }}>
              {d}
            </p>
          </div>
        ))}
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-h">
          <h3>Contacter le support</h3>
        </div>
        <div id="supForm">
          <FormRenderer formId="supForm" fields={SUP_F} rec={SUP_REC} />
        </div>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button
            className="btn primary"
            onClick={() => {
              if (readForm('supForm')) {
                toast('Demande envoyée au support — réponse sous 24 h ouvrées.')
                update((s) => logAct(s, 'a contacté le support', 'Aide'))
              }
            }}
          >
            <Icon name="send" size={15} /> Envoyer la demande
          </button>
        </div>
      </div>
    </>
  )
}
