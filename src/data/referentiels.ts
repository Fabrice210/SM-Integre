// prettier-ignore
/**
 * Référentiels repris à l'identique de l'original (reference/original.html).
 * USERS et ORG servent de valeurs initiales : les versions modifiables vivent
 * dans l'état sauvegardé (store), car l'application permet de les éditer.
 */
export const TODAY = new Date('2026-09-21T09:00:00');
export const NORMS = {
  '9001': {code:'ISO 9001', nom:'Management de la qualité', version:'2015 (transition 2026 prête)', couleur:'var(--n9001)'},
  '14001':{code:'ISO 14001',nom:'Management environnemental', version:'2026', couleur:'var(--n14001)'},
  '45001':{code:'ISO 45001',nom:'Santé et sécurité au travail', version:'2018', couleur:'var(--n45001)'},
  '27001':{code:'ISO 27001',nom:"Sécurité de l'information", version:'2022', couleur:'var(--n27001)'}
};
export const ALL_N = ['9001','14001','45001','27001'];

export const USERS = [
  {id:'u1',nom:'Florence DOSSOU-YOVO',email:'f.dossou-yovo@agrobenin.bj',poste:'Responsable SM / QSE',direction:'Direction QSE-SI',roles:['Responsable SM','Pilote de processus']},
  {id:'u2',nom:'Rodrigue AHOUANSOU',email:'r.ahouansou@agrobenin.bj',poste:'Directeur Général',direction:'Direction Générale',roles:['Dirigeant','Pilote de processus']},
  {id:'u3',nom:'Serge KOUTON',email:'s.kouton@agrobenin.bj',poste:'Directeur Industriel',direction:'Direction Industrielle',roles:['Pilote de processus']},
  {id:'u4',nom:'Aïcha BIO SIKA',email:'a.biosika@agrobenin.bj',poste:'Responsable Achats',direction:'Direction Achats & Logistique',roles:['Pilote de processus']},
  {id:'u5',nom:'Gildas HOUNKPATIN',email:'g.hounkpatin@agrobenin.bj',poste:'Directeur des Ressources Humaines',direction:'Direction des Ressources Humaines',roles:['Pilote de processus']},
  {id:'u6',nom:'Cédric AGBODJAN',email:'c.agbodjan@agrobenin.bj',poste:'Directeur des Systèmes d\'Information',direction:'Direction des Systèmes d\'Information',roles:['Pilote de processus']},
  {id:'u7',nom:'Arnaud TCHIBOZO',email:'a.tchibozo@agrobenin.bj',poste:'Responsable HSE',direction:'Direction QSE-SI',roles:['Pilote de processus','Auditeur interne']},
  {id:'u8',nom:'Nadège ZINSOU',email:'n.zinsou@agrobenin.bj',poste:'Chargée qualité',direction:'Direction QSE-SI',roles:['Auditeur interne','Collaborateur']},
  {id:'u9',nom:'Prisca ASSOGBA',email:'p.assogba@agrobenin.bj',poste:'Cheffe d\'équipe conditionnement',direction:'Direction Industrielle',roles:['Collaborateur']},
  {id:'u10',nom:'Bertin SOSSA',email:'b.sossa@agrobenin.bj',poste:'Responsable Maintenance',direction:'Direction Industrielle',roles:['Pilote de processus']},
  {id:'u11',nom:'Léa GANDAHO',email:'l.gandaho@agrobenin.bj',poste:'Directrice Commerciale',direction:'Direction Commerciale',roles:['Pilote de processus']},
  {id:'u12',nom:'Martial ADJIBADÉ',email:'m.adjibade@agrobenin.bj',poste:'Responsable Logistique',direction:'Direction Achats & Logistique',roles:['Pilote de processus']},
  {id:'u13',nom:'Carine AKPLOGAN',email:'c.akplogan@agrobenin.bj',poste:'Directrice Administrative & Financière',direction:'Direction Administrative & Financière',roles:['Pilote de processus']},
  {id:'u14',nom:'Hervé DJOSSOU',email:'h.djossou@agrobenin.bj',poste:'Administrateur plateforme',direction:'Direction des Systèmes d\'Information',roles:['Administrateur système']}
];
export const DIRECTIONS = ['Direction Générale','Direction QSE-SI','Direction Industrielle','Direction Achats & Logistique','Direction Commerciale','Direction des Ressources Humaines','Direction Administrative & Financière','Direction des Systèmes d\'Information'];
export const ROLES = ['Dirigeant','Responsable SM','Pilote de processus','Copilote de processus','Auditeur interne','Collaborateur','Administrateur système'];
export const ORG = {nom:'AGRO-BÉNIN Industries SA',sigle:'ABI',secteur:'Agro-industrie — transformation de noix de cajou et d\'ananas',taille:'250 à 499 salariés',effectif:312,ville:'Cotonou',pays:'Bénin',rccm:'RB/COT/19 B 24587',ifu:'3201910245871',adresse:'Lot 1245, Boulevard de la Marina, Ganhi — Cotonou',telephone:'+229 01 21 31 45 60',email:'contact@agrobenin.bj',certifs:'ISO 9001:2015 (certifié 2023), autres en préparation'};
export const MOIS = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];

/** Couleur de badge selon le libellé de statut. */
export const ST_COL = {
  green:['Fait','Clôturé','Clôturée','Conforme','Diffusé','Approuvé','Validée','Validé','Réalisé','Réalisée','Publiée','Efficace','Lu','Mise à disposition','En vigueur','Actif','Inclus','Couvert','Terminé','Point fort','Approuvée RSM','Disponible'],
  amber:['En cours','Mise en œuvre','Soumise','Vérification','Approbation','Planifié','Planifiée','Plan diffusé','Rapport déposé','À traiter','En attente','En traitement','Validée pilote','Préparée','Partiellement efficace','À évaluer','Observation','NC mineure','Brouillon','Rédaction','En cours d\'évaluation','Non évaluée','Moyen'],
  red:['Pas fait','Refusée','Refusé','En retard','Non conforme','Non lu','NC majeure','Exclu','Critique','Obsolète','Déclarée','Élevé','Très élevé'],
  blue:['Classique','Planifiée ','Positif','Faible']
};

export const MODS = [
 {id:'m1',n:1,l:'Contexte de l\'organisme',ic:'org',subs:[['m1-enjeux','1.1 Enjeux'],['m1-parties','1.2 Parties intéressées'],['m1-domaine','1.3 Domaine d\'application'],['m1-processus','1.4 Cartographie des processus']]},
 {id:'m2',n:2,l:'Leadership',ic:'lead',subs:[['m2-engagement','2.1 Engagement de la direction'],['m2-politique','2.2 Politique SM'],['m2-roles','2.3 Rôles et responsabilités'],['m2-consultation','2.4 Consultation et participation']]},
 {id:'m3',n:3,l:'Planification',ic:'plan',subs:[['m3-objectifs','3.1 Objectifs et plans d\'action'],['m3-veille','3.2 Veille et mise en conformité'],['m3-risques','3.3 Risques et opportunités']]},
 {id:'m4',n:4,l:'Support',ic:'supp',subs:[['m4-ressources','4.1 Ressources'],['m4-competences','4.2 Compétences'],['m4-communication','4.3 Communication']]},
 {id:'m5',n:5,l:'Maîtrise opérationnelle',ic:'ops',subs:[['m5-ged','5.1 Gestion électronique des documents'],['m5-planif','5.2 Planification opérationnelle'],['m5-urgences','5.3 Situations d\'urgence'],['m5-fiches','5.4 Fiche de maîtrise opérationnelle']]},
 {id:'m6',n:6,l:'Performance & amélioration',ic:'perf',subs:[['m6-surveillance','6.1 Surveillance et mesures'],['m6-audits','6.2 Audits'],['m6-revues','6.3 Revues'],['m6-nc','6.4 Non-conformités et actions'],['m6-registre','6.5 Registre d\'amélioration continue']]}
];
export const MOD_FULL = {m1:'Module 1 — Contexte de l\'organisme',m2:'Module 2 — Leadership',m3:'Module 3 — Planification',m4:'Module 4 — Support',m5:'Module 5 — Maîtrise opérationnelle',m6:'Module 6 — Évaluation des performances et amélioration continue'};
export const GEN = [['cover','Couverture normative','cover'],['journal','Journal d\'audit','log'],['users','Utilisateurs et rôles','users'],['settings','Paramètres','set'],['help','Centre d\'aide','help']];

export type NormId = '9001' | '14001' | '45001' | '27001'
export type User = (typeof USERS)[number]
export type Org = typeof ORG
