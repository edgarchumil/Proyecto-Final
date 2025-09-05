# users/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.contrib.auth.models import User
from .serializers import RegisterSerializer, UserSerializer


class HealthView(APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request):
        return Response({'status': 'ok'})


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    def post(self, request):
        s = RegisterSerializer(data=request.data)
        if s.is_valid():
            user = s.save()
            return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
        return Response(s.errors, status=status.HTTP_400_BAD_REQUEST)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        return Response(UserSerializer(request.user).data) 