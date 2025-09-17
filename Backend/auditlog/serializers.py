from rest_framework import serializers
from .models import AuditLog

class AuditLogSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source='actor.username', read_only=True)

    class Meta:
        model = AuditLog
        fields = ('id', 'actor', 'actor_username', 'action', 'payload_json', 'created_at')
        read_only_fields = ('id', 'actor', 'actor_username', 'created_at')
