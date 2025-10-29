from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('blocks', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='MiningReward',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('block_height', models.PositiveBigIntegerField()),
                ('block_hash', models.CharField(max_length=64)),
                ('amount_btc', models.DecimalField(decimal_places=8, max_digits=18)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=models.CASCADE, related_name='mining_rewards', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
