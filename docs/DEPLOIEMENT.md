# Déploiement de SM Intégré

La pile `docker compose` réunit trois services :

| Service | Image | Rôle |
|---|---|---|
| `db` | `postgres:16` | Base de données (volume `pgdata`) |
| `backend` | `backend/Dockerfile` | API Django servie par gunicorn (port interne 8000, volume `media`) |
| `frontend` | `Dockerfile` (racine) | Front React compilé, servi par nginx sur le port **8080** |

nginx sert la SPA (toute route inconnue renvoie `index.html`) et relaie `/api/`, `/admin/`
et `/static/` vers le backend. Le navigateur appelle donc l'API en **même origine**
(`/api/v1`) : pas de CORS, un seul domaine à exposer.

```
navigateur ──► nginx :8080 ──┬── /            → fichiers du front (dist/)
                             └── /api/ /admin/ /static/ → gunicorn :8000 ──► PostgreSQL
```

## Lancement

```bash
cp .env.docker.example .env        # puis modifier SECRET_KEY et POSTGRES_PASSWORD
docker compose up -d --build
docker compose ps                  # les trois services doivent être « healthy »
```

- Application : http://localhost:8080
- API : http://localhost:8080/api/v1/ (santé : `/api/v1/health/`)
- Documentation OpenAPI : http://localhost:8080/api/docs/
- Administration Django : http://localhost:8080/admin/

Au démarrage, le conteneur `backend` applique les migrations (`migrate`), puis charge la
démo si `LOAD_DEMO=1`. Journaux : `docker compose logs -f backend`.

Arrêt : `docker compose down` (les données restent dans les volumes) ;
`docker compose down -v` supprime aussi la base et les fichiers déposés.

Mise à jour après un `git pull` : `docker compose up -d --build` (les migrations
s'appliquent au redémarrage du backend).

## Variables d'environnement

Elles sont lues dans le fichier `.env` à la racine (modèle : `.env.docker.example`).

| Variable | Défaut | Rôle |
|---|---|---|
| `POSTGRES_DB` / `POSTGRES_USER` | `sm_integre` / `sm` | Base et utilisateur PostgreSQL |
| `POSTGRES_PASSWORD` | — (obligatoire) | Mot de passe PostgreSQL. Il entre dans `DATABASE_URL` : éviter `@ : / ? #` |
| `SECRET_KEY` | — (obligatoire) | Clé secrète Django (≥ 50 caractères aléatoires) |
| `DEBUG` | `false` | Ne jamais mettre `true` en production |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | Noms d'hôte servis, séparés par des virgules |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:8080` | Seulement si un autre domaine appelle l'API |
| `LOAD_DEMO` | `0` | `1` : charge l'organisme de démo au démarrage (sans effet s'il existe) |
| `DEMO_PASSWORD` | `Demo-SM-2026!` | Mot de passe des 14 comptes de démo |
| `JWT_ACCESS_MINUTES` / `JWT_REFRESH_DAYS` | `30` / `7` | Durée des jetons d'accès / de renouvellement |
| `GUNICORN_WORKERS` | `3` | Processus gunicorn (≈ 2 × cœurs + 1) |
| `VITE_API_URL` | `/api/v1` | URL de l'API vue du navigateur, **figée au build** du front (reconstruire après changement). Vide : mode local sans backend |
| `FRONT_PORT` | `8080` | Port publié sur l'hôte |

`DATABASE_URL` est construite par `docker-compose.yml` à partir des variables `POSTGRES_*`.
Hors compose, le backend lit directement `DATABASE_URL`, `SECRET_KEY`, etc.
(cf. `backend/.env.example`). Le conteneur front accepte `BACKEND_URL`
(défaut `http://backend:8000`, sans barre finale) pour pointer vers une autre API.

## Superutilisateur

Le superutilisateur sert à l'administration Django (`/admin/`) :

```bash
docker compose exec backend python manage.py createsuperuser
```

Le compte se connecte avec son e-mail (le « username » demandé peut reprendre l'e-mail).
Sans interaction :

```bash
docker compose exec -e DJANGO_SUPERUSER_EMAIL=admin@exemple.bj \
  -e DJANGO_SUPERUSER_USERNAME=admin@exemple.bj -e DJANGO_SUPERUSER_PASSWORD='…' \
  backend python manage.py createsuperuser --noinput
```

Pour utiliser l'application elle-même, un compte doit être rattaché à un organisme
(champ organisme dans l'admin, ou comptes de la démo).

## Données de démonstration

- Au démarrage : `LOAD_DEMO=1` dans `.env`, puis `docker compose up -d`.
- À la demande : `docker compose exec backend python manage.py load_demo`
- Réinitialiser la démo : `docker compose exec backend python manage.py load_demo --reset`

La démo crée l'organisme AGRO-BÉNIN Industries et 14 utilisateurs (e-mails de
`backend/demo/demo.json`, mot de passe `DEMO_PASSWORD`). Exemple :
`f.dossou-yovo@agrobenin.bj` (Responsable SM). **Ne pas charger la démo en production**,
ou changer immédiatement `DEMO_PASSWORD` et les mots de passe.

## Sauvegarde PostgreSQL

Sauvegarde (format compressé de `pg_dump`) :

```bash
docker compose exec -T db pg_dump -U sm -d sm_integre --format=custom > sauvegarde-$(date +%F).dump
```

Restauration (remplace les objets existants) :

```bash
docker compose exec -T db pg_restore -U sm -d sm_integre --clean --if-exists --no-owner < sauvegarde-AAAA-MM-JJ.dump
docker compose restart backend
```

Adapter `-U` / `-d` si `POSTGRES_USER` / `POSTGRES_DB` ont été changés. Les fichiers
déposés sont dans le volume `media` :

```bash
docker run --rm -v sm-integre_media:/data -v "$PWD":/out alpine tar czf /out/media-$(date +%F).tgz -C /data .
```

Planifier ces commandes (cron, timer systemd) et copier les archives hors du serveur ;
tester régulièrement une restauration.

## Mise en production

1. **HTTPS** : placer un reverse proxy TLS (Caddy, Traefik, nginx + Let's Encrypt, ou le
   répartiteur de charge de l'hébergeur) devant le port 8080. Il doit transmettre
   `X-Forwarded-Proto: https` : nginx le relaie au backend, et Django (avec
   `DEBUG=false`) s'en sert pour reconnaître les requêtes sécurisées. Avec
   `DEBUG=false`, les cookies de session et CSRF sont marqués `Secure` : l'admin Django
   n'est utilisable qu'en HTTPS (ou sur `localhost`). Ne publier que le port du proxy
   (remplacer `ports` du service `frontend` par `127.0.0.1:8080:8080`).
2. **`SECRET_KEY`** : longue valeur aléatoire propre à chaque environnement, jamais
   commitée : `python3 -c "import secrets; print(secrets.token_urlsafe(64))"`.
   La changer invalide les sessions et jetons en cours.
3. **`DEBUG=false`** : sinon Django expose ses pages d'erreur détaillées.
4. **`ALLOWED_HOSTS`** : le ou les domaines publics exacts, ex. `sm.exemple.bj`.
5. **CORS** : inutile en même origine. Si le front est servi depuis un autre domaine
   (build avec `VITE_API_URL=https://api.exemple.bj/api/v1`), lister ce domaine dans
   `CORS_ALLOWED_ORIGINS` (avec le schéma, ex. `https://sm.exemple.bj`).
6. **Mots de passe** : `POSTGRES_PASSWORD` fort ; PostgreSQL n'est pas exposé hors du
   réseau compose (pas de `ports` sur `db`).
7. Vérifier la configuration : `docker compose exec backend python manage.py check --deploy`.
8. Sauvegardes planifiées et supervision de `/api/v1/health/` (et `/healthz` pour nginx).

## Intégration continue

`.github/workflows/ci.yml` exécute à chaque push / pull request :

- **backend** (PostgreSQL 16 en service) : `ruff check`, `ruff format --check`,
  `makemigrations --check --dry-run`, `pytest` ;
- **frontend** : `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build`.
