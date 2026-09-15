from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Sum


class CoinSetting(models.Model):
    """One singleton per academy — use CoinSetting.get(academy), never
    .objects.create() directly."""

    academy = models.OneToOneField('academies.Academy', on_delete=models.CASCADE, related_name='coin_setting')

    # Oddiy kun
    place_1_normal    = models.PositiveIntegerField(default=5)
    place_2_normal    = models.PositiveIntegerField(default=4)
    place_3_normal    = models.PositiveIntegerField(default=3)
    effort_min_normal = models.PositiveIntegerField(default=1)
    effort_max_normal = models.PositiveIntegerField(default=2)

    # Hafta oxiri (katta kun)
    place_1_big    = models.PositiveIntegerField(default=10)
    place_2_big    = models.PositiveIntegerField(default=8)
    place_3_big    = models.PositiveIntegerField(default=6)
    effort_min_big = models.PositiveIntegerField(default=2)
    effort_max_big = models.PositiveIntegerField(default=4)

    # Individual dars
    individual_normal = models.PositiveIntegerField(default=3)
    individual_big    = models.PositiveIntegerField(default=6)

    # Qoidalar
    big_days              = models.CharField(max_length=20, default='4,5', help_text="Vergul bilan ajratilgan hafta kunlari: 0=dushanba ... 6=yakshanba")
    min_group_for_3rd     = models.PositiveIntegerField(default=6)
    max_games_per_week    = models.PositiveIntegerField(default=3)
    edit_window_hours      = models.PositiveIntegerField(default=24)
    purchase_expires_days  = models.PositiveIntegerField(default=14)

    class Meta:
        verbose_name = 'Tangacha sozlamasi'
        verbose_name_plural = 'Tangacha sozlamalari'

    def __str__(self):
        return f'Tangacha sozlamalari — {self.academy.name}'

    @classmethod
    def get(cls, academy):
        return cls.objects.get_or_create(academy=academy)[0]


class CoinTransaction(models.Model):
    """Append-only ledger. Never updated or deleted — balance is always
    derived via balance_for(), and a mistake is corrected with a new
    reversing entry (type=ADJUSTMENT), not by editing an old row."""

    class Type(models.TextChoices):
        GAME_PLACE  = 'game_place',  "O'yin — o'rin"
        GAME_EFFORT = 'game_effort', "O'yin — harakat"
        PURCHASE    = 'purchase',    'Xarid'
        REFUND      = 'refund',      'Qaytarish'
        ADJUSTMENT  = 'adjustment',  'Tuzatish'

    student    = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='coin_ledger')
    amount     = models.IntegerField()
    type       = models.CharField(max_length=20, choices=Type.choices)
    reason     = models.CharField(max_length=200)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['student', '-created_at']),
            models.Index(fields=['student', 'type', '-created_at']),
        ]

    def __str__(self):
        return f'{self.student} {self.amount:+d} ({self.type})'

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValidationError('CoinTransaction yozuvlari tahrirlanmaydi — teskari yozuv qo\'shing.')
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError('CoinTransaction yozuvlari o\'chirilmaydi — teskari yozuv qo\'shing.')

    @staticmethod
    def balance_for(student):
        return CoinTransaction.objects.filter(student=student).aggregate(s=Sum('amount'))['s'] or 0

    @staticmethod
    def balances_for(students):
        """Bulk version of balance_for() — one aggregate query for many
        students instead of one query each. Returns {student_id: balance},
        defaulting students with no transactions yet to 0."""
        students = list(students)
        by_id = {
            row['student']: row['balance']
            for row in CoinTransaction.objects.filter(student__in=students)
                .values('student').annotate(balance=Sum('amount'))
        }
        return {s.id: by_id.get(s.id, 0) for s in students}
