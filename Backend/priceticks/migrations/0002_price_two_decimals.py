from decimal import Decimal, ROUND_HALF_UP
from django.db import migrations, models


def round_prices(apps, schema_editor):
    PriceTick = apps.get_model('priceticks', 'PriceTick')
    quant = Decimal('0.01')
    for tick in PriceTick.objects.all():
        tick.price_usd = Decimal(str(tick.price_usd)).quantize(quant, rounding=ROUND_HALF_UP)
        tick.save(update_fields=['price_usd'])


class Migration(migrations.Migration):

    dependencies = [
        ('priceticks', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(round_prices, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='pricetick',
            name='price_usd',
            field=models.DecimalField(max_digits=18, decimal_places=2),
        ),
    ]
