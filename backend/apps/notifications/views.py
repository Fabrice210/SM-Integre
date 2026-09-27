"""
Préférences de notification de l'utilisateur connecté.

  GET   /api/v1/auth/me/notifications/   {email, actif, echeances, validations}
  PATCH /api/v1/auth/me/notifications/   {"actif": false} pour se désabonner
"""

from rest_framework import generics, serializers

from apps.core.permissions import IsMemberAnyMethod
from apps.core.viewsets import log_write

from .models import NotificationPreference


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = NotificationPreference
        fields = ["email", "actif", "echeances", "validations"]


class MyNotificationsView(generics.RetrieveUpdateAPIView):
    """Tout membre (y compris en lecture seule) gère ses propres préférences."""

    serializer_class = NotificationPreferenceSerializer
    permission_classes = [IsMemberAnyMethod]
    http_method_names = ["get", "patch", "put", "head", "options"]

    def get_object(self):
        return NotificationPreference.for_user(self.request.user)

    def perform_update(self, serializer):
        pref = serializer.save()
        log_write(
            self.request,
            "notificationPreferences",
            "update",
            self.request.user.uid,
            {k: getattr(pref, k) for k in ("actif", "echeances", "validations")},
        )
