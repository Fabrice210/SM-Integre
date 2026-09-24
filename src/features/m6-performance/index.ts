// Inscription des pages, formulaires et fiches du module 6 (Évaluation des performances).
import { registerDetails } from '../../app/detailRegistry'
import { registerPages } from '../../app/pages'
import { registerForms } from '../../forms/registry'
import { AuditsPage } from './AuditsPage'
import { audDetail, auditsForms } from './audits'
import { ncDetail, ncForms } from './nc'
import { NcPage } from './NcPage'
import { RegistrePage, regDetail } from './RegistrePage'
import { RevuesPage, revDetail, revuesForms } from './RevuesPage'
import { SurveillancePage } from './SurveillancePage'
import { surveillanceForms } from './surveillanceForms'

registerPages({
  'm6-surveillance': SurveillancePage,
  'm6-audits': AuditsPage,
  'm6-revues': RevuesPage,
  'm6-nc': NcPage,
  'm6-registre': RegistrePage,
})
registerForms({ ...surveillanceForms, ...auditsForms, ...revuesForms, ...ncForms })
registerDetails({ audDetail, revDetail, ncDetail, regDetail })
