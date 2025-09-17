from django.db import models
from decimal import Decimal

class Transaction(models.Model):
    STATUS_PENDING   = 'PENDING'
    STATUS_CONFIRMED = 'CONFIRMED'
    STATUS_FAILED    = 'FAILED'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'PENDING'),
        (STATUS_CONFIRMED, 'CONFIRMED'),
        (STATUS_FAILED, 'FAILED'),
    ]

    # Relaciones dobles con Wallet (emisora y receptora)
    from_wallet = models.ForeignKey(
        'wallets.Wallet', on_delete=models.PROTECT,
        related_name='tx_as_sender'
    )
    to_wallet = models.ForeignKey(
        'wallets.Wallet', on_delete=models.PROTECT,
        related_name='tx_as_receiver'
    )

    amount = models.DecimalField(max_digits=28, decimal_places=8, default=Decimal('0'))
    fee    = models.DecimalField(max_digits=28, decimal_places=8, default=Decimal('0'))

    tx_hash = models.CharField(max_length=64, unique=True, db_index=True)
    status  = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_PENDING)

    # Un bloque puede contener muchas transacciones confirmadas
    block = models.ForeignKey(
        'blocks.Block', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='transactions'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['created_at']),
            models.Index(fields=['from_wallet']),
            models.Index(fields=['to_wallet']),
        ]

    def __str__(self):
        return f'{self.tx_hash[:10]}... {self.status}'
