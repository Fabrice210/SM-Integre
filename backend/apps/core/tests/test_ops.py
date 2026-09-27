"""Exploitation : sondes de santé, erreurs JSON sous /api/, journalisation, schéma OpenAPI."""

import json
import logging
import os
import subprocess
import sys
from unittest import mock

import pytest
from django.db.utils import OperationalError
from drf_spectacular.drainage import GENERATOR_STATS, reset_generator_stats
from drf_spectacular.generators import SchemaGenerator
from drf_spectacular.validation import validate_schema
from rest_framework.test import APIClient

from apps.core.logformat import JsonFormatter

pytestmark = pytest.mark.django_db


# ---------- Santé ----------


def test_health_ok():
    r = APIClient().get("/api/v1/health/")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "checks": {"database": "ok"}}


def test_ready_ok():
    r = APIClient().get("/api/v1/ready/")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "checks": {"database": "ok", "migrations": "ok"}}


def test_health_database_down():
    with mock.patch("apps.core.api.connection.cursor", side_effect=OperationalError("down")):
        r = APIClient().get("/api/v1/health/")
        assert r.status_code == 503
        assert r.json() == {"status": "unavailable", "checks": {"database": "error"}}
        assert APIClient().get("/api/v1/ready/").status_code == 503


def test_ready_pending_migrations():
    with mock.patch("apps.core.api.MigrationExecutor") as executor:
        executor.return_value.migration_plan.return_value = [("migration", False)]
        r = APIClient().get("/api/v1/ready/")
    assert r.status_code == 503
    assert r.json()["checks"]["migrations"] == "pending"


def test_health_not_redirected_to_https(settings):
    settings.SECURE_SSL_REDIRECT = True
    assert APIClient().get("/api/v1/health/").status_code == 200
    assert APIClient().get("/api/v1/bootstrap/").status_code == 301


# ---------- Erreurs JSON ----------


def test_api_500_is_json(api):
    api.raise_request_exception = False
    with mock.patch("apps.core.api.build_state", side_effect=RuntimeError("boom")):
        r = api.get("/api/v1/bootstrap/")
    assert r.status_code == 500
    assert r["Content-Type"] == "application/json"
    assert r.json() == {"detail": "Erreur interne du serveur.", "status": 500}


def test_api_404_is_json():
    r = APIClient().get("/api/v1/nexiste-pas/")
    assert r.status_code == 404
    assert r.json()["detail"] == "Ressource introuvable."


# ---------- Journalisation ----------


def test_json_formatter():
    try:
        raise ValueError("détail")
    except ValueError:
        record = logging.getLogger("apps.test").makeRecord(
            "apps.test", logging.ERROR, __file__, 1, "Échec %s", ("x",), sys.exc_info(), extra={"org": 3}
        )
    line = JsonFormatter().format(record)
    data = json.loads(line)
    assert data["level"] == "ERROR" and data["logger"] == "apps.test"
    assert data["message"] == "Échec x" and data["org"] == 3
    assert "ValueError: détail" in data["exc_info"]
    assert "\n" not in line


# ---------- Stockage des fichiers ----------


def _settings_in_subprocess(code: str, **env) -> str:
    from django.conf import settings

    out = subprocess.run(
        [sys.executable, "-c", f"import config.settings as s; {code}"],
        cwd=settings.BASE_DIR,
        env={**os.environ, **env},
        capture_output=True,
        text=True,
        check=True,
    )
    return out.stdout.strip()


def test_storage_disk_by_default(settings):
    assert settings.STORAGES["default"]["BACKEND"] == "django.core.files.storage.FileSystemStorage"


def test_storage_s3_when_bucket_configured():
    code = (
        "from django.utils.module_loading import import_string as i; b = s.STORAGES['default'];"
        "i(b['BACKEND']); print(b['BACKEND'], b['OPTIONS']['bucket_name'], b['OPTIONS']['endpoint_url'])"
    )
    out = _settings_in_subprocess(
        code, AWS_STORAGE_BUCKET_NAME="sm-pieces", AWS_S3_ENDPOINT_URL="http://minio:9000"
    )
    assert out == "storages.backends.s3.S3Storage sm-pieces http://minio:9000"


# ---------- Schéma OpenAPI ----------


def test_openapi_schema_without_warnings():
    reset_generator_stats()
    schema = SchemaGenerator().get_schema(request=None, public=True)
    problems = {**GENERATOR_STATS._warn_cache, **GENERATOR_STATS._error_cache}
    assert not problems, "\n".join(problems)
    validate_schema(schema)
    paths = schema["paths"]
    for p in (
        "/api/v1/health/",
        "/api/v1/ready/",
        "/api/v1/bootstrap/",
        "/api/v1/auth/me/",
        "/api/v1/auth/signup/",
        "/api/v1/auth/password/reset/",
        "/api/v1/auth/password/confirm/",
        "/api/v1/parties/{uid}/plan-engagement/",
    ):
        assert p in paths, p
