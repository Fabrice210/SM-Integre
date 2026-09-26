"""
Chargement des données de démonstration (backend/demo/demo.json, exporté du front
par scripts/export-demo-json.mjs) dans un organisme, via les sérialiseurs du
registre — ce qui garantit que l'API relit exactement ce que le front attend.
"""

import json
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction

from . import registry
from .models import JournalEntry, Organisation

DEMO_PATH = Path(settings.BASE_DIR) / "demo" / "demo.json"
User = get_user_model()


def read_demo(path: Path = DEMO_PATH) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _save(serializer):
    if not serializer.is_valid():
        raise ValueError(f"{serializer.__class__.__name__} : {serializer.errors}")
    return serializer.save()


@transaction.atomic
def load_demo(demo: dict | None = None, password: str | None = None) -> Organisation:
    demo = demo or read_demo()
    password = password or settings.DEMO_PASSWORD
    org_data = dict(demo["org"])
    org = Organisation.objects.create(
        nom=org_data.pop("nom"),
        sigle=org_data.pop("sigle", ""),
        profil=org_data,
        active_norms=list(demo["norms"].keys()),
    )
    for u in demo["users"]:
        User.objects.create_user(
            email=u["email"],
            password=password,
            organisation=org,
            uid=u["id"],
            nom=u["nom"],
            poste=u.get("poste", ""),
            direction=u.get("direction", ""),
            roles=u.get("roles", []),
        )
    ctx = {"organisation": org, "skip_ref_validation": True}
    db = demo["db"]
    for col in registry.all_collections():
        if col.name not in db:
            continue
        data = db[col.name]
        if col.singleton:
            obj, _ = col.model.objects.get_or_create(organisation=org)
            _save(col.serializer(obj, data=data, context=ctx))
        else:
            for i, row in enumerate(data):
                obj = _save(col.serializer(data=row, context=ctx))
                obj.position = i
                obj.save(update_fields=["position"])
    # Journal : le plus récent en tête -> on insère du plus ancien au plus récent.
    for j in reversed(db.get("journal", [])):
        JournalEntry.objects.create(organisation=org, **j)
    return org
