import pytest
from rest_framework.test import APIClient


@pytest.fixture
def api_dg(demo_org):
    """Directeur Général (Rodrigue AHOUANSOU, rôle Dirigeant)."""
    user = demo_org.users.get(email="r.ahouansou@agrobenin.bj")
    c = APIClient()
    c.force_authenticate(user)
    c.user = user
    return c
