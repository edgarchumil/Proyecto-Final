from rest_framework import serializers
from decimal import Decimal, ROUND_HALF_UP
from .models import PriceTick

class PriceTickSerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceTick
        fields = ('id', 'ts', 'price_usd', 'price_btc', 'volume_sim', 'notes')
        read_only_fields = ('id',)

    def validate_price_usd(self, value):
        return Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    def validate_price_btc(self, value):
        if value in (None, ''):
            return None
        return Decimal(str(value)).quantize(Decimal('0.00000001'), rounding=ROUND_HALF_UP)

    def validate_volume_sim(self, value):
        if value in (None, ''):
            return None
        return Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
