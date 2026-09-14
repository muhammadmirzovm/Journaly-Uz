import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  GraduationCap, BookOpen, Users, Shield, Heart,
  Edit2, Save, X, Loader2, TrendingUp, CalendarCheck, Trophy, Lock, MessageCircle, ExternalLink, Unlink, Bell, Send, CheckCircle2, AlertCircle, Coins, UserCheck, ClipboardCheck,
} from 'lucide-react'
import { getProfile, getUserStats, updateMe, getUserChildren, getUserGroups, changePassword, connectTelegram, disconnectTelegram, getNotifyInfo, sendDirectNotification } from '../api/users'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import ScoreLineChart from '../components/charts/ScoreLineChart'
import AttendanceDoughnut from '../components/charts/AttendanceDoughnut'
import TeacherStats from '../components/charts/TeacherStats'
import CoinLineChart from '../components/charts/CoinLineChart'
import TodayLessons from '../components/TodayLessons'
import AttendanceCalendar from '../components/AttendanceCalendar'
import { ProfileSkeleton } from '../components/ui/Skeleton'
import { timeAgo, formatDate } from '../utils/date'

const isOnline = lastSeen => (Date.now() - new Date(lastSeen)) / 1000 < 300

export default function Profile() {
  const { id } = useParams()
  const { user: me, setUser } = useAuth()
  const { show } = useToast()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isOwn = String(me?.id) === String(id)

  const [profile,  setProfile]  = useState(null)
  const [stats,    setStats]    = useState(null)
  const [groups,   setGroups]   = useState([])
  const [children, setChildren] = useState([])
  const [parentInfo, setParentInfo] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [editing, setEditing]     = useState(false)
  const [editForm, setEditForm]   = useState({ first_name: '', last_name: '', username: '', email: '', bio: '' })
  const [saving, setSaving]       = useState(false)
  const [pwForm, setPwForm]       = useState({ old_password: '', new_password: '', confirm: '' })
  const [pwErrors, setPwErrors]   = useState({})
  const [pwSaving, setPwSaving]   = useState(false)
  const [tgLoading, setTgLoading] = useState(false)
  const [tgLink, setTgLink]       = useState(null)
  const [notifyOpen, setNotifyOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    setEditing(false)
    Promise.all([
      getProfile(id),
      getUserStats(id),
    ]).then(([p, s]) => {
      const targetRole    = p.data.role
      const viewerRole    = me?.role
      const viewerIsOwner = String(me?.id) === String(id)
      if (
        (targetRole === 'admin' || targetRole === 'teacher') &&
        viewerRole !== 'admin' && viewerRole !== 'teacher' &&
        !viewerIsOwner
      ) {
        navigate('/dashboard', { replace: true })
        return
      }
      setProfile(p.data)
      setEditForm({ first_name: p.data.first_name || '', last_name: p.data.last_name || '', username: p.data.username || '', email: p.data.email || '', bio: p.data.bio || '' })
      setStats(s.data)
      if (targetRole === 'student' || targetRole === 'teacher') {
        if (viewerIsOwner || viewerRole === 'admin' || viewerRole === 'teacher') {
          getUserGroups(id).then(r => setGroups(r.data)).catch(() => {})
        }
      }
      if (targetRole === 'parent') {
        getUserChildren(id).then(r => setChildren(r.data)).catch(() => {})
      }
      if (targetRole === 'student' && (viewerIsOwner || viewerRole === 'admin' || viewerRole === 'teacher')) {
        getNotifyInfo(id).then(r => setParentInfo(r.data)).catch(() => {})
      }
    }).catch(() => show(t('profile.fail_load'), 'error'))
    .finally(() => setLoading(false))
  }, [id, me?.id, me?.role, navigate, show, t])

  const setField = (k, v) => setEditForm(f => ({ ...f, [k]: v }))

  const saveProfile = async () => {
    setSaving(true)
    try {
      const { data } = await updateMe(editForm)
      setProfile(p => ({ ...p, ...data }))
      setUser(u => ({ ...u, ...data }))
      setEditForm({ first_name: data.first_name || '', last_name: data.last_name || '', username: data.username || '', email: data.email || '', bio: data.bio || '' })
      setEditing(false)
      show(t('profile.toast_updated'), 'success')
    } catch (err) {
      const detail = err.response?.data
      if (detail?.username) show(t('profile.err_username_taken'), 'error')
      else show(t('profile.fail_update'), 'error')
    }
    finally { setSaving(false) }
  }

  const cancelEdit = () => {
    setEditing(false)
    setEditForm({ first_name: profile?.first_name || '', last_name: profile?.last_name || '', username: profile?.username || '', email: profile?.email || '', bio: profile?.bio || '' })
  }

  const setPw = (k, v) => setPwForm(f => ({ ...f, [k]: v }))

  const savePassword = async e => {
    e.preventDefault()
    const errs = {}
    const hasPass = me?.has_password
    if (hasPass && !pwForm.old_password) errs.old_password = t('auth.err_password_required')
    if (pwForm.new_password.length < 6)  errs.new_password = t('auth.err_password_len')
    if (!pwForm.confirm)                  errs.confirm = t('auth.err_confirm_required')
    else if (pwForm.confirm !== pwForm.new_password) errs.confirm = t('auth.err_confirm_match')
    if (Object.keys(errs).length) { setPwErrors(errs); return }
    setPwSaving(true)
    try {
      await changePassword({ old_password: pwForm.old_password, new_password: pwForm.new_password })
      show(t('profile.password_changed'), 'success')
      setPwForm({ old_password: '', new_password: '', confirm: '' })
      setPwErrors({})
    } catch (err) {
      const msg = err.response?.data?.detail
      setPwErrors({ old_password: msg || t('auth.err_invalid') })
    } finally { setPwSaving(false) }
  }

  const handleConnectTelegram = async () => {
    setTgLoading(true)
    try {
      const { data } = await connectTelegram()
      setTgLink(data.link)
    } catch (err) {
      show(err.response?.data?.detail || 'Failed to generate link.', 'error')
    } finally { setTgLoading(false) }
  }

  const handleDisconnectTelegram = async () => {
    setTgLoading(true)
    try {
      await disconnectTelegram()
      setProfile(p => ({ ...p, telegram_id: null }))
      setUser(u => ({ ...u, telegram_id: null }))
      setTgLink(null)
      show('Telegram disconnected.', 'success')
    } catch {
      show('Failed to disconnect.', 'error')
    } finally { setTgLoading(false) }
  }

  if (loading) return <ProfileSkeleton />
  if (!profile) return <p style={{ color: 'var(--text-muted)' }}>{t('profile.not_found')}</p>

  const initials = (profile.first_name?.[0] || profile.username?.[0] || '?').toUpperCase()
  const avgScore = stats?.score_trend?.length
    ? (stats.score_trend.reduce((a, b) => a + b.score, 0) / stats.score_trend.length).toFixed(1)
    : null

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>

      {/* Profile hero card */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 24, boxShadow: 'var(--shadow-sm)' }}>

        {/* Top accent bar */}
        <div style={{ height: 80, background: 'linear-gradient(135deg, var(--accent) 0%, #0f766e 100%)' }} />

        <div className="profile-hero-body" style={{ padding: '0 28px 28px', position: 'relative' }}>
          {/* Avatar initials */}
          <div style={{ position: 'relative', display: 'inline-block', marginTop: -44, marginBottom: 16 }}>
            <div style={{ width: 88, height: 88, borderRadius: '50%', border: '4px solid var(--surface)', background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent)' }}>{initials}</span>
            </div>
          </div>

          {/* Name + role + edit controls */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
                {profile.first_name} {profile.last_name}
                {!profile.first_name && !profile.last_name && profile.username}
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 10 }}>@{profile.username}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <RoleBadge role={profile.role} />
                {avgScore && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--warning)', background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.3)', borderRadius: 99, padding: '3px 10px' }}>
                    <TrendingUp size={12} /> {t('profile.avg_score', { score: avgScore })}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                {profile.last_seen && (
                  isOnline(profile.last_seen)
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#16A34A', fontWeight: 600 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} /> {t('profile.online_now')}
                      </span>
                    : <span>{t('profile.last_active', { time: timeAgo(profile.last_seen) })}</span>
                )}
                {profile.date_joined && <span>{t('profile.joined_on', { date: formatDate(profile.date_joined) })}</span>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {isOwn && (editing ? (
                <>
                  <motion.button whileTap={{ scale: 0.96 }} onClick={saveProfile} disabled={saving}
                    style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}>
                    {saving ? <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Save size={13} />}
                    {saving ? t('profile.saving') : t('profile.save')}
                  </motion.button>
                  <button onClick={cancelEdit} style={ghostBtn}><X size={13} /> {t('profile.cancel')}</button>
                </>
              ) : (
                <button onClick={() => setEditing(true)} style={ghostBtn}><Edit2 size={13} /> {t('profile.edit')}</button>
              ))}
              {!isOwn && (me?.role === 'teacher' || me?.role === 'admin') && profile.role === 'student' && (
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => setNotifyOpen(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  <Bell size={13} /> {t('profile.send_notification')}
                </motion.button>
              )}
            </div>
          </div>

          {/* Edit form / Bio */}
          <div style={{ marginTop: 16 }}>
            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="name-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{t('profile.first_name')}</label>
                    <input value={editForm.first_name} onChange={e => setField('first_name', e.target.value)}
                      placeholder={t('profile.first_name')}
                      style={{ width: '100%', padding: '8px 11px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{t('profile.last_name')}</label>
                    <input value={editForm.last_name} onChange={e => setField('last_name', e.target.value)}
                      placeholder={t('profile.last_name')}
                      style={{ width: '100%', padding: '8px 11px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{t('profile.username_label')}</label>
                  <input value={editForm.username} onChange={e => setField('username', e.target.value)}
                    placeholder="username"
                    style={{ width: '100%', padding: '8px 11px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>💡 {t('profile.username_hint')}</p>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{t('profile.email_label')}</label>
                  <input type="email" value={editForm.email} onChange={e => setField('email', e.target.value)}
                    placeholder="email@example.com"
                    style={{ width: '100%', padding: '8px 11px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>{t('profile.bio')}</label>
                  <textarea value={editForm.bio} onChange={e => setField('bio', e.target.value)}
                    placeholder={t('profile.bio_placeholder')} rows={3}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, lineHeight: 1.6, resize: 'vertical', outline: 'none', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }} />
                </div>
              </div>
            ) : profile.bio ? (
              <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7 }}>{profile.bio}</p>
            ) : isOwn ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('profile.no_bio')}</p>
            ) : null}
          </div>
        </div>
      </motion.div>

      {/* Today's lessons — teacher & student */}
      {(profile.role === 'teacher' || profile.role === 'student') && <TodayLessons schedule={stats?.schedule} />}

      {/* Stats section — role-specific */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
        style={{ marginBottom: 24 }}>
        {profile.role === 'admin' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            <ProfileStatCard icon={Users}        label={t('dashboard.total_students')} value={stats?.total_students ?? '…'} color="#14B8A8" />
            <ProfileStatCard icon={GraduationCap} label={t('dashboard.total_teachers')} value={stats?.total_teachers ?? '…'} color="#8B5CF6" />
            <ProfileStatCard icon={BookOpen}     label={t('dashboard.total_groups')}   value={stats?.total_groups   ?? '…'} color="#0891B2" />
            <ProfileStatCard icon={Trophy}       label={t('dashboard.total_lessons')}  value={stats?.total_lessons  ?? '…'} color="#F59E0B" />
          </div>
        ) : profile.role === 'teacher' ? (
          <TeacherStats stats={stats} />
        ) : profile.role === 'parent' ? (
          <div style={chartCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <div style={{ ...chartIconWrap, background: 'rgba(236,72,153,0.1)' }}>
                <Heart size={16} color="#EC4899" />
              </div>
              <p style={{ fontWeight: 700, fontSize: 14 }}>{t('profile.linked_children')}</p>
            </div>
            {children.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('dashboard.no_children')}</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {children.map(child => (
                  <Link key={child.id} to={`/profile/${child.id}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', textDecoration: 'none', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#EC4899'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(20,184,168,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <GraduationCap size={16} color="var(--accent)" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{child.display_name}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{child.username}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            <div style={chartCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <div style={chartIconWrap}><TrendingUp size={16} color="var(--accent)" /></div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14 }}>{t('profile.score_trend')}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('profile.lessons_scored', { count: stats?.score_trend?.length || 0 })}</p>
                </div>
              </div>
              <ScoreLineChart data={stats?.score_trend} />
            </div>
            <div style={chartCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <div style={chartIconWrap}><CalendarCheck size={16} color="var(--accent)" /></div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14 }}>{t('profile.attendance')}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('profile.total_lessons', { count: stats?.attendance_summary?.total || 0 })}</p>
                </div>
              </div>
              <AttendanceDoughnut data={stats?.attendance_summary} />
            </div>
            <div style={chartCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <div style={{ ...chartIconWrap, background: 'rgba(245,158,11,0.1)' }}><Coins size={16} color="#F59E0B" /></div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14 }}>{t('profile.coin_trend')}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('profile.total_coins', { count: stats?.coin_trend?.length ? stats.coin_trend[stats.coin_trend.length - 1].total : 0 })}</p>
                </div>
              </div>
              <CoinLineChart data={stats?.coin_trend} />
            </div>
            {stats?.exam_trend?.length > 0 && (
              <div style={{ ...chartCard, gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <div style={{ ...chartIconWrap, background: 'rgba(139,92,246,0.1)' }}><ClipboardCheck size={16} color="#8B5CF6" /></div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 14 }}>{t('profile.exam_results')}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('profile.exams_count', { count: stats.exam_trend.length })}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[...stats.exam_trend].reverse().map((e, i) => {
                    const col = e.absent ? '#64748B' : e.percentage >= 80 ? '#16A34A' : e.percentage >= 50 ? '#D97706' : '#DC2626'
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 600, fontSize: 13.5, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.exam}</p>
                          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{e.group}</p>
                        </div>
                        {e.absent ? (
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B', background: 'rgba(100,116,139,0.12)', borderRadius: 6, padding: '3px 9px' }}>{t('exam.absent_label')}</span>
                        ) : (
                          <>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{e.total}/{e.max}</span>
                            <span style={{ fontSize: 14, fontWeight: 800, color: col, fontVariantNumeric: 'tabular-nums', minWidth: 44, textAlign: 'right' }}>{e.percentage}%</span>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Attendance calendar + streak — students only */}
      {profile.role === 'student' && stats?.attendance_calendar?.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} style={{ marginBottom: 24 }}>
          <AttendanceCalendar calendar={stats.attendance_calendar} streak={stats.streak} attendanceSummary={stats.attendance_summary} />
        </motion.div>
      )}

      {/* Parent link + Telegram status — student profiles, visible to self/teacher/admin */}
      {profile.role === 'student' && parentInfo && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, marginBottom: 24, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ ...chartIconWrap, background: 'rgba(236,72,153,0.1)' }}>
              <UserCheck size={16} color="#EC4899" />
            </div>
            <p style={{ fontWeight: 700, fontSize: 14 }}>{t('profile.parent_section')}</p>
          </div>

          {!isOwn && (
            <div style={{ marginBottom: parentInfo.parents.length ? 14 : 0 }}>
              <TelegramStatusRow label={t('profile.student_telegram')} connected={parentInfo.student.telegram_connected} t={t} />
            </div>
          )}

          {parentInfo.parents.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('profile.no_parent_linked')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {parentInfo.parents.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg)' }}>
                  <Link to={`/profile/${p.id}`} style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}>{p.name}</Link>
                  <TelegramStatusRow connected={p.telegram_connected} t={t} compact />
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Telegram status — teacher profiles, admin view only (isOwn already has the full section below) */}
      {profile.role === 'teacher' && !isOwn && me?.role === 'admin' && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, marginBottom: 24, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ ...chartIconWrap, background: 'rgba(0,136,204,0.1)' }}>
              <MessageCircle size={16} color="#0088CC" />
            </div>
            <p style={{ fontWeight: 700, fontSize: 14 }}>{t('profile.teacher_telegram_section')}</p>
          </div>
          <TelegramStatusRow label={t('telegram.section_title')} connected={!!profile.telegram_id} t={t} />
        </motion.div>
      )}

      {/* Groups — students only (teacher groups are shown via the timetable & charts) */}
      {groups.length > 0 && profile.role !== 'teacher' && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <div style={chartIconWrap}><Users size={16} color="var(--accent)" /></div>
            <p style={{ fontWeight: 700, fontSize: 14 }}>{t('profile.my_groups')}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {groups.map(g => (
              <Link key={g.id} to={`/groups/${g.id}`}
                style={{ display: 'block', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', textDecoration: 'none', transition: 'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>{g.name}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {profile.role === 'teacher' ? <GraduationCap size={11} /> : <BookOpen size={11} />}
                  {profile.role === 'teacher'
                    ? t('profile.teaching')
                    : g.teacher_name
                      ? `${g.teacher_name} · ${g.member_count} ${t('dashboard.students')}`
                      : `${g.member_count} ${t('dashboard.students')}`}
                </p>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* Security — password change, own profile only */}
      {isOwn && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, marginTop: 24, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <div style={{ ...chartIconWrap, background: 'rgba(139,92,246,0.1)' }}>
              <Lock size={16} color="#8B5CF6" />
            </div>
            <p style={{ fontWeight: 700, fontSize: 14 }}>
              {me?.has_password ? t('profile.change_password') : t('profile.set_password')}
            </p>
          </div>
          <form onSubmit={savePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 400 }}>
            {me?.has_password && (
              <div>
                <label style={labelStyle}>{t('profile.current_password')}</label>
                <input type="password" value={pwForm.old_password} onChange={e => setPw('old_password', e.target.value)}
                  placeholder="••••••••" autoComplete="current-password"
                  style={{ ...pwInputStyle(!!pwErrors.old_password) }} />
                {pwErrors.old_password && <p style={errStyle}>{pwErrors.old_password}</p>}
              </div>
            )}
            <div>
              <label style={labelStyle}>{t('profile.new_password')}</label>
              <input type="password" value={pwForm.new_password} onChange={e => setPw('new_password', e.target.value)}
                placeholder="••••••••" autoComplete="new-password"
                style={{ ...pwInputStyle(!!pwErrors.new_password) }} />
              {pwErrors.new_password && <p style={errStyle}>{pwErrors.new_password}</p>}
            </div>
            <div>
              <label style={labelStyle}>{t('auth.confirm_password')}</label>
              <input type="password" value={pwForm.confirm} onChange={e => setPw('confirm', e.target.value)}
                placeholder="••••••••" autoComplete="new-password"
                style={{ ...pwInputStyle(!!pwErrors.confirm) }} />
              {pwErrors.confirm && <p style={errStyle}>{pwErrors.confirm}</p>}
            </div>
            <motion.button type="submit" disabled={pwSaving} whileTap={{ scale: 0.97 }}
              style={{ ...primaryBtn, opacity: pwSaving ? 0.7 : 1, alignSelf: 'flex-start' }}>
              {pwSaving ? <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Lock size={13} />}
              {pwSaving ? t('profile.saving') : (me?.has_password ? t('profile.change_password') : t('profile.set_password'))}
            </motion.button>
          </form>
        </motion.div>
      )}

      {/* Telegram — own profile only */}
      {isOwn && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, marginTop: 24, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ ...chartIconWrap, background: 'rgba(0,136,204,0.1)' }}>
              <MessageCircle size={16} color="#0088CC" />
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 14 }}>{t('telegram.section_title')}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                {profile.telegram_id ? t('telegram.connected_desc') : t('telegram.disconnected_desc')}
              </p>
            </div>
          </div>

          {profile.telegram_id ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#0088CC', background: 'rgba(0,136,204,0.08)', border: '1px solid rgba(0,136,204,0.2)', borderRadius: 8, padding: '6px 12px' }}>
                {t('telegram.connected_badge')}
              </span>
              <button onClick={handleDisconnectTelegram} disabled={tgLoading}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#EF4444', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '6px 12px', cursor: tgLoading ? 'not-allowed' : 'pointer', opacity: tgLoading ? 0.6 : 1 }}>
                {tgLoading ? <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Unlink size={13} />}
                {t('telegram.disconnect')}
              </button>
            </div>
          ) : tgLink ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 400 }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {t('telegram.bot_instructions')}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <a href={tgLink} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 10, background: '#0088CC', color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                  <ExternalLink size={14} /> {t('telegram.open_bot')}
                </a>
                <button onClick={() => setTgLink(null)}
                  style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>
                  {t('telegram.cancel')}
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('telegram.link_expires')}</p>
            </div>
          ) : (
            <button onClick={handleConnectTelegram} disabled={tgLoading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 10, background: '#0088CC', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: tgLoading ? 'not-allowed' : 'pointer', opacity: tgLoading ? 0.6 : 1 }}>
              {tgLoading ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : <MessageCircle size={14} />}
              {t('telegram.connect')}
            </button>
          )}
        </motion.div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {notifyOpen && (
        <SendNotificationModal
          studentId={id}
          studentName={profile.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : profile.username}
          onClose={() => setNotifyOpen(false)}
          t={t}
          show={show}
        />
      )}
    </div>
  )
}

const ROLE_BADGE_MAP = {
  teacher: { color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.3)', icon: GraduationCap, key: 'profile.teacher_badge' },
  student: { color: '#14B8A8', bg: 'rgba(20,184,168,0.1)',  border: 'rgba(20,184,168,0.3)',  icon: BookOpen,     key: 'profile.student_badge' },
  admin:   { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)',  icon: Shield,       key: 'profile.admin_badge' },
  parent:  { color: '#EC4899', bg: 'rgba(236,72,153,0.1)',  border: 'rgba(236,72,153,0.3)',  icon: Heart,        key: 'profile.parent_badge' },
}

function RoleBadge({ role }) {
  const { t } = useTranslation()
  const cfg = ROLE_BADGE_MAP[role] || ROLE_BADGE_MAP.student
  const Icon = cfg.icon
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 99, padding: '3px 10px' }}>
      <Icon size={12} />
      {t(cfg.key)}
    </span>
  )
}

function TelegramStatusRow({ label, connected, compact, t }) {
  const badge = connected ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#0088CC', background: 'rgba(0,136,204,0.08)', border: '1px solid rgba(0,136,204,0.2)', borderRadius: 99, padding: '2px 8px', flexShrink: 0 }}>
      <CheckCircle2 size={11} /> {t('profile.notify_tg_connected')}
    </span>
  ) : (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#F59E0B', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 99, padding: '2px 8px', flexShrink: 0 }}>
      <AlertCircle size={11} /> {t('profile.notify_tg_not_connected')}
    </span>
  )
  if (compact) return badge
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{label}</span>
      {badge}
    </div>
  )
}

function ProfileStatCard({ icon: Icon, label, value, color }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={19} color={color} />
      </div>
      <div>
        <p style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{value}</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{label}</p>
      </div>
    </div>
  )
}

function SendNotificationModal({ studentId, studentName, onClose, t, show }) {
  const [info, setInfo]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState([])
  const [message, setMessage]   = useState('')
  const [sending, setSending]   = useState(false)

  useEffect(() => {
    getNotifyInfo(studentId).then(r => {
      setInfo(r.data)
      const defaults = []
      if (r.data.student.telegram_connected) defaults.push('student')
      r.data.parents.forEach(p => { if (p.telegram_connected) defaults.push(p.id) })
      setSelected(defaults.length ? defaults : ['student'])
    }).catch(() => {
      show(t('profile.notify_toast_fail'), 'error')
      onClose()
    }).finally(() => setLoading(false))
  }, [onClose, show, studentId, t])

  const toggle = key => setSelected(prev =>
    prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
  )

  const handleSend = async () => {
    if (!selected.length) { show(t('profile.notify_err_no_recipients'), 'error'); return }
    if (!message.trim())  { show(t('profile.notify_err_empty'), 'error'); return }
    setSending(true)
    try {
      await sendDirectNotification(studentId, { recipients: selected, message: message.trim() })
      show(t('profile.notify_toast_sent'), 'success')
      onClose()
    } catch { show(t('profile.notify_toast_fail'), 'error') }
    finally  { setSending(false) }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 340, damping: 26 }}
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={17} color="var(--accent)" />
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 16 }}>{t('profile.notify_modal_title')}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{studentName}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6 }}>
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
            <Loader2 size={24} style={{ animation: 'spin 0.7s linear infinite', color: 'var(--accent)' }} />
          </div>
        ) : (
          <>
            <p style={sectionLabel}>{t('profile.notify_recipients')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              <RecipientRow
                id="student"
                label={`${info.student.name} (${t('profile.notify_student')})`}
                telegram={info.student.telegram_connected}
                checked={selected.includes('student')}
                onToggle={() => toggle('student')}
                t={t}
              />
              {info.parents.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: 4 }}>{t('profile.notify_no_parents')}</p>
              ) : info.parents.map(p => (
                <RecipientRow key={p.id}
                  id={p.id}
                  label={`${p.name} (${t('profile.notify_parent')})`}
                  telegram={p.telegram_connected}
                  checked={selected.includes(p.id)}
                  onToggle={() => toggle(p.id)}
                  t={t}
                />
              ))}
            </div>

            <p style={sectionLabel}>{t('profile.notify_message')}</p>
            <div style={{ marginBottom: 6 }}>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value.slice(0, 300))}
                placeholder={t('profile.notify_placeholder')}
                rows={4}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: `1.5px solid ${message.length > 280 ? '#F59E0B' : 'var(--border)'}`, background: 'var(--bg)', color: 'var(--text)', fontSize: 14, lineHeight: 1.6, resize: 'vertical', outline: 'none', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
              />
              <p style={{ textAlign: 'right', fontSize: 11, color: message.length > 280 ? '#F59E0B' : 'var(--text-muted)', marginTop: 3 }}>
                {t('profile.notify_char_count', { count: message.length })}
              </p>
            </div>

            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
              {t('profile.notify_modal_sub')}
            </p>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={ghostBtn}>{t('profile.cancel')}</button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleSend} disabled={sending}
                style={{ ...primaryBtn, opacity: sending ? 0.7 : 1 }}>
                {sending ? <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Send size={13} />}
                {sending ? t('profile.notify_sending') : t('profile.notify_send')}
              </motion.button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

function RecipientRow({ label, telegram, checked, onToggle, t }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--border)'}`, background: checked ? 'var(--accent-bg)' : 'var(--bg)', cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s' }}>
      <input type="checkbox" checked={checked} onChange={onToggle}
        style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{label}</span>
      {telegram ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#0088CC', background: 'rgba(0,136,204,0.08)', border: '1px solid rgba(0,136,204,0.2)', borderRadius: 99, padding: '2px 8px', flexShrink: 0 }}>
          <CheckCircle2 size={11} /> {t('profile.notify_tg_connected')}
        </span>
      ) : (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#F59E0B', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 99, padding: '2px 8px', flexShrink: 0 }}>
          <AlertCircle size={11} /> {t('profile.notify_tg_not_connected')}
        </span>
      )}
    </label>
  )
}

const sectionLabel = { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }

const labelStyle  = { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }
const pwInputStyle = (hasErr) => ({ width: '100%', padding: '11px 14px', borderRadius: 9, border: `1.5px solid ${hasErr ? 'var(--danger)' : 'var(--border)'}`, background: 'var(--bg)', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' })
const errStyle    = { fontSize: 12, color: 'var(--danger)', marginTop: 4 }

const chartCard     = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, boxShadow: 'var(--shadow-sm)' }
const chartIconWrap = { width: 34, height: 34, borderRadius: 8, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
const primaryBtn    = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
const ghostBtn      = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }
