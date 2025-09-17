from django.db import models
from django.contrib.auth.models import User

class AuditLog(models.Model):
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='audit_logs')
    action = models.CharField(max_length=80, db_index=True)           # ej: WALLET_CREATE, TX_SEND, BLOCK_MINE
    payload_json = models.JSONField(default=dict, blank=True)          # datos relevantes
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['actor']),
            models.Index(fields=['created_at']),
            models.Index(fields=['action']),
        ]

    def __str__(self):
        user = self.actor.username if self.actor else 'system'
        return f'[{self.created_at:%Y-%m-%d %H:%M:%S}] {user} → {self.action}'
