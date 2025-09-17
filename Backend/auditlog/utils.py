from typing import Any, Mapping
from django.contrib.auth.models import User
from .models import AuditLog

def log_action(actor: User | None, action: str, payload: Mapping[str, Any] | None = None) -> AuditLog:
    """
    Crea una entrada de bitácora. actor puede ser None (acciones del sistema).
    Ejemplo:
        log_action(request.user, 'WALLET_CREATE', {'wallet_id': w.id, 'name': w.name})
    """
    return AuditLog.objects.create(
        actor=actor,
        action=action,
        payload_json=dict(payload or {})
    )
