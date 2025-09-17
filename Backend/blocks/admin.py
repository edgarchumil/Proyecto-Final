from django.contrib import admin
from .models import Block

@admin.register(Block)
class BlockAdmin(admin.ModelAdmin):
    list_display = ('id', 'height', 'prev_hash', 'merkle_root', 'nonce', 'mined_at', 'short_hash')
    search_fields = ('height', 'prev_hash', 'merkle_root', 'nonce')
    list_filter = ('mined_at',)
    readonly_fields = ('height', 'prev_hash', 'mined_at')

    def short_hash(self, obj):
        return obj.hash[:12]
    short_hash.short_description = 'hash'
