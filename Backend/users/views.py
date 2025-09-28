# users/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.contrib.auth.models import User
from django.db import transaction
from decimal import Decimal
from .serializers import RegisterSerializer, UserSerializer
from wallets.models import Wallet
from wallets.serializers import _gen_keypair
from transactions.serializers import TransactionCreateSerializer
from auditlog.utils import log_action


class HealthView(APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request):
        return Response({'status': 'ok'})


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    def post(self, request):
        s = RegisterSerializer(data=request.data)
        if not s.is_valid():
            return Response(s.errors, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            user = s.save()
            # 1) Crear wallet por defecto
            pub, priv = _gen_keypair()
            default_wallet = Wallet.objects.create(
                user=user,
                name='Default',
                pub_key=pub,
                priv_key_enc=priv
            )
            log_action(user, 'WALLET_CREATE', {'wallet_id': default_wallet.id, 'name': 'Default'})

            # 2) Crear o recuperar la wallet del "market/faucet"
            market_user, _ = User.objects.get_or_create(username='market', defaults={'email': 'market@example.com'})
            market_wallet = Wallet.objects.filter(user=market_user).first()
            if not market_wallet:
                pub_m, priv_m = _gen_keypair()
                market_wallet = Wallet.objects.create(user=market_user, name='Exchange', pub_key=pub_m, priv_key_enc=priv_m)
                log_action(market_user, 'WALLET_CREATE', {'wallet_id': market_wallet.id, 'name': 'Exchange'})

            # 3) Acreditar $5 SIM en una TX confirmada
            txs = TransactionCreateSerializer(data={
                'from_wallet': market_wallet.id,
                'to_wallet': default_wallet.id,
                'amount': Decimal('5'),
                'fee': Decimal('0')
            })
            txs.is_valid(raise_exception=True)
            tx = txs.save()
            tx.status = 'CONFIRMED'
            tx.save(update_fields=['status'])
            log_action(user, 'WELCOME_CREDIT', {'tx_id': tx.id, 'amount': '5'})

        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class UsersListView(APIView):
    """Lista de usuarios (id, username, email opcional)."""
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        qs = User.objects.all().order_by('id')
        data = UserSerializer(qs, many=True).data
        return Response(data)
