// Inscription des pages, formulaires et fiches du module 5 (Réalisation des activités opérationnelles).
import { registerDetails } from '../../app/detailRegistry'
import { registerPages } from '../../app/pages'
import { registerForms } from '../../forms/registry'
import { GedPage, gedForms } from './GedPage'
import { docDetail } from './gedDetail'
import { PlanifPage, planifForms } from './PlanifPage'
import { UrgencesPage, urgDetail, urgencesForms } from './UrgencesPage'

registerPages({
  'm5-ged': GedPage,
  'm5-planif': PlanifPage,
  'm5-urgences': UrgencesPage,
})
registerForms({ ...gedForms, ...planifForms, ...urgencesForms })
registerDetails({ docDetail, urgDetail })
