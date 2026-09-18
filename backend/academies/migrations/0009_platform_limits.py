from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('academies', '0008_academy_stamp'),
    ]

    operations = [
        migrations.AddField(
            model_name='academy', name='is_active',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='academy', name='max_students',
            field=models.PositiveIntegerField(default=100),
        ),
        migrations.AddField(
            model_name='academy', name='max_teachers',
            field=models.PositiveIntegerField(default=10),
        ),
        migrations.AddField(
            model_name='academy', name='max_groups',
            field=models.PositiveIntegerField(default=20),
        ),
        migrations.AddField(
            model_name='academy', name='max_invites_per_month',
            field=models.PositiveIntegerField(default=500),
        ),
    ]
