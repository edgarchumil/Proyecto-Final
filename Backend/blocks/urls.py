from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BlockViewSet

router = DefaultRouter()
router.register(r'blocks', BlockViewSet, basename='block')

urlpatterns = [
    path('', include(router.urls)),
]
