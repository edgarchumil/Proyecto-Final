from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ('transactions', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='TradeRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('side', models.CharField(choices=[('BUY', 'BUY'), ('SELL', 'SELL')], max_length=4)),
                ('amount', models.DecimalField(decimal_places=8, max_digits=28)),
                ('fee', models.DecimalField(decimal_places=8, default=0, max_digits=28)),
                ('token', models.CharField(db_index=True, max_length=64, unique=True)),
                ('status', models.CharField(choices=[('PENDING', 'PENDING'), ('APPROVED', 'APPROVED'), ('REJECTED', 'REJECTED'), ('CANCELLED', 'CANCELLED')], default='PENDING', max_length=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('counterparty', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='trade_requests_received', to=settings.AUTH_USER_MODEL)),
                ('requester', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='trade_requests_made', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.AddIndex(
            model_name='traderequest',
            index=models.Index(fields=['status'], name='tx_req_status_idx'),
        ),
        migrations.AddIndex(
            model_name='traderequest',
            index=models.Index(fields=['counterparty'], name='tx_req_cpty_idx'),
        ),
    ]

