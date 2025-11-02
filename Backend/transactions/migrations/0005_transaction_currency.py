from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('transactions', '0004_two_decimal_precision'),
    ]

    operations = [
        migrations.AddField(
            model_name='transaction',
            name='currency',
            field=models.CharField(choices=[('SIM', 'SIM'), ('USD', 'USD'), ('BTC', 'BTC')], default='SIM', max_length=3),
        ),
        migrations.AddField(
            model_name='traderequest',
            name='currency',
            field=models.CharField(choices=[('SIM', 'SIM'), ('USD', 'USD'), ('BTC', 'BTC')], default='SIM', max_length=3),
        ),
        migrations.AddIndex(
            model_name='transaction',
            index=models.Index(fields=['currency'], name='transaction_currency_idx'),
        ),
    ]
