from rest_framework import viewsets, permissions
from .models import AuditLog
from .serializers import AuditLogSerializer

class IsSelfOrStaff(permissions.BasePermission):
    """
    - is_staff: puede ver todo
    - usuarios normales: solo ven sus propias entradas
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        return request.user.is_staff or (obj.actor_id == request.user.id)

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Solo lectura vía API:
      GET /api/audit-logs/        (propios; si es staff, todos)
      GET /api/audit-logs/{id}/
    La creación se hace desde el backend con utils.log_action(...)
    """
    serializer_class = AuditLogSerializer
    permission_classes = [IsSelfOrStaff]

    def get_queryset(self):
        qs = AuditLog.objects.all().select_related('actor')
        if not self.request.user.is_staff:
            qs = qs.filter(actor=self.request.user)
        return qs
