// Inscription des pages, formulaires et fiches du module 5 (Réalisation des activités opérationnelles).
import { registerDetails } from '../../app/detailRegistry'
import { registerPages } from '../../app/pages'
import { registerForms } from '../../forms/registry'
import { FichesPage, fichesForms, fmDetail } from './FichesPage'
import { GedPage, gedForms } from './GedPage'
import { docDetail } from './gedDetail'
import { PlanifPage, planifForms } from './PlanifPage'
import { UrgencesPage, urgDetail, urgencesForms } from './UrgencesPage'

registerPages({
  'm5-ged': GedPage,
  'm5-planif': PlanifPage,
  'm5-urgences': UrgencesPage,
  'm5-fiches': FichesPage,
})
registerForms({ ...gedForms, ...planifForms, ...urgencesForms, ...fichesForms })
registerDetails({ docDetail, urgDetail, fmDetail })
