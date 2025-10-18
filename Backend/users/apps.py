from django.apps import AppConfig


class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'users'

    def ready(self) -> None:
        # Importa señales para bootstrap automático de wallets/creditos
        from . import signals  # noqa: F401
