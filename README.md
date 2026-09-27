# SM Intégré

Plateforme de digitalisation d'un **système de management intégré** ISO 9001 (qualité),
ISO 14001 (environnement), ISO 45001 (santé-sécurité) et ISO 27001 (sécurité de
l'information) : contexte de l'organisme, leadership, objectifs et risques, support,
maîtrise opérationnelle, performance et amélioration.

## Historique et organisation du dépôt

- **Prototype d'origine** : `Plateforme_SM_Integree.html` (et sa v2
  `Plateforme_SM_Integree.html 2.html`), application monofichier dont une copie figée
  sert de référence dans `reference/original.html`.
- **Migration React** (`src/`) : React 19 + TypeScript + Vite, état Zustand/immer. Les
  référentiels et données de démo sont extraits de l'original par
  `scripts/extract-reference.mjs`, sans retouche des textes.
- **Tests visuels** (`scripts/visual/`) : captures Playwright de l'original et du front
  React (`capture.mjs`), comparaison pixel à pixel (`compare.mjs`), contrôle qu'aucun
  texte n'est perdu ni inventé (`verify-texts.mjs`) ; références dans `baseline/`.
- **Backend** (`backend/`) : API REST Django + DRF, multi-organisme, JWT, PostgreSQL,
  qui renvoie les données au format exact du front.

## Démarrage rapide

### Front seul (mode local, données dans le navigateur)

```bash
npm install
npm run dev            # http://localhost:5174
```

Autres scripts : `npm run build`, `npm run preview` (port 4180), `npm run lint`,
`npm run typecheck`.

### Front + backend (développement)

```bash
# Terminal 1 — API (http://localhost:8000)
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
cp .env.example .env
.venv/bin/python manage.py migrate
.venv/bin/python manage.py load_demo
.venv/bin/python manage.py runserver

# Terminal 2 — front branché sur l'API
VITE_API_URL=http://localhost:8000/api/v1 npm run dev
```

Sans `VITE_API_URL`, le front reste en mode local.

### Pile complète avec Docker

```bash
cp .env.docker.example .env      # changer SECRET_KEY et POSTGRES_PASSWORD
docker compose up -d --build     # http://localhost:8080
```

PostgreSQL 16, API (gunicorn) et front (nginx, qui relaie `/api/` en même origine).

### Exploitation

- Santé : `GET /api/v1/health/` (base jointe) et `GET /api/v1/ready/` (migrations appliquées).
- Sauvegarde : `backend/scripts/backup.sh [dossier]` (pg_dump + fichiers déposés).
- Sécurité HTTPS, journaux JSON, e-mails (SMTP), pièces jointes sur disque ou S3,
  onboarding multi-organismes (inscription `ALLOW_SIGNUP`, invitations, mot de passe
  par lien) : tout se règle par variables d'environnement, cf.
  [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md). Vérification :
  `python manage.py check --deploy` sans avertissement avec `DEBUG=false`.
- Documentation de l'API : `/api/docs/` (schéma OpenAPI validé en CI).

## Documentation

- [backend/README.md](backend/README.md) — API, architecture et conventions du backend
- [docs/PLAN_BACKEND.md](docs/PLAN_BACKEND.md) — plan de passage au backend et phases
- [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md) — Docker, variables, sécurité, e-mails, stockage,
  onboarding, santé, sauvegardes, mise en production, CI
