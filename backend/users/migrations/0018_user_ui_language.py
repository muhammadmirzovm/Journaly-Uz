from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0017_alter_user_options_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='ui_language',
            field=models.CharField(
                choices=[('uz', 'Uzbek'), ('ru', 'Russian'), ('en', 'English')],
                default='uz',
                max_length=2,
            ),
        ),
    ]
