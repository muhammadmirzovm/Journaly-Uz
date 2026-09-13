import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from academies.models import Academy, InviteToken
from groups.models import Group

User = get_user_model()


@pytest.fixture
def academy(db):
    return Academy.objects.create(name='Test Academy', slug='test-academy')


@pytest.fixture
def other_academy(db):
    return Academy.objects.create(name='Other Academy', slug='other-academy')


@pytest.fixture
def admin(academy):
    return User.objects.create_user(username='admin1', password='pass1234', role='admin', academy=academy)


@pytest.fixture
def teacher(academy):
    return User.objects.create_user(username='teacher1', password='pass1234', role='teacher', academy=academy)


@pytest.fixture
def other_teacher(academy):
    return User.objects.create_user(username='teacher2', password='pass1234', role='teacher', academy=academy)


@pytest.fixture
def student(academy):
    return User.objects.create_user(
        username='alibek', password='pass1234', role='student', academy=academy,
        first_name='Ali', last_name='Aliyev',
    )


def _client_for(username):
    client = APIClient()
    res = client.post('/api/auth/login/', {'username': username, 'password': 'pass1234'})
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {res.data["access"]}')
    return client


def _make_invite(academy, created_by, **kwargs):
    defaults = dict(
        academy=academy, role='student', created_by=created_by,
        expires_at=timezone.now() + timedelta(days=7), max_uses=1,
    )
    defaults.update(kwargs)
    return InviteToken.objects.create(**defaults)


@pytest.mark.django_db
def test_invite_list_paginates(academy, admin):
    for i in range(15):
        _make_invite(academy, admin, note=f'invite {i}')
    client = _client_for('admin1')

    res = client.get('/api/invites/', {'page': 1})
    assert res.status_code == 200
    assert res.data['total'] == 15
    assert res.data['pages'] == 2
    assert len(res.data['results']) == 10

    res2 = client.get('/api/invites/', {'page': 2})
    assert len(res2.data['results']) == 5


@pytest.mark.django_db
def test_invite_list_search_by_note(academy, admin):
    _make_invite(academy, admin, note='avgust guruhi')
    _make_invite(academy, admin, note='sentyabr guruhi')
    client = _client_for('admin1')

    res = client.get('/api/invites/', {'search': 'avgust'})
    assert res.status_code == 200
    assert res.data['total'] == 1
    assert res.data['results'][0]['note'] == 'avgust guruhi'


@pytest.mark.django_db
def test_invite_list_search_by_student_name(academy, admin, student):
    _make_invite(academy, admin, role='parent', student=student)
    _make_invite(academy, admin, role='parent')
    client = _client_for('admin1')

    res = client.get('/api/invites/', {'search': 'Ali'})
    assert res.status_code == 200
    assert res.data['total'] == 1


@pytest.mark.django_db
def test_invite_list_filter_by_role(academy, admin):
    _make_invite(academy, admin, role='student')
    _make_invite(academy, admin, role='teacher')
    client = _client_for('admin1')

    res = client.get('/api/invites/', {'role': 'teacher'})
    assert res.status_code == 200
    assert res.data['total'] == 1
    assert res.data['results'][0]['role'] == 'teacher'


@pytest.mark.django_db
def test_invite_list_scoped_to_own_academy(academy, other_academy, admin):
    other_admin = User.objects.create_user(username='other_admin', password='pass1234', role='admin', academy=other_academy)
    _make_invite(academy, admin)
    _make_invite(other_academy, other_admin)
    client = _client_for('admin1')

    res = client.get('/api/invites/')
    assert res.data['total'] == 1


@pytest.mark.django_db
def test_invite_create_rejects_group_from_another_academy(academy, other_academy, admin):
    other_teacher = User.objects.create_user(
        username='other_academy_teacher', password='pass1234', role='teacher', academy=other_academy,
    )
    other_group = Group.objects.create(name='Other Group', teacher=other_teacher)
    client = _client_for('admin1')

    res = client.post('/api/invites/create/', {
        'role': 'student',
        'group': other_group.id,
    })

    assert res.status_code == 404
    assert not InviteToken.objects.filter(group=other_group, academy=academy).exists()


@pytest.mark.django_db
def test_teacher_invite_create_rejects_other_teachers_group(academy, teacher, other_teacher):
    other_group = Group.objects.create(name='Other Teacher Group', teacher=other_teacher)
    client = _client_for('teacher1')

    res = client.post('/api/invites/create/', {
        'role': 'student',
        'group': other_group.id,
    })

    assert res.status_code == 403
    assert not InviteToken.objects.filter(group=other_group, created_by=teacher).exists()


@pytest.mark.django_db
def test_invite_accept_can_set_role_for_new_account(academy, admin):
    invite = _make_invite(academy, admin, role='teacher')
    new_user = User.objects.create_user(username='new_teacher', password='pass1234', role='student')
    client = APIClient()
    client.force_authenticate(new_user)

    res = client.post(f'/api/invites/{invite.token}/accept/')

    assert res.status_code == 200
    new_user.refresh_from_db()
    assert new_user.role == 'teacher'
    assert new_user.academy == academy


@pytest.mark.django_db
def test_admin_can_delete_any_academy_invite(academy, admin, teacher):
    invite = _make_invite(academy, teacher)
    client = _client_for('admin1')

    res = client.delete(f'/api/invites/{invite.id}/')
    assert res.status_code == 204
    assert not InviteToken.objects.filter(id=invite.id).exists()


@pytest.mark.django_db
def test_teacher_can_delete_own_invite(academy, teacher):
    invite = _make_invite(academy, teacher)
    client = _client_for('teacher1')

    res = client.delete(f'/api/invites/{invite.id}/')
    assert res.status_code == 204
    assert not InviteToken.objects.filter(id=invite.id).exists()


@pytest.mark.django_db
def test_teacher_cannot_delete_others_invite(academy, teacher, other_teacher):
    invite = _make_invite(academy, other_teacher)
    client = _client_for('teacher1')

    res = client.delete(f'/api/invites/{invite.id}/')
    assert res.status_code == 404
    assert InviteToken.objects.filter(id=invite.id).exists()


@pytest.mark.django_db
def test_teacher_cannot_delete_invite_from_other_academy(academy, other_academy, teacher):
    other_admin = User.objects.create_user(username='other_admin2', password='pass1234', role='admin', academy=other_academy)
    invite = _make_invite(other_academy, other_admin)
    client = _client_for('teacher1')

    res = client.delete(f'/api/invites/{invite.id}/')
    assert res.status_code == 404
    assert InviteToken.objects.filter(id=invite.id).exists()
