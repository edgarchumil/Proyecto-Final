from django.contrib import admin
from .models import Wallet

@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'name', 'pub_key', 'created_at')
    list_filter = ('user', 'created_at')
    search_fields = ('name', 'pub_key', 'user__username', 'user__email')
    readonly_fields = ('pub_key', 'priv_key_enc', 'created_at')
