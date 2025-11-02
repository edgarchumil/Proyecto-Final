# users/serializers.py
import re
from django.contrib.auth.models import User
from rest_framework import serializers  # type: ignore


class RegisterSerializer(serializers.ModelSerializer):
    username = serializers.CharField(max_length=150, validators=[])
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

    def validate_username(self, value: str) -> str:
        cleaned = re.sub(r'\s+', ' ', value or '').strip()
        if not cleaned:
            raise serializers.ValidationError('El usuario es obligatorio.')
        normalized = cleaned.replace(' ', '_')
        if not re.match(r'^[\w.@+-]+$', normalized):
            raise serializers.ValidationError('Solo se permiten letras, números y los símbolos @/./+/-/_.')
        if User.objects.filter(username__iexact=normalized).exists():
            raise serializers.ValidationError('Este usuario ya existe. Elige otro nombre.')
        return normalized

    def create(self, validated_data):
        username = validated_data.pop('username')
        return User.objects.create_user(
            username=username,
            email=validated_data.get('email', ''),
            password=validated_data['password']
        )


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email')
