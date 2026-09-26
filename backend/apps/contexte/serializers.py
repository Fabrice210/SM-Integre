from apps.core.serializers import OrgModelSerializer

from .models import Processus


class ProcessusSerializer(OrgModelSerializer):
    class Meta(OrgModelSerializer.Meta):
        model = Processus
