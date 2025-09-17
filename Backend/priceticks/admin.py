from django.contrib import admin
from .models import PriceTick

@admin.register(PriceTick)
class PriceTickAdmin(admin.ModelAdmin):
    list_display = ('id', 'ts', 'price_usd')
    list_filter  = ('ts',)
    search_fields = ('ts',)
