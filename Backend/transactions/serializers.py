import os, hashlib
from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction as dbtx
from rest_framework import serializers
from .models import Transaction, TradeRequest
from wallets.models import Wallet
from blocks.models import Block

TWOPLACES = Decimal('0.01')


def _compute_tx_hash(from_id: int, to_id: int, amount: Decimal, fee: Decimal, salt: bytes) -> str:
    base = f'{from_id}:{to_id}:{amount}:{fee}:{salt.hex()}'.encode('utf-8')
    return hashlib.sha256(base).hexdigest()

class TransactionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = ('from_wallet', 'to_wallet', 'amount', 'fee')  # el servidor genera tx_hash y status
        extra_kwargs = {
            'fee': {'required': False, 'default': Decimal('0')}
        }

    def validate(self, data):
        from_w: Wallet = data['from_wallet']
        to_w: Wallet = data['to_wallet']

        if from_w_id := getattr(from_w, 'id', None) == getattr(to_w, 'id', None):
            raise serializers.ValidationError('from_wallet y to_wallet deben ser distintos.')

        amount = data.get('amount')
        fee = data.get('fee', Decimal('0'))
        if amount is None:
            raise serializers.ValidationError('amount es requerido.')
        if amount <= 0:
            raise serializers.ValidationError('amount debe ser > 0.')

        if fee < 0:
            raise serializers.ValidationError('fee no puede ser negativa.')

        data['amount'] = Decimal(str(amount)).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
        data['fee'] = Decimal(str(fee)).quantize(TWOPLACES, rounding=ROUND_HALF_UP)

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
    from_user = serializers.IntegerField(source='from_wallet.user.id', read_only=True)
    from_username = serializers.CharField(source='from_wallet.user.username', read_only=True)
    to_user = serializers.IntegerField(source='to_wallet.user.id', read_only=True)
    to_username = serializers.CharField(source='to_wallet.user.username', read_only=True)

    class Meta:
        model = Transaction
        fields = (
            'id',
            'from_wallet', 'from_wallet_name', 'from_user', 'from_username',
            'to_wallet', 'to_wallet_name', 'to_user', 'to_username',
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


class TradeRequestSerializer(serializers.ModelSerializer):
    requester_username = serializers.CharField(source='requester.username', read_only=True)
    counterparty_username = serializers.CharField(source='counterparty.username', read_only=True)

    class Meta:
        model = TradeRequest
        fields = (
            'id', 'token', 'side', 'amount', 'fee', 'status', 'created_at',
            'requester', 'requester_username', 'counterparty', 'counterparty_username'
        )
        read_only_fields = ('id', 'token', 'status', 'created_at', 'requester')

class TradeRequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TradeRequest
        fields = ('counterparty', 'side', 'amount', 'fee')
        extra_kwargs = {
            'fee': {'required': False, 'default': Decimal('0')}
        }

    def create(self, validated_data):
        import secrets
        requester = self.context['request'].user
        token = secrets.token_hex(16)
        amount = Decimal(str(validated_data.get('amount', Decimal('0')))).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
        fee = Decimal(str(validated_data.get('fee', Decimal('0')))).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
        validated_data['amount'] = amount
        validated_data['fee'] = fee
        return TradeRequest.objects.create(requester=requester, token=token, **validated_data)
