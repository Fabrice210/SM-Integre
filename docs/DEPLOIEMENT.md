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
| `ANTHROPIC_API_KEY` | — (vide) | Clé de l'API Claude pour l'assistant IA. Vide : l'assistant répond 503 `{fallback: true}` et le front garde son moteur local |
| `ASSISTANT_MODEL` | `claude-opus-5` | Modèle Claude utilisé par l'assistant |
| `ASSISTANT_EFFORT` | `medium` | Effort de raisonnement (`low` … `max`) ; vide : paramètre non envoyé (modèles qui ne le prennent pas en charge) |
| `ASSISTANT_RATE` | `30/hour` | Questions autorisées par utilisateur (syntaxe DRF : `N/second\|minute\|hour\|day`) |
| `ASSISTANT_TIMEOUT` | `45` | Délai d'attente de l'API Claude, en secondes ; rester sous `GUNICORN_TIMEOUT` (60) |
| `ASSISTANT_MAX_TOKENS` / `ASSISTANT_FALLBACKS` | `8000` / `1` | Plafond de sortie (réflexion comprise) ; repli serveur sur un autre modèle en cas de refus (`0` pour le désactiver) |
| `CSRF_TRUSTED_ORIGINS` | — | Origines de confiance, schéma compris (`https://sm.exemple.bj`) : admin Django derrière le proxy TLS, front sur un autre domaine |
| `SECURE_SSL_REDIRECT` | `true` hors DEBUG (`false` dans compose) | Redirection HTTP → HTTPS par Django. `false` quand le proxy TLS redirige déjà |
| `SECURE_HSTS_SECONDS` | `3600` hors DEBUG | En-tête HSTS (requêtes HTTPS). `31536000` une fois HTTPS validé, `0` si le proxy le pose |
| `SECURE_HSTS_INCLUDE_SUBDOMAINS` / `SECURE_HSTS_PRELOAD` | `true` / `false` | Portée HSTS ; le préchargement est une inscription volontaire |
| `SESSION_COOKIE_SECURE` / `CSRF_COOKIE_SECURE` | `true` hors DEBUG | Cookies envoyés en HTTPS seulement |
| `LOG_LEVEL` | `INFO` | Niveau des journaux (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |
| `LOG_FORMAT` | `json` hors DEBUG | `json` (une ligne JSON par événement) ou `text` |
| `ALLOW_SIGNUP` | `false` | `true` : inscription publique d'un organisme (`POST /api/v1/auth/signup/`) |
| `FRONTEND_URL` | `http://localhost:8080` (compose) | URL publique du front, base des liens envoyés par e-mail |
| `PASSWORD_SET_PATH` | `/definir-mot-de-passe` | Page du front qui reçoit `?uid=…&token=…` |
| `PASSWORD_RESET_TIMEOUT` | `259200` (3 jours) | Validité des liens d'invitation / de mot de passe (secondes) |
| `EMAIL_HOST` / `EMAIL_PORT` | — / `587` | Serveur SMTP. Sans `EMAIL_HOST` (ou en DEBUG) : e-mails écrits dans les journaux |
| `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` | — | Identifiants SMTP |
| `EMAIL_USE_TLS` / `EMAIL_USE_SSL` | `true` / `false` | STARTTLS (587) ou TLS implicite (465) |
| `EMAIL_BACKEND` | selon `EMAIL_HOST` | Forçage éventuel (ex. `django.core.mail.backends.console.EmailBackend`) |
| `DEFAULT_FROM_EMAIL` | `SM Intégré <no-reply@localhost>` | Expéditeur des e-mails |
| `AWS_STORAGE_BUCKET_NAME` | — | Défini : pièces jointes dans ce bucket S3 (sinon disque, volume `media`) |
| `AWS_S3_REGION_NAME` / `AWS_S3_ENDPOINT_URL` | — | Région ; point d'accès d'un stockage compatible S3 (MinIO, Scaleway, OVH…) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | — | Identifiants S3 (sinon rôle IAM de l'hôte) |
| `AWS_LOCATION` / `AWS_S3_ADDRESSING_STYLE` | `media` / — | Préfixe des objets ; `path` pour MinIO |
| `INTERNAL_HOSTS` | `127.0.0.1,localhost` | Hôtes toujours acceptés en plus d'`ALLOWED_HOSTS` (sondes du conteneur) |

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

## Onboarding d'un organisme et des utilisateurs

- **Création d'organisme par l'exploitant** (défaut) : admin Django (`/admin/`), créer
  l'organisme puis son premier utilisateur (rôle `Responsable SM`) ; ou activer
  temporairement l'inscription.
- **Inscription publique** (`ALLOW_SIGNUP=true`) : `POST /api/v1/auth/signup/`
  `{organisation, sigle?, nom, email, password}` crée un organisme **vierge** (aucune
  donnée de démo, `onboarded=false`) et son Responsable SM, et renvoie
  `{access, refresh, user}` comme la connexion. Désactivée, l'URL répond 404. Quota :
  5 inscriptions / heure / adresse IP (`THROTTLE_SIGNUP`).
- **Invitation** : un Responsable SM / Administrateur crée l'utilisateur par
  `POST /api/v1/users/` **sans mot de passe** (c'est ce que fait l'écran Utilisateurs du
  front) : le compte n'a pas de mot de passe utilisable et reçoit un e-mail avec le lien
  `FRONTEND_URL + PASSWORD_SET_PATH ?uid=…&token=…`. Renvoi : `POST /api/v1/users/{id}/inviter/`.
- **Mot de passe oublié** : `POST /api/v1/auth/password/reset/ {email}` (même réponse que le
  compte existe ou non), puis `POST /api/v1/auth/password/confirm/ {uid, token, password}`.
  Jetons Django : valables `PASSWORD_RESET_TIMEOUT`, invalidés dès que le mot de passe
  change (usage unique). La page du front qui reçoit le lien doit appeler ce second point
  d'accès.

## E-mails

Réglages `EMAIL_*` et `DEFAULT_FROM_EMAIL` (tableau ci-dessus). Sans `EMAIL_HOST`, ou en
`DEBUG`, les e-mails sont écrits sur la sortie standard (`docker compose logs backend`) :
pratique pour tester une invitation sans SMTP. Un échec d'envoi est journalisé (niveau
ERROR) sans faire échouer la création de l'utilisateur.

## Pièces jointes (stockage des fichiers)

- **Par défaut : disque**, dans `MEDIA_ROOT` (`/app/media`, volume Docker `media`).
- **S3 ou compatible** dès que `AWS_STORAGE_BUCKET_NAME` est défini (django-storages) :
  objets privés, préfixe `AWS_LOCATION` (`media`), jamais écrasés. Pour MinIO / Scaleway /
  OVH, renseigner `AWS_S3_ENDPOINT_URL` (et `AWS_S3_ADDRESSING_STYLE=path` pour MinIO).
- Dans les deux cas les fichiers sont téléchargés **via l'API**
  (`GET /api/v1/documents/{id}/fichier/`), qui vérifie l'authentification et l'organisme :
  aucun dossier de fichiers n'est publié par nginx. En développement (`DEBUG=true`, stockage
  disque), `runserver` sert aussi `MEDIA_URL` (`/media/`).

## Journaux et erreurs

- Journaux sur la sortie standard (`docker compose logs -f backend`) ; `LOG_FORMAT=json`
  (défaut hors DEBUG) produit une ligne JSON par événement : `time`, `level`, `logger`,
  `message`, et selon le cas `method`, `path`, `status_code`, `user`, `exc_info`. Niveau :
  `LOG_LEVEL`. Les accès HTTP sont journalisés par gunicorn.
- Sous `/api/`, une erreur non prévue renvoie `500 {"detail": "Erreur interne du serveur."}`
  (JSON, sans détail interne) et une URL inconnue `404 {"detail": …}` ; la trace complète
  part dans les journaux (logger `django.request`).

## Santé et supervision

| Sonde | Rôle | Réponse |
|---|---|---|
| `GET /api/v1/health/` | Vivacité (liveness) : le processus répond et joint la base | `200 {"status": "ok", "checks": {"database": "ok"}}`, `503` sinon |
| `GET /api/v1/ready/` | Disponibilité (readiness) : base jointe **et** migrations appliquées | `200`, ou `503` avec `"migrations": "pending"` |
| `GET /healthz` (nginx) | Conteneur front | `200 ok` |

Les sondes sont publiques, sans authentification, et exemptées de la redirection HTTPS.
Dans `docker-compose.yml`, le healthcheck du backend utilise `/api/v1/ready/` : le front ne
démarre qu'une fois les migrations appliquées. Superviser `/api/v1/health/` depuis
l'extérieur (Uptime Kuma, Prometheus blackbox…) et alerter sur un code ≠ 200.

## Sauvegarde et restauration

Script fourni : `backend/scripts/backup.sh [dossier]` (défaut `./backups`).

```bash
# Pile docker compose (depuis l'hôte) : pg_dump dans le conteneur db + archive du volume media
backend/scripts/backup.sh /srv/sauvegardes/sm-integre

# Hors compose : client PostgreSQL 16 sur la machine
DATABASE_URL=postgres://sm:…@db.exemple.bj:5432/sm_integre MEDIA_ROOT=/var/lib/sm/media \
  backend/scripts/backup.sh /srv/sauvegardes/sm-integre
```

Il produit `sm_integre-AAAAMMJJ-HHMMSS.dump` (format « custom » de `pg_dump`, contrôlé par
`pg_restore --list` si disponible) et `sm_integre-media-….tgz`, puis supprime les
sauvegardes de plus de `BACKUP_RETENTION_DAYS` jours (14 ; `0` pour tout garder).
`BACKUP_MEDIA=0` : base seule (inutile avec S3 : sauvegarder le bucket côté fournisseur,
versionnement ou réplication). Planification, par exemple (cron de l'hôte, 2 h 15) :

```
15 2 * * * cd /opt/sm-integre && backend/scripts/backup.sh /srv/sauvegardes/sm-integre >> /var/log/sm-backup.log 2>&1
```

Copier les sauvegardes hors du serveur (rsync, rclone, stockage objet) et **tester
régulièrement une restauration** :

```bash
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' \
  < /srv/sauvegardes/sm-integre/sm_integre-AAAAMMJJ-HHMMSS.dump
docker compose exec -T backend sh -c 'tar xzf - -C /app/media' \
  < /srv/sauvegardes/sm-integre/sm_integre-media-AAAAMMJJ-HHMMSS.tgz
docker compose restart backend
```

## Mise en production

1. **HTTPS** : placer un reverse proxy TLS (Caddy, Traefik, nginx + Let's Encrypt, ou le
   répartiteur de charge de l'hébergeur) devant le port 8080. Il doit transmettre
   `X-Forwarded-Proto: https` : nginx le relaie au backend, et Django s'en sert pour
   reconnaître les requêtes sécurisées. Ne publier que le port du proxy (remplacer `ports`
   du service `frontend` par `127.0.0.1:8080:8080`).
2. **Réglages de sécurité** (tous par variable, cf. tableau) : hors DEBUG, cookies
   `Secure`, HSTS (1 h par défaut, à passer à `31536000` une fois HTTPS validé),
   `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
   `nosniff`. La redirection HTTP → HTTPS est faite par Django (`SECURE_SSL_REDIRECT=true`,
   défaut hors compose) ou par le proxy TLS (`SECURE_SSL_REDIRECT=false`, défaut de
   `docker-compose.yml`, pour que la pile locale reste utilisable en
   `http://localhost:8080`). Désactiver explicitement une protection (redirection, HSTS)
   fait taire l'avertissement correspondant de `check --deploy` : c'est un choix assumé.
   Admin Django sur un domaine public : `CSRF_TRUSTED_ORIGINS=https://sm.exemple.bj`.
3. **`SECRET_KEY`** : longue valeur aléatoire propre à chaque environnement, jamais
   commitée : `python3 -c "import secrets; print(secrets.token_urlsafe(64))"`.
   La changer invalide les sessions et jetons en cours.
4. **`DEBUG=false`** : sinon Django expose ses pages d'erreur détaillées.
5. **`ALLOWED_HOSTS`** : le ou les domaines publics exacts, ex. `sm.exemple.bj`
   (`127.0.0.1` et `localhost` restent acceptés pour les sondes : `INTERNAL_HOSTS`).
6. **CORS** : inutile en même origine. Si le front est servi depuis un autre domaine
   (build avec `VITE_API_URL=https://api.exemple.bj/api/v1`), lister ce domaine dans
   `CORS_ALLOWED_ORIGINS` (avec le schéma, ex. `https://sm.exemple.bj`).
7. **Mots de passe** : `POSTGRES_PASSWORD` fort ; PostgreSQL n'est pas exposé hors du
   réseau compose (pas de `ports` sur `db`).
8. **Assistant IA** (facultatif) : renseigner `ANTHROPIC_API_KEY` (clé propre à
   l'environnement, jamais commitée). Les données de l'organisme de l'utilisateur
   (résumé compact) sont alors transmises à l'API Claude d'Anthropic à chaque question :
   le faire valider par l'organisme (politique de protection des données). Sans clé,
   aucune donnée ne sort et l'assistant garde ses réponses locales. Détails :
   `backend/README.md`, section « Assistant IA ».
9. **E-mails** : `EMAIL_HOST`… et `FRONTEND_URL` (domaine public) pour les invitations.
10. Vérifier la configuration :
   `docker compose exec backend python manage.py check --deploy --fail-level WARNING`
   (aucun avertissement attendu).
11. Sauvegardes planifiées (`backend/scripts/backup.sh`) et supervision de
    `/api/v1/health/` (et `/healthz` pour nginx).

## Intégration continue

`.github/workflows/ci.yml` exécute à chaque push / pull request :

- **backend** (PostgreSQL 16 en service) : `ruff check`, `ruff format --check`,
  `makemigrations --check --dry-run`, `pytest`, schéma OpenAPI
  (`spectacular --validate --fail-on-warn`), `check --deploy --fail-level WARNING`
  (variables factices de production) ;
- **frontend** : `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build`.
- **e2e** (manuel) : *Actions → CI → Run workflow*, case « e2e » cochée. Démarre l'API
  (SQLite + démo), le front Vite branché dessus et exécute `scripts/api-smoke.mjs`
  (Playwright / Chromium).
