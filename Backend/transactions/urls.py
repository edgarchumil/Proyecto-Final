from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TransactionViewSet, TradeRequestViewSet

router = DefaultRouter()
router.register(r'tx', TransactionViewSet, basename='tx')
router.register(r'tx-requests', TradeRequestViewSet, basename='tx-request')

urlpatterns = [
    path('', include(router.urls)),
]
