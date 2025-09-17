from django.contrib import admin
from .models import AuditLog

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'actor', 'action', 'created_at', 'short_payload')
    list_filter  = ('action', 'created_at')
    search_fields = ('actor__username', 'action')
    readonly_fields = ('actor', 'action', 'payload_json', 'created_at')

    def short_payload(self, obj):
        s = str(obj.payload_json)
        return (s[:80] + '…') if len(s) > 80 else s
