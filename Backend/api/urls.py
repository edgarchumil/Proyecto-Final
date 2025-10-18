from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.urls import path, include

urlpatterns = [
    path('auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('', include('wallets.urls')),
    path('', include('blocks.urls')),
    path('', include('priceticks.urls')),
    path('', include('transactions.urls')),
    path('', include('auditlog.urls')),
    path('', include('users.urls')),
]
