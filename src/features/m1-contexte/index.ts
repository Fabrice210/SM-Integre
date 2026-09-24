// Inscription des pages, formulaires et fiches du module 1 — Contexte de l'organisme.
import { registerDetails } from '../../app/detailRegistry'
import { registerPages } from '../../app/pages'
import { registerForms } from '../../forms/registry'
import { enjDetail, piDetail, procDetail, siteDetail } from './details'
import { DomainePage } from './DomainePage'
import { EnjeuxPage } from './EnjeuxPage'
import { M1_FORMS } from './forms'
import { PartiesPage } from './PartiesPage'
import { ProcessusPage } from './ProcessusPage'

registerPages({
  'm1-enjeux': EnjeuxPage,
  'm1-parties': PartiesPage,
  'm1-domaine': DomainePage,
  'm1-processus': ProcessusPage,
})
registerForms(M1_FORMS)
registerDetails({ enjDetail, piDetail, procDetail, siteDetail })
