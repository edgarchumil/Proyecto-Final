from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from .models import Wallet
from .serializers import WalletSerializer, WalletCreateSerializer
from auditlog.utils import log_action

class IsOwner(permissions.BasePermission):
    """Solo el dueño puede ver/modificar su wallet."""
    def has_object_permission(self, request, view, obj):
        return getattr(obj, 'user_id', None) == request.user.id

class WalletViewSet(viewsets.ModelViewSet):
    """
    /api/wallets/           GET (list) -> mis wallets
                            POST       -> crear (genera claves)
    /api/wallets/{id}/      GET, DELETE (solo si es mía)
    """
    permission_classes = [permissions.IsAuthenticated, IsOwner]

    def get_queryset(self):
        return Wallet.objects.filter(user=self.request.user)

    def get_serializer_class(self):
        return WalletCreateSerializer if self.action == 'create' else WalletSerializer

    def perform_create(self, serializer):
        wallet = serializer.save()
        log_action(self.request.user, 'WALLET_CREATE', {'wallet_id': wallet.id, 'name': wallet.name})

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        self.check_object_permissions(request, instance)
        return Response(WalletSerializer(instance).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.check_object_permissions(request, instance)
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
