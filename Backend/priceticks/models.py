from django.db import models

class PriceTick(models.Model):
    ts = models.DateTimeField(db_index=True)
    price_usd = models.DecimalField(max_digits=18, decimal_places=2)
    price_btc = models.DecimalField(max_digits=18, decimal_places=8, null=True, blank=True)
    volume_sim = models.DecimalField(max_digits=28, decimal_places=2, null=True, blank=True)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ['-ts']
        indexes = [
            models.Index(fields=['ts']),
        ]

    def __str__(self):
        return f'{self.ts.isoformat()} → ${self.price_usd}'
