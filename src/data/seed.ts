// prettier-ignore
/**
 * Données de démonstration, reprises à l'identique de l'original.
 * Généré par scripts/extract-reference.mjs — ne pas modifier à la main.
 * Chargées au premier lancement, puis remplacées par l'état sauvegardé.
 */
export const seed = {
/* ---------------- Module 1 ---------------- */
processus:[
 {id:'P01',code:'P01',intitule:'Management stratégique',categorie:'Pilotage',proprietaire:'Rodrigue AHOUANSOU',finalite:'Définir les orientations, allouer les moyens et piloter la performance globale',entrees:'Contexte, attentes des parties intéressées, résultats de revue',sorties:'Plan stratégique, politique SM, budgets',indicateurs:'Taux de réalisation du plan stratégique',normes:['9001','14001','45001','27001']},
 {id:'P02',code:'P02',intitule:'Management du SM intégré',categorie:'Pilotage',proprietaire:'Florence DOSSOU-YOVO',finalite:'Maintenir et améliorer le système de management QSE-SI',entrees:'Exigences normatives, résultats d\'audits, NC',sorties:'Programme d\'audit, revues, registre d\'amélioration',indicateurs:'Taux de clôture des actions dans les délais',normes:['9001','14001','45001','27001']},
 {id:'P03',code:'P03',intitule:'Achats & approvisionnement',categorie:'Support',proprietaire:'Aïcha BIO SIKA',finalite:'Garantir des matières et services conformes au meilleur coût',entrees:'Besoins exprimés, budget',sorties:'Commandes, fournisseurs évalués',indicateurs:'Taux de fournisseurs critiques évalués',normes:['9001','14001','27001']},
 {id:'P04',code:'P04',intitule:'Réception & stockage des matières premières',categorie:'Réalisation',proprietaire:'Serge KOUTON',finalite:'Réceptionner et stocker les noix de cajou brutes et ananas frais dans les conditions requises',entrees:'Livraisons coopératives, bons de commande',sorties:'Lots stockés et tracés',indicateurs:'Taux d\'humidité des lots conformes',normes:['9001','14001','45001']},
 {id:'P05',code:'P05',intitule:'Transformation & conditionnement',categorie:'Réalisation',proprietaire:'Serge KOUTON',finalite:'Produire amandes de cajou et jus d\'ananas conformes aux spécifications clients',entrees:'Lots matières, ordres de fabrication',sorties:'Produits finis conditionnés',indicateurs:'Taux de rebut, accidents avec arrêt',normes:['9001','14001','45001']},
 {id:'P06',code:'P06',intitule:'Commercialisation & export',categorie:'Réalisation',proprietaire:'Léa GANDAHO',finalite:'Vendre et fidéliser les clients nationaux et export',entrees:'Demandes clients, catalogue',sorties:'Contrats, commandes, satisfaction client',indicateurs:'Indice de satisfaction client',normes:['9001','27001']},
 {id:'P07',code:'P07',intitule:'Logistique & expédition',categorie:'Réalisation',proprietaire:'Martial ADJIBADÉ',finalite:'Livrer dans les délais depuis le Port de Cotonou et par route',entrees:'Produits finis, commandes',sorties:'Livraisons, documents d\'export',indicateurs:'Taux de livraison à l\'heure',normes:['9001','14001']},
 {id:'P08',code:'P08',intitule:'Ressources humaines',categorie:'Support',proprietaire:'Gildas HOUNKPATIN',finalite:'Disposer de collaborateurs compétents et en sécurité',entrees:'Besoins en effectifs et compétences',sorties:'Recrutements, formations, évaluations',indicateurs:'Taux de réalisation du plan de formation',normes:['9001','45001','27001']},
 {id:'P09',code:'P09',intitule:'Maintenance & infrastructures',categorie:'Support',proprietaire:'Bertin SOSSA',finalite:'Assurer la disponibilité des équipements et bâtiments',entrees:'Plan de maintenance, demandes d\'intervention',sorties:'Équipements disponibles',indicateurs:'Taux de disponibilité des lignes',normes:['9001','14001','45001']},
 {id:'P10',code:'P10',intitule:'Systèmes d\'information',categorie:'Support',proprietaire:'Cédric AGBODJAN',finalite:'Fournir un SI disponible et sécurisé',entrees:'Besoins métiers, menaces',sorties:'Services SI, sauvegardes, déclaration d\'applicabilité',indicateurs:'Disponibilité ERP, incidents de sécurité',normes:['27001','9001']},
 {id:'P11',code:'P11',intitule:'Hygiène, sécurité & environnement',categorie:'Support',proprietaire:'Arnaud TCHIBOZO',finalite:'Prévenir les accidents et maîtriser les impacts environnementaux',entrees:'Évaluation des risques, exigences légales',sorties:'Plans de prévention, suivi des déchets',indicateurs:'Taux de fréquence des accidents, tonnage de déchets valorisés',normes:['14001','45001']},
 {id:'P12',code:'P12',intitule:'Finance & comptabilité',categorie:'Support',proprietaire:'Carine AKPLOGAN',finalite:'Garantir la fiabilité financière et le financement des actions SM',entrees:'Budgets, demandes de ressources',sorties:'États financiers, validations budgétaires',indicateurs:'Délai moyen de validation des demandes',normes:['9001','27001']}
],
swot:[
 {id:'SW1',type:'Force',libelle:'Certification ISO 9001 déjà obtenue en 2023',description:'Culture qualité établie, processus documentés',impact:4,normes:['9001']},
 {id:'SW2',type:'Force',libelle:'Partenariat stable avec 42 coopératives de producteurs',description:'Sécurise l\'approvisionnement en noix brutes du Borgou et de l\'Alibori',impact:5,normes:['9001','14001']},
 {id:'SW3',type:'Force',libelle:'Usine récente à la Zone économique spéciale de Glo-Djigbé',description:'Équipements modernes, faible consommation énergétique',impact:4,normes:['14001','45001']},
 {id:'SW4',type:'Faiblesse',libelle:'Dépendance à un ERP non sauvegardé hors site',description:'Risque de perte de données de traçabilité',impact:4,normes:['27001']},
 {id:'SW5',type:'Faiblesse',libelle:'Taux d\'accidents manuels élevé au décorticage',description:'12 accidents avec arrêt en 2025',impact:5,normes:['45001']},
 {id:'SW6',type:'Faiblesse',libelle:'Gestion des coques de cajou encore partielle',description:'40 % des coques non valorisées',impact:3,normes:['14001']}
],
pestel:[
 {id:'PE1',dimension:'Politique',facteur:'Politique nationale de transformation locale du cajou',qualification:'Positif',impact:5,normes:['9001','14001']},
 {id:'PE2',dimension:'Économique',facteur:'Volatilité du prix international de l\'amande de cajou',qualification:'Négatif',impact:4,normes:['9001']},
 {id:'PE3',dimension:'Socioculturel',facteur:'Attente croissante des consommateurs pour des produits tracés',qualification:'Positif',impact:4,normes:['9001']},
 {id:'PE4',dimension:'Technologique',facteur:'Hausse des cyberattaques ciblant les PME exportatrices',qualification:'Négatif',impact:4,normes:['27001']},
 {id:'PE5',dimension:'Environnemental',facteur:'Irrégularité des pluies affectant les récoltes',qualification:'Négatif',impact:4,normes:['14001']},
 {id:'PE6',dimension:'Légal',facteur:'Renforcement des contrôles d\'inspection du travail',qualification:'Négatif',impact:3,normes:['45001']},
 {id:'PE7',dimension:'Environnemental',facteur:'Débouchés pour la valorisation énergétique des coques',qualification:'Positif',impact:3,normes:['14001']},
 {id:'PE8',dimension:'Légal',facteur:'Application du Code du numérique (protection des données)',qualification:'Négatif',impact:3,normes:['27001']}
],
axes:[
 {id:'AX1',code:'AX1',libelle:'Satisfaire durablement nos clients nationaux et export',avancement:72,evaluation:'Satisfaction client à 86 %, objectif 90 % en 2026'},
 {id:'AX2',code:'AX2',libelle:'Protéger la santé et la sécurité de nos collaborateurs',avancement:58,evaluation:'Taux de fréquence en baisse mais au-dessus de la cible'},
 {id:'AX3',code:'AX3',libelle:'Réduire notre empreinte environnementale',avancement:64,evaluation:'Valorisation des coques à 60 %, cible 85 %'},
 {id:'AX4',code:'AX4',libelle:'Sécuriser nos informations et celles de nos clients',avancement:45,evaluation:'Déclaration d\'applicabilité en cours, sauvegarde externalisée à finaliser'}
],
enjeux:[
 {id:'EN1',libelle:'Sécuriser l\'approvisionnement face aux aléas climatiques',source:'Externe (PESTEL)',qualification:'Négatif',axes:['AX1','AX3'],normes:['9001','14001'],origine:'PE5',date:'2026-03-12',statut:'Actif'},
 {id:'EN2',libelle:'Tirer parti de la politique de transformation locale',source:'Externe (PESTEL)',qualification:'Positif',axes:['AX1'],normes:['9001','14001'],origine:'PE1',date:'2026-03-12',statut:'Actif'},
 {id:'EN3',libelle:'Protéger les données de traçabilité contre les cyberattaques',source:'Externe (PESTEL)',qualification:'Négatif',axes:['AX4'],normes:['27001'],origine:'PE4',date:'2026-03-12',statut:'Actif'},
 {id:'EN4',libelle:'Réduire les accidents au décorticage',source:'Interne (SWOT)',qualification:'Négatif',axes:['AX2'],normes:['45001'],origine:'SW5',date:'2026-03-14',statut:'Actif'},
 {id:'EN5',libelle:'Valoriser 100 % des coques de cajou',source:'Interne (SWOT)',qualification:'Négatif',axes:['AX3'],normes:['14001'],origine:'SW6',date:'2026-03-14',statut:'Actif'}
],
analyseVersions:[
 {id:'AV1',version:'v1.0',date:'2025-02-10',auteur:'Florence DOSSOU-YOVO',commentaire:'Analyse initiale après certification ISO 9001',facteurs:9,enjeux:3},
 {id:'AV2',version:'v2.0',date:'2026-03-14',auteur:'Florence DOSSOU-YOVO',commentaire:'Extension QSE-SI : ajout des facteurs SST, environnement et sécurité de l\'information',facteurs:14,enjeux:5}
],
parties:[
 {id:'PI1',nom:'Clients export (Europe, Inde)',categorie:'Externe',normes:['9001','27001'],exigences:'Conformité aux spécifications, traçabilité lot par lot, confidentialité des contrats',pouvoir:5,legitimite:5,urgence:4,plan:'Revue trimestrielle qualité, portail de traçabilité, clauses de confidentialité',planMisEnOeuvre:true},
 {id:'PI2',nom:'Coopératives de producteurs',categorie:'Externe',normes:['9001','14001'],exigences:'Prix juste, paiement rapide, appui technique',pouvoir:4,legitimite:5,urgence:3,plan:'Contrats pluriannuels, formation aux bonnes pratiques post-récolte',planMisEnOeuvre:true},
 {id:'PI3',nom:'Travailleurs et délégués du personnel',categorie:'Interne',normes:['45001','9001'],exigences:'Conditions de travail sûres, consultation, formation',pouvoir:4,legitimite:5,urgence:5,plan:'Réunions mensuelles du comité HS, plan de formation sécurité',planMisEnOeuvre:false},
 {id:'PI4',nom:'Agence Béninoise pour l\'Environnement (ABE)',categorie:'Externe',normes:['14001'],exigences:'Respect du certificat de conformité environnementale, rapports de suivi',pouvoir:5,legitimite:5,urgence:3,plan:'Rapport annuel de suivi environnemental, visites conjointes',planMisEnOeuvre:true},
 {id:'PI5',nom:'Hébergeur cloud et prestataires IT',categorie:'Externe',normes:['27001'],exigences:'Clauses de sécurité, notification d\'incidents sous 72 h',pouvoir:3,legitimite:4,urgence:3,plan:'Avenant sécurité aux contrats, revue annuelle des accès',planMisEnOeuvre:false},
 {id:'PI6',nom:'Riverains de Glo-Djigbé',categorie:'Externe',normes:['14001','45001'],exigences:'Limitation du bruit, des fumées et du trafic poids lourds',pouvoir:2,legitimite:4,urgence:2,plan:'Réunion semestrielle avec le chef d\'arrondissement, registre des plaintes',planMisEnOeuvre:true},
 {id:'PI7',nom:'Direction et actionnaires',categorie:'Interne',normes:['9001','14001','45001','27001'],exigences:'Rentabilité, image, conformité réglementaire',pouvoir:5,legitimite:5,urgence:3,plan:'Revue de direction semestrielle, tableau de bord mensuel',planMisEnOeuvre:true}
],
sites:[
 {id:'S1',nom:'Siège social — Ganhi',adresse:'Lot 1245, Boulevard de la Marina, Cotonou',activite:'Direction, finances, commercial, SI',statut:'Inclus',justification:'Site de pilotage du système de management'},
 {id:'S2',nom:'Usine de Glo-Djigbé',adresse:'Zone économique spéciale de Glo-Djigbé, Abomey-Calavi',activite:'Réception, transformation et conditionnement',statut:'Inclus',justification:'Site de production principal'},
 {id:'S3',nom:'Entrepôt de Porto-Novo',adresse:'Quartier Ouando, Porto-Novo',activite:'Stockage produits finis',statut:'Inclus',justification:'Stockage avant expédition'},
 {id:'S4',nom:'Point de collecte de Parakou',adresse:'Route de Malanville, Parakou',activite:'Collecte saisonnière de noix brutes',statut:'Exclu',justification:'Site saisonnier exploité par un prestataire sous contrat ; maîtrise assurée via l\'évaluation des prestataires (processus P03)'}
],
activites:[
 {id:'AC1',type:'Produit',libelle:'Amandes de cajou blanches entières (W240, W320)',site:'Usine de Glo-Djigbé',statut:'Inclus',justification:'Produit phare export'},
 {id:'AC2',type:'Produit',libelle:'Jus d\'ananas pasteurisé',site:'Usine de Glo-Djigbé',statut:'Inclus',justification:'Marché national et sous-régional'},
 {id:'AC3',type:'Service',libelle:'Appui technique aux coopératives',site:'Siège social — Ganhi',statut:'Inclus',justification:'Impact direct sur la qualité des matières'},
 {id:'AC4',type:'Activité',libelle:'Conception de nouveaux produits (R&D)',site:'Siège social — Ganhi',statut:'Exclu',justification:'Pas d\'activité de conception : formulations fournies par les clients (exclusion ISO 9001 §8.3 justifiée)'},
 {id:'AC5',type:'Processus',libelle:'Hébergement et exploitation du SI de production',site:'Siège social — Ganhi',statut:'Inclus',justification:'Périmètre du SMSI ISO 27001'}
],
domaineVersions:[
 {id:'DV1',version:'v1',date:'2023-01-20',auteur:'Florence DOSSOU-YOVO',commentaire:'Périmètre ISO 9001 initial'},
 {id:'DV2',version:'v2',date:'2026-03-20',auteur:'Florence DOSSOU-YOVO',commentaire:'Extension aux normes 14001, 45001, 27001'}
],
/* ---------------- Module 2 ---------------- */
planStrat:[
 {id:'PS1',version:'v1',titre:'Plan stratégique 2023-2025',fichier:'Plan_strategique_ABI_2023-2025.pdf',dateValidation:'2023-01-10',validePar:'Conseil d\'administration',statut:'Obsolète'},
 {id:'PS2',version:'v2',titre:'Plan stratégique 2026-2028 « Cap Qualité Export »',fichier:'Plan_strategique_ABI_2026-2028.pdf',dateValidation:'2026-01-28',validePar:'Conseil d\'administration',statut:'En vigueur'}
],
champsPerso:[
 {id:'CP1',libelle:'Politique RSE',type:'Document',valeur:'Politique_RSE_ABI_2026.pdf',commentaire:'Adoptée par le CA en février 2026'},
 {id:'CP2',libelle:'Charte éthique et anticorruption',type:'Document',valeur:'Charte_ethique_ABI.pdf',commentaire:'Culture et éthique (préparation ISO 9001:2026 §5.1)'},
 {id:'CP3',libelle:'Politique d\'achats responsables',type:'Texte',valeur:'Privilégier les coopératives certifiées et les fournisseurs locaux',commentaire:'Applicable depuis 2025'}
],
politique:{version:'v3',statut:'Publiée',date:'2026-04-02',signataire:'Rodrigue AHOUANSOU, Directeur Général',
 resume:'AGRO-BÉNIN Industries s\'engage à fournir des produits transformés sûrs et conformes, à protéger la santé et la sécurité de ses collaborateurs, à préserver l\'environnement et à sécuriser les informations qui lui sont confiées.',
 orientations:'1. Satisfaire durablement nos clients par la maîtrise de nos procédés.\n2. Éliminer les dangers et réduire les risques pour la santé et la sécurité, en consultant les travailleurs.\n3. Prévenir la pollution, valoriser nos déchets et réduire nos consommations.\n4. Protéger la confidentialité, l\'intégrité et la disponibilité de nos informations.\n5. Respecter les exigences légales et les engagements pris envers nos parties intéressées.\n6. Améliorer en continu notre système de management intégré.'},
preuvesCom:[
 {id:'PC1',date:'2026-04-05',support:'Affichage',lieu:'Hall de l\'usine et réfectoire',personnes:280,preuve:'Photo_affichage_politique.jpg',objet:'Politique SM v3'},
 {id:'PC2',date:'2026-04-08',support:'Réunion',lieu:'Salle de conférence siège',personnes:36,preuve:'Feuille_presence_reunion_encadrement.pdf',objet:'Politique SM v3'},
 {id:'PC3',date:'2026-04-09',support:'Email',lieu:'Liste tous-collaborateurs',personnes:118,preuve:'Accuses_email_politique.pdf',objet:'Politique SM v3'}
],
accuses:[
 {id:'AR1',collaborateur:'Serge KOUTON',date:'2026-04-09',statut:'Lu'},{id:'AR2',collaborateur:'Aïcha BIO SIKA',date:'2026-04-09',statut:'Lu'},
 {id:'AR3',collaborateur:'Gildas HOUNKPATIN',date:'2026-04-10',statut:'Lu'},{id:'AR4',collaborateur:'Cédric AGBODJAN',date:'2026-04-11',statut:'Lu'},
 {id:'AR5',collaborateur:'Prisca ASSOGBA',date:'2026-04-14',statut:'Lu'},{id:'AR6',collaborateur:'Bertin SOSSA',date:'—',statut:'Non lu'},
 {id:'AR7',collaborateur:'Martial ADJIBADÉ',date:'—',statut:'Non lu'}
],
postes:[
 {id:'FP1',intitule:'Directeur Général',direction:'Direction Générale',titulaire:'Rodrigue AHOUANSOU',mission:'Diriger l\'entreprise et porter le système de management',responsabilites:'Signer la politique SM, présider la revue de direction, allouer les ressources',processus:['P01'],preuve:'Note de service NS-2026-004'},
 {id:'FP2',intitule:'Responsable SM / QSE',direction:'Direction QSE-SI',titulaire:'Florence DOSSOU-YOVO',mission:'Animer et maintenir le SM intégré',responsabilites:'Piloter les audits, les revues, le registre d\'amélioration ; rendre compte à la direction',processus:['P02'],preuve:'Lettre de nomination du 15/01/2026'},
 {id:'FP3',intitule:'Directeur Industriel',direction:'Direction Industrielle',titulaire:'Serge KOUTON',mission:'Garantir la production conforme et sûre',responsabilites:'Piloter P04 et P05, appliquer les fiches de maîtrise opérationnelle',processus:['P04','P05'],preuve:'Note de service NS-2026-006'},
 {id:'FP4',intitule:'Responsable HSE',direction:'Direction QSE-SI',titulaire:'Arnaud TCHIBOZO',mission:'Prévenir les risques SST et environnementaux',responsabilites:'Tenir le registre des risques SST, organiser les exercices d\'urgence',processus:['P11'],preuve:'Note de service NS-2026-007'},
 {id:'FP5',intitule:'Directeur des Systèmes d\'Information',direction:'Direction des Systèmes d\'Information',titulaire:'Cédric AGBODJAN',mission:'Sécuriser et faire évoluer le SI',responsabilites:'Responsable de la sécurité de l\'information, tient la déclaration d\'applicabilité',processus:['P10'],preuve:'Lettre de délégation RSSI du 02/02/2026'},
 {id:'FP6',intitule:'Responsable Achats',direction:'Direction Achats & Logistique',titulaire:'Aïcha BIO SIKA',mission:'Sécuriser les approvisionnements',responsabilites:'Évaluer les fournisseurs critiques, intégrer les clauses QSE-SI',processus:['P03'],preuve:'Note de service NS-2026-009'},
 {id:'FP7',intitule:'Directeur des Ressources Humaines',direction:'Direction des Ressources Humaines',titulaire:'Gildas HOUNKPATIN',mission:'Développer les compétences',responsabilites:'Plan de formation, matrice des compétences, habilitations',processus:['P08'],preuve:'Note de service NS-2026-010'},
 {id:'FP8',intitule:'Directrice Administrative & Financière',direction:'Direction Administrative & Financière',titulaire:'Carine AKPLOGAN',mission:'Piloter les finances',responsabilites:'Valider les demandes de ressources, suivre le coût de la non-qualité',processus:['P12'],preuve:'Note de service NS-2026-011'},
 {id:'FP9',intitule:'Directrice Commerciale',direction:'Direction Commerciale',titulaire:'Léa GANDAHO',mission:'Développer les ventes',responsabilites:'Traiter les réclamations clients, mesurer la satisfaction',processus:['P06'],preuve:'Note de service NS-2026-012'}
],
representants:[
 {id:'RP1',nom:'HOUESSOU',prenom:'Jules',fonction:'Opérateur décorticage — délégué titulaire',mandatDebut:'2024-10-15',mandatFin:'2026-10-15'},
 {id:'RP2',nom:'KPADONOU',prenom:'Estelle',fonction:'Agent de conditionnement — déléguée titulaire',mandatDebut:'2024-10-15',mandatFin:'2026-10-15'},
 {id:'RP3',nom:'ALLAGBÉ',prenom:'Rufin',fonction:'Magasinier — délégué suppléant',mandatDebut:'2025-03-01',mandatFin:'2027-03-01'}
],
comite:[
 {id:'CH1',nom:'TCHIBOZO',prenom:'Arnaud',dateNaissance:'1984-06-11',role:'Secrétaire du comité',mandatFin:'2027-06-30'},
 {id:'CH2',nom:'HOUESSOU',prenom:'Jules',dateNaissance:'1990-02-03',role:'Représentant des travailleurs',mandatFin:'2026-10-15'},
 {id:'CH3',nom:'DOSSOU',prenom:'Irène',dateNaissance:'1979-09-21',role:'Médecin du travail',mandatFin:'2027-12-31'},
 {id:'CH4',nom:'AHOUANSOU',prenom:'Rodrigue',dateNaissance:'1971-12-02',role:'Président (employeur)',mandatFin:'2027-06-30'}
],
reunions:[
 {id:'RC1',date:'2026-07-08',objet:'Bilan des accidents du 1er semestre',participants:'Comité HS au complet, 2 délégués',compteRendu:'Analyse des 5 accidents du semestre ; demande de gants anti-coupure niveau 5',planAction:'Achat de 300 paires de gants — resp. Aïcha BIO SIKA — échéance 31/08/2026',statutPlan:'Clôturé'},
 {id:'RC2',date:'2026-09-02',objet:'Consultation sur la nouvelle ligne de conditionnement',participants:'Comité HS, chef d\'équipe conditionnement',compteRendu:'Les travailleurs demandent un tapis anti-fatigue et une rotation des postes',planAction:'Mise en place de la rotation toutes les 2 h — resp. Serge KOUTON — échéance 15/10/2026',statutPlan:'En cours'}
],
/* ---------------- Module 3 ---------------- */
objectifs:[
 {id:'OB1',code:'OB-01',libelle:'Atteindre 90 % de satisfaction client export',axe:'AX1',kpi:'Indice de satisfaction client',cible:'90 %',delai:'2026-12-31',processus:['P06','P05'],normes:['9001'],efficacite:'En cours d\'évaluation',
  actions:[{libelle:'Déployer l\'enquête satisfaction en ligne',responsable:'Léa GANDAHO',echeance:'2026-06-30',statut:'Clôturé',observation:'Taux de réponse 64 %'},{libelle:'Réduire le délai de traitement des réclamations à 10 jours',responsable:'Léa GANDAHO',echeance:'2026-10-31',statut:'En cours',observation:'Délai actuel 14 jours'},{libelle:'Former les opérateurs au calibrage W240',responsable:'Serge KOUTON',echeance:'2026-09-15',statut:'En cours',observation:'2 sessions sur 3 réalisées'}]},
 {id:'OB2',code:'OB-02',libelle:'Réduire de 50 % les accidents avec arrêt',axe:'AX2',kpi:'Taux de fréquence (TF1)',cible:'TF1 ≤ 8',delai:'2026-12-31',processus:['P05','P11'],normes:['45001'],efficacite:'Partiellement efficace',
  actions:[{libelle:'Équiper tous les postes de décorticage de protections',responsable:'Arnaud TCHIBOZO',echeance:'2026-08-31',statut:'Clôturé',observation:'300 paires de gants distribuées'},{libelle:'Former 100 % des opérateurs aux gestes sûrs',responsable:'Gildas HOUNKPATIN',echeance:'2026-09-30',statut:'En cours',observation:'78 % formés'},{libelle:'Installer des carters sur les décortiqueuses',responsable:'Bertin SOSSA',echeance:'2026-07-31',statut:'Mise en œuvre',observation:'En attente de pièces — retard'}]},
 {id:'OB3',code:'OB-03',libelle:'Valoriser 85 % des coques de cajou',axe:'AX3',kpi:'Taux de valorisation des coques',cible:'85 %',delai:'2027-03-31',processus:['P05','P11'],normes:['14001'],efficacite:'Non évaluée',
  actions:[{libelle:'Contractualiser avec une briqueterie pour les coques',responsable:'Aïcha BIO SIKA',echeance:'2026-11-30',statut:'En cours',observation:'Deux offres reçues'},{libelle:'Installer une chaudière à biomasse',responsable:'Bertin SOSSA',echeance:'2027-02-28',statut:'Mise en œuvre',observation:'Étude de faisabilité validée'}]},
 {id:'OB4',code:'OB-04',libelle:'Externaliser 100 % des sauvegardes critiques',axe:'AX4',kpi:'Taux de systèmes critiques sauvegardés hors site',cible:'100 %',delai:'2026-10-31',processus:['P10'],normes:['27001'],efficacite:'Non évaluée',
  actions:[{libelle:'Signer le contrat de sauvegarde externalisée',responsable:'Cédric AGBODJAN',echeance:'2026-08-15',statut:'Clôturé',observation:'Contrat signé'},{libelle:'Tester la restauration de l\'ERP',responsable:'Cédric AGBODJAN',echeance:'2026-09-10',statut:'Mise en œuvre',observation:'Test reporté — retard'}]}
],
textes:[
 {id:'TX1',intitule:'Loi n°98-004 du 27 janvier 1998 portant Code du travail',domaine:'Santé et sécurité au travail',datePublication:'1998-01-27',lien:'https://sgg.gouv.bj',statut:'Fait',justificatif:'Registre des accidents tenu, visites médicales réalisées',pieces:'Rapport_inspection_travail_2025.pdf',echeance:'2026-11-15',responsable:'Gildas HOUNKPATIN',normes:['45001']},
 {id:'TX2',intitule:'Loi n°98-030 du 12 février 1999 portant loi-cadre sur l\'environnement',domaine:'Environnement',datePublication:'1999-02-12',lien:'https://sgg.gouv.bj',statut:'Fait',justificatif:'Certificat de conformité environnementale délivré',pieces:'CCE_usine_Glo-Djigbe.pdf',echeance:'2026-12-10',responsable:'Arnaud TCHIBOZO',normes:['14001']},
 {id:'TX3',intitule:'Loi n°2017-20 du 20 avril 2018 portant Code du numérique',domaine:'Protection des données',datePublication:'2018-04-20',lien:'https://sgg.gouv.bj',statut:'Pas fait',justificatif:'Déclaration des traitements de données RH non effectuée auprès de l\'APDP',pieces:'Audit_conformite_donnees_2026.pdf',echeance:'2026-09-30',responsable:'Cédric AGBODJAN',normes:['27001']},
 {id:'TX4',intitule:'Décret n°2001-235 du 12 juillet 2001 portant organisation de la procédure d\'étude d\'impact sur l\'environnement',domaine:'Environnement',datePublication:'2001-07-12',lien:'https://sgg.gouv.bj',statut:'Fait',justificatif:'Étude d\'impact réalisée pour l\'usine',pieces:'EIES_usine_2022.pdf',echeance:'2027-01-20',responsable:'Arnaud TCHIBOZO',normes:['14001']},
 {id:'TX5',intitule:'Décret n°2003-332 du 27 août 2003 portant gestion des déchets solides',domaine:'Déchets',datePublication:'2003-08-27',lien:'https://sgg.gouv.bj',statut:'Pas fait',justificatif:'Bordereaux de suivi des déchets incomplets pour le 2e trimestre',pieces:'Bordereaux_dechets_T2.pdf',echeance:'2026-09-15',responsable:'Arnaud TCHIBOZO',normes:['14001']},
 {id:'TX6',intitule:'Loi n°98-019 du 21 mars 2003 portant Code de sécurité sociale',domaine:'Social',datePublication:'2003-03-21',lien:'https://sgg.gouv.bj',statut:'Fait',justificatif:'Déclarations CNSS à jour',pieces:'Attestation_CNSS_2026.pdf',echeance:'2027-03-31',responsable:'Gildas HOUNKPATIN',normes:['45001','9001']}
],
declarations:[
 {id:'DC1',objet:'Non-déclaration des traitements de données RH à l\'APDP',texte:'TX3',cause:'Méconnaissance de l\'obligation lors du déploiement du nouveau SIRH',impact:'Sanction administrative possible, atteinte à l\'image auprès des clients export',planAction:'Constituer le dossier de déclaration et le déposer avant le 30/09/2026',statut:'Soumise',auteur:'Cédric AGBODJAN',date:'2026-09-12',commentaireDG:'En attente de décision du Directeur Général'},
 {id:'DC2',objet:'Bordereaux de suivi des déchets incomplets (T2)',texte:'TX5',cause:'Prestataire de collecte changé en avril sans transfert de la procédure',impact:'Non-conformité réglementaire lors d\'un contrôle de l\'ABE',planAction:'Former le nouveau prestataire et reconstituer les bordereaux manquants',statut:'Validée',auteur:'Arnaud TCHIBOZO',date:'2026-08-20',commentaireDG:'Validée le 22/08/2026 — lier au registre des non-conformités'}
],
risques:[
 {id:'R01',intitule:'Coupure de doigt au poste de décorticage',cause:'Lames exposées, cadence élevée',consequences:'Accident avec arrêt, atteinte à la santé',type:'SST',normes:['45001'],probabilite:4,criticite:3,traitement:'Réduire',processus:['P05'],action:'Installer des carters et former aux gestes sûrs',responsable:'Arnaud TCHIBOZO',echeance:'2026-10-31',statutAction:'En cours',efficacite:'À évaluer',realise:false},
 {id:'R02',intitule:'Contamination des amandes par aflatoxines',cause:'Humidité excessive des noix stockées',consequences:'Rappel de lots, perte de clients export',type:'Qualité',normes:['9001'],probabilite:2,criticite:4,traitement:'Réduire',processus:['P04'],action:'Contrôle systématique de l\'humidité à réception',responsable:'Serge KOUTON',echeance:'2026-07-31',statutAction:'Clôturé',efficacite:'Efficace',realise:false},
 {id:'R03',intitule:'Rançongiciel sur l\'ERP de production',cause:'Absence de sauvegarde hors site, postes non mis à jour',consequences:'Arrêt de la production, perte de traçabilité',type:'Sécurité de l\'information',normes:['27001'],probabilite:3,criticite:4,traitement:'Réduire',processus:['P10'],action:'Sauvegardes externalisées et tests de restauration',responsable:'Cédric AGBODJAN',echeance:'2026-09-10',statutAction:'En cours',efficacite:'À évaluer',realise:false},
 {id:'R04',intitule:'Déversement de soude lors du nettoyage des cuves',cause:'Stockage sans bac de rétention',consequences:'Pollution du sol, brûlures',type:'Environnement',normes:['14001','45001'],probabilite:2,criticite:3,traitement:'Éviter',processus:['P05','P09'],action:'Installer des bacs de rétention sous les stockages chimiques',responsable:'Bertin SOSSA',echeance:'2026-11-30',statutAction:'Mise en œuvre',efficacite:'À évaluer',realise:false},
 {id:'R05',intitule:'Incendie dans le magasin de coques',cause:'Accumulation de coques huileuses inflammables',consequences:'Destruction du stock, blessés',type:'Situation d\'urgence',normes:['14001','45001'],probabilite:2,criticite:4,traitement:'Réduire',processus:['P11'],action:'Réduire le stock et installer une détection incendie',responsable:'Arnaud TCHIBOZO',echeance:'2026-12-15',statutAction:'En cours',efficacite:'À évaluer',realise:false},
 {id:'R06',intitule:'Rupture d\'approvisionnement en noix brutes',cause:'Mauvaise campagne agricole',consequences:'Sous-activité de l\'usine',type:'Qualité',normes:['9001'],probabilite:3,criticite:3,traitement:'Transférer',processus:['P03'],action:'Contrats d\'achat anticipés avec clause de volume',responsable:'Aïcha BIO SIKA',echeance:'2026-12-31',statutAction:'En cours',efficacite:'À évaluer',realise:false},
 {id:'R07',intitule:'Retard de livraison au Port de Cotonou',cause:'Congestion portuaire',consequences:'Pénalités contractuelles',type:'Qualité',normes:['9001'],probabilite:3,criticite:2,traitement:'Accepter',processus:['P07'],action:'Surveillance hebdomadaire des escales',responsable:'Martial ADJIBADÉ',echeance:'2026-12-31',statutAction:'Clôturé',efficacite:'Efficace',realise:true}
],
opportunites:[
 {id:'O01',intitule:'Valorisation énergétique des coques',origine:'Analyse PESTEL (PE7)',benefices:'Réduction de 30 % de la facture énergétique',type:'Environnement',normes:['14001'],probabilite:3,impact:4,exploitation:'Investir dans une chaudière biomasse',processus:['P05','P11'],action:'Étude technico-économique et appel d\'offres',responsable:'Bertin SOSSA',echeance:'2027-02-28',statutAction:'En cours',efficacite:'À évaluer'},
 {id:'O02',intitule:'Label « Transformé au Bénin » pour l\'export',origine:'Politique nationale de transformation (PE1)',benefices:'Prime de prix de 5 % sur les marchés européens',type:'Qualité',normes:['9001'],probabilite:3,impact:3,exploitation:'Déposer le dossier de labellisation',processus:['P06'],action:'Constituer le dossier et auditer la traçabilité',responsable:'Léa GANDAHO',echeance:'2026-12-15',statutAction:'En cours',efficacite:'À évaluer'},
 {id:'O03',intitule:'Portail client de traçabilité sécurisé',origine:'Attente des consommateurs (PE3)',benefices:'Différenciation commerciale, fidélisation',type:'Sécurité de l\'information',normes:['27001','9001'],probabilite:2,impact:3,exploitation:'Développer le portail avec authentification forte',processus:['P10','P06'],action:'Cahier des charges du portail',responsable:'Cédric AGBODJAN',echeance:'2027-01-31',statutAction:'Mise en œuvre',efficacite:'À évaluer'}
],
/* ---------------- Module 4 ---------------- */
ressources:[
 {id:'RS1',besoin:'Chaudière biomasse 500 kW',type:'Matérielle',processus:'P05',disponible:'Chaudière gasoil existante',justification:'Objectif OB-03 et opportunité O01',montant:185000000,circuit:'Finance',dateDemandee:'2026-12-31',dateReelle:'—',statut:'Soumise',demandeur:'Bertin SOSSA'},
 {id:'RS2',besoin:'Technicien sécurité informatique (CDI)',type:'Humaine',processus:'P10',disponible:'1 administrateur système',justification:'Mise en œuvre ISO 27001, risque R03',montant:9600000,circuit:'RH',dateDemandee:'2026-08-01',dateReelle:'—',statut:'Validée',demandeur:'Cédric AGBODJAN'},
 {id:'RS3',besoin:'300 paires de gants anti-coupure niveau 5',type:'Matérielle',processus:'P05',disponible:'Gants niveau 3',justification:'Risque R01, demande du comité HS',montant:2700000,circuit:'Finance',dateDemandee:'2026-08-31',dateReelle:'2026-08-25',statut:'Mise à disposition',demandeur:'Arnaud TCHIBOZO'},
 {id:'RS4',besoin:'Bacs de rétention chimiques (x6)',type:'Infrastructure',processus:'P09',disponible:'Aucun',justification:'Risque R04',montant:4200000,circuit:'Finance',dateDemandee:'2026-09-10',dateReelle:'—',statut:'Validée',demandeur:'Bertin SOSSA'}
],
competences:{
 liste:['Gestes sûrs au décorticage','Calibrage des amandes','Hygiène HACCP','Conduite de chariot élévateur','Lutte incendie','Sensibilisation cybersécurité','Audit interne ISO'],
 requis:{'Gestes sûrs au décorticage':3,'Calibrage des amandes':3,'Hygiène HACCP':3,'Conduite de chariot élévateur':2,'Lutte incendie':2,'Sensibilisation cybersécurité':2,'Audit interne ISO':3},
 collaborateurs:[
  {nom:'Prisca ASSOGBA',direction:'Direction Industrielle',niveaux:[4,3,3,0,2,1,0]},
  {nom:'Jules HOUESSOU',direction:'Direction Industrielle',niveaux:[3,2,2,0,1,1,0]},
  {nom:'Estelle KPADONOU',direction:'Direction Industrielle',niveaux:[2,3,3,0,1,1,0]},
  {nom:'Rufin ALLAGBÉ',direction:'Direction Achats & Logistique',niveaux:[0,0,2,3,2,1,0]},
  {nom:'Nadège ZINSOU',direction:'Direction QSE-SI',niveaux:[1,2,4,0,2,3,4]},
  {nom:'Arnaud TCHIBOZO',direction:'Direction QSE-SI',niveaux:[3,1,3,1,4,2,3]},
  {nom:'Hervé DJOSSOU',direction:'Direction des Systèmes d\'Information',niveaux:[0,0,1,0,1,4,1]}
 ]},
savoirs:[
 {id:'SC1',savoir:'Réglage des décortiqueuses automatiques',detenteurs:'Bertin SOSSA',couverture:'1 détenteur',criticite:'Critique',action:'Former 2 techniciens de maintenance'},
 {id:'SC2',savoir:'Restauration de l\'ERP de production',detenteurs:'Hervé DJOSSOU',couverture:'1 détenteur',criticite:'Critique',action:'Rédiger la procédure et former le nouveau technicien'},
 {id:'SC3',savoir:'Pasteurisation du jus d\'ananas',detenteurs:'Serge KOUTON, Estelle KPADONOU, Prisca ASSOGBA',couverture:'3 détenteurs',criticite:'Couvert',action:'Maintenir'}
],
formations:[
 {id:'FO1',theme:'Gestes sûrs au décorticage',date:'2026-09-28',formateur:'Arnaud TCHIBOZO',participants:'Équipe décorticage B (24 pers.)',statut:'Planifiée',evaluationDate:'2026-10-28',resultat:'—',normes:['45001']},
 {id:'FO2',theme:'Sensibilisation cybersécurité (hameçonnage)',date:'2026-07-15',formateur:'Cédric AGBODJAN',participants:'Personnel administratif (58 pers.)',statut:'Réalisée',evaluationDate:'2026-09-15',resultat:'Niveau 3 Kirkpatrick : taux de clic au test de hameçonnage passé de 31 % à 9 %',normes:['27001']},
 {id:'FO3',theme:'Auditeur interne ISO 45001 et 14001',date:'2026-10-12',formateur:'Cabinet QUALIS Afrique',participants:'6 auditeurs internes',statut:'Planifiée',evaluationDate:'2026-12-12',resultat:'—',normes:['14001','45001']},
 {id:'FO4',theme:'Lutte contre l\'incendie — équipiers de première intervention',date:'2026-05-20',formateur:'Sapeurs-pompiers de Cotonou',participants:'Équipiers EPI (18 pers.)',statut:'Réalisée',evaluationDate:'2026-06-20',resultat:'Niveau 2 : 17/18 validés à l\'exercice pratique',normes:['45001','14001']}
],
communications:[
 {id:'CM1',objectif:'Faire connaître la politique SM v3',quiFait:'Florence DOSSOU-YOVO',cible:'Tous les collaborateurs',moyen:'Affichage + réunion',date:'2026-04-08',statut:'Fait',preuve:'Feuille_presence_reunion_encadrement.pdf',processus:'P02',normes:['9001','14001','45001','27001']},
 {id:'CM2',objectif:'Sensibiliser au port des gants anti-coupure',quiFait:'Arnaud TCHIBOZO',cible:'Opérateurs décorticage',moyen:'Causerie sécurité (quart d\'heure sécurité)',date:'2026-09-01',statut:'Fait',preuve:'Photo_causerie_0109.jpg',processus:'P05',normes:['45001']},
 {id:'CM3',objectif:'Rappeler le tri des déchets à la source',quiFait:'Arnaud TCHIBOZO',cible:'Personnel de l\'usine',moyen:'Affiches en français et en fongbé',date:'2026-10-05',statut:'Pas fait',preuve:'—',processus:'P11',normes:['14001']},
 {id:'CM4',objectif:'Prévenir l\'hameçonnage',quiFait:'Cédric AGBODJAN',cible:'Personnel administratif',moyen:'Email + campagne de test',date:'2026-07-15',statut:'Fait',preuve:'Rapport_campagne_phishing.pdf',processus:'P10',normes:['27001']},
 {id:'CM5',objectif:'Informer les riverains des travaux de la chaudière',quiFait:'Rodrigue AHOUANSOU',cible:'Riverains de Glo-Djigbé',moyen:'Réunion publique à la mairie',date:'2026-11-12',statut:'Pas fait',preuve:'—',processus:'P01',normes:['14001']}
],
/* ---------------- Module 5 ---------------- */
modeles:[
 {id:'MD1',nom:'Modèle de procédure',type:'Procédure',description:'Objet, domaine, responsabilités, logigramme, enregistrements'},
 {id:'MD2',nom:'Modèle d\'instruction de travail',type:'Instruction',description:'Étapes illustrées, EPI requis, points de contrôle'},
 {id:'MD3',nom:'Modèle de fiche d\'enregistrement',type:'Formulaire',description:'Tableau de relevés, visa, date'},
 {id:'MD4',nom:'Modèle de compte-rendu d\'exercice d\'urgence',type:'Enregistrement',description:'Scénario, chronologie, écarts, actions'}
],
documents:[
 {id:'D1',ref:'PR-QSE-01',intitule:'Maîtrise des informations documentées',type:'Procédure',version:'4',proprietaire:'Florence DOSSOU-YOVO',processus:'P02',normes:['9001','14001','45001','27001'],statut:'Diffusé',dateCreation:'2021-05-10',dateRevue:'2026-10-10',droits:'Lecture : tous ; Modification : QSE ; Validation : DG',diffusion:'Tous les pilotes de processus',
  versions:[{v:'3',date:'2024-02-12',auteur:'Florence DOSSOU-YOVO',contenu:'Les documents sont validés par le Responsable Qualité.\nLa revue est annuelle.\nLes documents obsolètes sont détruits.'},{v:'4',date:'2026-03-25',auteur:'Florence DOSSOU-YOVO',contenu:'Les documents sont vérifiés par le pilote puis approuvés par la Direction.\nLa revue est annuelle.\nLes documents obsolètes sont archivés et restent traçables.\nLes documents SMSI sont classés par niveau de confidentialité.'}]},
 {id:'D2',ref:'PR-ACH-02',intitule:'Évaluation des fournisseurs et prestataires',type:'Procédure',version:'2',proprietaire:'Aïcha BIO SIKA',processus:'P03',normes:['9001','14001','27001'],statut:'Approbation',dateCreation:'2022-09-01',dateRevue:'2027-01-15',droits:'Lecture : Achats, QSE ; Validation : DAF',diffusion:'Direction Achats & Logistique',
  versions:[{v:'1',date:'2022-09-01',auteur:'Aïcha BIO SIKA',contenu:'Les fournisseurs sont évalués une fois par an.\nCritères : prix, délai.'},{v:'2',date:'2026-09-05',auteur:'Aïcha BIO SIKA',contenu:'Les fournisseurs critiques sont évalués deux fois par an.\nCritères : prix, délai, qualité, sécurité de l\'information, environnement.\nUn fournisseur noté sous 60 % fait l\'objet d\'un plan de progrès.'}]},
 {id:'D3',ref:'IT-PRO-07',intitule:'Réglage et sécurité des décortiqueuses',type:'Instruction',version:'1',proprietaire:'Serge KOUTON',processus:'P05',normes:['9001','45001'],statut:'Vérification',dateCreation:'2026-09-14',dateRevue:'2027-09-14',droits:'Lecture : production ; Validation : Direction Industrielle',diffusion:'Équipes de décorticage',
  versions:[{v:'1',date:'2026-09-14',auteur:'Serge KOUTON',contenu:'Arrêter la machine avant tout réglage.\nConsigner l\'alimentation électrique.\nPorter les gants niveau 5.'}]},
 {id:'D4',ref:'PR-SI-03',intitule:'Sauvegarde et restauration des données',type:'Procédure',version:'1',proprietaire:'Cédric AGBODJAN',processus:'P10',normes:['27001'],statut:'Rédaction',dateCreation:'2026-09-18',dateRevue:'2027-09-18',droits:'Lecture : DSI ; Validation : DG',diffusion:'Direction des Systèmes d\'Information',
  versions:[{v:'1',date:'2026-09-18',auteur:'Cédric AGBODJAN',contenu:'Sauvegarde quotidienne incrémentale.\nSauvegarde hebdomadaire complète hors site.\nTest de restauration trimestriel.'}]},
 {id:'D5',ref:'PO-SM-01',intitule:'Politique du système de management intégré',type:'Politique',version:'3',proprietaire:'Rodrigue AHOUANSOU',processus:'P01',normes:['9001','14001','45001','27001'],statut:'Diffusé',dateCreation:'2023-01-15',dateRevue:'2026-10-02',droits:'Lecture : tous ; Validation : DG',diffusion:'Tous les collaborateurs',
  versions:[{v:'3',date:'2026-04-02',auteur:'Rodrigue AHOUANSOU',contenu:'Politique intégrée QSE-SI en 6 engagements.'}]},
 {id:'D6',ref:'PR-QUA-04',intitule:'Contrôle à réception des noix brutes',type:'Procédure',version:'2',proprietaire:'Serge KOUTON',processus:'P04',normes:['9001'],statut:'Obsolète',dateCreation:'2020-03-02',dateRevue:'2025-03-02',droits:'Lecture seule (archive)',diffusion:'Archivé',
  versions:[{v:'2',date:'2023-03-02',auteur:'Serge KOUTON',contenu:'Contrôle visuel des sacs.'}]},
 {id:'D7',ref:'EXT-LEG-01',intitule:'Certificat de conformité environnementale (ABE)',type:'Document externe',version:'1',proprietaire:'Arnaud TCHIBOZO',processus:'P11',normes:['14001'],statut:'Diffusé',dateCreation:'2022-11-20',dateRevue:'2026-11-20',droits:'Lecture : QSE, DG',diffusion:'Direction QSE-SI',
  versions:[{v:'1',date:'2022-11-20',auteur:'Arnaud TCHIBOZO',contenu:'Certificat délivré par l\'Agence Béninoise pour l\'Environnement.'}]}
],
plansOps:[
 {id:'PO1',processus:'P05',plan:'Mise en place de la rotation des postes au conditionnement',responsable:'Serge KOUTON',echeance:'2026-10-15',statut:'En cours'},
 {id:'PO2',processus:'P04',plan:'Calibrage mensuel des humidimètres',responsable:'Serge KOUTON',echeance:'2026-09-30',statut:'Fait'},
 {id:'PO3',processus:'P10',plan:'Déploiement des correctifs de sécurité sur 45 postes',responsable:'Cédric AGBODJAN',echeance:'2026-09-25',statut:'En cours'},
 {id:'PO4',processus:'P11',plan:'Réaménagement de l\'aire de stockage des coques',responsable:'Arnaud TCHIBOZO',echeance:'2026-11-30',statut:'Pas fait'},
 {id:'PO5',processus:'P03',plan:'Audit de 5 coopératives critiques',responsable:'Aïcha BIO SIKA',echeance:'2026-12-15',statut:'En cours'}
],
urgences:[
 {id:'SU1',type:'Incendie dans le magasin de coques',procedure:'PR-HSE-05 Plan d\'intervention incendie',consignes:'Déclencher l\'alarme, évacuer vers le point de rassemblement n°2, ne pas utiliser d\'eau sur l\'huile de coque',moyens:'12 extincteurs CO2 et poudre, RIA, réserve d\'eau 60 m³',responsables:'Arnaud TCHIBOZO (chef d\'intervention), Bertin SOSSA (suppléant)',risques:['R05'],sites:['Usine de Glo-Djigbé'],
  exercices:[{date:'2026-03-18',participants:'Équipiers EPI + personnel de nuit',scenario:'Départ de feu dans le magasin de coques à 22 h',procedure:'PR-HSE-05',statut:'Réalisé',compteRendu:'Évacuation en 4 min 30 s (cible 5 min). Un extincteur non vérifié.',actions:'Vérifier tous les extincteurs — Bertin SOSSA — 30/04/2026 (clôturé)'},{date:'2026-10-20',participants:'Tout le personnel de jour',scenario:'Incendie avec victime à évacuer',procedure:'PR-HSE-05',statut:'Planifié',compteRendu:'—',actions:'—'}]},
 {id:'SU2',type:'Déversement de produits chimiques',procedure:'IT-HSE-09 Conduite à tenir en cas de déversement',consignes:'Isoler la zone, porter les EPI chimiques, utiliser le kit absorbant',moyens:'3 kits anti-pollution, douche de sécurité, lave-yeux',responsables:'Arnaud TCHIBOZO',risques:['R04'],sites:['Usine de Glo-Djigbé'],
  exercices:[{date:'2026-06-10',participants:'Équipe nettoyage',scenario:'Fuite de soude sur l\'aire de lavage',procedure:'IT-HSE-09',statut:'En retard',compteRendu:'—',actions:'—'}]},
 {id:'SU3',type:'Cyberattaque paralysant l\'ERP',procedure:'PR-SI-06 Gestion des incidents de sécurité',consignes:'Isoler le réseau, prévenir le DSI, basculer sur les fiches papier de traçabilité',moyens:'Sauvegarde hors site, poste de secours, cellule de crise',responsables:'Cédric AGBODJAN',risques:['R03'],sites:['Siège social — Ganhi','Usine de Glo-Djigbé'],
  exercices:[{date:'2026-11-05',participants:'Cellule de crise, DSI, production',scenario:'Chiffrement de l\'ERP un lundi matin',procedure:'PR-SI-06',statut:'Planifié',compteRendu:'—',actions:'—'}]}
],
fichesMaitrise:[
 {id:'FM1',objet:'Décorticage des noix de cajou',processus:'P05',criteres:'Carters en place, gants niveau 5, cadence ≤ 40 kg/h/opérateur',moyens:'Contrôle visuel à la prise de poste, check-list',responsable:'Serge KOUTON',ressources:'Gants, carters, formation gestes sûrs',risques:['R01'],derniereMaj:'2025-10-02',prochaineMaj:'2026-10-02'},
 {id:'FM2',objet:'Stockage des noix brutes',processus:'P04',criteres:'Humidité ≤ 9 %, sacs sur palettes, rotation FIFO',moyens:'Humidimètre étalonné, registre de stock',responsable:'Serge KOUTON',ressources:'Humidimètres, palettes',risques:['R02'],derniereMaj:'2026-02-15',prochaineMaj:'2027-02-15'},
 {id:'FM3',objet:'Stockage et manipulation des produits chimiques',processus:'P09',criteres:'Bacs de rétention, fiches de données de sécurité affichées',moyens:'Inspection mensuelle HSE',responsable:'Bertin SOSSA',ressources:'Bacs, kits anti-pollution',risques:['R04'],derniereMaj:'2025-09-10',prochaineMaj:'2026-09-10'},
 {id:'FM4',objet:'Administration des accès à l\'ERP',processus:'P10',criteres:'Revue trimestrielle des comptes, authentification forte des administrateurs',moyens:'Journal des accès, revue signée',responsable:'Cédric AGBODJAN',ressources:'Outil de gestion des identités',risques:['R03'],derniereMaj:'2026-06-30',prochaineMaj:'2026-12-30'}
],
/* ---------------- Module 6 ---------------- */
indicateurs:[
 {id:'KP1',objectif:'OB-01',kpi:'Indice de satisfaction client',cible:90,unite:'%',sens:'hausse',moyen:'Enquête semestrielle',echeance:'2026-12-31',processus:'P06',responsable:'Léa GANDAHO',action:'Plan de réduction du délai de réclamation',valeur:86},
 {id:'KP2',objectif:'OB-02',kpi:'Taux de fréquence TF1',cible:8,unite:'',sens:'baisse',moyen:'Registre des accidents',echeance:'2026-12-31',processus:'P11',responsable:'Arnaud TCHIBOZO',action:'Carters + formation gestes sûrs',valeur:11.2},
 {id:'KP3',objectif:'OB-03',kpi:'Taux de valorisation des coques',cible:85,unite:'%',sens:'hausse',moyen:'Bordereaux de sortie des déchets',echeance:'2027-03-31',processus:'P11',responsable:'Arnaud TCHIBOZO',action:'Contrat briqueterie',valeur:60},
 {id:'KP4',objectif:'OB-04',kpi:'Systèmes critiques sauvegardés hors site',cible:100,unite:'%',sens:'hausse',moyen:'Rapport de sauvegarde',echeance:'2026-10-31',processus:'P10',responsable:'Cédric AGBODJAN',action:'Test de restauration ERP',valeur:75},
 {id:'KP5',objectif:'—',kpi:'Taux de livraison à l\'heure',cible:95,unite:'%',sens:'hausse',moyen:'Suivi des expéditions',echeance:'2026-12-31',processus:'P07',responsable:'Martial ADJIBADÉ',action:'Surveillance des escales',valeur:93},
 {id:'KP6',objectif:'—',kpi:'Taux de rebut au conditionnement',cible:2,unite:'%',sens:'baisse',moyen:'Rapport de production',echeance:'2026-12-31',processus:'P05',responsable:'Serge KOUTON',action:'Réglage des doseuses',valeur:1.6},
 {id:'KP7',objectif:'—',kpi:'Réalisation du plan de formation',cible:90,unite:'%',sens:'hausse',moyen:'Registre des formations',echeance:'2026-12-31',processus:'P08',responsable:'Gildas HOUNKPATIN',action:'Relance des sessions reportées',valeur:78}
],
prestataires:[
 {id:'EX1',nom:'Coopérative Wobi de N\'Dali',categorie:'Critique',debut:'2019-11-01',frequence:'Semestrielle',champ:'Qualité des noix, délais, pratiques environnementales',processus:'P03',responsable:'Aïcha BIO SIKA',notes:{qualite:4,delai:3,securite:3,environnement:4}},
 {id:'EX2',nom:'BéninCloud Hébergement SARL',categorie:'Critique',debut:'2025-01-15',frequence:'Annuelle',champ:'Disponibilité, sécurité de l\'information, notification d\'incidents',processus:'P10',responsable:'Cédric AGBODJAN',notes:{qualite:4,delai:4,securite:3,environnement:3}},
 {id:'EX3',nom:'Transports Agossou & Fils',categorie:'Classique',debut:'2021-06-01',frequence:'Annuelle',champ:'Ponctualité, état des véhicules, sécurité routière',processus:'P07',responsable:'Martial ADJIBADÉ',notes:{qualite:3,delai:2,securite:3,environnement:2}},
 {id:'EX4',nom:'EcoCollecte Bénin',categorie:'Critique',debut:'2026-04-01',frequence:'Trimestrielle',champ:'Collecte et traçabilité des déchets',processus:'P11',responsable:'Arnaud TCHIBOZO',notes:{qualite:2,delai:3,securite:3,environnement:2}},
 {id:'EX5',nom:'Cabinet QUALIS Afrique',categorie:'Classique',debut:'2023-02-01',frequence:'Annuelle',champ:'Qualité des formations et des audits',processus:'P02',responsable:'Florence DOSSOU-YOVO',notes:{qualite:4,delai:4,securite:4,environnement:3}}
],
statsSurv:{mois:['Mar','Avr','Mai','Jun','Jul','Aoû','Sep'],incidents:[3,2,4,2,1,2,1],dysfonctionnements:[6,5,7,4,5,3,4],dechets:[18.2,17.5,21.0,19.4,16.8,15.9,14.7]},
auditeurs:[
 {id:'AU1',nom:'Nadège ZINSOU',qualification:'Auditrice interne ISO 9001 et 27001 (certifiée 2024)',normes:['9001','27001'],disponibilite:'Disponible sauf novembre',independance:'Ne peut pas auditer P02'},
 {id:'AU2',nom:'Arnaud TCHIBOZO',qualification:'Auditeur interne ISO 14001 et 45001',normes:['14001','45001'],disponibilite:'Disponible octobre et décembre',independance:'Ne peut pas auditer P11'},
 {id:'AU3',nom:'Cabinet QUALIS Afrique',qualification:'Auditeurs tierce partie IRCA',normes:['9001','14001','45001','27001'],disponibilite:'Sur réservation (préavis 1 mois)',independance:'Indépendant de tous les processus'}
],
audits:[
 {id:'A1',ref:'AUD-2026-01',titre:'Audit processus Achats',date:'2026-02-18',perimetre:'P03',normes:['9001','14001'],auditeur:'Nadège ZINSOU',statut:'Clôturé',rapport:'Rapport_AUD-2026-01.pdf',constats:[{type:'NC mineure',description:'Deux fournisseurs critiques non évalués en 2025',processus:'P03'},{type:'Point fort',description:'Clauses environnementales intégrées aux contrats',processus:'P03'}]},
 {id:'A2',ref:'AUD-2026-02',titre:'Audit SST atelier décorticage',date:'2026-05-12',perimetre:'P05',normes:['45001'],auditeur:'Arnaud TCHIBOZO',statut:'Clôturé',rapport:'Rapport_AUD-2026-02.pdf',constats:[{type:'NC majeure',description:'Carters de protection absents sur 4 décortiqueuses',processus:'P05'},{type:'Observation',description:'Affichage des consignes incomplet',processus:'P05'}]},
 {id:'A3',ref:'AUD-2026-03',titre:'Audit SMSI — gestion des accès et sauvegardes',date:'2026-09-08',perimetre:'P10',normes:['27001'],auditeur:'Nadège ZINSOU',statut:'Rapport déposé',rapport:'Rapport_AUD-2026-03.pdf',constats:[{type:'NC mineure',description:'Test de restauration non réalisé depuis 14 mois',processus:'P10'}]},
 {id:'A4',ref:'AUD-2026-04',titre:'Audit environnement — déchets et produits chimiques',date:'2026-10-14',perimetre:'P11',normes:['14001'],auditeur:'Cabinet QUALIS Afrique',statut:'Plan diffusé',rapport:'—',constats:[]},
 {id:'A5',ref:'AUD-2026-05',titre:'Audit processus Réception & stockage',date:'2026-11-18',perimetre:'P04',normes:['9001','45001'],auditeur:'Arnaud TCHIBOZO',statut:'Planifié',rapport:'—',constats:[]},
 {id:'A6',ref:'AUD-2026-06',titre:'Audit du management du SM intégré',date:'2026-12-09',perimetre:'P02',normes:['9001','14001','45001','27001'],auditeur:'Cabinet QUALIS Afrique',statut:'Planifié',rapport:'—',constats:[]}
],
revues:[
 {id:'RV1',ref:'RD-2026-S1',date:'2026-07-22',type:'Revue de direction semestrielle',normes:['9001','14001','45001','27001'],statut:'Clôturée',
  ordreDuJour:['Suivi des actions de la revue précédente','Changements des enjeux internes et externes','Performance des processus et indicateurs','Résultats des audits','Non-conformités et actions correctives','Adéquation des ressources','Opportunités d\'amélioration'],
  rapportEntree:'Satisfaction client 86 %, TF1 = 11,2, 2 audits clôturés, 9 NC ouvertes, 3 textes réglementaires non conformes.',
  pv:'La direction valide l\'extension de la certification aux normes 14001, 45001 et 27001 pour décembre 2027 et approuve le budget de la chaudière biomasse sous réserve d\'étude.',
  actions:[{libelle:'Recruter un technicien sécurité informatique',responsable:'Gildas HOUNKPATIN',echeance:'2026-10-31',statut:'En cours'},{libelle:'Lancer l\'étude de la chaudière biomasse',responsable:'Bertin SOSSA',echeance:'2026-09-30',statut:'Clôturé'}]},
 {id:'RV2',ref:'RD-2027-S1',date:'2027-01-20',type:'Revue de direction semestrielle',normes:['9001','14001','45001','27001'],statut:'Préparée',
  ordreDuJour:['Suivi des actions de la revue RD-2026-S1','Changements des enjeux internes et externes','Performance des processus et indicateurs','Résultats des audits 2026','Non-conformités et actions correctives','Adéquation des ressources','Opportunités d\'amélioration'],
  rapportEntree:'Généré automatiquement à la clôture de RD-2026-S1 — sera complété à J-15.',pv:'—',actions:[]}
],
ncs:[
 {id:'NC1',ref:'NC-2026-014',categorie:'Non-conformité',source:'Audit',description:'Carters de protection absents sur 4 décortiqueuses',typeActe:'Conformité',cause:'Carters retirés pour faciliter le nettoyage et non remis',action:'Installer des carters à fixation rapide et contrôler à la prise de poste',lieu:'Usine de Glo-Djigbé — atelier décorticage',processus:'P05',normes:['45001'],statut:'En traitement',n1:'Validé',n2:'Approuvé',date:'2026-05-12',declarant:'Arnaud TCHIBOZO',origine:'AUD-2026-02'},
 {id:'NC2',ref:'NC-2026-015',categorie:'Non-conformité',source:'Veille réglementaire',description:'Bordereaux de suivi des déchets incomplets pour le 2e trimestre',typeActe:'Conformité',cause:'Changement de prestataire sans transfert de procédure',action:'Former EcoCollecte Bénin et reconstituer les bordereaux',lieu:'Usine de Glo-Djigbé',processus:'P11',normes:['14001'],statut:'En traitement',n1:'Validé',n2:'Approuvé',date:'2026-08-22',declarant:'Arnaud TCHIBOZO',origine:'Déclaration DC2'},
 {id:'NC3',ref:'INC-2026-022',categorie:'Accident / incident',source:'Terrain',description:'Coupure à l\'index gauche d\'une opératrice (3 jours d\'arrêt)',typeActe:'Dysfonctionnement',cause:'Gant niveau 3 inadapté',action:'Fourniture de gants niveau 5 à tout l\'atelier',lieu:'Atelier décorticage, poste 12',processus:'P05',normes:['45001'],statut:'Clôturée',n1:'Validé',n2:'Approuvé',date:'2026-06-03',declarant:'Prisca ASSOGBA',origine:'Terrain'},
 {id:'NC4',ref:'NC-2026-023',categorie:'Non-conformité',source:'Réclamation client',description:'Lot W320 n°2026-188 avec 4 % de brisures (tolérance 2 %)',typeActe:'Conformité',cause:'Réglage de la trieuse optique décalé',action:'Recalibrer la trieuse et renforcer le contrôle final',lieu:'Ligne de conditionnement 2',processus:'P05',normes:['9001'],statut:'Déclarée',n1:'En attente',n2:'En attente',date:'2026-09-16',declarant:'Léa GANDAHO',origine:'Client Nordic Nuts AB'},
 {id:'NC5',ref:'AM-2026-006',categorie:'Piste d\'amélioration',source:'Terrain',description:'Mettre un code couleur sur les bacs de tri des déchets',typeActe:'Dysfonctionnement',cause:'Erreurs de tri fréquentes',action:'Acheter des bacs de couleur et afficher la signalétique',lieu:'Usine de Glo-Djigbé',processus:'P11',normes:['14001'],statut:'Validée pilote',n1:'Validé',n2:'En attente',date:'2026-09-10',declarant:'Prisca ASSOGBA',origine:'Boîte à idées'},
 {id:'NC6',ref:'NC-2026-024',categorie:'Non-conformité',source:'Audit',description:'Test de restauration de l\'ERP non réalisé depuis 14 mois',typeActe:'Conformité',cause:'Absence de procédure de sauvegarde formalisée',action:'Rédiger PR-SI-03 et réaliser un test trimestriel',lieu:'Salle serveurs du siège',processus:'P10',normes:['27001'],statut:'Déclarée',n1:'En attente',n2:'En attente',date:'2026-09-09',declarant:'Nadège ZINSOU',origine:'AUD-2026-03'},
 {id:'NC7',ref:'OBS-2026-004',categorie:'Observation',source:'Revue',description:'Indicateurs de maintenance non consolidés mensuellement',typeActe:'Dysfonctionnement',cause:'Pas de responsable de consolidation désigné',action:'Désigner un responsable et automatiser l\'extraction',lieu:'Siège',processus:'P09',normes:['9001'],statut:'Clôturée',n1:'Validé',n2:'Approuvé',date:'2026-07-22',declarant:'Florence DOSSOU-YOVO',origine:'RD-2026-S1'}
],
sourcesNC:['Audit','Terrain','Réclamation client','Incident','Revue','Veille réglementaire','Risque réalisé','Boîte à idées'],
registre:[
 {id:'RG1',ref:'RG-2026-031',type:'Non-conformité',intitule:'Carters absents sur 4 décortiqueuses',origine:'Audit AUD-2026-02',processus:'P05',normes:['45001'],statut:'En cours',date:'2026-05-12',responsable:'Bertin SOSSA'},
 {id:'RG2',ref:'RG-2026-032',type:'Non-conformité',intitule:'Bordereaux de déchets incomplets',origine:'Veille réglementaire (DC2)',processus:'P11',normes:['14001'],statut:'En cours',date:'2026-08-22',responsable:'Arnaud TCHIBOZO'},
 {id:'RG3',ref:'RG-2026-033',type:'Incident',intitule:'Coupure à l\'index — poste 12',origine:'Terrain',processus:'P05',normes:['45001'],statut:'Clôturé',date:'2026-06-03',responsable:'Arnaud TCHIBOZO'},
 {id:'RG4',ref:'RG-2026-034',type:'Action de revue',intitule:'Recruter un technicien sécurité informatique',origine:'Revue RD-2026-S1',processus:'P08',normes:['27001'],statut:'En cours',date:'2026-07-22',responsable:'Gildas HOUNKPATIN'},
 {id:'RG5',ref:'RG-2026-035',type:'Action d\'audit',intitule:'Évaluer les 2 fournisseurs critiques manquants',origine:'Audit AUD-2026-01',processus:'P03',normes:['9001'],statut:'Clôturé',date:'2026-02-18',responsable:'Aïcha BIO SIKA'},
 {id:'RG6',ref:'RG-2026-036',type:'Risque réalisé',intitule:'Retard de livraison au Port de Cotonou (R07)',origine:'Risque R07',processus:'P07',normes:['9001'],statut:'Clôturé',date:'2026-04-09',responsable:'Martial ADJIBADÉ'},
 {id:'RG7',ref:'RG-2026-037',type:'Observation',intitule:'Indicateurs de maintenance non consolidés',origine:'Revue RD-2026-S1',processus:'P09',normes:['9001'],statut:'Clôturé',date:'2026-07-22',responsable:'Bertin SOSSA'}
],
/* ---------------- Transverse ---------------- */
mapping:[
 {id:'MP1',norme:'9001',version:'2015',article:'4.1',libelle:'Compréhension de l\'organisme et de son contexte',module:'1.1 Enjeux',type:'Commune',preuve:'Analyse SWOT/PESTEL validée',couverture:100},
 {id:'MP2',norme:'9001',version:'2015',article:'4.2',libelle:'Besoins et attentes des parties intéressées',module:'1.2 Parties intéressées',type:'Commune',preuve:'Registre des parties intéressées',couverture:100},
 {id:'MP3',norme:'9001',version:'2015',article:'4.3',libelle:'Domaine d\'application',module:'1.3 Domaine d\'application',type:'Commune',preuve:'Document « Domaine d\'application »',couverture:100},
 {id:'MP4',norme:'9001',version:'2015',article:'4.4',libelle:'Système de management et processus',module:'1.4 Cartographie des processus',type:'Commune',preuve:'Cartographie et fiches processus',couverture:100},
 {id:'MP5',norme:'9001',version:'2015',article:'5.2',libelle:'Politique',module:'2.2 Politique SM',type:'Commune',preuve:'Politique signée et preuves de communication',couverture:100},
 {id:'MP6',norme:'9001',version:'2015',article:'6.1',libelle:'Actions face aux risques et opportunités',module:'3.4 Risques et opportunités',type:'Commune',preuve:'Registre des risques et opportunités',couverture:90},
 {id:'MP7',norme:'9001',version:'2015',article:'7.5',libelle:'Informations documentées',module:'5.1 GED',type:'Commune',preuve:'Procédure PR-QSE-01 et liste des documents',couverture:95},
 {id:'MP8',norme:'9001',version:'2015',article:'8.4',libelle:'Maîtrise des prestataires externes',module:'6.1 Surveillance et mesures',type:'Spécifique',preuve:'Évaluations des prestataires',couverture:80},
 {id:'MP9',norme:'9001',version:'2015',article:'9.2',libelle:'Audit interne',module:'6.2 Audits',type:'Commune',preuve:'Programme et rapports d\'audit',couverture:85},
 {id:'MP10',norme:'9001',version:'2015',article:'9.3',libelle:'Revue de direction',module:'6.3 Revues',type:'Commune',preuve:'PV de revue de direction',couverture:100},
 {id:'MP11',norme:'14001',version:'2026',article:'6.1.2',libelle:'Aspects environnementaux',module:'3.4 Risques et opportunités',type:'Spécifique',preuve:'Registre aspects-impacts (vue filtrée)',couverture:75},
 {id:'MP12',norme:'14001',version:'2026',article:'6.1.3',libelle:'Obligations de conformité',module:'3.3 Veille réglementaire',type:'Spécifique',preuve:'Registre réglementaire évalué',couverture:70},
 {id:'MP13',norme:'14001',version:'2026',article:'6.3',libelle:'Planification et gestion des changements',module:'3.4 Risques et opportunités',type:'Spécifique',preuve:'Fiche d\'analyse d\'impact du changement',couverture:40},
 {id:'MP14',norme:'14001',version:'2026',article:'8.2',libelle:'Préparation et réponse aux situations d\'urgence',module:'5.3 Situations d\'urgence',type:'Commune',preuve:'Fiches d\'urgence et comptes-rendus d\'exercice',couverture:70},
 {id:'MP15',norme:'45001',version:'2018',article:'5.4',libelle:'Consultation et participation des travailleurs',module:'2.4 Consultation et participation',type:'Spécifique',preuve:'PV des réunions du comité HS',couverture:90},
 {id:'MP16',norme:'45001',version:'2018',article:'6.1.2',libelle:'Identification des dangers et évaluation des risques',module:'3.4 Risques et opportunités',type:'Spécifique',preuve:'DUERP (vue SST du registre)',couverture:80},
 {id:'MP17',norme:'45001',version:'2018',article:'8.1',libelle:'Maîtrise opérationnelle',module:'3.2 Fiche de maîtrise opérationnelle',type:'Commune',preuve:'Fiches de maîtrise à jour',couverture:65},
 {id:'MP18',norme:'45001',version:'2018',article:'10.2',libelle:'Événement indésirable, NC et action corrective',module:'6.4 Non-conformités',type:'Commune',preuve:'Registre des incidents et actions',couverture:85},
 {id:'MP19',norme:'27001',version:'2022',article:'6.1.3',libelle:'Traitement des risques de sécurité — déclaration d\'applicabilité',module:'3.4 Risques et opportunités',type:'Spécifique',preuve:'Déclaration d\'applicabilité (SoA)',couverture:45},
 {id:'MP20',norme:'27001',version:'2022',article:'7.3',libelle:'Sensibilisation',module:'4.3 Communication',type:'Commune',preuve:'Campagnes de sensibilisation',couverture:90},
 {id:'MP21',norme:'27001',version:'2022',article:'A.8.13',libelle:'Sauvegarde des informations',module:'3.2 Fiche de maîtrise opérationnelle',type:'Spécifique',preuve:'Procédure PR-SI-03 et rapports de test',couverture:35},
 {id:'MP22',norme:'27001',version:'2022',article:'9.2',libelle:'Audit interne',module:'6.2 Audits',type:'Commune',preuve:'Rapport AUD-2026-03',couverture:80}
],
journal:[
 {d:'2026-09-19 16:42',u:'Aïcha BIO SIKA',a:'a soumis PR-ACH-02 v2 à l\'approbation',mod:'GED',statut:'En attente'},
 {d:'2026-09-18 11:05',u:'Cédric AGBODJAN',a:'a créé le document PR-SI-03 « Sauvegarde et restauration »',mod:'GED',statut:'Brouillon'},
 {d:'2026-09-16 15:20',u:'Léa GANDAHO',a:'a déclaré la non-conformité NC-2026-023 (réclamation client)',mod:'Non-conformités',statut:'Déclarée'},
 {d:'2026-09-12 09:48',u:'Cédric AGBODJAN',a:'a soumis la déclaration DC1 au Directeur Général',mod:'Veille',statut:'En attente'},
 {d:'2026-09-09 17:10',u:'Nadège ZINSOU',a:'a déposé le rapport AUD-2026-03',mod:'Audits',statut:'Terminé'},
 {d:'2026-09-02 12:30',u:'Arnaud TCHIBOZO',a:'a enregistré la réunion de consultation du 02/09',mod:'Consultation',statut:'Terminé'},
 {d:'2026-08-25 10:15',u:'Carine AKPLOGAN',a:'a confirmé la mise à disposition des gants anti-coupure',mod:'Ressources',statut:'Terminé'}
],
cloturesMois:{labels:['Mar','Avr','Mai','Jun','Jul','Aoû','Sep'],clotures:[7,9,6,12,14,10,8],ouvertures:[11,8,13,9,10,7,9]},
cloturesAn:{labels:['2021','2022','2023','2024','2025','2026'],clotures:[38,52,71,86,94,66],ouvertures:[45,60,74,80,97,67]}
};

export type Seed = typeof seed
