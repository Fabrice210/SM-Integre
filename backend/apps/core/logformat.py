"""
Journalisation structurée : une ligne JSON par événement (LOG_FORMAT=json).

Champs : time (ISO 8601 UTC), level, logger, message, et selon le cas method, path,
status_code, user, exc_info, plus les clés passées dans `extra=`.
Ce module n'importe rien de Django : il est chargé par la configuration LOGGING.
"""

import json
import logging
from datetime import UTC, datetime

# Attributs standard d'un LogRecord : tout le reste vient de `extra=`.
_RESERVED = set(vars(logging.makeLogRecord({}))) | {"message", "asctime", "request", "server_time"}


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        out = {
            "time": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        request = getattr(record, "request", None)
        if request is not None and hasattr(request, "path"):
            out["method"] = getattr(request, "method", None)
            out["path"] = request.path
            user = getattr(request, "user", None)
            if user is not None and getattr(user, "is_authenticated", False):
                out["user"] = getattr(user, "email", str(user))
        for key, value in vars(record).items():
            if key not in _RESERVED and not key.startswith("_"):
                out[key] = value
        if record.exc_info:
            out["exc_info"] = self.formatException(record.exc_info)
        if record.stack_info:
            out["stack_info"] = self.formatStack(record.stack_info)
        return json.dumps(out, ensure_ascii=False, default=str)
