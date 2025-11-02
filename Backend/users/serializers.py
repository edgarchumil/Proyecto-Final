# users/serializers.py
import re
from django.contrib.auth.models import User
from rest_framework import serializers  # type: ignore


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ('username', 'email', 'password')

    def validate_password(self, value: str) -> str:
        if len(value) < 8:
            raise serializers.ValidationError('La contraseña debe tener al menos 8 caracteres.')
        if not re.search(r'[A-Z]', value):
            raise serializers.ValidationError('La contraseña debe incluir al menos una letra mayúscula.')
        if not re.search(r'[a-z]', value):
            raise serializers.ValidationError('La contraseña debe incluir al menos una letra minúscula.')
        if not re.search(r'\d', value):
            raise serializers.ValidationError('La contraseña debe incluir al menos un número.')
        if not re.search(r'[^\w\s]', value):
            raise serializers.ValidationError('La contraseña debe incluir al menos un símbolo.')
        return value

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password']
        )


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email')
