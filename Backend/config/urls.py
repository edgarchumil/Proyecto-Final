from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from users.views import RegisterView, MeView, HealthView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),  # <— enrutador de tu API

    # Auth JWT
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Registro y perfil
    path('api/users/register/', RegisterView.as_view(), name='register'),
    path('api/users/me/', MeView.as_view(), name='me'),

    # Público para comprobar que el server vive
    path('api/health/', HealthView.as_view(), name='health'),
    
    # API de wallets
    #path('api/', include('wallets.urls')),
]
