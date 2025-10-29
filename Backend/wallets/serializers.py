import os, base64, hashlib
from rest_framework import serializers
from .models import Wallet

def _gen_keypair():
    """
    DEMO: genera 32 bytes aleatorios.
    pub_key = hex(semilla)
    priv_key_enc = SHA256(Base64(semilla))  (no almacenamos la semilla cruda)
    """
    seed = os.urandom(32)
    pub = seed.hex()
    priv = hashlib.sha256(base64.b64encode(seed)).hexdigest()
    return pub, priv

class WalletCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Wallet
        fields = ('name',)   # el cliente solo envía nombre

    def create(self, validated_data):
        request = self.context['request']
        pub, priv = _gen_keypair()
        name = validated_data.get('name')
        if not name:
            base = request.user.username or request.user.get_full_name() or 'Wallet'
            name = f"{base}"
        return Wallet.objects.create(
            user=request.user,
            name=name,
            pub_key=pub,
            priv_key_enc=priv
        )

class WalletSerializer(serializers.ModelSerializer):
    class Meta:
        model = Wallet
        # OJO: no exponemos priv_key_enc
        fields = ('id', 'name', 'pub_key', 'created_at')
        read_only_fields = ('id', 'pub_key', 'created_at')
