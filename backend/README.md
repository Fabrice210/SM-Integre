# SM Intégré — Backend (Django)

API REST du système de management intégré ISO 9001 / 14001 / 45001 / 27001.
Le front React (`../src`) parle exactement le format de ses propres données :
l'API renvoie les mêmes objets que `db` côté front (mêmes clés camelCase, mêmes `id`).

## Démarrer

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
cp .env.example .env
.venv/bin/python manage.py migrate
.venv/bin/python manage.py load_demo          # organisme AGRO-BÉNIN + 14 utilisateurs
.venv/bin/python manage.py runserver
```

- Documentation OpenAPI : http://localhost:8000/api/docs/
- Connexion : `POST /api/v1/auth/login/ {email, password}` → `{access, refresh, user}`
  (comptes de démo : e-mails de `demo/demo.json`, mot de passe `DEMO_PASSWORD`).
- Tout l'état d'un coup : `GET /api/v1/bootstrap/` (forme `Persisted` du front).

Tests et qualité : `.venv/bin/pytest`, `.venv/bin/ruff check .`, `.venv/bin/ruff format .`,
`.venv/bin/python manage.py spectacular --validate --fail-on-warn --file /tmp/openapi.yml`
(schéma sans avertissement : annoter toute nouvelle vue avec `@extend_schema` si besoin).

Comptes et exploitation (détails : `../docs/DEPLOIEMENT.md`) :

- `POST /api/v1/auth/signup/` (si `ALLOW_SIGNUP=true`) : organisme vierge + Responsable SM ;
- `POST /api/v1/users/` sans mot de passe : invitation par e-mail ;
  `POST /api/v1/auth/password/reset/` puis `/auth/password/confirm/ {uid, token, password}` ;
- `GET /api/v1/health/` (base) et `GET /api/v1/ready/` (base + migrations) : 200 ou 503 ;
- erreurs 500 / 404 en JSON sous `/api/`, journaux JSON (`LOG_FORMAT`, `LOG_LEVEL`) ;
- pièces jointes sur disque (`MEDIA_ROOT`) ou S3 (`AWS_STORAGE_BUCKET_NAME`) ;
- sauvegarde : `scripts/backup.sh`.

## Pile technique

| Besoin | Choix |
|---|---|
| Framework | Django 5.2 LTS + Django REST Framework |
| Authentification | JWT (djangorestframework-simplejwt), connexion par e-mail |
| Base de données | PostgreSQL en production (`DATABASE_URL`), SQLite en dev/tests |
| Documentation API | drf-spectacular (OpenAPI 3, Swagger UI) |
| Filtres | django-filter + `?norme=`, `?search=`, `?ordering=` |
| Configuration | django-environ (`.env`) |
| Service | gunicorn + whitenoise, Docker |
| Tests / lint | pytest-django, ruff |

## Architecture

```
config/            réglages, urls racine (/api/v1/…)
apps/core/         organisme, utilisateurs, journal, registre des collections,
                   sérialiseurs / vues génériques, bootstrap, chargement démo
apps/contexte/     Module 1 — Contexte de l'organisme
apps/leadership/   Module 2 — Leadership
apps/planification/Module 3 — Objectifs, conformité et risques
apps/support/      Module 4 — Support
apps/operations/   Module 5 — Maîtrise opérationnelle
apps/performance/  Module 6 — Performance & amélioration
apps/pilotage/     Transverse : couverture normative, clôtures, tableau de bord
apps/assistant/    Assistant IA (API Claude) fondé sur les données de l'organisme
apps/exports/      Exports Excel / CSV / PDF (/api/v1/exports/…)
apps/notifications/ Récapitulatif e-mail quotidien (manage.py send_alerts), préférences
demo/demo.json     données de démo exportées du front (node scripts/export-demo-json.mjs)
```

## Conventions (à respecter dans chaque module)

1. **Une collection du front = un modèle.** Le nom de collection est la clé de `db`
   côté front (`processus`, `analyseVersions`…). L'URL est générée en kebab-case :
   `/api/v1/analyse-versions/`, et un élément s'adresse par son `id` front :
   `/api/v1/processus/P01/`.
2. **Modèles** : hériter de `apps.core.models.OrgModel` (+ `NormesMixin` si l'objet a
   un champ `normes`). Objet unique par organisme (`politique`, `competences`…) :
   `OrgSingleton`. Définir `UID_PREFIX` (préfixe des id générés). Noms de champs en
   snake_case : ils sont convertis automatiquement en camelCase (`plan_mis_en_oeuvre`
   ↔ `planMisEnOeuvre`, `preuve1` ↔ `preuve1`).
3. **Types de champs** — choisis d'après *toutes* les valeurs de la démo :
   - texte → `CharField`/`TextField` (`blank=True` si vide possible) ;
   - dates → `DateField` **seulement** si toutes les valeurs sont des dates ISO
     (sinon `CharField` : la démo contient par exemple `'—'`) ;
   - nombres → `IntegerField` / `FloatField` (jamais Decimal, rendu en chaîne) ;
   - listes, objets et tableaux imbriqués (`normes`, `actions`, `versions`,
     `exercices`…) → `JSONField` ;
   - champ absent de certains éléments → `null=True` : les `None` ne sont pas émis,
     le champ reste absent comme dans la démo ;
   - listes de valeurs fermées → `TextChoices`.
4. **Références entre collections** : des `id` front (CharField ou JSON de `id`),
   jamais de ForeignKey (aucune dépendance de migration entre modules). Valider avec
   `apps.core.refs.validate_refs(self, "processus", value)` dans le sérialiseur.
   Les personnes sont référencées par leur nom complet, comme dans le front.
5. **Sérialiseurs** : hériter de `OrgModelSerializer` / `OrgSingletonSerializer`.
   Clés inconnues conservées dans `extra` (ex. `hist`) : rien n'est perdu.
6. **Enregistrement** dans `<app>/catalog.py` avec `apps.core.registry.register(...)` :
   routes, bootstrap et démo en découlent. Actions métier (workflow, calculs) :
   sous-classer `apps.core.viewsets.OrgModelViewSet` et le passer en `viewset=`.
7. **Contrat de fidélité** : `apps/core/tests/test_fidelity.py` vérifie que
   `bootstrap` renvoie exactement `demo.json` pour chaque collection enregistrée.
8. **Droits** (`apps/core/permissions.py`) : lecture pour tout membre de l'organisme ;
   écriture pour les rôles de pilotage ; utilisateurs et paramètres pour
   Responsable SM / Administrateur système ; auditeurs externes en lecture seule, et
   seulement si `auditorAccess`. Écritures ouvertes à tout membre (hors auditeurs externes) :
   accusé de lecture, déclaration de NC, journal ; les autres actions ouvertes (ressource,
   document, évaluation de formation, communication) exigent d'être la personne nommée dans
   l'élément. `apps/core/tests/test_security.py` vérifie ces règles sur toutes les routes.
   Identifiants (`id`) : lettres, chiffres, `_`, `-`, `.` (32 caractères, pas de point en tête).
9. **Traçabilité** : chaque écriture API crée un `AuditLog` automatique ; le journal
   fonctionnel (`/api/v1/journal/`) est en ajout seul. Dans les actions métier, utiliser
   `apps.core.tracing` (`log_act`, `add_hist`, `now_stamp`, `add_registre`).
10. **Ordre** : `POST /<url>/?at=start` insère en tête de liste (`unshift()` du front),
    sinon en fin. Une collection créée à l'usage (absente de la démo) s'enregistre avec
    `in_demo=False`.
11. **Synchronisation du front** : le front envoie l'état complet des éléments modifiés
    (PUT) et son propre journal ; les actions métier de l'API (`/documents/D1/approuver/`…)
    servent les autres clients et appliquent les mêmes règles de droits.

## Assistant IA

`POST /api/v1/assistant/ask/` — réponse de l'API Claude (SDK officiel `anthropic`) fondée
**uniquement** sur les données de l'organisme de l'utilisateur ; les propositions sont à
valider par un humain et l'assistant n'exécute aucune action.

```
entrée   {question, contexte?: "m3-risques" (page courante), historique?: [{role, content}]}
200      {reponse, sources: [{collection, id, libelle}]}
503      {detail, fallback: true}   clé absente ou API Claude indisponible
```

- **Contexte** (`apps/assistant/context.py`) : collections relues par les sérialiseurs du
  registre, filtrées par organisme, en lignes compactes `[collection:id] {...}` (chaînes
  tronquées, listes limitées, fichiers masqués). Bloc stable, mis en cache (prompt
  caching) : organisme, inventaire, alertes et validations en attente
  (`apps.pilotage.metrics`), enregistrements du module de la page courante. Bloc
  question : collections nommées dans la question puis recherche par mots-clés, sous budget.
- **Prompt** (`apps/assistant/service.py`) : consignes en français (données fournies
  uniquement, citer `[collection:id]`, dire quand l'information manque, aucune action).
  Seules les références citées **et** transmises deviennent des `sources` ; les autres
  sont retirées du texte.
- **Sécurité** : membres authentifiés de l'organisme (auditeurs externes selon
  `auditorAccess`) ; limite par utilisateur `ASSISTANT_RATE` (défaut `30/hour`) ;
  chaque question aboutie est tracée au journal (« a interrogé l'assistant IA »).
- **Repli** : sans `ANTHROPIC_API_KEY`, ou si l'API est injoignable / en erreur, réponse
  503 `{fallback: true}` : le front utilise son moteur local (`src/features/ai/aiAnswer.ts`).
- **Variables** : `ANTHROPIC_API_KEY`, `ASSISTANT_MODEL` (défaut `claude-opus-5`),
  `ASSISTANT_EFFORT` (`medium`), `ASSISTANT_MAX_TOKENS` (`8000`), `ASSISTANT_TIMEOUT`
  (`45` s), `ASSISTANT_RATE`, `ASSISTANT_FALLBACKS` (`1` : repli serveur sur un autre
  modèle en cas de refus, pour les modèles qui le proposent). Voir `docs/DEPLOIEMENT.md`.
- **Tests** : `apps/assistant/tests/` simule le client anthropic (aucun appel réseau).
