from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Deprecated: bot now runs in webhook mode via /api/auth/telegram/webhook/'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING(
            'The polling bot is no longer used.\n'
            'The bot now runs in webhook mode — no separate process needed.\n'
            'To register the webhook URL, run:\n'
            '  python manage.py set_telegram_webhook https://<your-app>/api/auth/telegram/webhook/'
        ))
