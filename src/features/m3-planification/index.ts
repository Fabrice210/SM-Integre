// Inscription des pages, formulaires et fiches du module 3 — Planification.
import { registerDetails } from '../../app/detailRegistry'
import { registerPages } from '../../app/pages'
import { registerForms } from '../../forms/registry'
import { FichesPage, fichesForms, fmDetail } from './FichesPage'
import './forms'
import { ObjectifsPage } from './ObjectifsPage'
import { objDetail } from './objectifs'
import { oppDetail, riskDetail } from './risques'
import { RisquesPage } from './RisquesPage'
import { declDetail, qualifUrgence, txDetail } from './veille'
import { VeillePage } from './VeillePage'

registerPages({
  'm3-objectifs': ObjectifsPage,
  'm3-fiches': FichesPage,
  'm3-veille': VeillePage,
  'm3-risques': RisquesPage,
})

registerForms(fichesForms)
registerDetails({ objDetail, txDetail, declDetail, riskDetail, oppDetail, qualifUrgence, fmDetail })
