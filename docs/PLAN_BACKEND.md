# Plan — Backend et mise en production de SM Intégré

Objectif : passer d'un prototype 100 % navigateur (données en localStorage) à une
plateforme multi-organismes avec un vrai backend, sans changer l'interface.

## Principes

- **Le front ne change pas de forme de données** : l'API renvoie les objets de `db`
  à l'identique (clés, `id`). Le front garde un mode local (sans `VITE_API_URL`)
  pour la démo et les tests visuels.
- **Multi-organisme** dès le départ : toute donnée appartient à un `Organisation`.
- **Fidélité testée** : `bootstrap` doit renvoyer exactement la démo (`demo.json`).

## Phases

### Phase 0 — Socle (fait)
- Projet Django (`backend/`), apps par module, réglages par variables d'environnement.
- `core` : organisme, utilisateurs (connexion e-mail, rôles), JWT, journal (ajout
  seul), AuditLog automatique, registre des collections, sérialiseurs camelCase,
  vues génériques filtrées par organisme, `?norme=`, `bootstrap`, `load_demo`.
- Collection de référence : `processus`. Tests : auth, CRUD, droits, isolation,
  fidélité.

### Phase 1 — Collections métier (en parallèle, un agent par lot)
| Lot | Apps | Collections |
|---|---|---|
| A | contexte, leadership | swot, pestel, axes, enjeux, analyseVersions, parties, sites, activites, domaineVersions, applicabilite, planStrat, champsPerso, politique, preuvesCom, accuses, postes, representants, comite, reunions |
| B | planification | objectifs, textes, declarations, risques, opportunites, fichesMaitrise, rapportsConf |
| C | support, operations | ressources, competences, savoirs, formations, communications, modeles, documents, plansOps, urgences |
| D | performance, pilotage | indicateurs, prestataires, statsSurv, auditeurs, audits, revues, ncs, sourcesNC, registre, mapping, cloturesMois, cloturesAn |

Chaque lot : modèles, sérialiseurs (validation des références), enregistrement,
migrations, admin, tests (fidélité + règles métier), actions de workflow quand le
front en a (validation GED, soumission au DG, clôture de NC…).

### Phase 1 bis — Intégration front (en parallèle)
- Client API + connexion JWT réelle (écran de connexion existant).
- Hydratation du store via `GET /bootstrap/`.
- Synchronisation des écritures : patches immer du store → POST / PUT / DELETE
  par collection ; journal → `POST /journal/`.
- Mode local conservé quand `VITE_API_URL` n'est pas défini (tests visuels intacts).

### Phase 1 ter — Industrialisation (en parallèle)
- Dockerfile backend, `docker-compose.yml` (PostgreSQL, API, front servi par nginx).
- CI GitHub Actions : ruff + pytest (PostgreSQL), lint + typecheck + build du front.
- Documentation de déploiement.

### Phase 2 — Fonctions serveur
- Pièces jointes (preuves, documents GED) : upload, stockage (S3 compatible), droits.
- Tableau de bord et alertes calculés côté serveur (échéances, retards, mandats).
- Exports (PDF / Excel) côté serveur.
- Notifications e-mail (échéances, validations en attente) via tâches planifiées.
- Assistant IA branché sur un vrai modèle (API Claude), avec les données de
  l'organisme comme contexte et validation humaine des propositions.

### Phase 3 — Production
- Onboarding multi-organismes (création d'organisme, invitation d'utilisateurs).
- Droits fins par processus (pilotes / copilotes), SSO éventuel.
- Sauvegardes, supervision, RGPD / Code du numérique béninois (APDP).
