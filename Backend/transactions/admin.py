from django.contrib import admin
from .models import Transaction

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('id', 'tx_hash', 'status', 'from_wallet', 'to_wallet', 'amount', 'fee', 'block', 'created_at')
    list_filter  = ('status', 'created_at')
    search_fields = ('tx_hash', 'from_wallet__name', 'to_wallet__name')
    readonly_fields = ('tx_hash', 'created_at')
