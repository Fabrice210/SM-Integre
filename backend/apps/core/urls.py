from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from . import accounts, api

router = DefaultRouter()
router.include_root_view = False
router.register("users", api.UserViewSet, basename="users")
router.register("journal", api.JournalViewSet, basename="journal")

urlpatterns = [
    path("health/", api.health, name="health"),
    path("ready/", api.ready, name="ready"),
    path("auth/login/", api.LoginView.as_view(), name="login"),
    path("auth/signup/", accounts.SignupView.as_view(), name="signup"),
    path("auth/password/reset/", accounts.PasswordResetView.as_view(), name="password-reset"),
    path("auth/password/confirm/", accounts.PasswordConfirmView.as_view(), name="password-confirm"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/me/", api.me, name="me"),
    path("organisation/", api.OrganisationView.as_view(), name="organisation"),
    path("settings/", api.SettingsView.as_view(), name="settings"),
    path("bootstrap/", api.bootstrap, name="bootstrap"),
    *router.urls,
]
