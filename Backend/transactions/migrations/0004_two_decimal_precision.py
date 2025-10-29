from decimal import Decimal, ROUND_HALF_UP
from django.db import migrations, models


def round_transaction_amounts(apps, schema_editor):
    Transaction = apps.get_model('transactions', 'Transaction')
    TradeRequest = apps.get_model('transactions', 'TradeRequest')
    quant = Decimal('0.01')

    for tx in Transaction.objects.all():
        tx.amount = Decimal(str(tx.amount)).quantize(quant, rounding=ROUND_HALF_UP)
        tx.fee = Decimal(str(tx.fee)).quantize(quant, rounding=ROUND_HALF_UP)
        tx.save(update_fields=['amount', 'fee'])

    for req in TradeRequest.objects.all():
        req.amount = Decimal(str(req.amount)).quantize(quant, rounding=ROUND_HALF_UP)
        req.fee = Decimal(str(req.fee)).quantize(quant, rounding=ROUND_HALF_UP)
        req.save(update_fields=['amount', 'fee'])


class Migration(migrations.Migration):

    dependencies = [
        ('transactions', '0003_rename_tx_req_status_idx_transaction_status_677e82_idx_and_more'),
    ]

    operations = [
        migrations.RunPython(round_transaction_amounts, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='traderequest',
            name='amount',
            field=models.DecimalField(max_digits=28, decimal_places=2),
        ),
        migrations.AlterField(
            model_name='traderequest',
            name='fee',
            field=models.DecimalField(max_digits=28, decimal_places=2, default=Decimal('0')),
        ),
        migrations.AlterField(
            model_name='transaction',
            name='amount',
            field=models.DecimalField(max_digits=28, decimal_places=2, default=Decimal('0')),
        ),
        migrations.AlterField(
            model_name='transaction',
            name='fee',
            field=models.DecimalField(max_digits=28, decimal_places=2, default=Decimal('0')),
        ),
    ]
