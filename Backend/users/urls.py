# Backend/users/urls.py
from django.urls import path
from .views import RegisterView, MeView, HealthView  # ajusta si tus nombres difieren

urlpatterns = [
    path('users/register/', RegisterView.as_view(), name='register'),
    path('users/me/', MeView.as_view(), name='me'),
    path('health/', HealthView.as_view(), name='health'),
]
