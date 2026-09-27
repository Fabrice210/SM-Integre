# Vérifications — SM Intégré

Commandes à relancer avant toute livraison, et état de la dernière vérification.

## Backend (`backend/`)

```bash
.venv/bin/ruff check . && .venv/bin/ruff format --check .
.venv/bin/python manage.py makemigrations --check --dry-run
.venv/bin/pytest -q
DEBUG=false SECRET_KEY=<valeur longue factice> ALLOWED_HOSTS=sm.exemple.bj \
  .venv/bin/python manage.py check --deploy --fail-level WARNING
.venv/bin/python manage.py spectacular --validate --fail-on-warn --file /dev/null
```

Couverture des tests :

- **fidélité** : `bootstrap` renvoie exactement la démo du front (49 collections) ;
- **sécurité** (`apps/core/tests/test_security.py`) : isolation entre organismes, droits
  d'écriture et auditeurs externes sur toutes les collections et toutes les actions,
  entrées aberrantes (jamais d'erreur 500) ;
- règles métier et workflows de chaque module, exports, notifications, assistant IA
  (client Claude simulé), comptes (inscription, invitation, mot de passe, jetons).

## Front (racine)

```bash
npm ci && npm run typecheck && npm run lint && npm run build
```

Mode local (sans `VITE_API_URL`) : non-régression visuelle avec `scripts/visual/`
(capture + comparaison au pixel près).

## Bout en bout (navigateur réel, API réelle)

```bash
# backend : migrate, load_demo, runserver 8000 (CORS_ALLOWED_ORIGINS=http://localhost:5174)
VITE_API_URL=http://localhost:8000/api/v1 npx vite --port 5174 --strictPort
CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node scripts/api-smoke.mjs http://localhost:5174
API_URL=http://localhost:8010/api/v1 node scripts/api-e2e.mjs http://localhost:5180  # base neuve, cf. en-tête du script
E2E_DIR=/tmp/auth-e2e CHROMIUM_PATH=… node scripts/api-auth-e2e.mjs   # démarre ses propres serveurs
```

## Simulations d'exploitation

- `manage.py send_alerts --dry-run --today 2026-09-21` puis envoi réel (backend console) :
  7 récapitulatifs, aucun renvoi le même jour (anti-doublon).
- Exports via l'API avec jeton JWT : `processus.xlsx`, `ncs.csv`, `registre.pdf`,
  `tableau-de-bord.pdf`, `rapport-revue/RV1.pdf`, `rapport-audit/A1.pdf` → 200.
- `docker compose config` valide (PostgreSQL, Redis, API, scheduler, front nginx).
- `backend/scripts/backup.sh` sur PostgreSQL 16 : dump + archive des fichiers, puis
  `pg_restore` dans une base vierge → 14 utilisateurs et 12 processus retrouvés.

## Dernier état vérifié

| Contrôle | Résultat |
|---|---|
| pytest (SQLite et PostgreSQL 16) | tout vert |
| non-régression visuelle, mode local | 0 différence sur 267 captures |
| ruff, format, migrations | propres |
| `check --deploy`, OpenAPI `--fail-on-warn` | aucun avertissement |
| typecheck, lint (0 erreur), build | OK |
| `api-e2e.mjs` (interface réelle, M1 à M6, robustesse, collisions d'id, refus, accusé de lecture, Collaborateur, session expirée) | 164 / 164 |
| `api-smoke.mjs` | 31 / 31 |
| `api-auth-e2e.mjs` | 22 / 22 |

Non exécuté dans cet environnement : build Docker complet (le proxy réseau de
l'environnement réécrit les certificats), appel réel à l'API Claude (clé non fournie).
