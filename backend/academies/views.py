from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.text import slugify
from django.db import transaction
from django.db.models import Q
from datetime import timedelta
from .models import Academy, InviteToken, AcademyTelegramGroup
from .serializers import AcademySerializer, AcademyBrandSerializer, InviteTokenSerializer, AcademyTelegramGroupSerializer


class AcademyCreateView(generics.CreateAPIView):
    serializer_class   = AcademySerializer
    permission_classes = (permissions.IsAuthenticated,)

    def perform_create(self, serializer):
        name = serializer.validated_data['name']
        slug = serializer.validated_data.get('slug') or slugify(name)
        academy = serializer.save(created_by=self.request.user, slug=slug)
        user = self.request.user
        user.academy = academy
        user.role    = 'admin'
        user.save(update_fields=['academy', 'role'])


class AcademyDetailView(generics.RetrieveUpdateAPIView):
    serializer_class   = AcademySerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_object(self):
        academy = self.request.user.academy
        if not academy:
            from rest_framework.exceptions import NotFound
            raise NotFound('You are not part of any academy.')
        return academy

    def update(self, request, *args, **kwargs):
        if request.user.role != 'admin':
            return Response({'detail': 'Only admins can update academy settings.'}, status=403)
        return super().update(request, *args, **kwargs)


class AcademyMembersView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        user = request.user
        if user.role not in ('admin', 'teacher') or not user.academy:
            return Response({'detail': 'No access.'}, status=403)

        from django.contrib.auth import get_user_model
        User = get_user_model()

        qs = User.objects.filter(academy=user.academy).exclude(pk=user.pk).select_related('academy')

        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search) | Q(last_name__icontains=search) |
                Q(username__icontains=search) | Q(email__icontains=search)
            )

        role_filter = request.query_params.get('role', '').strip()
        if role_filter:
            qs = qs.filter(role=role_filter)

        qs = qs.order_by('first_name', 'last_name', 'username')

        # Build invited_by map for these members
        invites = InviteToken.objects.filter(academy=user.academy).prefetch_related('used_by')
        invited_by = {}
        for inv in invites:
            for used_user in inv.used_by.all():
                if used_user.id not in invited_by:
                    invited_by[used_user.id] = {
                        'username':   inv.created_by.username,
                        'first_name': inv.created_by.first_name,
                        'role':       inv.created_by.role,
                    }

        # If role filter requested without pagination, return flat list (for dropdowns)
        if role_filter and not request.query_params.get('page'):
            data = [{'id': m.id, 'username': m.username, 'first_name': m.first_name,
                     'last_name': m.last_name, 'role': m.role} for m in qs]
            return Response(data)

        page      = max(1, int(request.query_params.get('page', 1)))
        page_size = max(1, min(100, int(request.query_params.get('page_size', 20))))
        total     = qs.count()
        pages     = max(1, (total + page_size - 1) // page_size)
        page      = min(page, pages)
        members   = qs[(page - 1) * page_size : page * page_size]

        data = []
        for m in members:
            data.append({
                'id':          m.id,
                'username':    m.username,
                'first_name':  m.first_name,
                'last_name':   m.last_name,
                'email':       m.email,
                'role':        m.role,
                'date_joined': m.date_joined,
                'invited_by':  invited_by.get(m.id),
                'is_active':   m.is_active,
            })

        return Response({'results': data, 'total': total, 'pages': pages, 'page': page})

    def delete(self, request, member_id):
        user = request.user
        if user.role not in ('admin', 'teacher') or not user.academy:
            return Response({'detail': 'No access.'}, status=403)

        from django.contrib.auth import get_user_model
        User = get_user_model()

        member = get_object_or_404(User, pk=member_id, academy=user.academy)

        # Teachers can only remove students and parents
        if user.role == 'teacher' and member.role not in ('student', 'parent'):
            return Response({'detail': 'Teachers can only remove students and parents.'}, status=403)

        # Teachers can only manage students they own — either the student is
        # in one of their groups, or the student joined via an invite this
        # teacher created (covers group-less invites too) — and parents of
        # those students. Never another teacher's students.
        if user.role == 'teacher':
            from groups.models import GroupMembership
            if member.role == 'student':
                is_own = (
                    GroupMembership.objects.filter(student=member, group__teacher=user).exists()
                    or InviteToken.objects.filter(created_by=user, used_by=member).exists()
                )
                if not is_own:
                    return Response({'detail': 'You can only manage your own students.'}, status=403)
            elif member.role == 'parent':
                from users.models import ParentStudent
                own_students = ParentStudent.objects.filter(parent=member).values_list('student_id', flat=True)
                is_own = (
                    GroupMembership.objects.filter(student_id__in=own_students, group__teacher=user).exists()
                    or InviteToken.objects.filter(created_by=user, used_by_id__in=own_students).exists()
                )
                if not is_own:
                    return Response({'detail': 'You can only manage parents of your own students.'}, status=403)

        # Nobody can remove an admin except another admin
        if member.role == 'admin' and user.role != 'admin':
            return Response({'detail': 'Only admins can remove other admins.'}, status=403)

        member.academy = None
        member.save(update_fields=['academy'])
        return Response(status=204)


class InviteCreateView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        user = request.user
        if user.role not in ('admin', 'teacher'):
            return Response({'detail': 'Only admins and teachers can create invites.'}, status=403)

        academy = user.academy
        if not academy:
            return Response({'detail': 'You are not part of an academy.'}, status=400)

        role       = request.data.get('role', 'student')
        group_id   = request.data.get('group')
        student_id = request.data.get('student')
        max_uses   = int(request.data.get('max_uses', 1))
        days_valid = int(request.data.get('days_valid', 7))
        note       = request.data.get('note', '').strip()

        # Role hierarchy enforcement
        if user.role == 'teacher' and role not in ('student', 'parent'):
            return Response({'detail': 'Teachers can only invite students and parents.'}, status=403)
        if user.role == 'admin' and role not in ('teacher', 'student', 'parent', 'admin'):
            return Response({'detail': 'Invalid role.'}, status=400)
        if role not in ('teacher', 'student', 'admin', 'parent'):
            return Response({'detail': 'Invalid role.'}, status=400)

        group = None
        if group_id:
            from groups.models import Group
            group = get_object_or_404(Group, pk=group_id, teacher__academy=academy)
            if user.role == 'teacher' and group.teacher_id != user.id:
                return Response({'detail': 'Teachers can only invite students to their own groups.'}, status=403)

        student = None
        if student_id and role == 'parent':
            from django.contrib.auth import get_user_model
            User_model = get_user_model()
            student = get_object_or_404(User_model, pk=student_id, academy=academy, role='student')

        invite = InviteToken.objects.create(
            academy    = academy,
            group      = group,
            student    = student,
            role       = role,
            created_by = user,
            expires_at = timezone.now() + timedelta(days=days_valid),
            max_uses   = max_uses,
            note       = note,
        )
        return Response(InviteTokenSerializer(invite).data, status=201)


class InviteListView(generics.ListAPIView):
    serializer_class   = InviteTokenSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        user = self.request.user
        if user.role not in ('admin', 'teacher') or not user.academy:
            return InviteToken.objects.none()
        qs = InviteToken.objects.filter(academy=user.academy).order_by('-created_at')

        role = self.request.query_params.get('role')
        if role:
            qs = qs.filter(role=role)

        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(note__icontains=search)
                | Q(student__first_name__icontains=search)
                | Q(student__last_name__icontains=search)
                | Q(student__username__icontains=search)
            )
        return qs

    def list(self, request, *args, **kwargs):
        qs        = self.get_queryset()
        page      = max(1, int(request.query_params.get('page', 1)))
        page_size = max(1, min(100, int(request.query_params.get('page_size', 10))))
        total     = qs.count()
        pages     = max(1, (total + page_size - 1) // page_size)
        page      = min(page, pages)
        invites   = qs[(page - 1) * page_size : page * page_size]
        data      = self.get_serializer(invites, many=True).data
        return Response({'results': data, 'total': total, 'pages': pages, 'page': page})


class InviteDeleteView(generics.DestroyAPIView):
    serializer_class   = InviteTokenSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        user = self.request.user
        if user.role not in ('admin', 'teacher') or not user.academy:
            return InviteToken.objects.none()
        qs = InviteToken.objects.filter(academy=user.academy)
        if user.role != 'admin':
            qs = qs.filter(created_by=user)
        return qs


class InviteVerifyView(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request, token):
        invite = get_object_or_404(InviteToken, token=token)
        if not invite.is_valid:
            return Response({'detail': 'This invite link has expired or reached its use limit.'}, status=400)
        academy_data = AcademyBrandSerializer(invite.academy, context={'request': request}).data
        student_name = None
        if invite.student:
            s = invite.student
            student_name = f'{s.first_name} {s.last_name}'.strip() or s.username
        return Response({
            'token':        str(invite.token),
            'role':         invite.role,
            'academy':      academy_data,
            'group_name':   invite.group.name if invite.group else None,
            'student_name': student_name,
            'note':         invite.note,
        })


class InviteAcceptView(APIView):
    """Called after a user registers/logs in via an invite link."""
    permission_classes = (permissions.IsAuthenticated,)

    @transaction.atomic
    def post(self, request, token):
        invite = get_object_or_404(InviteToken, token=token)
        if not invite.is_valid:
            return Response({'detail': 'This invite link has expired or reached its use limit.'}, status=400)

        user = request.user
        if invite.used_by.filter(pk=user.pk).exists():
            return Response({'detail': 'You have already used this invite.'}, status=400)

        joining_new_academy = user.academy_id is None
        if user.academy_id is not None and user.academy_id != invite.academy_id:
            return Response({'detail': 'This account already belongs to a different academy. Log out and use a different account to accept this invite.'}, status=400)
        if not joining_new_academy and user.role != invite.role:
            return Response({'detail': f'This account is already registered as {user.get_role_display()}. Log out and create a separate account to accept this invite.'}, status=400)

        user.academy = invite.academy
        user.role    = invite.role
        user.save(update_fields=['academy', 'role'])

        if invite.group and invite.role == 'student':
            from groups.models import GroupMembership, Attendance
            membership, created = GroupMembership.objects.get_or_create(
                group=invite.group, student=user,
            )
            if created:
                # Only track attendance from the join date onward, so a student
                # who joins late is not marked absent for earlier lessons.
                join_date = membership.joined_at.date()
                for lesson in invite.group.lessons.filter(date__gte=join_date):
                    Attendance.objects.get_or_create(
                        lesson=lesson, student=user, defaults={'present': False}
                    )

        if invite.role == 'parent' and invite.student:
            from users.models import ParentStudent
            ParentStudent.objects.get_or_create(parent=user, student=invite.student)

        invite.use_count += 1
        invite.used_by.add(user)
        invite.save(update_fields=['use_count'])

        from users.serializers import UserSerializer
        return Response({
            'detail':  'Invite accepted.',
            'role':    user.role,
            'academy': invite.academy.name,
            'user':    UserSerializer(user, context={'request': request}).data,
        })


class TelegramGroupListCreateView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        academy = request.user.academy
        if not academy:
            return Response([], status=200)
        groups = AcademyTelegramGroup.objects.filter(academy=academy)
        return Response(AcademyTelegramGroupSerializer(groups, many=True).data)

    def post(self, request):
        if request.user.role != 'admin':
            return Response({'detail': 'Only admins can add Telegram groups.'}, status=403)
        academy = request.user.academy
        if not academy:
            return Response({'detail': 'No academy found.'}, status=404)
        serializer = AcademyTelegramGroupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(academy=academy)
        return Response(serializer.data, status=201)


class TelegramGroupDeleteView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def delete(self, request, pk):
        if request.user.role != 'admin':
            return Response({'detail': 'Only admins can remove Telegram groups.'}, status=403)
        group = get_object_or_404(AcademyTelegramGroup, pk=pk, academy=request.user.academy)
        group.delete()
        return Response(status=204)
