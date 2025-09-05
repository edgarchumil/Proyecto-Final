from django.shortcuts import render

# Create your views here.
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.auth.models import User
from rest_framework import status

class MeView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        u = request.user
        return Response({"id": u.id, "username": u.username, "email": u.email})

class RegisterView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        username = request.data.get("username")
        email    = request.data.get("email") or ""
        password = request.data.get("password")
        if not username or not password:
            return Response({"detail": "username y password requeridos"}, status=400)
        if User.objects.filter(username=username).exists():
            return Response({"detail": "usuario ya existe"}, status=400)
        user = User.objects.create_user(username=username, email=email, password=password)
        return Response({"id": user.id, "username": user.username, "email": user.email}, status=status.HTTP_201_CREATED)
