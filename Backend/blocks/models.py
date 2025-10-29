from django.db import models
from django.contrib.auth.models import User
import hashlib

class Block(models.Model):
    # height empieza en 0 (genesis) o en 1 si prefieres; aquí lo haremos automático en el serializer
    height = models.PositiveBigIntegerField(unique=True)
    prev_hash = models.CharField(max_length=64)       # SHA-256 del bloque anterior
    merkle_root = models.CharField(max_length=64)     # raíz Merkle de las txs confirmadas
    nonce = models.CharField(max_length=64)           # texto o número (string para flexibilidad)
    mined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-height']
        indexes = [
            models.Index(fields=['height']),
            models.Index(fields=['mined_at']),
        ]

    def __str__(self):
        return f'Block {self.height}'

    @property
    def header(self) -> str:
        # Cabecera simple para demo; en real incluirías más campos (timestamp, version, etc.)
        return f'{self.height}:{self.prev_hash}:{self.merkle_root}:{self.nonce}'

    @property
    def hash(self) -> str:
        return hashlib.sha256(self.header.encode('utf-8')).hexdigest()


class MiningReward(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='mining_rewards')
    block_height = models.PositiveBigIntegerField()
    block_hash = models.CharField(max_length=64)
    amount_btc = models.DecimalField(max_digits=18, decimal_places=8)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user_id} → {self.amount_btc} BTC (#{self.block_height})'
