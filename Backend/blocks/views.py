import random
from decimal import Decimal
from django.db.models import Sum, Count
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from .models import Block, MiningReward
from .serializers import BlockSerializer, BlockCreateSerializer
from auditlog.utils import log_action

class BlockViewSet(viewsets.ModelViewSet):
    """
    /api/blocks/            GET list (público de lectura), POST crea/minea (requiere auth)
    /api/blocks/{id}/       GET retrieve (público), DELETE (auth) [opcional en una demo]
    /api/blocks/mine/       POST alias de create (opcional)
    """
    queryset = Block.objects.all()
    # Serializer por defecto para lecturas
    serializer_class = BlockSerializer
    
    def create(self, request, *args, **kwargs):
        resp = super().create(request, *args, **kwargs)
        log_action(request.user, 'BLOCK_MINE', {
            'block_id': resp.data.get('id'),
            'height': resp.data.get('height'),
            'prev_hash': resp.data.get('prev_hash'),
        })
        return resp

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_serializer_class(self):
        return BlockCreateSerializer if self.action in ('create', 'mine') else BlockSerializer

    @action(detail=False, methods=['post'])
    def mine(self, request):
        """Alias explícito para minado: recibe merkle_root y nonce."""
        s = BlockCreateSerializer(data=request.data, context={'request': request})
        if s.is_valid():
            block = s.save()
            return Response(BlockSerializer(block).data, status=status.HTTP_201_CREATED)
        return Response(s.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='simulate-mining')
    def simulate_mining(self, request, pk=None):
        """Simula el minado de un bloque existente con resultado aleatorio."""
        block = self.get_object()
        block_snapshot = {
            'block_id': block.id,
            'height': block.height,
            'prev_hash': block.prev_hash,
            'current_hash': block.hash,
            'merkle_root': block.merkle_root,
            'nonce': block.nonce,
        }

        success = random.random() >= 0.5
        if success:
            reward_sats = random.randint(20_000, 150_000)  # 0.0002 - 0.0015 BTC aprox
            reward = (Decimal(reward_sats) / Decimal('100000000')).quantize(Decimal('0.00000001'))
            payload = {
                **block_snapshot,
                'reward_btc': str(reward),
                'outcome': 'success',
            }
            log_action(request.user, 'BLOCK_SIMULATION_SUCCESS', payload)
            MiningReward.objects.create(
                user=request.user,
                block_height=block_snapshot['height'],
                block_hash=block_snapshot['current_hash'],
                amount_btc=reward
            )
            block.delete()
            return Response({
                'success': True,
                'message': f"Bloque #{block_snapshot['height']} minado. Recompensa {reward} BTC",
                'reward_btc': str(reward),
                'block_id': block_snapshot['block_id'],
            })

        payload = {
            **block_snapshot,
            'outcome': 'failure',
            'reason': 'network_difficulty',
        }
        log_action(request.user, 'BLOCK_SIMULATION_FAILURE', payload)
        block.delete()
        return Response({
            'success': False,
            'message': f"Imposible minar el bloque #{block_snapshot['height']} en este intento.",
            'block_id': block_snapshot['block_id'],
        })

    @action(detail=False, methods=['get'], url_path='mining-summary')
    def mining_summary(self, request):
        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication credentials were not provided.'}, status=status.HTTP_401_UNAUTHORIZED)
        summary = MiningReward.objects.filter(user=request.user).aggregate(
            total=Sum('amount_btc'),
            count=Count('id')
        )
        total = summary['total'] or Decimal('0')
        if not isinstance(total, Decimal):
            total = Decimal(total)
        total = total.quantize(Decimal('0.00000001'))
        return Response({
            'total_btc': str(total),
            'total_attempts': summary['count'] or 0
        })
