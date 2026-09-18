from django.urls import path
from .views import (
    AcademyCreateView, AcademyDetailView, AcademyMembersView,
    InviteCreateView, InviteListView, InviteDeleteView,
    InviteVerifyView, InviteAcceptView,
    PlatformOverviewView, PlatformAcademyListView, PlatformAcademyDetailView, PlatformInviteCreateView,
    TelegramGroupListCreateView, TelegramGroupDeleteView,
)

urlpatterns = [
    path('academy/', AcademyDetailView.as_view(), name='academy_detail'),
    path('academy/create/', AcademyCreateView.as_view(), name='academy_create'),
    path('academy/members/', AcademyMembersView.as_view(), name='academy_members'),
    path('academy/members/<int:member_id>/', AcademyMembersView.as_view(), name='academy_member_delete'),
    path('academy/telegram-groups/', TelegramGroupListCreateView.as_view(), name='telegram_groups'),
    path('academy/telegram-groups/<int:pk>/', TelegramGroupDeleteView.as_view(), name='telegram_group_delete'),
    path('invites/', InviteListView.as_view(), name='invite_list'),
    path('invites/create/', InviteCreateView.as_view(), name='invite_create'),
    path('invites/<int:pk>/', InviteDeleteView.as_view(), name='invite_delete'),
    path('invites/<uuid:token>/verify/', InviteVerifyView.as_view(), name='invite_verify'),
    path('invites/<uuid:token>/accept/', InviteAcceptView.as_view(), name='invite_accept'),
    path('platform/overview/', PlatformOverviewView.as_view(), name='platform_overview'),
    path('platform/academies/', PlatformAcademyListView.as_view(), name='platform_academies'),
    path('platform/academies/<int:pk>/', PlatformAcademyDetailView.as_view(), name='platform_academy_detail'),
    path('platform/invites/', PlatformInviteCreateView.as_view(), name='platform_invite_create'),
]
