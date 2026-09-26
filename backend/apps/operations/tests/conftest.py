import pytest
from rest_framework.test import APIClient


@pytest.fixture
def client_for(demo_org):
    """Client API authentifié pour un utilisateur de la démo, désigné par son nom complet."""

    def make(nom):
        user = demo_org.users.get(nom=nom)
        c = APIClient()
        c.force_authenticate(user)
        c.user = user
        return c

    return make


@pytest.fixture
def media(settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path)
    return tmp_path
