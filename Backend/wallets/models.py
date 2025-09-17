from django.db import models
from django.contrib.auth.models import User

class Wallet(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='wallets')
    name = models.CharField(max_length=120)
    pub_key = models.CharField(max_length=128, unique=True)     # clave pública (demo)
    priv_key_enc = models.CharField(max_length=256)             # privada “ofuscada” (NO exponer)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f'{self.name} ({self.pub_key[:8]}...)'
