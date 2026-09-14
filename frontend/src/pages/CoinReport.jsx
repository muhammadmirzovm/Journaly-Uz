import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Coins, Wallet, TrendingUp, TrendingDown, Receipt, ChevronLeft, ChevronRight, Loader2, PlusCircle, Search, Users, SlidersHorizontal, Save } from 'lucide-react'
import { getCoinReport, adjustCoins, getCoinSettings, updateCoinSettings } from '../api/coins'
import { getAdminPurchases } from '../api/purchases'
import { getGroups, getMembers, getAcademyStudents } from '../api/groups'
import { useToast } from '../context/ToastContext'
import { formatDate, weekdayNameShort } from '../utils/date'

const CATEGORY_COLORS = {
  snack:      '#0EA5E9',
  stationery: '#8B5CF6',
  merch:      '#F59E0B',
  discount:   '#16A34A',
  coupon:     '#DC2626',
  other:      '#64748B',
}

const STATUS_META = {
  active:  { color: '#0EA5E9', bg: 'rgba(14,165,233,0.08)' },
  issued:  { color: '#16A34A', bg: 'rgba(22,163,74,0.08)' },
  expired: { color: '#DC2626', bg: 'rgba(220,38,38,0.08)' },
}

export default function CoinReport() {
  const { t }    = useTranslation()
  const { show } = useToast()
  const [report, setReport]   = useState(null)
  const [loading, setLoading] = useState(true)

  const [purchases, setPurchases]         = useState([])
  const [purchasesLoading, setPurchasesLoading] = useState(true)
  const [page, setPage]   = useState(1)
  const [pages, setPages] = useState(1)

  const load = useCallback(() => {
    setLoading(true)
    getCoinReport().then(r => setReport(r.data)).catch(() => show(t('coin_report.toast_load_fail'), 'error')).finally(() => setLoading(false))
  }, [show, t])
  useEffect(load, [load])

  useEffect(() => {
    setPurchasesLoading(true)
    getAdminPurchases(page).then(r => {
      setPurchases(r.data.results)
      setPages(r.data.pages)
    }).catch(() => show(t('coin_report.toast_purchases_fail'), 'error')).finally(() => setPurchasesLoading(false))
  }, [page, show, t])

  const som = n => new Intl.NumberFormat('uz-UZ').format(n)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, marginBottom: 4 }}>{t('coin_report.title')}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('coin_report.subtitle')}</p>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <CoinAdjustPanel onAdjusted={load} t={t} />
        <CoinSettingsPanel t={t} />
      </div>

      {loading || !report ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ height: 84, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)' }} />
          ))}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 26 }}>
            <StatCard icon={Wallet} label={t('coin_report.outstanding_balance')} value={som(report.outstanding_balance)} color="var(--accent)" />
            <StatCard icon={TrendingUp} label={t('coin_report.issued_30d')} value={som(report.issued_last_30_days)} color="#16A34A" />
            <StatCard icon={TrendingDown} label={t('coin_report.spent_30d')} value={som(report.spent_last_30_days)} color="#DC2626" />
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Coins size={16} color="var(--text-muted)" />
              <p style={{ fontWeight: 700, fontSize: 14 }}>{t('coin_report.spend_by_category')}</p>
            </div>

            {report.spend_by_category.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('coin_report.no_purchases')}</p>
            ) : (
              <SpendByCategory rows={report.spend_by_category} t={t} />
            )}
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Receipt size={16} color="var(--text-muted)" />
              <p style={{ fontWeight: 700, fontSize: 14 }}>{t('coin_report.purchase_history')}</p>
            </div>
            <PurchaseHistory
              purchases={purchases} loading={purchasesLoading}
              page={page} pages={pages} onPageChange={setPage} t={t}
            />
          </div>
        </>
      )}
    </div>
  )
}

function PurchaseHistory({ purchases, loading, page, pages, onPageChange, t }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <Loader2 size={22} style={{ animation: 'spin 0.7s linear infinite', color: 'var(--text-muted)' }} />
      </div>
    )
  }

  if (purchases.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('coin_report.no_purchases')}</p>
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {purchases.map(p => {
          const meta = STATUS_META[p.status] || STATUS_META.active
          const initials = (p.student_name?.[0] || p.student_username?.[0] || '?').toUpperCase()
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: 'var(--accent)', flexShrink: 0 }}>
                {initials}
              </div>
              <div style={{ minWidth: 120 }}>
                <p style={{ fontWeight: 600, fontSize: 13 }}>{p.student_name}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {p.student_groups.length > 0 ? p.student_groups.join(', ') : t('coin_report.no_group')}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 140 }}>
                {p.reward_image ? (
                  <img src={p.reward_image} alt="" style={{ width: 22, height: 22, borderRadius: 5, objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 16 }}>{p.reward_icon || '🎁'}</span>
                )}
                <span style={{ fontSize: 13 }}>{p.reward_name} {p.quantity > 1 && `×${p.quantity}`}</span>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                {p.total_price} <Coins size={12} color="var(--accent)" fill="var(--accent)" />
              </span>
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{p.code}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, color: meta.color, background: meta.bg }}>
                {t(`scanner.status_${p.status}`)}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                {formatDate(p.created_at)}
              </span>
            </div>
          )
        })}
      </div>

      {pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 18 }}>
          <button onClick={() => onPageChange(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--bg)', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1, display: 'flex', alignItems: 'center' }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{page} / {pages}</span>
          <button onClick={() => onPageChange(p => Math.min(pages, p + 1))} disabled={page === pages}
            style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--bg)', cursor: page === pages ? 'not-allowed' : 'pointer', opacity: page === pages ? 0.4 : 1, display: 'flex', alignItems: 'center' }}>
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </>
  )
}

function SpendByCategory({ rows, t }) {
  const total = rows.reduce((sum, r) => sum + r.coins, 0) || 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map(r => {
        const pct = Math.round((r.coins / total) * 100)
        const color = CATEGORY_COLORS[r.category] || CATEGORY_COLORS.other
        return (
          <div key={r.category}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{t(`rewards.cat_${r.category}`)}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                {r.coins} <Coins size={11} color="var(--text-muted)" /> · {r.purchase_count} {t('coin_report.purchases_suffix')} · {pct}%
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: 'var(--bg)', overflow: 'hidden' }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }}
                style={{ height: '100%', borderRadius: 999, background: color }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

const AMOUNT_PRESETS = [-50, -10, 10, 50, 100]

function CoinAdjustPanel({ onAdjusted, t }) {
  const { show } = useToast()
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [groups, setGroups] = useState([])
  const [students, setStudents] = useState([])

  const [mode, setMode] = useState('group') // group | students
  const [groupSearch, setGroupSearch] = useState('')
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [groupMembers, setGroupMembers] = useState([])
  const [groupMembersLoading, setGroupMembersLoading] = useState(false)
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set())

  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const toggleOpen = async () => {
    const next = !open
    setOpen(next)
    if (next && !loaded) {
      try {
        const [g, s] = await Promise.all([getGroups(), getAcademyStudents()])
        setGroups(g.data.filter(gr => !gr.is_graduated))
        setStudents(s.data)
        setLoaded(true)
      } catch { show(t('coin_report.toast_adjust_load_fail'), 'error') }
    }
  }

  const pickGroup = async (gr) => {
    setSelectedGroup(gr)
    setGroupMembersLoading(true)
    try {
      const { data } = await getMembers(gr.id)
      setGroupMembers(data)
    } catch { show(t('coin_report.toast_adjust_load_fail'), 'error') }
    finally { setGroupMembersLoading(false) }
  }

  const toggleStudent = (id) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const affectedIds = mode === 'group'
    ? groupMembers.map(m => m.id)
    : [...selectedStudentIds]

  const numAmount = Number(amount) || 0
  const canSubmit = affectedIds.length > 0 && numAmount !== 0 && reason.trim().length > 0

  const reset = () => {
    setMode('group'); setSelectedGroup(null); setGroupMembers([]); setGroupSearch('')
    setSelectedStudentIds(new Set()); setStudentSearch('')
    setAmount(''); setReason(''); setConfirming(false)
  }

  const submit = async () => {
    setSubmitting(true)
    try {
      const { data } = await adjustCoins({ student_ids: affectedIds, amount: numAmount, reason: reason.trim() })
      show(t('coin_report.toast_adjusted', { count: data.affected }), 'success')
      reset(); setOpen(false)
      onAdjusted()
    } catch (err) {
      show(err.response?.data?.detail || t('coin_report.toast_adjust_fail'), 'error')
    } finally { setSubmitting(false) }
  }

  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(groupSearch.trim().toLowerCase()))
  const filteredStudents = students.filter(s =>
    `${s.first_name} ${s.last_name} ${s.username}`.toLowerCase().includes(studentSearch.trim().toLowerCase()))

  return (
    <div style={{ marginBottom: 20 }}>
      <button onClick={toggleOpen}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, border: '1px solid var(--accent)', background: open ? 'var(--accent-bg)' : 'transparent', color: 'var(--accent)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
        <PlusCircle size={15} /> {t('coin_report.adjust_btn')}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden' }}>
            <div style={{ marginTop: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>

              {!loaded ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
                  <Loader2 size={20} color="var(--accent)" style={{ animation: 'spin 0.7s linear infinite' }} />
                </div>
              ) : confirming ? (
                <div>
                  <p style={{ fontSize: 14, marginBottom: 14 }}>
                    {t('coin_report.adjust_confirm_body', { count: affectedIds.length, amount: numAmount > 0 ? `+${numAmount}` : numAmount })}
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 18 }}>"{reason.trim()}"</p>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => setConfirming(false)} disabled={submitting}
                      style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                      {t('coin_report.adjust_back')}
                    </button>
                    <motion.button whileTap={{ scale: 0.97 }} onClick={submit} disabled={submitting}
                      style={{ padding: '9px 16px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: submitting ? 0.7 : 1 }}>
                      {submitting && <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} />}
                      {t('coin_report.adjust_confirm_btn')}
                    </motion.button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Mode tabs */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                    {['group', 'students'].map(m => (
                      <button key={m} onClick={() => setMode(m)}
                        style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${mode === m ? 'var(--accent)' : 'var(--border)'}`, background: mode === m ? 'var(--accent-bg)' : 'transparent', color: mode === m ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                        {t(`coin_report.adjust_mode_${m}`)}
                      </button>
                    ))}
                  </div>

                  {mode === 'group' ? (
                    <div style={{ marginBottom: 14 }}>
                      {groups.length > 6 && (
                        <div style={{ position: 'relative', marginBottom: 8 }}>
                          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                          <input value={groupSearch} onChange={e => setGroupSearch(e.target.value)}
                            placeholder={t('coin_report.adjust_search_group')}
                            style={{ width: '100%', padding: '7px 10px 7px 30px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                      )}
                      <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {filteredGroups.map(g => (
                          <button key={g.id} onClick={() => pickGroup(g)}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${selectedGroup?.id === g.id ? 'var(--accent)' : 'var(--border)'}`, background: selectedGroup?.id === g.id ? 'var(--accent-bg)' : 'transparent', color: selectedGroup?.id === g.id ? 'var(--accent)' : 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                            <Users size={13} /> {g.name}
                          </button>
                        ))}
                      </div>
                      {selectedGroup && (
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                          {groupMembersLoading
                            ? t('coin_report.adjust_loading_members')
                            : t('coin_report.adjust_group_member_count', { count: groupMembers.length })}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ position: 'relative', marginBottom: 8 }}>
                        <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                          placeholder={t('coin_report.adjust_search_student')}
                          style={{ width: '100%', padding: '7px 10px 7px 30px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                      <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {filteredStudents.map(s => {
                          const checked = selectedStudentIds.has(s.id)
                          return (
                            <button key={s.id} onClick={() => toggleStudent(s.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--border)'}`, background: checked ? 'var(--accent-bg)' : 'transparent', color: checked ? 'var(--accent)' : 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                              {(s.first_name || s.last_name) ? `${s.first_name} ${s.last_name}`.trim() : s.username}
                              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>@{s.username}</span>
                            </button>
                          )
                        })}
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                        {t('coin_report.adjust_selected_count', { count: selectedStudentIds.size })}
                      </p>
                    </div>
                  )}

                  {/* Amount */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                      {t('coin_report.adjust_amount')}
                    </label>
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                      placeholder="±10"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                      {AMOUNT_PRESETS.map(p => (
                        <button key={p} onClick={() => setAmount(String(p))}
                          style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: `1px solid ${numAmount === p ? 'var(--accent)' : 'var(--border)'}`, background: numAmount === p ? 'var(--accent-bg)' : 'transparent', color: numAmount === p ? 'var(--accent)' : 'var(--text-muted)' }}>
                          {p > 0 ? `+${p}` : p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reason */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                      {t('coin_report.adjust_reason')}
                    </label>
                    <input value={reason} onChange={e => setReason(e.target.value)}
                      placeholder={t('coin_report.adjust_reason_placeholder')}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <motion.button whileTap={{ scale: 0.97 }} disabled={!canSubmit} onClick={() => setConfirming(true)}
                      style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: canSubmit ? 'var(--accent)' : 'var(--border)', color: canSubmit ? '#fff' : 'var(--text-muted)', fontWeight: 700, fontSize: 13, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
                      {t('coin_report.adjust_review_btn')}
                    </motion.button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function NumField({ label, value, onChange, min = 0, max }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      <input type="number" min={min} max={max} value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
    </div>
  )
}

function CoinSettingsPanel({ t }) {
  const { i18n } = useTranslation()
  const { show } = useToast()
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [values, setValues] = useState(null)
  const [bigDays, setBigDays] = useState(new Set())

  const toggleOpen = async () => {
    const next = !open
    setOpen(next)
    if (next && !loaded) {
      try {
        const { data } = await getCoinSettings()
        setValues(data)
        setBigDays(new Set(data.big_days.split(',').filter(Boolean).map(Number)))
        setLoaded(true)
      } catch { show(t('coin_report.toast_settings_load_fail'), 'error') }
    }
  }

  const set = (key, val) => setValues(v => ({ ...v, [key]: val }))

  const toggleBigDay = (d) => {
    setBigDays(prev => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d); else next.add(d)
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        ...values,
        big_days: [...bigDays].sort((a, b) => a - b).join(','),
      }
      const { data } = await updateCoinSettings(payload)
      setValues(data)
      setBigDays(new Set(data.big_days.split(',').filter(Boolean).map(Number)))
      show(t('coin_report.toast_settings_saved'), 'success')
    } catch (err) {
      show(err.response?.data?.detail || t('coin_report.toast_settings_fail'), 'error')
    } finally { setSaving(false) }
  }

  return (
    <div>
      <button onClick={toggleOpen}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, border: '1px solid var(--accent)', background: open ? 'var(--accent-bg)' : 'transparent', color: 'var(--accent)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
        <SlidersHorizontal size={15} /> {t('coin_report.settings_btn')}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden' }}>
            <div style={{ marginTop: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, maxWidth: 520 }}>
              {!loaded || !values ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
                  <Loader2 size={20} color="var(--accent)" style={{ animation: 'spin 0.7s linear infinite' }} />
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.5 }}>
                    {t('coin_report.settings_hint')}
                  </p>

                  {/* Oddiy kun */}
                  <p style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>{t('coin_report.settings_normal_day')}</p>
                  <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <NumField label={t('coin_report.settings_place_1')} value={values.place_1_normal} onChange={v => set('place_1_normal', v)} />
                    <NumField label={t('coin_report.settings_place_2')} value={values.place_2_normal} onChange={v => set('place_2_normal', v)} />
                    <NumField label={t('coin_report.settings_place_3')} value={values.place_3_normal} onChange={v => set('place_3_normal', v)} />
                  </div>
                  <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                    <NumField label={t('coin_report.settings_effort_min')} value={values.effort_min_normal} onChange={v => set('effort_min_normal', v)} />
                    <NumField label={t('coin_report.settings_effort_max')} value={values.effort_max_normal} onChange={v => set('effort_max_normal', v)} />
                  </div>

                  {/* Katta kun */}
                  <p style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>{t('coin_report.settings_big_day')}</p>
                  <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <NumField label={t('coin_report.settings_place_1')} value={values.place_1_big} onChange={v => set('place_1_big', v)} />
                    <NumField label={t('coin_report.settings_place_2')} value={values.place_2_big} onChange={v => set('place_2_big', v)} />
                    <NumField label={t('coin_report.settings_place_3')} value={values.place_3_big} onChange={v => set('place_3_big', v)} />
                  </div>
                  <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <NumField label={t('coin_report.settings_effort_min')} value={values.effort_min_big} onChange={v => set('effort_min_big', v)} />
                    <NumField label={t('coin_report.settings_effort_max')} value={values.effort_max_big} onChange={v => set('effort_max_big', v)} />
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                      {t('coin_report.settings_big_days')}
                    </label>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {/* d is 0=Monday (backend's big_days convention); weekdayNameShort expects
                          0=Sunday (matches Date#getDay()), hence the (d+1)%7 conversion. */}
                      {[0, 1, 2, 3, 4, 5, 6].map(d => (
                        <button key={d} type="button" onClick={() => toggleBigDay(d)}
                          style={{ width: 38, height: 34, borderRadius: 8, border: `1.5px solid ${bigDays.has(d) ? 'var(--accent)' : 'var(--border)'}`, background: bigDays.has(d) ? 'var(--accent-bg)' : 'transparent', color: bigDays.has(d) ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                          {weekdayNameShort((d + 1) % 7, i18n.language)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Individual dars */}
                  <p style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>{t('coin_report.settings_individual')}</p>
                  <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                    <NumField label={t('coin_report.settings_normal_day')} value={values.individual_normal} onChange={v => set('individual_normal', v)} />
                    <NumField label={t('coin_report.settings_big_day')} value={values.individual_big} onChange={v => set('individual_big', v)} />
                  </div>

                  {/* Qoidalar */}
                  <p style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>{t('coin_report.settings_rules')}</p>
                  <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
                    <NumField label={t('coin_report.settings_min_group_3rd')} value={values.min_group_for_3rd} onChange={v => set('min_group_for_3rd', v)} min={3} />
                    <NumField label={t('coin_report.settings_max_games_week')} value={values.max_games_per_week} onChange={v => set('max_games_per_week', v)} min={1} max={7} />
                    <NumField label={t('coin_report.settings_edit_window')} value={values.edit_window_hours} onChange={v => set('edit_window_hours', v)} min={1} />
                    <NumField label={t('coin_report.settings_purchase_expires')} value={values.purchase_expires_days} onChange={v => set('purchase_expires_days', v)} min={1} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <motion.button whileTap={{ scale: 0.97 }} onClick={save} disabled={saving}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                      {saving ? <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Save size={13} />}
                      {t('coin_report.settings_save')}
                    </motion.button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ width: 42, height: 42, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={20} color={color} />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 17, fontWeight: 700, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value} <Coins size={15} color={color} fill={color} />
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{label}</p>
      </div>
    </div>
  )
}
