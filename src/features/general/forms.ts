import { DIRECTIONS, ROLES } from '../../data/referentiels'
import type { FieldDef, FormDef, Rec } from '../../forms/types'

/** FORMS.users de l'original. */
export const usersForm: FormDef = {
  title: 'Utilisateur',
  prefix: 'u',
  label: 'nom',
  mod: 'Utilisateurs',
  list: (s) => s.users as unknown as Rec[],
  fields: [
    { k: 'nom', l: 'Nom et prénom', req: 1 },
    {
      k: 'email',
      l: 'Email',
      t: 'email',
      req: 1,
      check: (v) => /@/.test(String(v)),
      err: 'Email invalide.',
    },
    { k: 'poste', l: 'Poste', req: 1 },
    { k: 'direction', l: 'Direction', t: 'select', o: DIRECTIONS },
    { k: 'roles', l: 'Rôles (cumulables)', t: 'multi', o: ROLES, req: 1 },
  ],
  def: () => ({
    nom: 'Irène DOSSOU',
    email: 'i.dossou@agrobenin.bj',
    poste: 'Médecin du travail',
    direction: 'Direction des Ressources Humaines',
    roles: ['Collaborateur'],
  }),
  save: (_s, r, n) => (n ? 'Invitation envoyée à ' + r.email + '.' : null),
}

export const TAILLES = [
  'Moins de 50 salariés',
  '50 à 249 salariés',
  '250 à 499 salariés',
  '500 salariés et plus',
]

/** ORG_F de l'original (profil de l'organisme, Paramètres). */
export const ORG_F: FieldDef[] = [
  { k: 'nom', l: 'Raison sociale', req: 1 },
  { k: 'sigle', l: 'Sigle', req: 1 },
  { k: 'secteur', l: 'Secteur', req: 1, full: 1 },
  { k: 'taille', l: 'Taille', t: 'select', o: TAILLES },
  { k: 'effectif', l: 'Effectif', t: 'number', req: 1 },
  { k: 'adresse', l: 'Adresse du siège', req: 1, full: 1 },
  { k: 'telephone', l: 'Téléphone', req: 1 },
  { k: 'email', l: 'Email', t: 'email', req: 1 },
  { k: 'rccm', l: 'RCCM', req: 1 },
  { k: 'ifu', l: 'IFU', req: 1 },
  { k: 'certifs', l: 'Certifications détenues', t: 'textarea' },
]

/** SUP_F de l'original (contact du support, Centre d'aide). */
export const SUP_F: FieldDef[] = [
  { k: 'objet', l: 'Objet', req: 1 },
  { k: 'prio', l: 'Priorité', t: 'select', o: ['Basse', 'Normale', 'Haute'] },
  { k: 'message', l: 'Message', t: 'textarea', req: 1 },
]
