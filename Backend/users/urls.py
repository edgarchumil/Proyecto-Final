# Backend/users/urls.py
from django.urls import path
from .views import RegisterView, MeView, HealthView, UsersListView  # ajusta si tus nombres difieren

urlpatterns = [
    path('users/register/', RegisterView.as_view(), name='register'),
    path('users/me/', MeView.as_view(), name='me'),
    path('users/', UsersListView.as_view(), name='users-list'),
    path('health/', HealthView.as_view(), name='health'),
]
