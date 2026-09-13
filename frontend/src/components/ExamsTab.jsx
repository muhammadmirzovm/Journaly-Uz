import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Plus, Minus, ClipboardList, CheckCircle2, ChevronDown, ChevronUp, Loader2, UserX, ChevronLeft, ChevronRight, Pencil, FileDown, Trash2 } from 'lucide-react'
import { toggleExamReady, createExam, submitExam, getExams, exportExamExcel, deleteExam } from '../api/groups'
import { useToast } from '../context/ToastContext'
import Modal from './ui/Modal'
import { formatDayMonthTime } from '../utils/date'

const PCT_COLOR = pct =>
  pct >= 70 ? { color: '#16A34A', bg: '#16A34A12', border: '#16A34A30' }
  : { color: '#DC2626', bg: '#DC262612', border: '#DC262630' }

const ABSENT_STYLE = { color: '#64748B', bg: '#64748B10', border: '#64748B30' }

// ── Scoring screen ────────────────────────────────────────────────────────────
function ScoringScreen({ exam, members, groupId, onDone, t }) {
  const { show } = useToast()
  const defaultCount = exam.question_count

  const init = () =>
    members.map(m => {
      const existing = exam.results?.find(r => r.student === m.id)
      const hasScores = existing && !existing.absent && existing.scores.length > 0
      return {
        student:  m.id,
        name:     m.first_name ? `${m.first_name} ${m.last_name}`.trim() : m.username,
        absent:   existing?.absent ?? false,
        scores:   hasScores ? [...existing.scores] : Array(defaultCount).fill(0),
        comments: hasScores ? [...existing.comments] : Array(defaultCount).fill(''),
        open:     false,
      }
    })

  const [rows, setRows]     = useState(init)
  const [saving, setSaving] = useState(false)
  const [autoSaveState, setAutoSaveState] = useState('idle') // idle | pending | saving | saved | error

  const mountedRef   = useRef(false)
  const saveTimerRef = useRef(null)

  // Bumped only by actual grading-data edits (not the open/collapse toggle
  // below), so autosave doesn't fire just from expanding a student's card.
  const [dataVersion, setDataVersion] = useState(0)
  const bump = () => setDataVersion(v => v + 1)

  const toggleAbsent = si => {
    setRows(r => r.map((row, i) => i !== si ? row : { ...row, absent: !row.absent, open: row.absent ? row.open : false }))
    bump()
  }

  const setScore = (si, qi, val) => {
    setRows(r => r.map((row, i) => i !== si ? row : { ...row, scores: row.scores.map((s, j) => j !== qi ? s : val) }))
    bump()
  }

  const setComment = (si, qi, val) => {
    setRows(r => r.map((row, i) => i !== si ? row : { ...row, comments: row.comments.map((c, j) => j !== qi ? c : val) }))
    bump()
  }

  const toggleOpen = si =>
    setRows(r => r.map((row, i) => i !== si ? row : { ...row, open: !row.open }))

  const addQuestion = si => {
    setRows(r => r.map((row, i) => i !== si ? row : { ...row, scores: [...row.scores, 0], comments: [...row.comments, ''] }))
    bump()
  }

  const removeQuestion = si => {
    setRows(r => r.map((row, i) => (i !== si || row.scores.length <= 1) ? row
      : { ...row, scores: row.scores.slice(0, -1), comments: row.comments.slice(0, -1) }))
    bump()
  }

  const pct = row => {
    if (row.absent || row.scores.length === 0) return null
    const total = row.scores.reduce((a, b) => a + b, 0)
    return Math.round(total / (row.scores.length * 5) * 100)
  }

  const buildResults = () => rows.map(r => ({
    student:  r.student,
    absent:   r.absent,
    scores:   r.absent ? [] : r.scores,
    comments: r.absent ? [] : r.comments,
  }))

  // Autosave: persist progress in the background so a refresh mid-grading
  // never loses already-entered scores/comments. Skips the very first
  // render (init from existing results shouldn't trigger a save).
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    setAutoSaveState('pending')
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      setAutoSaveState('saving')
      try {
        await submitExam(groupId, exam.id, { results: buildResults(), finish: false })
        setAutoSaveState('saved')
      } catch { setAutoSaveState('error') }
    }, 1500)
    return () => clearTimeout(saveTimerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataVersion])

  // Warn before an accidental refresh/close while a save hasn't landed yet.
  useEffect(() => {
    const handler = e => {
      if (autoSaveState === 'pending' || autoSaveState === 'saving') {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [autoSaveState])

  const save = async () => {
    clearTimeout(saveTimerRef.current)
    setSaving(true)
    try {
      await submitExam(groupId, exam.id, { results: buildResults(), finish: true })
      show(t('exam.saved_toast'), 'success')
      onDone()
    } catch { show('Error saving results', 'error') }
    finally { setSaving(false) }
  }

  const absentCount = rows.filter(r => r.absent).length

  return (
    <div>
      <div className="exam-scoring-hd" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h3 style={{ fontWeight: 800, fontSize: 18, margin: 0 }}>{exam.name}</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
            {t('exam.scoring_title')} · {defaultCount} {t('exam.q_short')}
            {absentCount > 0 && <span style={{ marginLeft: 8, color: '#64748B', fontWeight: 600 }}>· {absentCount} {t('exam.absent_count')}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {!saving && (autoSaveState === 'pending' || autoSaveState === 'saving') && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
              <Loader2 size={12} style={{ animation: 'spin 0.7s linear infinite' }} /> {t('exam.autosaving')}
            </span>
          )}
          {!saving && autoSaveState === 'saved' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--success)' }}>
              <CheckCircle2 size={12} /> {t('exam.autosaved')}
            </span>
          )}
          {!saving && autoSaveState === 'error' && (
            <span style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>{t('exam.autosave_error')}</span>
          )}
          <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} onClick={save} disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : <CheckCircle2 size={14} />}
            {saving ? t('exam.saving') : t('exam.save_all')}
          </motion.button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((row, si) => {
          const p   = pct(row)
          const col = row.absent ? ABSENT_STYLE : PCT_COLOR(p ?? 0)
          const total = row.absent ? 0 : row.scores.reduce((a, b) => a + b, 0)
          return (
            <div key={row.student} style={{ border: `1.5px solid ${row.open ? col.border : 'var(--border)'}`, borderRadius: 14, overflow: 'hidden', transition: 'border-color 0.2s', opacity: row.absent ? 0.7 : 1 }}>
              {/* Student header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                <button onClick={() => !row.absent && toggleOpen(si)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: row.open ? col.bg : row.absent ? '#64748B08' : 'var(--surface)', border: 'none', cursor: row.absent ? 'default' : 'pointer', transition: 'background 0.2s', textAlign: 'left' }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: `${col.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, fontSize: 15, color: col.color }}>
                    {row.absent ? <UserX size={16} /> : row.name[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', margin: 0 }}>{row.name}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>
                      {row.absent
                        ? <span style={{ color: '#64748B', fontWeight: 700 }}>{t('exam.absent_label')}</span>
                        : <>{t('exam.total')}: {total}/{row.scores.length * 5} · <span style={{ color: col.color, fontWeight: 700 }}>{p}%</span></>}
                    </p>
                  </div>
                  {!row.absent && (row.open ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />)}
                </button>
                {/* Absent toggle */}
                <button onClick={() => toggleAbsent(si)} title={row.absent ? t('exam.mark_present') : t('exam.mark_absent')}
                  style={{ padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: row.absent ? '#DC2626' : '#94A3B8', flexShrink: 0 }}>
                  <UserX size={14} />
                  {row.absent ? t('exam.present') : t('exam.absent_btn')}
                </button>
              </div>

              {/* Question rows */}
              <AnimatePresence>
                {row.open && !row.absent && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                    <div style={{ padding: '12px 18px 16px', display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--border)' }}>
                      {Array.from({ length: row.scores.length }, (_, qi) => (
                        <div key={qi}>
                          <div className="exam-q-score-row" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', minWidth: 70 }}>
                              {t('exam.q_label', { n: qi + 1 })}
                            </span>
                            <div className="exam-q-score-btns" style={{ display: 'flex', gap: 5 }}>
                              {[0,1,2,3,4,5].map(v => (
                                <button key={v} onClick={() => setScore(si, qi, v)}
                                  className="exam-q-score-btn"
                                  style={{
                                    width: 34, height: 34, borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13,
                                    background: row.scores[qi] === v
                                      ? (v === 0 ? '#EF4444' : v <= 2 ? '#F59E0B' : v <= 3 ? '#3B82F6' : '#16A34A')
                                      : 'var(--bg)',
                                    color: row.scores[qi] === v ? '#fff' : 'var(--text-muted)',
                                    transition: 'all 0.12s',
                                    outline: row.scores[qi] === v ? `2px solid ${v === 0 ? '#EF4444' : v <= 2 ? '#F59E0B' : v <= 3 ? '#3B82F6' : '#16A34A'}` : 'none',
                                    outlineOffset: 1,
                                  }}>
                                  {v}
                                </button>
                              ))}
                            </div>
                          </div>
                          <input
                            placeholder={t('exam.comment_placeholder')}
                            value={row.comments[qi]}
                            onChange={e => setComment(si, qi, e.target.value)}
                            style={{ width: '100%', padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                        <button onClick={() => addQuestion(si)}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, border: '1px dashed var(--accent)', background: 'transparent', color: 'var(--accent)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                          <Plus size={13} /> {t('exam.add_question')}
                        </button>
                        {row.scores.length > 1 && (
                          <button onClick={() => removeQuestion(si)}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                            <Minus size={13} /> {t('exam.remove_question')}
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Results view ──────────────────────────────────────────────────────────────
function ResultsView({ exam, groupId, groupName, t }) {
  const { show } = useToast()
  const [open, setOpen] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const present = exam.results.filter(r => !r.absent).sort((a, b) => b.percentage - a.percentage)
  const absent  = exam.results.filter(r => r.absent)
  const sorted  = [...present, ...absent]

  const handleDownload = async () => {
    setDownloading(true)
    try { await exportExamExcel(groupId, exam.id, groupName, exam.name) }
    catch { show('Excel yuklab olishda xatolik', 'error') }
    finally { setDownloading(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>{exam.name}</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>
            {t('exam.result_title')} · {exam.question_count} {t('exam.q_short')}
            {absent.length > 0 && <span style={{ marginLeft: 8, color: '#64748B' }}>· {absent.length} {t('exam.absent_count')}</span>}
          </p>
        </div>
        <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} onClick={handleDownload} disabled={downloading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1.5px solid #10B98133', background: 'rgba(16,185,129,0.07)', color: '#10B981', fontSize: 12, fontWeight: 700, cursor: downloading ? 'not-allowed' : 'pointer', flexShrink: 0, opacity: downloading ? 0.7 : 1 }}>
          {downloading ? <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> : <FileDown size={13} />}
          Excel
        </motion.button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map((r, idx) => {
          const col = r.absent ? ABSENT_STYLE : PCT_COLOR(r.percentage)
          return (
            <div key={r.id} style={{ border: `1.5px solid ${open === r.id ? col.border : 'var(--border)'}`, borderRadius: 14, overflow: 'hidden', opacity: r.absent ? 0.65 : 1 }}>
              <button onClick={() => !r.absent && setOpen(open === r.id ? null : r.id)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: open === r.id ? col.bg : 'var(--surface)', border: 'none', cursor: r.absent ? 'default' : 'pointer' }}>
                <span style={{ width: 26, height: 26, borderRadius: '50%', background: col.bg, border: `1.5px solid ${col.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: col.color, flexShrink: 0 }}>
                  {r.absent ? <UserX size={12} /> : idx + 1}
                </span>
                <span style={{ flex: 1, fontWeight: 700, fontSize: 14, color: 'var(--text)', textAlign: 'left' }}>{r.student_name}</span>
                {r.absent ? (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: ABSENT_STYLE.bg, color: ABSENT_STYLE.color }}>
                    {t('exam.absent_label')}
                  </span>
                ) : (
                  <>
                    <span style={{ fontSize: 13, fontWeight: 800, color: col.color, marginRight: 8 }}>{r.percentage}%</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: col.bg, color: col.color }}>
                      {r.total}/{r.max_score}
                    </span>
                  </>
                )}
                {!r.absent && (open === r.id ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />)}
              </button>

              <AnimatePresence>
                {open === r.id && !r.absent && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} style={{ overflow: 'hidden' }}>
                    <div style={{ padding: '10px 16px 14px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {r.scores.map((sc, qi) => {
                        const qCol = PCT_COLOR(Math.round(sc / 5 * 100))
                        return (
                          <div key={qi} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 66, paddingTop: 2 }}>{t('exam.q_label', { n: qi + 1 })}</span>
                            <span style={{ width: 28, height: 28, borderRadius: 7, background: qCol.bg, border: `1px solid ${qCol.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: qCol.color, flexShrink: 0 }}>{sc}</span>
                            {r.comments?.[qi] && (
                              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', paddingTop: 5 }}>{r.comments[qi]}</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Student result view ───────────────────────────────────────────────────────
function StudentResultView({ exam, userId, t }) {
  const result = exam.results.find(r => r.student === userId)
  if (!result) return <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: '32px 0' }}>{t('exam.no_exams')}</p>

  if (result.absent) {
    return (
      <div>
        <h3 style={{ fontWeight: 800, fontSize: 17, marginBottom: 4 }}>{exam.name}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{t('exam.your_result')}</p>
        <div style={{ padding: '32px 20px', borderRadius: 14, background: ABSENT_STYLE.bg, border: `2px solid ${ABSENT_STYLE.border}`, textAlign: 'center' }}>
          <UserX size={36} color={ABSENT_STYLE.color} style={{ margin: '0 auto 12px', display: 'block' }} />
          <p style={{ fontSize: 18, fontWeight: 800, color: ABSENT_STYLE.color, margin: 0 }}>{t('exam.absent_student_msg')}</p>
        </div>
      </div>
    )
  }

  const col = PCT_COLOR(result.percentage)
  return (
    <div>
      <h3 style={{ fontWeight: 800, fontSize: 17, marginBottom: 4 }}>{exam.name}</h3>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{t('exam.your_result')}</p>
      <div style={{ padding: '20px', borderRadius: 14, background: col.bg, border: `2px solid ${col.border}`, marginBottom: 20, textAlign: 'center' }}>
        <p style={{ fontSize: 40, fontWeight: 900, color: col.color, margin: 0 }}>{result.percentage}%</p>
        <p style={{ fontSize: 14, fontWeight: 700, color: col.color, marginTop: 4 }}>{result.total}/{result.max_score} · {result.percentage >= 70 ? t('exam.pass') : t('exam.fail')}</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {result.scores.map((sc, qi) => {
          const qCol = PCT_COLOR(Math.round(sc / 5 * 100))
          return (
            <div key={qi} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', minWidth: 72 }}>{t('exam.q_label', { n: qi + 1 })}</span>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: qCol.bg, border: `1px solid ${qCol.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: qCol.color, flexShrink: 0 }}>{sc}</span>
              {result.comments?.[qi] && (
                <span style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', paddingTop: 6 }}>{result.comments[qi]}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main ExamsTab ─────────────────────────────────────────────────────────────
export default function ExamsTab({ group, members, isAdmin, isTeacher, userId, groupId }) {
  const { show }  = useToast()
  const { t }     = useTranslation()

  const [exams, setExams]               = useState([])
  const [page, setPage]                 = useState(1)
  const [totalPages, setTotalPages]     = useState(1)
  const [loadingExams, setLoadingExams] = useState(true)
  const [examReady, setExamReady]       = useState(group.exam_ready)
  const [examReadyAt, setExamReadyAt]   = useState(group.exam_ready_at || null)
  const [examReadyNote, setExamReadyNote] = useState(group.exam_ready_note || '')
  const [readyLoading, setReadyLoading] = useState(false)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [noteInput, setNoteInput]       = useState('')
  const [showCreate, setShowCreate]     = useState(false)
  const [form, setForm]                 = useState({ name: '', question_count: 10 })
  const [creating, setCreating]         = useState(false)
  const [view, setView]                 = useState(null) // { examId, mode: 'score'|'results'|'mine' }
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [deletingId, setDeletingId]     = useState(null)

  const activeExam = view ? exams.find(e => e.id === view.examId) : null

  const fetchExams = useCallback(async (p = page) => {
    setLoadingExams(true)
    try {
      const { data } = await getExams(groupId, p)
      setExams(data.results)
      setTotalPages(data.pages)
      setPage(data.page)
    } catch {
      show(t('common.error'), 'error')
    }
    finally { setLoadingExams(false) }
  }, [groupId])

  useEffect(() => { fetchExams(1) }, [fetchExams])

  const handleToggleReady = () => {
    if (!examReady) {
      setNoteInput('')
      setShowNoteModal(true)
    } else {
      confirmToggleReady('')
    }
  }

  const confirmToggleReady = async (note) => {
    setShowNoteModal(false)
    setReadyLoading(true)
    try {
      const { data } = await toggleExamReady(groupId, note)
      setExamReady(data.exam_ready)
      setExamReadyAt(data.exam_ready_at || null)
      setExamReadyNote(data.exam_ready_note || '')
      if (data.exam_ready) show(t('exam.ready_toast'), 'success')
    } catch {
      show(t('common.error'), 'error')
    }
    finally { setReadyLoading(false) }
  }

  const handleCreate = async e => {
    e.preventDefault()
    if (!form.name.trim() || !form.question_count) return
    setCreating(true)
    try {
      await createExam(groupId, form)
      setShowCreate(false)
      setForm({ name: '', question_count: 10 })
      fetchExams(1)
    } catch { show('Error creating exam', 'error') }
    finally { setCreating(false) }
  }

  const handleScored = () => {
    setView(null)
    fetchExams(page)
  }

  const handleDelete = async examId => {
    setDeletingId(examId)
    try {
      await deleteExam(groupId, examId)
      setConfirmDeleteId(null)
      fetchExams(page)
      show(t('exam.deleted_toast'), 'success')
    } catch { show(t('exam.err_delete'), 'error') }
    finally { setDeletingId(null) }
  }

  if (view && activeExam) {
    return (
      <div>
        <button onClick={() => setView(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 20, background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0 }}>
          ← {t('exam.tab')}
        </button>
        {view.mode === 'score'   && <ScoringScreen exam={activeExam} members={members} groupId={groupId} onDone={handleScored} t={t} />}
        {view.mode === 'results' && <ResultsView exam={activeExam} groupId={groupId} groupName={group.name} t={t} />}
        {view.mode === 'mine'    && <StudentResultView exam={activeExam} userId={userId} t={t} />}
      </div>
    )
  }

  return (
    <div>
      {/* Teacher: exam-ready button */}
      {isTeacher && !isAdmin && (
        <div style={{ marginBottom: 20 }}>
          <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} onClick={handleToggleReady} disabled={readyLoading}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px',
              borderRadius: 10, border: `1.5px solid ${examReady ? '#F59E0B' : 'var(--accent)'}`,
              background: examReady ? '#F59E0B15' : 'var(--accent-bg)',
              color: examReady ? '#D97706' : 'var(--accent)',
              fontWeight: 700, fontSize: 13, cursor: readyLoading ? 'not-allowed' : 'pointer',
            }}>
            <ClipboardList size={14} />
            {examReady ? t('exam.not_ready_btn') : t('exam.ready_btn')}
          </motion.button>
          {examReady && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 12, color: '#D97706', margin: 0 }}>
                ✓ {t('exam.admin_notified')}
                {examReadyAt && ` — ${formatDayMonthTime(examReadyAt)}`}
              </p>
              {examReadyNote && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0', fontStyle: 'italic' }}>"{examReadyNote}"</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Admin or teacher: create exam button + ready notice */}
      {(isAdmin || isTeacher) && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          {isAdmin && examReady && (
            <div style={{ flex: 1 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#D97706', fontWeight: 600 }}>
                <ClipboardList size={14} /> {t('exam.teacher_marked_ready')}
                {examReadyAt && (
                  <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-muted)' }}>
                    · {formatDayMonthTime(examReadyAt)}
                  </span>
                )}
              </span>
              {examReadyNote && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0', fontStyle: 'italic' }}>"{examReadyNote}"</p>
              )}
            </div>
          )}
          <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} onClick={() => setShowCreate(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            <Plus size={14} /> {t('exam.create_btn')}
          </motion.button>
        </div>
      )}

      {/* Exam list */}
      {loadingExams ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <Loader2 size={24} color="var(--accent)" style={{ animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : exams.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <ClipboardList size={36} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
          <p style={{ fontWeight: 600 }}>{t('exam.no_exams')}</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>{(isAdmin || isTeacher) ? t('exam.no_exams_sub_creator') : t('exam.no_exams_sub')}</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {exams.map(ex => {
              const finished  = ex.status === 'finished'
              const myResult  = !isAdmin && !isTeacher ? ex.results?.find(r => r.student === userId) : null
              const absentCount = ex.results?.filter(r => r.absent).length ?? 0
              return (
                <div key={ex.id} className="exam-hub-card" style={{ padding: '16px 18px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 11, background: finished ? '#16A34A15' : 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ClipboardList size={20} color={finished ? '#16A34A' : 'var(--accent)'} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{ex.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                        background: finished ? '#16A34A15' : 'var(--accent-bg)',
                        color: finished ? '#16A34A' : 'var(--accent)' }}>
                        {finished ? t('exam.status_finished') : t('exam.status_active')}
                      </span>
                      {finished && absentCount > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: ABSENT_STYLE.bg, color: ABSENT_STYLE.color, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <UserX size={10} /> {absentCount} {t('exam.absent_count')}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                      {ex.question_count} {t('exam.q_short')} · {ex.created_by_name}
                      {myResult && !myResult.absent && <span style={{ marginLeft: 10, fontWeight: 700, color: PCT_COLOR(myResult.percentage).color }}>{myResult.percentage}%</span>}
                      {myResult?.absent && <span style={{ marginLeft: 10, fontWeight: 700, color: ABSENT_STYLE.color }}>{t('exam.absent_label')}</span>}
                    </p>
                  </div>
                  <div className="exam-hub-card-btns" style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {(isAdmin || isTeacher) && !finished && (
                      <button onClick={() => setView({ examId: ex.id, mode: 'score' })}
                        style={{ padding: '7px 14px', borderRadius: 9, border: '1px solid var(--accent)', background: 'var(--accent-bg)', color: 'var(--accent)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                        {t('exam.score_btn')}
                      </button>
                    )}
                    {(isAdmin || isTeacher) && finished && (
                      <button onClick={() => setView({ examId: ex.id, mode: 'results' })}
                        style={{ padding: '7px 14px', borderRadius: 9, border: '1px solid #16A34A', background: '#16A34A15', color: '#16A34A', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                        {t('exam.results_btn')}
                      </button>
                    )}
                    {(isAdmin || isTeacher) && finished && (
                      <button onClick={() => setView({ examId: ex.id, mode: 'score' })}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 9, border: '1px solid #8B5CF6', background: '#8B5CF615', color: '#8B5CF6', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                        <Pencil size={12} /> {t('exam.edit_btn')}
                      </button>
                    )}
                    {(isAdmin || isTeacher) && (
                      confirmDeleteId === ex.id ? (
                        <>
                          <button onClick={() => handleDelete(ex.id)} disabled={deletingId === ex.id}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 9, border: 'none', background: '#DC2626', color: '#fff', fontWeight: 700, fontSize: 12, cursor: deletingId === ex.id ? 'not-allowed' : 'pointer', opacity: deletingId === ex.id ? 0.7 : 1 }}>
                            {deletingId === ex.id ? <Loader2 size={12} style={{ animation: 'spin 0.7s linear infinite' }} /> : t('exam.confirm_delete')}
                          </button>
                          <button onClick={() => setConfirmDeleteId(null)}
                            style={{ padding: '7px 14px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                            {t('exam.cancel')}
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(ex.id)} title={t('exam.delete_btn')}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
                          <Trash2 size={14} />
                        </button>
                      )
                    )}
                    {!isAdmin && !isTeacher && myResult && (
                      <button onClick={() => setView({ examId: ex.id, mode: 'mine' })}
                        style={{ padding: '7px 14px', borderRadius: 9, border: `1px solid ${myResult.absent ? ABSENT_STYLE.border : PCT_COLOR(myResult.percentage).border}`, background: myResult.absent ? ABSENT_STYLE.bg : PCT_COLOR(myResult.percentage).bg, color: myResult.absent ? ABSENT_STYLE.color : PCT_COLOR(myResult.percentage).color, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                        {t('exam.results_btn')}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 20 }}>
              <button onClick={() => { const p = page - 1; setPage(p); fetchExams(p) }} disabled={page <= 1}
                style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1 }}>
                <ChevronLeft size={16} color="var(--text-muted)" />
              </button>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                {page} / {totalPages}
              </span>
              <button onClick={() => { const p = page + 1; setPage(p); fetchExams(p) }} disabled={page >= totalPages}
                style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1 }}>
                <ChevronRight size={16} color="var(--text-muted)" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Note modal (teacher marks group ready) */}
      <Modal open={showNoteModal} onClose={() => setShowNoteModal(false)} title="Imtihonga tayyor — izoh">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Admin uchun qisqacha izoh yozing (ixtiyoriy). U Telegram xabariga ham qo'shiladi.
          </p>
          <textarea
            autoFocus
            rows={3}
            placeholder="Masalan: O'quvchilar 6-mavzugacha tayyor, 20 ta savol bo'lsin..."
            value={noteInput}
            onChange={e => setNoteInput(e.target.value)}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowNoteModal(false)}
              style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              Bekor
            </button>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => confirmToggleReady(noteInput)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 10, border: 'none', background: '#D97706', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              <ClipboardList size={13} /> Yuborish
            </motion.button>
          </div>
        </div>
      </Modal>

      {/* Create exam modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t('exam.modal_title')}>
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
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={() => setShowCreate(false)}
              style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              {t('exam.cancel')}
            </button>
            <motion.button type="submit" disabled={creating} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.7 : 1 }}>
              {creating && <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} />}
              {creating ? t('exam.creating') : t('exam.create')}
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
