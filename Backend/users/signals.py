from __future__ import annotations

from decimal import Decimal

from django.contrib.auth.models import User
from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from auditlog.utils import log_action
from transactions.models import Transaction
from transactions.serializers import TransactionCreateSerializer
from wallets.models import Wallet
from wallets.serializers import _gen_keypair


@receiver(post_save, sender=User)
def ensure_default_wallet_and_credit(sender, instance: User, created: bool, **_kwargs) -> None:
    """
    Cuando se crea un usuario nuevo se genera automáticamente una wallet "Default"
    y se acredita un saldo inicial de 5 SIM proveniente del usuario "market".
    """
    if not created:
        return

    # Evita ejecutar la lógica para el usuario especial del faucet
    if instance.username == 'market':
        return

    # Si por alguna razón ya existe una wallet, no dupliques la operación.
    if instance.wallets.exists():
        return

    with transaction.atomic():
        pub, priv = _gen_keypair()
        default_wallet = Wallet.objects.create(
            user=instance,
            name='Default',
            pub_key=pub,
            priv_key_enc=priv
        )
        log_action(instance, 'WALLET_CREATE', {'wallet_id': default_wallet.id, 'name': default_wallet.name})

        market_user, _ = User.objects.get_or_create(
            username='market',
            defaults={'email': 'market@example.com'}
        )

        market_wallet = market_user.wallets.filter(name='Exchange').first()
        if not market_wallet:
            pub_m, priv_m = _gen_keypair()
            market_wallet = Wallet.objects.create(
                user=market_user,
                name='Exchange',
                pub_key=pub_m,
                priv_key_enc=priv_m
            )
            log_action(market_user, 'WALLET_CREATE', {'wallet_id': market_wallet.id, 'name': market_wallet.name})

        credit_serializer = TransactionCreateSerializer(data={
            'from_wallet': market_wallet.id,
            'to_wallet': default_wallet.id,
            'amount': Decimal('5'),
            'fee': Decimal('0'),
        })
        credit_serializer.is_valid(raise_exception=True)
        tx = credit_serializer.save()
        tx.status = Transaction.STATUS_CONFIRMED
        tx.save(update_fields=['status'])
        log_action(instance, 'WELCOME_CREDIT', {'tx_id': tx.id, 'amount': '5'})
