"""
Colonnes des exports tabulaires.

Les colonnes sont des clés du front (forme de `db`). Pour les collections qui ont un
tableau exportable dans l'interface (DataTable avec `exportName`), SPECS reprend le nom
de fichier et les colonnes de ce tableau ; sinon toutes les clés présentes sont
exportées, avec un en-tête lisible (LABELS, ou la clé « décamelisée »).
"""

import re

# collection -> (nom de fichier du front, [(clé, en-tête)])
SPECS: dict[str, tuple[str, list[tuple[str, str]]]] = {
    "processus": (
        "Fiches_processus",
        [
            ("code", "Code"),
            ("intitule", "Processus"),
            ("categorie", "Catégorie"),
            ("proprietaire", "Pilote"),
            ("copilote", "Copilote(s)"),
            ("finalite", "Finalité"),
            ("normes", "Normes"),
        ],
    ),
    "enjeux": (
        "Enjeux",
        [
            ("libelle", "Enjeu"),
            ("source", "Source"),
            ("qualification", "Qualification"),
            ("axes", "Axes de la politique"),
            ("normes", "Normes"),
            ("date", "Identifié le"),
            ("statut", "Statut"),
        ],
    ),
    "parties": (
        "Parties_interessees",
        [
            ("nom", "Partie intéressée"),
            ("categorie", "Catégorie"),
            ("exigences", "Exigences"),
            ("pouvoir", "Pouvoir"),
            ("legitimite", "Légitimité"),
            ("urgence", "Urgence"),
            ("plan", "Plan de réponse"),
            ("normes", "Normes"),
        ],
    ),
    "sites": (
        "Sites",
        [
            ("nom", "Site"),
            ("adresse", "Adresse"),
            ("activite", "Activité principale"),
            ("monnaie", "Monnaie"),
        ],
    ),
    "activites": ("Activites_couvertes", [("type", "Type"), ("libelle", "Libellé"), ("site", "Site")]),
    "applicabilite": (
        "Applicabilite_normative",
        [
            ("norme", "Norme"),
            ("article", "Article / exigence"),
            ("exclu", "Exclu"),
            ("justification", "Justification"),
            ("commentaire", "Commentaire"),
        ],
    ),
    "planStrat": (
        "Plans_strategiques",
        [
            ("version", "Version"),
            ("titre", "Titre"),
            ("dateValidation", "Validé le"),
            ("validePar", "Validé par"),
            ("statut", "Statut"),
        ],
    ),
    "preuvesCom": (
        "Preuves_communication_politique",
        [
            ("objet", "Objet"),
            ("date", "Date"),
            ("support", "Support"),
            ("lieu", "Lieu ou canal"),
            ("personnes", "Personnes touchées"),
        ],
    ),
    "postes": (
        "Fiches_de_poste",
        [
            ("intitule", "Poste"),
            ("titulaire", "Titulaire"),
            ("direction", "Direction"),
            ("processus", "Processus"),
            ("responsabilites", "Responsabilités SM"),
            ("preuve", "Preuve de communication"),
        ],
    ),
    "representants": (
        "Representants",
        [
            ("prenom", "Prénom"),
            ("nom", "Nom"),
            ("fonction", "Fonction"),
            ("qualiteLien", "Qualité du lien"),
            ("suppleant", "Suppléant"),
            ("mandatDebut", "Début"),
            ("mandatFin", "Fin de mandat"),
            ("statut", "État"),
        ],
    ),
    "comite": (
        "Comite_HS",
        [
            ("prenom", "Prénom"),
            ("nom", "Nom"),
            ("dateNaissance", "Date de naissance"),
            ("role", "Rôle"),
            ("mandatFin", "Fin de mandat"),
        ],
    ),
    "reunions": (
        "Reunions_consultation",
        [
            ("datePrevue", "Date"),
            ("objet", "Objet"),
            ("participants", "Participants"),
            ("compteRendu", "Compte rendu"),
            ("statut", "Statut"),
        ],
    ),
    "objectifs": (
        "Objectifs",
        [
            ("code", "Code"),
            ("libelle", "Objectif"),
            ("kpi", "KPI"),
            ("cible", "Cible"),
            ("delai", "Délai"),
            ("processus", "Processus"),
            ("efficacite", "Efficacité"),
            ("normes", "Normes"),
        ],
    ),
    "textes": (
        "Registre_reglementaire",
        [
            ("intitule", "Texte"),
            ("categorie", "Catégorie"),
            ("domaine", "Domaine"),
            ("datePublication", "Publié le"),
            ("statut", "Statut"),
            ("statutDiff", "Diffusion"),
            ("justificatif", "Justificatif"),
            ("pieces", "Pièces"),
            ("echeance", "Échéance"),
            ("responsable", "Responsable"),
            ("normes", "Normes"),
        ],
    ),
    "rapportsConf": (
        "Rapports_conformite",
        [
            ("ref", "Référence"),
            ("titre", "Titre"),
            ("statut", "Conclusion"),
            ("date", "Date"),
            ("auteur", "Auteur"),
        ],
    ),
    "risques": (
        "Registre_risques",
        [
            ("id", "Réf."),
            ("intitule", "Risque"),
            ("cause", "Cause"),
            ("type", "Type"),
            ("probabilite", "Probabilité"),
            ("criticite", "Criticité"),
            ("traitement", "Traitement"),
            ("action", "Action"),
            ("responsable", "Responsable"),
            ("echeance", "Échéance"),
            ("statutAction", "Statut"),
            ("normes", "Normes"),
        ],
    ),
    "opportunites": (
        "Registre_opportunites",
        [
            ("id", "Réf."),
            ("intitule", "Opportunité"),
            ("origine", "Origine"),
            ("benefices", "Bénéfices"),
            ("probabilite", "Probabilité"),
            ("impact", "Impact"),
            ("exploitation", "Exploitation"),
            ("action", "Action"),
            ("responsable", "Responsable"),
            ("statutAction", "Statut"),
            ("normes", "Normes"),
        ],
    ),
    "fichesMaitrise": (
        "Fiches_maitrise_operationnelle",
        [
            ("objet", "Activité à risque"),
            ("criteres", "Critères opérationnels"),
            ("moyens", "Moyens de maîtrise"),
            ("responsable", "Responsable"),
            ("risques", "Risques"),
            ("prochaineMaj", "Prochaine mise à jour"),
        ],
    ),
    "ressources": (
        "Demandes_ressources",
        [
            ("besoin", "Besoin"),
            ("type", "Type"),
            ("disponible", "Bilan disponible"),
            ("montant", "Montant"),
            ("circuit", "Circuit"),
            ("dateDemandee", "Demandée pour"),
            ("dateReelle", "Réelle"),
            ("statut", "Statut"),
        ],
    ),
    "savoirs": (
        "Savoirs_critiques",
        [
            ("savoir", "Savoir critique"),
            ("detenteurs", "Détenteurs"),
            ("couverture", "Couverture"),
            ("criticite", "Situation"),
            ("action", "Plan de formation thématique"),
        ],
    ),
    "formations": (
        "Plan_de_formation",
        [
            ("theme", "Thème"),
            ("date", "Date"),
            ("participants", "Participants"),
            ("statut", "Statut"),
            ("evaluationDate", "Évaluation post-formation"),
            ("resultat", "Résultat"),
            ("normes", "Normes"),
        ],
    ),
    "communications": (
        "Plan_de_communication",
        [
            ("type", "Type"),
            ("objectif", "Objectif"),
            ("quiFait", "Qui fait"),
            ("cible", "Cible"),
            ("moyen", "Moyen"),
            ("date", "Date prévue"),
            ("dateRealisation", "Réalisée le"),
            ("statut", "Statut"),
            ("preuve", "Preuve"),
        ],
    ),
    "documents": (
        "Liste_des_documents",
        [
            ("ref", "Référence"),
            ("intitule", "Intitulé"),
            ("type", "Type"),
            ("version", "Version"),
            ("redacteur", "Rédacteur"),
            ("approbateur", "Approbateur"),
            ("processus", "Processus"),
            ("statut", "Statut"),
            ("dateRevue", "Prochaine revue"),
            ("normes", "Normes"),
        ],
    ),
    "plansOps": (
        "Planification_operationnelle",
        [
            ("processus", "Processus"),
            ("plan", "Plan d'action"),
            ("responsable", "Responsable unique"),
            ("echeance", "Échéance"),
            ("statut", "Statut"),
        ],
    ),
    "indicateurs": (
        "Indicateurs",
        [
            ("kpi", "Indicateur"),
            ("cible", "Cible"),
            ("unite", "Unité"),
            ("moyen", "Moyen de mesure"),
            ("echeance", "Échéance"),
            ("processus", "Processus"),
            ("responsable", "Responsable"),
            ("action", "Action"),
            ("valeur", "Valeur"),
        ],
    ),
    "prestataires": (
        "Intervenants_externes",
        [
            ("nom", "Intervenant"),
            ("categorie", "Catégorie"),
            ("frequence", "Fréquence"),
            ("champ", "Champ d'évaluation"),
            ("processus", "Processus"),
            ("responsable", "Responsable"),
        ],
    ),
    "auditeurs": (
        "Auditeurs",
        [
            ("nom", "Auditeur"),
            ("qualification", "Qualification"),
            ("normes", "Normes"),
            ("disponibilite", "Disponibilité"),
            ("independance", "Indépendance"),
        ],
    ),
    "audits": (
        "Programme_audit",
        [
            ("ref", "Référence"),
            ("titre", "Audit"),
            ("date", "Date"),
            ("perimetre", "Périmètre"),
            ("auditeur", "Auditeur"),
            ("statut", "Statut"),
            ("rapport", "Rapport"),
            ("constats", "Constats"),
            ("normes", "Normes"),
        ],
    ),
    "revues": (
        "Planification_revues",
        [
            ("ref", "Référence"),
            ("type", "Type / objet"),
            ("date", "Date de pilotage"),
            ("participants", "Participants"),
            ("ordreDuJour", "Ordre du jour"),
            ("rapportEntree", "Rapport d'entrée"),
            ("pv", "Procès-verbal"),
            ("statut", "Statut"),
        ],
    ),
    "ncs": (
        "Non_conformites",
        [
            ("ref", "Référence"),
            ("categorie", "Catégorie"),
            ("description", "Description"),
            ("source", "Source"),
            ("typeActe", "Type d'acte"),
            ("processus", "Processus"),
            ("statut", "Statut"),
            ("normes", "Normes"),
        ],
    ),
    "registre": (
        "Registre_amelioration_continue",
        [
            ("ref", "Référence"),
            ("type", "Type"),
            ("intitule", "Intitulé"),
            ("origine", "Origine"),
            ("processus", "Processus"),
            ("responsable", "Responsable"),
            ("date", "Date"),
            ("statut", "Statut"),
            ("normes", "Normes"),
        ],
    ),
    "mapping": (
        "Couverture_normative",
        [
            ("norme", "Norme"),
            ("version", "Version"),
            ("article", "Article"),
            ("libelle", "Exigence"),
            ("module", "Module du noyau"),
            ("preuve", "Preuve attendue"),
            ("couverture", "Couverture (%)"),
        ],
    ),
    "journal": (
        "Journal_audit",
        [
            ("d", "Date et heure"),
            ("u", "Utilisateur"),
            ("a", "Action"),
            ("mod", "Module"),
            ("statut", "Statut"),
        ],
    ),
    "users": (
        "Utilisateurs",
        [
            ("nom", "Utilisateur"),
            ("email", "E-mail"),
            ("poste", "Poste"),
            ("direction", "Direction"),
            ("roles", "Rôles"),
        ],
    ),
}

# En-têtes des clés courantes hors SPECS.
LABELS = {
    "id": "Identifiant",
    "ref": "Référence",
    "code": "Code",
    "nom": "Nom",
    "prenom": "Prénom",
    "libelle": "Libellé",
    "intitule": "Intitulé",
    "titre": "Titre",
    "type": "Type",
    "description": "Description",
    "date": "Date",
    "statut": "Statut",
    "normes": "Normes",
    "norme": "Norme",
    "processus": "Processus",
    "responsable": "Responsable",
    "auteur": "Auteur",
    "commentaire": "Commentaire",
    "version": "Version",
    "impact": "Impact",
    "qualification": "Qualification",
    "facteur": "Facteur",
    "dimension": "Dimension",
    "avancement": "Avancement",
    "evaluation": "Évaluation",
    "valeur": "Valeur",
    "collaborateur": "Collaborateur",
    "echeance": "Échéance",
    "justification": "Justification",
    "preuve": "Preuve",
}


def humanize(key: str) -> str:
    """dateValidation -> « Date validation »."""
    if key in LABELS:
        return LABELS[key]
    words = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", key).lower()
    return words[:1].upper() + words[1:]


def columns_for(name: str, rows: list[dict]) -> tuple[str, list[tuple[str, str]]]:
    """(nom de fichier, colonnes) d'une collection, d'après SPECS ou les clés présentes."""
    if name in SPECS:
        return SPECS[name]
    keys: list[str] = []
    for r in rows:
        for k in r:
            if k not in keys and k != "hist":
                keys.append(k)
    return name, [(k, humanize(k)) for k in keys]
