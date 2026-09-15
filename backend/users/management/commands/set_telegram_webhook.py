import os
import urllib.request
import urllib.parse
import json
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Register the Telegram webhook URL with Telegram servers'

    def add_arguments(self, parser):
        parser.add_argument('url', help='Full webhook URL, e.g. https://<your-app>/api/auth/telegram/webhook/')
        parser.add_argument('--delete', action='store_true', help='Delete the webhook instead of setting it')

    def handle(self, *args, **options):
        token = os.environ.get('TELEGRAM_BOT_TOKEN')
        if not token:
            raise CommandError('TELEGRAM_BOT_TOKEN is not set')

        secret = os.environ.get('TELEGRAM_WEBHOOK_SECRET', '')

        if options['delete']:
            api_url = f'https://api.telegram.org/bot{token}/deleteWebhook'
            data = urllib.parse.urlencode({}).encode()
        else:
            api_url = f'https://api.telegram.org/bot{token}/setWebhook'
            payload = {'url': options['url']}
            if secret:
                payload['secret_token'] = secret
            data = urllib.parse.urlencode(payload).encode()

        req = urllib.request.Request(api_url, data=data, method='POST')
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())

        if result.get('ok'):
            if options['delete']:
                self.stdout.write(self.style.SUCCESS('Webhook deleted successfully.'))
            else:
                self.stdout.write(self.style.SUCCESS(f'Webhook set: {options["url"]}'))
        else:
            raise CommandError(f'Telegram API error: {result}')
