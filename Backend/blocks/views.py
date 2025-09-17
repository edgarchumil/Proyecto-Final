from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from .models import Block
from .serializers import BlockSerializer, BlockCreateSerializer
from auditlog.utils import log_action

class BlockViewSet(viewsets.ModelViewSet):
    """
    /api/blocks/            GET list (público de lectura), POST crea/minea (requiere auth)
    /api/blocks/{id}/       GET retrieve (público), DELETE (auth) [opcional en una demo]
    /api/blocks/mine/       POST alias de create (opcional)
    """
    queryset = Block.objects.all()
    
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
