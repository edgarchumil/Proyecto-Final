from rest_framework import serializers
from django.db.models import Max
from .models import Block
import hashlib

GENESIS_PREV_HASH = '0' * 64   # marcador del bloque génesis

class BlockSerializer(serializers.ModelSerializer):
    current_hash = serializers.SerializerMethodField()

    class Meta:
        model = Block
        fields = ('id', 'height', 'prev_hash', 'merkle_root', 'nonce', 'mined_at', 'current_hash')
        read_only_fields = ('id', 'height', 'prev_hash', 'mined_at', 'current_hash')

    def get_current_hash(self, obj) -> str:
        return obj.hash

class BlockCreateSerializer(serializers.ModelSerializer):
    """Para crear/minear un bloque. El cliente envía merkle_root y nonce."""
    class Meta:
        model = Block
        fields = ('merkle_root', 'nonce')

    def create(self, validated_data):
        # Siguiente height
        last = Block.objects.aggregate(m=Max('height'))['m']
        next_height = 0 if last is None else last + 1

        # prev_hash = hash del último bloque, o GENESIS si no existe
        if last is None:
            prev_hash = GENESIS_PREV_HASH
        else:
            prev_block = Block.objects.get(height=last)
            prev_hash = prev_block.hash

        return Block.objects.create(
            height=next_height,
            prev_hash=prev_hash,
            **validated_data
        )
