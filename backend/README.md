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
   Responsable SM / Administrateur système ; auditeurs externes selon `auditorAccess`.
9. **Traçabilité** : chaque écriture API crée un `AuditLog` automatique ; le journal
   fonctionnel (`/api/v1/journal/`) est en ajout seul. Dans les actions métier, utiliser
   `apps.core.tracing` (`log_act`, `add_hist`, `now_stamp`, `add_registre`).
10. **Ordre** : `POST /<url>/?at=start` insère en tête de liste (`unshift()` du front),
    sinon en fin. Une collection créée à l'usage (absente de la démo) s'enregistre avec
    `in_demo=False`.
11. **Synchronisation du front** : le front envoie l'état complet des éléments modifiés
    (PUT) et son propre journal ; les actions métier de l'API (`/documents/D1/approuver/`…)
    servent les autres clients et appliquent les mêmes règles de droits.
