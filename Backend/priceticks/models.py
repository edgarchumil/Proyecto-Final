from django.db import models

class PriceTick(models.Model):
    ts = models.DateTimeField(db_index=True)                      # timestamp de la observación
    price_usd = models.DecimalField(max_digits=18, decimal_places=6)

    class Meta:
        ordering = ['-ts']                                        # más reciente primero
        indexes = [
            models.Index(fields=['ts']),
        ]

    def __str__(self):
        return f'{self.ts.isoformat()} → ${self.price_usd}'
