from decimal import Decimal
from django.db.models import Sum

from .models import Transaction


def wallet_available_balance(wallet_id: int, currency: str = Transaction.CURRENCY_SIM) -> Decimal:
    """
    Calcula el saldo disponible de una wallet considerando:
    - Entradas confirmadas
    - Salidas confirmadas (monto + fee)
    - Salidas pendientes (monto + fee)
    """
    def aggregate_amount(queryset, field: str) -> Decimal:
        return queryset.aggregate(total=Sum(field))['total'] or Decimal('0')

    confirmed = Transaction.objects.filter(status=Transaction.STATUS_CONFIRMED, currency=currency)
    pending = Transaction.objects.filter(status=Transaction.STATUS_PENDING, currency=currency)

    incoming = aggregate_amount(confirmed.filter(to_wallet_id=wallet_id), 'amount')
    outgoing = aggregate_amount(confirmed.filter(from_wallet_id=wallet_id), 'amount')
    outgoing_fee = aggregate_amount(confirmed.filter(from_wallet_id=wallet_id), 'fee')
    pending_out = aggregate_amount(pending.filter(from_wallet_id=wallet_id), 'amount')
    pending_fee = aggregate_amount(pending.filter(from_wallet_id=wallet_id), 'fee')

    available = incoming - outgoing - outgoing_fee - pending_out - pending_fee
    if available < 0:
        return Decimal('0')
    return available.quantize(Decimal('0.01'))


def wallet_balances(wallet_id: int) -> dict[str, Decimal]:
    balances: dict[str, Decimal] = {}
    for code, _ in Transaction.CURRENCY_CHOICES:
        balances[code] = wallet_available_balance(wallet_id, code)
    return balances
