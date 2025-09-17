from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PriceTickViewSet

router = DefaultRouter()
router.register(r'prices', PriceTickViewSet, basename='pricetick')

urlpatterns = [
    path('', include(router.urls)),
]
