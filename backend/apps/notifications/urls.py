from django.urls import path

from . import views

urlpatterns = [
    path("auth/me/notifications/", views.MyNotificationsView.as_view(), name="me-notifications"),
]
