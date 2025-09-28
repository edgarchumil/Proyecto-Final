from django.db.models import Q
from django.contrib.auth.models import User
from decimal import Decimal
import secrets
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from auditlog.utils import log_action

from .models import Transaction
from wallets.models import Wallet
from .serializers import (
    TransactionSerializer,
    TransactionCreateSerializer,
    TransactionConfirmSerializer,
    TransactionFailSerializer,
    TradeRequestSerializer,
    TradeRequestCreateSerializer,
)

class TransactionViewSet(viewsets.ModelViewSet):
    """
    /api/tx/                GET -> lista (solo mis transacciones) | POST -> crear (enviar)
    /api/tx/{id}/           GET -> detalle
    /api/tx/{id}/confirm/   POST -> marcar CONFIRMED + asignar block
    /api/tx/{id}/fail/      POST -> marcar FAILED
    Filtros: ?status=...  | ?wallet=<id> (involucrada como from o to)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        my_wallet_ids = list(user.wallets.values_list('id', flat=True))
        qs = Transaction.objects.filter(
            Q(from_wallet_id__in=my_wallet_ids) | Q(to_wallet_id__in=my_wallet_ids)
        )
        status_f = self.request.query_params.get('status')
        wallet_f = self.request.query_params.get('wallet')
        if status_f:
            qs = qs.filter(status=status_f)
        if wallet_f:
            qs = qs.filter(Q(from_wallet_id=wallet_f) | Q(to_wallet_id=wallet_f))
        return qs.select_related('from_wallet', 'to_wallet', 'block')

    def get_serializer_class(self):
        return {
            'create': TransactionCreateSerializer,
            'confirm': TransactionConfirmSerializer,
            'fail': TransactionFailSerializer,
        }.get(self.action, TransactionSerializer)

    # acciones de negocio
    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        tx = self.get_object()
        s = TransactionConfirmSerializer(tx, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(TransactionSerializer(tx).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def fail(self, request, pk=None):
        tx = self.get_object()
        s = TransactionFailSerializer(tx, data={}, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(TransactionSerializer(tx).data, status=status.HTTP_200_OK)
    
    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        # Permitir especificar usuario destino (id o username) en vez de wallet destino
        to_user = data.get('to_user')
        to_username = data.get('to_username')
        if 'to_wallet' not in data and (to_user or to_username):
            try:
                if to_user and str(to_user).isdigit():
                    u = User.objects.get(id=int(to_user))
                elif to_username:
                    u = User.objects.get(username=str(to_username))
                else:
                    u = None
            except User.DoesNotExist:
                u = None
            if not u:
                return Response({'detail': 'Usuario destino no encontrado.'}, status=status.HTTP_400_BAD_REQUEST)
            target = Wallet.objects.filter(user=u).order_by('created_at')
            w = target.filter(name__iexact='default').first() or target.first()
            if not w:
                return Response({'detail': 'El usuario destino no tiene wallet.'}, status=status.HTTP_400_BAD_REQUEST)
            data['to_wallet'] = w.id
            data.pop('to_user', None); data.pop('to_username', None)

        s = TransactionCreateSerializer(data=data)
        s.is_valid(raise_exception=True)
        tx = s.save()
        payload = TransactionSerializer(tx).data
        log_action(request.user, 'TX_SEND', {
            'tx_id': payload.get('id'),
            'tx_hash': payload.get('tx_hash'),
            'from_wallet': payload.get('from_wallet'),
            'to_wallet': payload.get('to_wallet'),
            'amount': payload.get('amount'),
            'fee': payload.get('fee'),
        })
        return Response(payload, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        tx = self.get_object()
        s = TransactionConfirmSerializer(tx, data=request.data, partial=True)
        s.is_valid(raise_exception=True); s.save()
        log_action(request.user, 'TX_CONFIRM', {'tx_id': tx.id, 'block': tx.block_id})
        return Response(TransactionSerializer(tx).data)

    @action(detail=True, methods=['post'])
    def fail(self, request, pk=None):
        tx = self.get_object()
        s = TransactionFailSerializer(tx, data={}, partial=True)
        s.is_valid(raise_exception=True); s.save()
        log_action(request.user, 'TX_FAIL', {'tx_id': tx.id})
        return Response(TransactionSerializer(tx).data)

    # --- Trading simplificado (compra/venta a "mercado") ---
    def _get_market_wallet(self) -> Wallet:
        user, _ = User.objects.get_or_create(username='market', defaults={'email': 'market@example.com'})
        w, created = Wallet.objects.get_or_create(
            user=user,
            name='Exchange',
            defaults={
                'pub_key': secrets.token_hex(16),
                'priv_key_enc': 'enc:' + secrets.token_hex(32),
            }
        )
        if created:
            log_action(user, 'WALLET_CREATE', {'wallet_id': w.id, 'name': w.name})
        return w

    @action(detail=False, methods=['post'])
    def buy(self, request):
        """Compra SIM: el exchange envía a tu wallet. Body: { wallet, amount, fee?, method?, reference? }"""
        wallet_id = request.data.get('wallet')
        amount = request.data.get('amount')
        fee = request.data.get('fee', '0.001')
        method = (request.data.get('method') or 'BANK').upper()
        if method not in ('BANK', 'CARD', 'P2P'):
            method = 'BANK'
        reference = request.data.get('reference')
        if not wallet_id or not amount:
            return Response({'detail': 'wallet y amount son requeridos.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            wallet = Wallet.objects.get(id=wallet_id, user=request.user)
            amount_d = Decimal(str(amount))
            fee_d = Decimal(str(fee))
        except Wallet.DoesNotExist:
            return Response({'detail': 'Wallet inválida.'}, status=status.HTTP_404_NOT_FOUND)
        except Exception:
            return Response({'detail': 'Parámetros inválidos.'}, status=status.HTTP_400_BAD_REQUEST)

        market = self._get_market_wallet()
        payload = {
            'from_wallet': market.id,
            'to_wallet': wallet.id,
            'amount': amount_d,
            'fee': fee_d,
        }
        s = TransactionCreateSerializer(data=payload)
        s.is_valid(raise_exception=True)
        tx = s.save()
        log_action(request.user, 'TRADE_BUY', {'tx_id': tx.id, 'amount': str(amount_d), 'method': method, 'reference': reference})
        return Response(TransactionSerializer(tx).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def sell(self, request):
        """Vende SIM: tu wallet envía al exchange. Body: { wallet, amount, fee?, method?, reference? }"""
        wallet_id = request.data.get('wallet')
        amount = request.data.get('amount')
        fee = request.data.get('fee', '0.001')
        method = (request.data.get('method') or 'BANK').upper()
        if method not in ('BANK', 'CARD', 'P2P'):
            method = 'BANK'
        reference = request.data.get('reference')
        if not wallet_id or not amount:
            return Response({'detail': 'wallet y amount son requeridos.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            wallet = Wallet.objects.get(id=wallet_id, user=request.user)
            amount_d = Decimal(str(amount))
            fee_d = Decimal(str(fee))
        except Wallet.DoesNotExist:
            return Response({'detail': 'Wallet inválida.'}, status=status.HTTP_404_NOT_FOUND)
        except Exception:
            return Response({'detail': 'Parámetros inválidos.'}, status=status.HTTP_400_BAD_REQUEST)

        market = self._get_market_wallet()
        payload = {
            'from_wallet': wallet.id,
            'to_wallet': market.id,
            'amount': amount_d,
            'fee': fee_d,
        }
        s = TransactionCreateSerializer(data=payload)
        s.is_valid(raise_exception=True)
        tx = s.save()
        log_action(request.user, 'TRADE_SELL', {'tx_id': tx.id, 'amount': str(amount_d), 'method': method, 'reference': reference})
        return Response(TransactionSerializer(tx).data, status=status.HTTP_201_CREATED)

from django.db import models

class TradeRequestViewSet(viewsets.ModelViewSet):
    """Solicitudes P2P con token para aprobación."""
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from .models import TradeRequest
        scope = self.request.query_params.get('scope')
        qs = TradeRequest.objects.all()
        if scope == 'incoming':
            qs = qs.filter(counterparty=self.request.user)
        elif scope == 'outgoing':
            qs = qs.filter(requester=self.request.user)
        else:
            qs = qs.filter(models.Q(requester=self.request.user) | models.Q(counterparty=self.request.user))
        status_f = self.request.query_params.get('status')
        if status_f:
            qs = qs.filter(status=status_f)
        return qs.select_related('requester', 'counterparty')

    def get_serializer_class(self):
        return TradeRequestCreateSerializer if self.action == 'create' else TradeRequestSerializer

    def perform_create(self, serializer):
        req = serializer.save()
        log_action(self.request.user, 'TRADE_REQUEST', {
            'id': req.id, 'token': req.token, 'side': req.side,
            'to': req.counterparty_id, 'amount': str(req.amount)
        })

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        from .models import TradeRequest
        tr: TradeRequest = self.get_object()
        if tr.counterparty_id != request.user.id:
            return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        if tr.status != 'PENDING':
            return Response({'detail': 'Solicitud no está pendiente.'}, status=status.HTTP_400_BAD_REQUEST)
        # Crear transacción según lado
        req_default = Wallet.objects.filter(user=tr.requester).order_by('created_at')
        req_w = req_default.filter(name__iexact='default').first() or req_default.first()
        cpty_default = Wallet.objects.filter(user=tr.counterparty).order_by('created_at')
        cpty_w = cpty_default.filter(name__iexact='default').first() or cpty_default.first()
        if not req_w or not cpty_w:
            return Response({'detail': 'Alguna de las partes no tiene wallet.'}, status=status.HTTP_400_BAD_REQUEST)
        if tr.side == 'SELL':
            payload = {'from_wallet': req_w.id, 'to_wallet': cpty_w.id, 'amount': tr.amount, 'fee': tr.fee}
        else:
            payload = {'from_wallet': cpty_w.id, 'to_wallet': req_w.id, 'amount': tr.amount, 'fee': tr.fee}
        s = TransactionCreateSerializer(data=payload)
        s.is_valid(raise_exception=True)
        tx = s.save()
        tr.status = 'APPROVED'
        tr.save(update_fields=['status'])
        log_action(request.user, 'TRADE_REQUEST_APPROVE', {'request_id': tr.id, 'tx_id': tx.id})
        return Response({'request': TradeRequestSerializer(tr).data, 'tx': TransactionSerializer(tx).data})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        tr = self.get_object()
        if tr.counterparty_id != request.user.id:
            return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        tr.status = 'REJECTED'
        tr.save(update_fields=['status'])
        log_action(request.user, 'TRADE_REQUEST_REJECT', {'request_id': tr.id})
        return Response(TradeRequestSerializer(tr).data)
