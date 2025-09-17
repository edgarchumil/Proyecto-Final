from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.urls import path, include
from .views import MeView, RegisterView

urlpatterns = [
    path('auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('users/me/', MeView.as_view(), name='users_me'),
    path('users/register/', RegisterView.as_view(), name='users_register'),
    #path('api/', include('wallets.urls')),
    path('', include('wallets.urls')),
    path('', include('blocks.urls')),     
    path('', include('priceticks.urls')),  
    path('', include('transactions.urls')), 
    path('', include('auditlog.urls')), 
    path('', include('users.urls')),  
]
