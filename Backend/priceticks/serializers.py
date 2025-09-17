from rest_framework import serializers
from .models import PriceTick

class PriceTickSerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceTick
        fields = ('id', 'ts', 'price_usd')
        read_only_fields = ('id',)
