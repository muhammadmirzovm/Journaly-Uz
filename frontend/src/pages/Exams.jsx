import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { ClipboardList, Loader2, ChevronRight, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getUpcomingExams, createExam } from '../api/groups'
import { useToast } from '../context/ToastContext'
import Modal from '../components/ui/Modal'
import { formatDayMonthTime } from '../utils/date'

const DAY_SHORT = ['Mo','Tu','We','Th','Fr','Sa','Su']
const scheduleStr = g => {
  const days = (g.class_days || []).map(d => DAY_SHORT[d]).join(', ')
  const time = g.class_time ? g.class_time.replace('-', ' — ') : ''
  return [days, time].filter(Boolean).join(' · ')
}

const PCT_COLOR = pct =>
  pct >= 70 ? { color: '#16A34A', bg: '#16A34A12', border: '#16A34A30' }
  : { color: '#DC2626', bg: '#DC262612', border: '#DC262630' }

export default function Exams() {
  const { t }    = useTranslation()
  const { user } = useAuth()
  const { show } = useToast()

  const [data,    setData]    = useState({ exam_ready_groups: [], active_exams: [] })
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(null) // group id being created for
  const [form,    setForm]    = useState({ name: '', question_count: 10 })
  const [saving,  setSaving]  = useState(false)

  const isAdmin   = user?.role === 'admin'
  const isTeacher = user?.role === 'teacher'
  const isStudent = user?.role === 'student'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: d } = await getUpcomingExams()
      setData(d)
    } catch { show('Error loading exams', 'error') }
    finally { setLoading(false) }
  }, [show])

  useEffect(() => { load() }, [load])

  const handleCreate = async e => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await createExam(creating, form)
      show(t('exam.saved_toast'), 'success')
      setCreating(null)
      setForm({ name: '', question_count: 10 })
      load()
    } catch { show('Error creating exam', 'error') }
    finally { setSaving(false) }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
      <Loader2 size={28} color="var(--accent)" style={{ animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  const { exam_ready_groups, active_exams } = data
  const hasNothing = exam_ready_groups.length === 0 && active_exams.length === 0

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, margin: 0 }}>
          {t('exam.page_title')}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 6 }}>
          {t('exam.page_sub')}
        </p>
      </div>

      {hasNothing && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ textAlign: 'center', padding: '64px 24px' }}>
          <ClipboardList size={44} style={{ margin: '0 auto 14px', display: 'block', opacity: 0.2 }} />
          <p style={{ fontWeight: 600, fontSize: 16, color: 'var(--text)' }}>{t('exam.no_exams')}</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
            {isAdmin ? t('exam.no_exams_sub_admin') : t('exam.no_exams_sub')}
          </p>
        </motion.div>
      )}

      {/* Groups awaiting exam creation (admin only sees this) */}
      {isAdmin && exam_ready_groups.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <AlertCircle size={16} color="#D97706" />
            <h3 style={{ fontWeight: 700, fontSize: 15, margin: 0, color: '#D97706' }}>
              {t('exam.ready_groups_title')} ({exam_ready_groups.length})
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {exam_ready_groups.map((g, i) => (
              <motion.div key={g.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="exam-hub-card"
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 12, border: '1.5px solid #D9770630', background: '#D9770608' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#D9770620', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ClipboardList size={18} color="#D97706" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', margin: 0 }}>{g.name}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {g.member_count} {t('group_detail.students_count')}
                    {g.teacher_name && <> · {g.teacher_name}</>}
                  </p>
                  {scheduleStr(g) && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} /> {scheduleStr(g)}
                    </p>
                  )}
                  {g.exam_ready_at && (
                    <p style={{ fontSize: 12, color: '#D97706', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} />
                      {formatDayMonthTime(g.exam_ready_at)}
                    </p>
                  )}
                  {g.exam_ready_note && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>"{g.exam_ready_note}"</p>
                  )}
                </div>
                <div className="exam-hub-card-btns" style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <Link to={`/groups/${g.id}?tab=exams`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                    {t('common.open')} <ChevronRight size={13} />
                  </Link>
                  <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }}
                    onClick={() => { setCreating(g.id); setForm({ name: '', question_count: 10 }) }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    <ClipboardList size={13} /> {t('exam.create_btn')}
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Teacher: their groups that are marked ready (info only) */}
      {isTeacher && exam_ready_groups.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <CheckCircle2 size={16} color="var(--accent)" />
            <h3 style={{ fontWeight: 700, fontSize: 15, margin: 0, color: 'var(--accent)' }}>
              {t('exam.your_ready_groups')}
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {exam_ready_groups.map((g, i) => (
              <motion.div key={g.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="exam-hub-card"
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 12, border: '1.5px solid var(--accent)30', background: 'var(--accent-bg)' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ClipboardList size={18} color="var(--accent)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', margin: 0 }}>{g.name}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('exam.waiting_for_admin')}</p>
                  {scheduleStr(g) && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} /> {scheduleStr(g)}
                    </p>
                  )}
                </div>
                <div className="exam-hub-card-btns" style={{ display: 'flex', flexShrink: 0 }}>
                  <Link to={`/groups/${g.id}?tab=exams`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                    {t('common.open')} <ChevronRight size={13} />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Active / upcoming exams */}
      {active_exams.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <ClipboardList size={16} color="var(--accent)" />
            <h3 style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>
              {isStudent ? t('exam.your_exams') : t('exam.active_exams_title')} ({active_exams.length})
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {active_exams.map((ex, i) => {
              const myResult = isStudent ? ex.results?.find(r => r.student === user.id) : null
              const col = myResult ? PCT_COLOR(myResult.percentage) : null
              return (
                <motion.div key={ex.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="exam-hub-card"
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 11, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ClipboardList size={20} color="var(--accent)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{ex.name}</span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'var(--accent-bg)', color: 'var(--accent)', fontWeight: 700 }}>
                        {t('exam.status_active')}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                      {ex.group_name || t('common.group')} · {ex.question_count} {t('exam.q_short')} · {ex.created_by_name}
                      {myResult && (
                        <span style={{ marginLeft: 10, fontWeight: 700, color: col.color }}>{myResult.percentage}%</span>
                      )}
                    </p>
                  </div>
                  <Link to={`/groups/${ex.group_id || ex.group}?tab=exams`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>
                    {isAdmin ? t('exam.score_btn') : isTeacher ? t('exam.results_btn') : myResult ? t('exam.results_btn') : t('common.open')}
                    <ChevronRight size={14} />
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </section>
      )}

      {/* Quick-create modal for admin from this page */}
      <Modal open={!!creating} onClose={() => setCreating(null)} title={t('exam.modal_title')}>
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>{t('exam.name_label')}</label>
            <input autoFocus placeholder={t('exam.name_placeholder')} value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t('exam.q_count_label')}</label>
            <input type="number" min={1} max={100} value={form.question_count}
              onChange={e => setForm(f => ({ ...f, question_count: Number(e.target.value) }))}
              style={{ ...inputStyle, width: 120 }} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setCreating(null)}
              style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              {t('exam.cancel')}
            </button>
            <motion.button type="submit" disabled={saving} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving && <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} />}
              {saving ? t('exam.creating') : t('exam.create')}
            </motion.button>
          </div>
        </form>
      </Modal>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }
const inputStyle = { width: '100%', padding: '10px 13px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }
