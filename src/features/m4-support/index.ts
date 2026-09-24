// Inscription des pages, formulaires et fiches du module 4 — Support.
import { registerDetails } from '../../app/detailRegistry'
import { registerPages } from '../../app/pages'
import { CommunicationPage } from './CommunicationPage'
import { CompetencesPage } from './CompetencesPage'
import './forms'
import { resDetail } from './ressources'
import { RessourcesPage } from './RessourcesPage'

registerPages({
  'm4-ressources': RessourcesPage,
  'm4-competences': CompetencesPage,
  'm4-communication': CommunicationPage,
})

registerDetails({ resDetail })
