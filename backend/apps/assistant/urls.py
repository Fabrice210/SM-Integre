from django.urls import path

from . import views

urlpatterns = [
    path("assistant/ask/", views.AskView.as_view(), name="assistant-ask"),
]
