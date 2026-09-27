"""
Configuration Django de SM Intégré.

Tout ce qui varie selon l'environnement passe par des variables d'environnement
(cf. backend/.env.example et docs/DEPLOIEMENT.md). Sans DATABASE_URL, on utilise
SQLite (dev local et tests).
"""

from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    CORS_ALLOWED_ORIGINS=(list, ["http://localhost:5174", "http://localhost:4180"]),
)
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("SECRET_KEY", default="dev-insecure-change-me-0123456789abcdefghijklmnop")
DEBUG = env("DEBUG")
# Hôtes publics + hôtes des sondes internes (healthcheck Docker sur 127.0.0.1).
ALLOWED_HOSTS = list(
    dict.fromkeys([*env("ALLOWED_HOSTS"), *env.list("INTERNAL_HOSTS", default=["127.0.0.1", "localhost"])])
)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Tiers
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",  # révocation des jetons (rotation, déconnexion)
    "django_filters",
    "drf_spectacular",
    "corsheaders",
    # SM Intégré
    "apps.core",
    "apps.contexte",  # Module 1 — Contexte de l'organisme
    "apps.leadership",  # Module 2 — Leadership
    "apps.planification",  # Module 3 — Objectifs, conformité et risques
    "apps.support",  # Module 4 — Support
    "apps.operations",  # Module 5 — Maîtrise opérationnelle
    "apps.performance",  # Module 6 — Performance & amélioration
    "apps.pilotage",  # Pages transverses : couverture normative, tableau de bord…
    "apps.assistant",  # Assistant IA (API Claude)
    "apps.exports",  # Exports Excel / CSV / PDF côté serveur
    "apps.notifications",  # Notifications e-mail (alertes, validations en attente)
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {"default": env.db("DATABASE_URL", default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}")}
DATABASES["default"]["CONN_MAX_AGE"] = env.int("CONN_MAX_AGE", default=60)
DATABASES["default"]["CONN_HEALTH_CHECKS"] = True

AUTH_USER_MODEL = "core.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
# Validité des liens d'invitation / de réinitialisation du mot de passe (secondes).
PASSWORD_RESET_TIMEOUT = env.int("PASSWORD_RESET_TIMEOUT", default=3 * 24 * 3600)

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Africa/Porto-Novo"
USE_I18N = True
USE_TZ = True

# ---------- Fichiers statiques et pièces jointes ----------
#
# Statiques (admin, Swagger) : collectstatic + whitenoise.
# Pièces jointes (GED…) : disque local (MEDIA_ROOT, volume Docker `media`) par défaut ;
# stockage objet S3 ou compatible (MinIO, Scaleway, OVH…) si AWS_STORAGE_BUCKET_NAME est
# défini. Dans les deux cas, les fichiers sont téléchargés via l'API (droits vérifiés),
# jamais servis publiquement ; en DEBUG, MEDIA_URL est aussi servi par runserver.

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = env("MEDIA_URL", default="/media/")
MEDIA_ROOT = env("MEDIA_ROOT", default=str(BASE_DIR / "media"))

AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME", default="")
USE_S3 = bool(AWS_STORAGE_BUCKET_NAME)

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}
if USE_S3:
    # Identifiants : AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (lus par django-storages),
    # sinon chaîne de résolution de boto3 (rôle IAM de l'hôte…).
    _s3_optional = {
        "region_name": env("AWS_S3_REGION_NAME", default=None),
        # Fournisseur compatible S3 : https://s3.fr-par.scw.cloud, http://minio:9000…
        "endpoint_url": env("AWS_S3_ENDPOINT_URL", default=None),
        "addressing_style": env("AWS_S3_ADDRESSING_STYLE", default=None),  # « path » pour MinIO
    }
    STORAGES["default"] = {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {
            "bucket_name": AWS_STORAGE_BUCKET_NAME,
            "location": env("AWS_LOCATION", default="media"),
            "default_acl": None,  # objets privés (ACL du bucket)
            "file_overwrite": False,
            "querystring_auth": True,  # URL signées si une URL directe est produite
            "querystring_expire": env.int("AWS_QUERYSTRING_EXPIRE", default=300),
            "signature_version": "s3v4",
            **{k: v for k, v in _s3_optional.items() if v},
        },
    }

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------- API ----------

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["apps.core.permissions.IsOrgMember"],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_RATES": {
        "login": env("THROTTLE_LOGIN", default="10/min"),
        "signup": env("THROTTLE_SIGNUP", default="5/hour"),
        "password": env("THROTTLE_PASSWORD", default="10/hour"),
        "refresh": env("THROTTLE_REFRESH", default="30/min"),
        "export": env("THROTTLE_EXPORT", default="5/hour"),
    },
    "EXCEPTION_HANDLER": "apps.core.exceptions.camel_exception_handler",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env.int("JWT_ACCESS_MINUTES", default=30)),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env.int("JWT_REFRESH_DAYS", default=7)),
    "ROTATE_REFRESH_TOKENS": True,
    # Un jeton de rafraîchissement déjà utilisé (ou révoqué à la déconnexion) est refusé.
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
}

SPECTACULAR_SETTINGS = {
    "TITLE": "SM Intégré — API",
    "DESCRIPTION": "API du système de management intégré ISO 9001 / 14001 / 45001 / 27001.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    # Listes fermées partagées par plusieurs champs / modèles : un seul nom stable.
    "ENUM_NAME_OVERRIDES": {
        "InterneExterneEnum": "apps.contexte.models.PartieInteressee.Categorie",
        "PerimetreEnum": "apps.contexte.models.Perimetre",
        "EfficaciteTraitementEnum": "apps.planification.models.EfficaciteTraitement",
        "StatutActionEnum": "apps.planification.models.StatutAction",
        "DocTypeEnum": "apps.operations.models.DocType",
    },
}

CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")
# Origines de confiance pour les requêtes non sûres avec cookies (admin Django derrière un
# proxy, front sur un autre domaine) : schéma compris, ex. https://sm.exemple.bj
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])

# Mot de passe des comptes de démonstration créés par `manage.py load_demo`.
DEMO_PASSWORD = env("DEMO_PASSWORD", default="Demo-SM-2026!")

# ---------- Onboarding et comptes ----------

# Inscription publique d'un nouvel organisme (POST /api/v1/auth/signup/) : désactivée
# par défaut, les organismes sont alors créés par l'administrateur.
ALLOW_SIGNUP = env.bool("ALLOW_SIGNUP", default=False)
# URL du front, pour les liens envoyés par e-mail (invitation, mot de passe oublié).
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:5174").rstrip("/")
# Chemin de la page du front qui reçoit ?uid=…&token=… et appelle /auth/password/confirm/.
PASSWORD_SET_PATH = env("PASSWORD_SET_PATH", default="/definir-mot-de-passe")

# ---------- Données personnelles (docs/DONNEES_PERSONNELLES.md) ----------

# Durée de conservation (jours) de la trace technique (AuditLog) et des envois de
# notifications (NotificationLog), purgés par `manage.py purge_logs` ; 0 = jamais purgés.
# Le journal fonctionnel (JournalEntry) n'est jamais purgé (traçabilité ISO).
AUDITLOG_RETENTION_DAYS = env.int("AUDITLOG_RETENTION_DAYS", default=0)

# ---------- E-mail ----------
# Sans EMAIL_HOST (ou en DEBUG), les e-mails sont écrits dans la console.

EMAIL_HOST = env("EMAIL_HOST", default="")
EMAIL_BACKEND = env(
    "EMAIL_BACKEND",
    default="django.core.mail.backends.smtp.EmailBackend"
    if EMAIL_HOST and not DEBUG
    else "django.core.mail.backends.console.EmailBackend",
)
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
EMAIL_USE_SSL = env.bool("EMAIL_USE_SSL", default=False)
EMAIL_TIMEOUT = env.int("EMAIL_TIMEOUT", default=10)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="SM Intégré <no-reply@localhost>")
SERVER_EMAIL = env("SERVER_EMAIL", default=DEFAULT_FROM_EMAIL)

# ---------- Journalisation ----------
# LOG_FORMAT=json (défaut hors DEBUG) : une ligne JSON par événement sur la sortie standard,
# prête pour Docker / Loki / CloudWatch ; LOG_FORMAT=text en développement.

LOG_LEVEL = env("LOG_LEVEL", default="INFO").upper()
LOG_FORMAT = env("LOG_FORMAT", default="text" if DEBUG else "json")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {"()": "apps.core.logformat.JsonFormatter"},
        "text": {"format": "%(asctime)s %(levelname)s %(name)s %(message)s"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": LOG_FORMAT},
    },
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
    "loggers": {
        "django": {"handlers": ["console"], "level": LOG_LEVEL, "propagate": False},
        "django.db.backends": {"level": env("DB_LOG_LEVEL", default="WARNING").upper()},
        "apps": {"handlers": ["console"], "level": LOG_LEVEL, "propagate": False},
    },
}

# ---------- Sécurité (HTTPS) ----------
# Derrière un proxy TLS qui transmet X-Forwarded-Proto. Chaque réglage est pilotable par
# variable ; désactiver explicitement une protection fait taire l'avertissement
# correspondant de `manage.py check --deploy` (choix documenté, cf. docs/DEPLOIEMENT.md).

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
# Redirection HTTP -> HTTPS par Django. À désactiver si le proxy TLS redirige déjà
# (ou pour la pile Docker locale en http://localhost:8080).
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=not DEBUG)
# Sondes internes (healthcheck Docker en HTTP) : jamais redirigées.
SECURE_REDIRECT_EXEMPT = [r"^api/v1/health/$", r"^api/v1/ready/$"]
# HSTS : 1 h par défaut hors DEBUG ; passer à 31536000 (1 an) une fois HTTPS validé.
SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=0 if DEBUG else 3600)
SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", default=True)
SECURE_HSTS_PRELOAD = env.bool("SECURE_HSTS_PRELOAD", default=False)
SESSION_COOKIE_SECURE = env.bool("SESSION_COOKIE_SECURE", default=not DEBUG)
CSRF_COOKIE_SECURE = env.bool("CSRF_COOKIE_SECURE", default=not DEBUG)
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = env("SECURE_REFERRER_POLICY", default="strict-origin-when-cross-origin")
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"
X_FRAME_OPTIONS = env("X_FRAME_OPTIONS", default="DENY")

SILENCED_SYSTEM_CHECKS = []
if not SECURE_SSL_REDIRECT:
    SILENCED_SYSTEM_CHECKS.append("security.W008")  # redirection assurée par le proxy TLS
if not SECURE_HSTS_SECONDS:
    SILENCED_SYSTEM_CHECKS.append("security.W004")  # HSTS posé par le proxy TLS
if not SECURE_HSTS_INCLUDE_SUBDOMAINS:
    SILENCED_SYSTEM_CHECKS.append("security.W005")
if not SECURE_HSTS_PRELOAD:
    # Le préchargement HSTS est une inscription volontaire aux listes des navigateurs.
    SILENCED_SYSTEM_CHECKS.append("security.W021")


# Cache partagé : indispensable aux limites de débit (throttling) avec plusieurs workers
# gunicorn. Sans REDIS_URL, cache mémoire local (limites comptées par processus).
REDIS_URL = env("REDIS_URL", default="")
CACHES = {
    "default": (
        {"BACKEND": "django.core.cache.backends.redis.RedisCache", "LOCATION": REDIS_URL}
        if REDIS_URL
        else {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}
    )
}

# Taille maximale d'une pièce jointe GED (octets) ; rester sous client_max_body_size de nginx.
GED_MAX_UPLOAD_SIZE = env.int("GED_MAX_UPLOAD_SIZE", default=20 * 1024 * 1024)
