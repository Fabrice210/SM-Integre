// Inscription des pages, formulaires et fiches du module 2 — Leadership.
import { registerDetails } from '../../app/detailRegistry'
import { registerPages } from '../../app/pages'
import { registerForms } from '../../forms/registry'
import { ConsultationPage } from './ConsultationPage'
import { repDetail, reuDetail } from './consultationActions'
import { diffuserNoyau } from './diffusion'
import { EngagementPage } from './EngagementPage'
import { M2_FORMS } from './forms'
import { PolitiquePage } from './PolitiquePage'
import { RolesPage } from './RolesPage'

registerPages({
  'm2-engagement': EngagementPage,
  'm2-politique': PolitiquePage,
  'm2-roles': RolesPage,
  'm2-consultation': ConsultationPage,
})
registerForms(M2_FORMS)
registerDetails({ repDetail, reuDetail, diffuserNoyau })
