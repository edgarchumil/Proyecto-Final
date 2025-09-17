import os, hashlib
from decimal import Decimal
from django.db import transaction as dbtx
from rest_framework import serializers
from .models import Transaction
from wallets.models import Wallet
from blocks.models import Block

def _compute_tx_hash(from_id: int, to_id: int, amount: Decimal, fee: Decimal, salt: bytes) -> str:
    base = f'{from_id}:{to_id}:{amount}:{fee}:{salt.hex()}'.encode('utf-8')
    return hashlib.sha256(base).hexdigest()

class TransactionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = ('from_wallet', 'to_wallet', 'amount', 'fee')  # el servidor genera tx_hash y status

    def validate(self, data):
        from_w: Wallet = data['from_wallet']
        to_w: Wallet = data['to_wallet']

        if from_w_id := getattr(from_w, 'id', None) == getattr(to_w, 'id', None):
            raise serializers.ValidationError('from_wallet y to_wallet deben ser distintos.')

        if data['amount'] <= 0:
            raise serializers.ValidationError('amount debe ser > 0.')

        if data['fee'] < 0:
            raise serializers.ValidationError('fee no puede ser negativa.')

        # Opcional: si quieres impedir enviar a wallets de otros usuarios, descomenta:
        # if from_w.user_id != self.context["request"].user.id:
        #     raise serializers.ValidationError("Solo puedes emitir desde tus propias wallets.")

        return data

    @dbtx.atomic
    def create(self, validated_data):
        salt = os.urandom(16)
        txh = _compute_tx_hash(
            validated_data['from_wallet'].id,
            validated_data['to_wallet'].id,
            validated_data['amount'],
            validated_data['fee'],
            salt
        )
        # status arranca en PENDING; block = None
        return Transaction.objects.create(tx_hash=txh, **validated_data)

class TransactionSerializer(serializers.ModelSerializer):
    from_wallet_name = serializers.CharField(source='from_wallet.name', read_only=True)
    to_wallet_name   = serializers.CharField(source='to_wallet.name', read_only=True)

    class Meta:
        model = Transaction
        fields = (
            'id', 'from_wallet', 'from_wallet_name', 'to_wallet', 'to_wallet_name',
            'amount', 'fee', 'tx_hash', 'status', 'block', 'created_at'
        )
        read_only_fields = ('id', 'tx_hash', 'status', 'block', 'created_at')

class TransactionConfirmSerializer(serializers.ModelSerializer):
    """Solo cambia status→CONFIRMED y asigna block (si lo envían)."""
    class Meta:
        model = Transaction
        fields = ('block',)

    def validate_block(self, value: Block):
        if value is None:
            raise serializers.ValidationError('Debes indicar un bloque válido.')
        return value

    @dbtx.atomic
    def update(self, instance: Transaction, validated_data):
        instance.block = validated_data['block']
        instance.status = Transaction.STATUS_CONFIRMED
        instance.save(update_fields=['block', 'status'])
        return instance

class TransactionFailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = ()  # no llega nada, solo cambiamos estado

    @dbtx.atomic
    def update(self, instance: Transaction, validated_data):
        instance.status = Transaction.STATUS_FAILED
        instance.save(update_fields=['status'])
        return instance
