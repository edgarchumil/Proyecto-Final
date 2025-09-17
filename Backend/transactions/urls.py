from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TransactionViewSet

router = DefaultRouter()
router.register(r'tx', TransactionViewSet, basename='tx')

urlpatterns = [
    path('', include(router.urls)),
]
