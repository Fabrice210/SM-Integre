"""Fixtures partagées : organisme de démo chargé, clients API par rôle."""

import pytest
from rest_framework.test import APIClient

from apps.core.demo import load_demo, read_demo


@pytest.fixture(scope="session")
def demo_data():
    return read_demo()


@pytest.fixture
def demo_org(db, demo_data):
    return load_demo(demo_data, password="Test-pass-123!")


def _client(org, email):
    user = org.users.get(email=email)
    c = APIClient()
    c.force_authenticate(user)
    c.user = user
    return c


@pytest.fixture
def api(demo_org):
    """Responsable SM (Florence DOSSOU-YOVO) : tous les droits."""
    return _client(demo_org, "f.dossou-yovo@agrobenin.bj")


@pytest.fixture
def api_collab(demo_org):
    """Collaboratrice (Prisca ASSOGBA) : lecture seule."""
    return _client(demo_org, "p.assogba@agrobenin.bj")


@pytest.fixture
def api_admin(demo_org):
    """Administrateur plateforme (Hervé DJOSSOU)."""
    return _client(demo_org, "h.djossou@agrobenin.bj")


@pytest.fixture(autouse=True)
def _fast_password_hasher(settings):
    settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]


@pytest.fixture(autouse=True)
def _test_environment(settings):
    """Client de test en HTTP (pas de redirection HTTPS), e-mails en mémoire, quotas remis à zéro."""
    from django.core.cache import cache

    settings.SECURE_SSL_REDIRECT = False
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    cache.clear()
    yield
    cache.clear()
