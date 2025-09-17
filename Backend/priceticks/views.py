from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import PriceTick
from .serializers import PriceTickSerializer

class PriceTickViewSet(viewsets.ModelViewSet):
    """
    /api/prices/            GET list (público), POST crear (auth)
    /api/prices/{id}/       GET retrieve (público), DELETE/PUT/PATCH (auth)
    /api/prices/latest/     GET último precio (público)
    """
    queryset = PriceTick.objects.all()

    def get_permissions(self):
        # Lectura pública; escritura requiere autenticación
        if self.action in ('list', 'retrieve', 'latest'):
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    serializer_class = PriceTickSerializer

    @action(detail=False, methods=['get'])
    def latest(self, request):
        obj = PriceTick.objects.order_by('-ts').first()
        if not obj:
            return Response({'detail': 'No hay datos de precio'}, status=404)
        return Response(self.get_serializer(obj).data)
