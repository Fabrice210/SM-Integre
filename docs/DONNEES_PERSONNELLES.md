# Données personnelles — registre des traitements de la plateforme

Ce document décrit les données personnelles traitées par la plateforme SM Intégré (mode API :
backend Django + front React) et les mécanismes que le code fournit pour respecter le
**Code du numérique de la République du Bénin (livre V, protection des données à caractère
personnel)**, dans l'esprit du RGPD européen.

> **Avertissement.** Ce document décrit le fonctionnement technique de la plateforme. Il ne
> constitue ni un avis juridique ni une attestation de conformité. La conformité relève de
> l'organisme qui exploite la plateforme (responsable du traitement) : il doit compléter les
> points signalés « **À compléter** », faire valider l'ensemble par son délégué à la
> protection des données (DPO) ou son conseil, et accomplir les formalités auprès de
> l'**APDP** (Autorité de Protection des Données à caractère Personnel).

## 1. Rôles

| Rôle | Qui | À compléter |
|---|---|---|
| Responsable du traitement | Chaque organisme utilisateur, pour les données de son espace | Raison sociale, adresse, représentant |
| Sous-traitant (le cas échéant) | L'exploitant de l'instance (si ce n'est pas l'organisme lui-même) | Contrat de sous-traitance |
| Délégué à la protection des données | — | **À compléter** : nom, contact |
| Formalités APDP | Déclaration / demande d'autorisation selon le traitement | **À compléter** : numéro et date du récépissé |

Chaque organisme est un locataire isolé : ses données ne sont jamais visibles d'un autre
organisme (filtrage systématique par organisme, vérifié par `apps/core/tests/test_security.py`).

## 2. Données traitées

| Catégorie | Données | Où (code) |
|---|---|---|
| Compte utilisateur | nom complet, e-mail (identifiant de connexion), poste, direction, rôles, date d'inscription, dernière connexion, empreinte du mot de passe | `apps.core.models.User` |
| Préférences | abonnement au récapitulatif e-mail (échéances, validations) | `apps.notifications.models.NotificationPreference` |
| Envois de notifications | jour, type et titre des alertes envoyées à chaque utilisateur (anti-doublon) | `NotificationLog` |
| Journal d'audit fonctionnel | horodatage, **nom** de l'auteur, action, module, statut | `JournalEntry` (`/api/v1/journal/`) |
| Trace technique | auteur, collection, identifiant, action et contenu de chaque écriture API | `AuditLog` (non exposé au front) |
| Données du système de management | personnes **nommées** dans les enregistrements : pilotes et copilotes de processus, responsables d'actions, déclarants de NC, participants, collaborateurs et compétences, détenteurs de savoirs, historiques (`hist`)… | collections du registre (`apps/*/catalog.py`) |
| Pièces jointes (GED) | fichiers déposés, pouvant contenir des données personnelles | disque (`MEDIA_ROOT`) ou S3 |
| Questions à l'assistant IA | question, historique de la conversation, extraits des données de l'organisme | transmis à l'API Claude (voir § 4), non stockés par la plateforme hors journal (« a interrogé l'assistant IA ») |
| Journaux serveur | adresse IP (journaux d'accès gunicorn / proxy), e-mail de l'utilisateur dans certains événements, chemins appelés | sortie standard des conteneurs |

En **mode local** (sans `VITE_API_URL`), toutes les données restent dans le navigateur
(`localStorage`) : aucune n'est transmise à un serveur. Ce document concerne le mode API.

Aucune catégorie particulière de données (santé, opinions, biométrie…) n'est demandée par la
plateforme. Certains registres ISO 45001 (accidents, situations d'urgence) peuvent en
contenir si l'organisme y en saisit : **À compléter** par l'organisme (règles de saisie,
minimisation).

## 3. Finalités et bases de traitement

| Finalité | Base envisageable (à valider par l'organisme) |
|---|---|
| Authentifier les utilisateurs et gérer leurs droits | Exécution du contrat de travail / de service ; intérêt légitime (sécurité) |
| Tenir le système de management ISO (responsabilités, actions, compétences, audits) | Intérêt légitime de l'organisme et obligations découlant des normes auxquelles il s'engage |
| Traçabilité des modifications (journal, trace technique) | Intérêt légitime (preuve, sécurité, exigences ISO de maîtrise des informations documentées) |
| Envoyer le récapitulatif e-mail quotidien | Intérêt légitime ; désabonnement possible à tout moment |
| Assistant IA (si activé) | Intérêt légitime ; **À compléter** : information des utilisateurs, analyse d'impact si nécessaire |
| Sauvegardes | Intérêt légitime (continuité d'activité) |

## 4. Destinataires

| Destinataire | Données | Condition |
|---|---|---|
| Utilisateurs de l'organisme | données de l'espace selon leurs rôles (`apps/core/permissions.py`) | toujours |
| Auditeurs externes | lecture seule | si l'organisme active « accès auditeurs » (`auditorAccess`) |
| **Anthropic (API Claude)** | question, historique, extraits des données de l'organisme (dont des noms de personnes) | seulement si `ANTHROPIC_API_KEY` est défini ; sans clé, rien n'est envoyé (repli sur le moteur local du navigateur). Transfert hors du Bénin : **À compléter** (garanties, autorisation APDP le cas échéant) |
| Hébergeur de l'instance | l'ensemble (base PostgreSQL, fichiers, journaux) | toujours. **À compléter** : nom, pays d'hébergement |
| Fournisseur SMTP | e-mail, nom, contenu des invitations, liens de mot de passe et récapitulatifs | si `EMAIL_HOST` est défini |
| Stockage objet S3 (ou compatible) | pièces jointes | si `AWS_STORAGE_BUCKET_NAME` est défini. **À compléter** : fournisseur, région |

Aucune donnée n'est vendue ni utilisée à des fins publicitaires par la plateforme.

## 5. Durées de conservation

| Données | Durée | Mécanisme |
|---|---|---|
| Compte actif | tant que la personne a besoin d'accéder à la plateforme | administration des utilisateurs |
| Compte après départ | jusqu'à l'**anonymisation** par un administrateur (§ 6) | `POST /api/v1/users/<id>/anonymiser/` |
| Trace technique (`AuditLog`) et envois de notifications (`NotificationLog`) | `AUDITLOG_RETENTION_DAYS` jours (défaut `0` = illimitée) | `manage.py purge_logs`, lancé chaque jour par le service `scheduler` si la variable est > 0. **À compléter** : durée retenue (ex. 365) |
| Journal d'audit fonctionnel (`JournalEntry`) | **non purgé** | exigence de traçabilité ISO (preuve des décisions et validations) ; le nom d'une personne peut y être pseudonymisé à l'anonymisation |
| Données du système de management | durée fixée par l'organisme pour ses informations documentées | suppression / archivage dans l'interface |
| Sauvegardes | `BACKUP_RETENTION_DAYS` jours (défaut 14) | `backend/scripts/backup.sh` ; une donnée effacée subsiste dans les sauvegardes jusqu'à leur expiration |
| Journaux serveur | selon la politique de l'hébergeur | **À compléter** |
| Jetons de connexion | accès 30 min, renouvellement 7 jours (`JWT_ACCESS_MINUTES`, `JWT_REFRESH_DAYS`) | révoqués à la déconnexion et à l'anonymisation |

```bash
# Aperçu puis purge des traces techniques de plus d'un an
python manage.py purge_logs --days 365 --dry-run
python manage.py purge_logs --days 365
```

## 6. Droits des personnes et comment les exercer

| Droit | Dans la plateforme |
|---|---|
| **Accès et portabilité** | Menu **Mon profil → Exporter mes données** (mode API) : `GET /api/v1/auth/me/export/` renvoie un fichier JSON (format structuré, réutilisable) contenant le compte (sans le mot de passe), les préférences de notification, les envois de notifications, les entrées du journal et de la trace technique le concernant, et la liste des éléments du registre où la personne est nommée (`{collection, id, champs}`). Limité à `THROTTLE_EXPORT` (5 par heure par défaut) ; chaque export est tracé au journal (« a exporté ses données personnelles »). Ouvert à tout utilisateur connecté, auditeurs externes compris. |
| **Rectification** | Un administrateur modifie nom, e-mail, poste, direction (page Utilisateurs) ; chacun corrige les enregistrements selon ses droits. |
| **Opposition au récapitulatif e-mail** | `PATCH /api/v1/auth/me/notifications/ {"actif": false}`. |
| **Effacement** | Page **Utilisateurs → Anonymiser** (Responsable SM ou Administrateur système, mode API) : `POST /api/v1/users/<id>/anonymiser/ {"remplacerDansDonnees": bool}`. Voir ci-dessous. |
| **Limitation** | Désactivation du compte par l'administrateur de la plateforme (admin Django). |
| **Réclamation** | Auprès de l'APDP. **À compléter** : point de contact de l'organisme pour les demandes (DPO). |

### Anonymisation : ce qui est fait

Dans une seule transaction (tout ou rien) :

- le compte est **désactivé** et conservé (les historiques gardent une référence cohérente) ;
- nom → « Utilisateur supprimé #n », e-mail → `utilisateur-supprime-n@anonymise.invalid`
  (domaine réservé, non routable), poste, direction et rôles vidés, mot de passe rendu
  inutilisable ;
- tous ses **jetons de renouvellement** sont mis en liste noire (simplejwt
  `OutstandingToken` / `BlacklistedToken`) ; un jeton d'accès encore valide est refusé car le
  compte est inactif ;
- ses **préférences** et ses **envois de notifications** sont supprimés ;
- avec `remplacerDansDonnees: true` : son nom complet est remplacé par le pseudonyme dans
  tous les champs texte et JSON des collections du registre de **son organisme** (et la fiche
  organisme), dans le journal fonctionnel (auteur et texte des actions) et dans la trace
  technique. Les autres organismes ne sont jamais modifiés, même en cas d'homonymie.

Garde-fous : un administrateur ne peut pas s'anonymiser lui-même, ni anonymiser le dernier
administrateur actif de l'organisme, ni un compte de la plateforme (staff / superutilisateur) ;
l'action est tracée au journal et dans la trace technique, sans le nom effacé.

### Compromis traçabilité ISO / effacement

Les normes ISO demandent de conserver la preuve de qui a décidé, validé ou réalisé quoi. Par
défaut, l'anonymisation **n'altère pas l'historique** : le journal et la trace technique gardent
le nom, et les enregistrements du système de management continuent de nommer la personne
(pilote d'un processus clos, auteur d'une validation…). C'est le choix adapté quand la
conservation de la preuve prime (intérêt légitime, durée limitée).

Avec `remplacerDansDonnees`, le nom disparaît partout dans l'espace de l'organisme : la
traçabilité est conservée (qui = « Utilisateur supprimé #n », toujours le même pseudonyme),
mais l'identité réelle n'est plus lisible. Il s'agit d'une **pseudonymisation** : le lien
avec la personne reste possible par d'autres moyens (sauvegardes, pièces jointes, textes
libres mentionnant la personne autrement que par son nom complet, journaux serveur). La
recherche porte sur le nom complet exact (mot entier, sans tenir compte de la casse) ; les
initiales, surnoms ou fautes de frappe ne sont pas détectés. **À compléter** par
l'organisme : règle de choix entre les deux options.

## 7. Mesures de sécurité en place

| Mesure | Mécanisme réel |
|---|---|
| Chiffrement en transit | TLS assuré par le reverse proxy placé devant l'instance (`docs/DEPLOIEMENT.md`, « Mise en production ») ; redirection HTTPS (`SECURE_SSL_REDIRECT`), HSTS, cookies `Secure` ; SMTP en STARTTLS / TLS (`EMAIL_USE_TLS`) |
| Mots de passe | jamais stockés en clair : empreinte PBKDF2 (hacheur par défaut de Django), règles de robustesse `AUTH_PASSWORD_VALIDATORS`, liens de définition à usage unique et durée limitée (`PASSWORD_RESET_TIMEOUT`) |
| Authentification | jetons JWT courts, rotation et liste noire des jetons de renouvellement, limites de débit (connexion, renouvellement, mot de passe, inscription, export) |
| Isolation | chaque requête est filtrée par l'organisme de l'utilisateur ; tests d'isolation sur toutes les routes |
| Moindre privilège | droits par rôle (`apps/core/permissions.py`) ; auditeurs externes en lecture seule et seulement si autorisés |
| Pièces jointes | servies uniquement via l'API après contrôle des droits ; objets S3 privés |
| Journalisation | journal fonctionnel non modifiable, trace technique automatique de chaque écriture, journaux serveur JSON |
| Sauvegardes | `backend/scripts/backup.sh` (base + fichiers, rétention), restauration testée |
| Minimisation vers l'IA | l'assistant ne reçoit que les données de l'organisme de l'utilisateur, tronquées, sans fichiers ; désactivé sans clé |

**À compléter** par l'organisme / l'exploitant : chiffrement des disques et des sauvegardes
chez l'hébergeur, gestion des accès administrateurs à l'infrastructure, procédure de
notification des violations de données à l'APDP et aux personnes concernées, analyse
d'impact si requise, information des utilisateurs (mention d'information / charte).
