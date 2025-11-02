from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('priceticks', '0002_price_two_decimals'),
    ]

    operations = [
        migrations.AddField(
            model_name='pricetick',
            name='price_btc',
            field=models.DecimalField(blank=True, decimal_places=8, max_digits=18, null=True),
        ),
        migrations.AddField(
            model_name='pricetick',
            name='volume_sim',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=28, null=True),
        ),
        migrations.AddField(
            model_name='pricetick',
            name='notes',
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
