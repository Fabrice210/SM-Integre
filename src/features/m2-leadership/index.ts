// Inscription des pages et formulaires du module 2 — Leadership.
import { registerPages } from '../../app/pages'
import { registerForms } from '../../forms/registry'
import { ConsultationPage } from './ConsultationPage'
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
