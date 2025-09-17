from django.db.models import Q
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from auditlog.utils import log_action

from .models import Transaction
from .serializers import (
    TransactionSerializer,
    TransactionCreateSerializer,
    TransactionConfirmSerializer,
    TransactionFailSerializer,
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
        resp = super().create(request, *args, **kwargs)
        # resp.data contiene la tx creada
        log_action(request.user, 'TX_SEND', {
            'tx_id': resp.data.get('id'),
            'tx_hash': resp.data.get('tx_hash'),
            'from_wallet': resp.data.get('from_wallet'),
            'to_wallet': resp.data.get('to_wallet'),
            'amount': resp.data.get('amount'),
            'fee': resp.data.get('fee'),
        })
        return resp

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
