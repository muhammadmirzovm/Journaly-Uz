import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator
from auditlog.registry import auditlog


def generate_join_key():
    return uuid.uuid4().hex[:8].upper()


class Group(models.Model):
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    teacher = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='taught_groups')
    join_key = models.CharField(max_length=8, unique=True, default=generate_join_key)
    class_days        = models.JSONField(default=list, blank=True, help_text='List of weekday ints: 0=Mon … 6=Sun')
    class_time        = models.CharField(max_length=11, blank=True, help_text='HH:MM-HH:MM lesson time range')
    telegram_chat_id  = models.BigIntegerField(null=True, blank=True)
    language          = models.CharField(max_length=2, default='uz', choices=[('uz', 'Uzbek'), ('ru', 'Russian')])
    is_individual     = models.BooleanField(default=False)
    is_graduated      = models.BooleanField(default=False)
    exam_ready        = models.BooleanField(default=False)
    exam_ready_at     = models.DateTimeField(null=True, blank=True)
    exam_ready_note   = models.CharField(max_length=200, blank=True)
    created_at        = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Active groups first, graduated ones last, alphabetical within each.
        ordering = ['is_graduated', 'name']
        indexes = [
            models.Index(fields=['teacher', 'is_graduated']),
            models.Index(fields=['teacher', 'is_individual', 'is_graduated']),
        ]

    def __str__(self):
        return self.name


class GroupMembership(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='memberships')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='memberships')
    joined_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ('group', 'student')
        indexes = [
            models.Index(fields=['group', 'joined_at']),
            models.Index(fields=['student', 'joined_at']),
        ]

    def __str__(self):
        return f'{self.student.username} in {self.group.name}'


class Lesson(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='lessons')
    title = models.CharField(max_length=200)
    date = models.DateField()
    homework = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['group', 'date']),
            models.Index(fields=['group', '-created_at']),
        ]

    def __str__(self):
        return f'{self.group.name} — {self.title}'


class GroupDayOff(models.Model):
    SICK    = 'sick'
    HOLIDAY = 'holiday'
    OTHER   = 'other'
    REASON_CHOICES = [(SICK, 'Teacher sick'), (HOLIDAY, 'Holiday'), (OTHER, 'Other')]

    group      = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='day_offs')
    date       = models.DateField()
    reason     = models.CharField(max_length=10, choices=REASON_CHOICES, default=OTHER)
    note       = models.CharField(max_length=200, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='marked_day_offs')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('group', 'date')
        ordering = ['-date']

    def __str__(self):
        return f'{self.group.name} — no lesson on {self.date} ({self.reason})'


class Attendance(models.Model):
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='attendances')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='attendances')
    present = models.BooleanField(default=False)

    class Meta:
        unique_together = ('lesson', 'student')
        indexes = [
            models.Index(fields=['student', 'present']),
            models.Index(fields=['lesson', 'present']),
        ]

    def __str__(self):
        status = 'present' if self.present else 'absent'
        return f'{self.student.username} — {self.lesson.title} ({status})'


class Score(models.Model):
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='scores')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='scores')
    value = models.PositiveSmallIntegerField(validators=[MinValueValidator(0), MaxValueValidator(5)])

    class Meta:
        unique_together = ('lesson', 'student')
        indexes = [
            models.Index(fields=['student']),
            models.Index(fields=['lesson']),
        ]

    def __str__(self):
        return f'{self.student.username} — {self.lesson.title}: {self.value}/5'


class Journal(models.Model):
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='journals')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='journals')
    body = models.TextField()
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('lesson', 'student')
        indexes = [
            models.Index(fields=['student', 'updated_at']),
        ]

    def __str__(self):
        return f'{self.student.username} journal — {self.lesson.title}'


class HomeworkSubmission(models.Model):
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='homework_submissions')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='homework_submissions')
    body = models.TextField()
    submitted_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('lesson', 'student')
        indexes = [
            models.Index(fields=['student', 'submitted_at']),
        ]

    def __str__(self):
        return f'{self.student.username} homework — {self.lesson.title}'


class Announcement(models.Model):
    author     = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='announcements')
    group      = models.ForeignKey(Group, on_delete=models.CASCADE, null=True, blank=True, related_name='announcements')
    title      = models.CharField(max_length=200)
    body       = models.TextField(blank=True)
    is_pinned  = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-is_pinned', '-created_at']

    def __str__(self):
        scope = self.group.name if self.group else 'Academy'
        return f'[{scope}] {self.title}'


class Exam(models.Model):
    DRAFT    = 'draft'
    ACTIVE   = 'active'
    FINISHED = 'finished'
    STATUS_CHOICES = [(DRAFT, 'Draft'), (ACTIVE, 'Active'), (FINISHED, 'Finished')]

    group          = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='exams')
    name           = models.CharField(max_length=200)
    question_count = models.PositiveIntegerField()
    status         = models.CharField(max_length=10, choices=STATUS_CHOICES, default=DRAFT)
    created_by     = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='created_exams')
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.group.name} — {self.name}'


class ExamResult(models.Model):
    exam     = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name='results')
    student  = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='exam_results')
    scores   = models.JSONField(default=list)    # [int, ...]  per-student question count, each 0-5
    comments = models.JSONField(default=list)    # [str, ...]  same length as scores, can be ''
    absent   = models.BooleanField(default=False)

    class Meta:
        unique_together = ('exam', 'student')

    @property
    def total(self):
        return sum(self.scores)

    @property
    def max_score(self):
        # Each student is scored out of their own number of questions, so a
        # student asked more/fewer questions is graded fairly against their own.
        return len(self.scores) * 5

    @property
    def percentage(self):
        if self.absent or self.max_score == 0:
            return 0
        return round(self.total / self.max_score * 100)

    def __str__(self):
        if self.absent:
            return f'{self.student.username} — {self.exam.name}: Absent'
        return f'{self.student.username} — {self.exam.name}: {self.percentage}%'


auditlog.register(Group)
auditlog.register(Lesson)
auditlog.register(Attendance)
auditlog.register(Score)
