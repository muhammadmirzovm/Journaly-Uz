import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { GraduationCap, BookOpen, Users, Sparkles, Eye, EyeOff, ArrowRight, Loader2, CheckCircle2, AlertCircle, Globe } from 'lucide-react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const ROLE_ICONS = { teacher: GraduationCap, student: BookOpen, admin: Users, parent: Users }
const LANGS = [
  { code: 'uz', label: "O'zbek", short: 'UZ' },
  { code: 'ru', label: 'Русский', short: 'RU' },
  { code: 'en', label: 'English', short: 'EN' },
]

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}

export default function InviteLanding() {
  const { token }      = useParams()
  const navigate       = useNavigate()
  const { login, user } = useAuth()
  const { show }       = useToast()
  const { t, i18n }   = useTranslation()

  const [invite,  setInvite]  = useState(null)
  const [status,  setStatus]  = useState('loading') // loading | valid | invalid | error
  const [mode,    setMode]    = useState('choose')   // choose | register | login
  const [languageSelected, setLanguageSelected] = useState(Boolean(user))
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({ first_name: '', last_name: '', username: '', email: '', password: '', confirm: '' })
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [showPass, setShowPass]       = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [errors, setErrors] = useState({})

  const verifyInvite = useCallback(() => {
    setStatus('loading')
    api.get(`/invites/${token}/verify/`)
      .then(r => { setInvite(r.data); setStatus('valid') })
      .catch(err => setStatus(err.response?.status === 400 ? 'invalid' : 'error'))
  }, [token])

  useEffect(() => { verifyInvite() }, [verifyInvite])

  useEffect(() => {
    if (user) setLanguageSelected(true)
  }, [user])

  const color     = invite?.academy?.primary_color || '#0D9488'
  const colorRgb  = invite ? hexToRgb(color) : '13, 148, 136'
  const RoleIcon  = invite ? (ROLE_ICONS[invite.role] || GraduationCap) : GraduationCap

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })) }
  const setL = (k, v) => { setLoginForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })) }

  const chooseLanguage = code => {
    i18n.changeLanguage(code)
    setLanguageSelected(true)
    setMode('choose')
    setErrors({})
    setForm({ first_name: '', last_name: '', username: '', email: '', password: '', confirm: '' })
    setLoginForm({ username: '', password: '' })
  }

  const acceptInvite = async () => {
    await api.post(`/invites/${token}/accept/`)
    const { data: me } = await api.get('/auth/me/')
    return me
  }

  const handleRegister = async e => {
    e.preventDefault()
    const errs = {}
    if (!form.first_name) errs.first_name = t('invite.err_required')
    if (!form.username)   errs.username   = t('invite.err_required')
    if (form.password.length < 6) errs.password = t('auth.err_password_len')
    if (!form.confirm)    errs.confirm    = t('auth.err_confirm_required')
    else if (form.confirm !== form.password) errs.confirm = t('auth.err_confirm_match')
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    try {
      const { confirm: _, ...payload } = form
      const { data } = await api.post('/auth/register/', {
        ...payload,
        ui_language: i18n.language,
        role: invite.role,
      })
      login(data.tokens, data.user)
      const me = await acceptInvite()
      login({ access: localStorage.getItem('access'), refresh: localStorage.getItem('refresh') }, me)
      show(t('invite.welcome', { name: invite.academy.name }), 'success')
      navigate('/dashboard')
    } catch (err) {
      const detail = err.response?.data
      if (typeof detail === 'object') {
        const mapped = {}
        Object.entries(detail).forEach(([k, v]) => { mapped[k] = Array.isArray(v) ? v[0] : v })
        setErrors(mapped)
      } else {
        show(t('invite.err_generic'), 'error')
      }
    } finally { setLoading(false) }
  }

  const handleLogin = async e => {
    e.preventDefault()
    const errs = {}
    if (!loginForm.username) errs.username = t('invite.err_required')
    if (!loginForm.password) errs.password = t('invite.err_required')
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    try {
      const { data: tokens } = await api.post('/auth/login/', loginForm)
      login(tokens, {})
      const me = await acceptInvite()
      login(tokens, me)
      show(t('invite.welcome', { name: invite.academy.name }), 'success')
      navigate('/dashboard')
    } catch (err) {
      const detail = err.response?.data?.detail
      setErrors({ password: detail || t('auth.err_invalid') })
    } finally { setLoading(false) }
  }

  const handleAlreadyLoggedIn = async () => {
    if (!user) { setMode('choose'); return }
    setLoading(true)
    try {
      const me = await acceptInvite()
      login({ access: localStorage.getItem('access'), refresh: localStorage.getItem('refresh') }, me)
      show(t('invite.welcome', { name: invite.academy.name }), 'success')
      navigate('/dashboard')
    } catch (err) {
      show(err.response?.data?.detail || t('invite.err_accept'), 'error')
    } finally { setLoading(false) }
  }

  const inputStyle = hasErr => ({
    width: '100%', padding: '12px 16px', borderRadius: 12, boxSizing: 'border-box',
    background: 'var(--bg)',
    border: `1.5px solid ${hasErr ? 'rgba(239,68,68,0.5)' : 'var(--border)'}`,
    color: 'var(--text)', fontSize: 15, outline: 'none', transition: 'border-color 0.2s',
  })

  const labelStyle = { fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <Loader2 size={32} style={{ color: '#0D9488', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(239,68,68,0.02)), var(--bg)', padding: 24 }}>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <AlertCircle size={40} color="#ef4444" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{t('invite.expired_title')}</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
            {t('invite.expired_sub')}
          </p>
          <Link to="/" style={{ display: 'inline-block', padding: '12px 28px', borderRadius: 12, background: '#ef4444', color: '#fff', fontWeight: 700, textDecoration: 'none' }}>
            {t('invite.go_home')}
          </Link>
        </motion.div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 }}>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <AlertCircle size={40} color="#f59e0b" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{t('invite.error_title')}</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>{t('invite.error_sub')}</p>
          <button type="button" onClick={verifyInvite} style={{ padding: '12px 28px', borderRadius: 12, border: 'none', background: '#0D9488', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            {t('invite.retry')}
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', position: 'relative', overflow: 'hidden',
      background: `linear-gradient(135deg, rgba(${colorRgb},0.06) 0%, rgba(${colorRgb},0.02) 100%), var(--bg)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)',
        width: 700, height: 400,
        background: `radial-gradient(ellipse, rgba(${colorRgb},0.12) 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 160, damping: 22 }}
        style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 460 }}>

        {/* Academy header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
              display: 'inline-flex', width: 72, height: 72, borderRadius: 18,
              background: `linear-gradient(135deg, ${color}, ${color}dd)`,
              alignItems: 'center', justifyContent: 'center', marginBottom: 16,
              boxShadow: `0 8px 32px rgba(${colorRgb},0.35)`,
            }}>
              <GraduationCap size={32} color="#fff" />
            </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
            {invite.academy.name}
          </h1>
          {!(!user && !languageSelected) && <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 20,
            background: `rgba(${colorRgb},0.12)`, color: color,
            fontSize: 13, fontWeight: 700,
          }}>
            <RoleIcon size={13} />
            {t('invite.invited_as', { role: t(`settings.role_${invite.role}`, { defaultValue: invite.role }) })}
            {invite.student_name && ` · ${t('invite.for_student', { name: invite.student_name })}`}
            {invite.group_name && ` · ${invite.group_name}`}
          </div>}
          {!(!user && !languageSelected) && invite.note && (
            <p style={{ marginTop: 12, fontSize: 14, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              "{invite.note}"
            </p>
          )}
        </div>

        {/* Card */}
        <div style={{
          borderRadius: 24, border: '1px solid var(--border)',
          background: 'var(--surface)', backdropFilter: 'blur(16px)',
          padding: 28, boxShadow: `0 24px 80px rgba(${colorRgb},0.12)`,
        }}>
          <AnimatePresence mode="wait">

            {/* Step: choose language before showing onboarding */}
            {!user && !languageSelected && (
              <motion.div key="language" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}>
                <div style={{ textAlign: 'center', marginBottom: 22 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: `rgba(${colorRgb},0.12)`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                    <Globe size={22} />
                  </div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{t('invite.select_language')}</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('invite.select_language_sub')}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {LANGS.map(lang => (
                    <button key={lang.code} type="button" onClick={() => chooseLanguage(lang.code)}
                      style={{ width: '100%', minHeight: 52, padding: '12px 16px', borderRadius: 14, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, fontSize: 15, fontWeight: 700, textAlign: 'left' }}>
                      <span style={{ width: 32, height: 32, borderRadius: 9, background: `rgba(${colorRgb},0.12)`, color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>{lang.short}</span>
                      {lang.label}
                      <ArrowRight size={17} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step: choose register or login */}
            {languageSelected && mode === 'choose' && (
              <motion.div key="choose" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}>
                {user ? (
                  <div style={{ textAlign: 'center' }}>
                    <CheckCircle2 size={36} color={color} style={{ margin: '0 auto 12px' }} />
                    <p style={{ fontSize: 15, color: 'var(--text)', marginBottom: 20 }}>
                      {t('invite.logged_in_as', { username: user.username })}
                    </p>
                    <button onClick={handleAlreadyLoggedIn} disabled={loading}
                      style={{
                        width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
                        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                        color: '#fff', fontWeight: 800, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        boxShadow: `0 8px 24px rgba(${colorRgb},0.3)`,
                      }}>
                      {loading ? <Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Sparkles size={16} />}
                      {t('invite.join_btn', { name: invite.academy.name })}
                    </button>
                    <button onClick={() => setMode('login')}
                      style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>
                      {t('invite.use_different')}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <p style={{ textAlign: 'center', fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                      {t('invite.how_join')}
                    </p>

                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => setMode('register')}
                      style={{
                        width: '100%', padding: '16px 20px', borderRadius: 16, border: 'none',
                        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                        color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 12,
                        boxShadow: `0 8px 24px rgba(${colorRgb},0.3)`,
                      }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Sparkles size={18} />
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div>{t('invite.create_account')}</div>
                        <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.8 }}>{t('invite.create_account_sub')}</div>
                      </div>
                      <ArrowRight size={18} style={{ marginLeft: 'auto' }} />
                    </motion.button>

                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => setMode('login')}
                      style={{
                        width: '100%', padding: '16px 20px', borderRadius: 16, cursor: 'pointer',
                        background: 'var(--bg)', border: '1.5px solid var(--border)',
                        color: 'var(--text)', fontWeight: 700, fontSize: 15,
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <BookOpen size={18} />
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div>{t('invite.signin_account')}</div>
                        <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>{t('invite.signin_account_sub')}</div>
                      </div>
                      <ArrowRight size={18} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
                    </motion.button>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step: register */}
            {languageSelected && mode === 'register' && (
              <motion.div key="register" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <button onClick={() => setMode('choose')}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {t('invite.back')}
                </button>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 20 }}>{t('invite.register_title')}</h2>
                <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={labelStyle}>{t('auth.first_name')}</label>
                      <input style={inputStyle(!!errors.first_name)} placeholder={t('auth.first_name_placeholder')}
                        value={form.first_name} onChange={e => set('first_name', e.target.value)}
                        onFocus={ev => { ev.target.style.borderColor = color }} onBlur={ev => { ev.target.style.borderColor = 'var(--border)' }} />
                      {errors.first_name && <p style={{ fontSize: 11, color: '#f87171', marginTop: 3 }}>{errors.first_name}</p>}
                    </div>
                    <div>
                      <label style={labelStyle}>{t('auth.last_name')}</label>
                      <input style={inputStyle(false)} placeholder={t('auth.last_name_placeholder')}
                        value={form.last_name} onChange={e => set('last_name', e.target.value)}
                        onFocus={ev => { ev.target.style.borderColor = color }} onBlur={ev => { ev.target.style.borderColor = 'var(--border)' }} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>{t('auth.username')}</label>
                      <input style={inputStyle(!!errors.username)} placeholder={t('auth.username_placeholder')}
                      value={form.username} onChange={e => set('username', e.target.value)} autoComplete="username"
                      onFocus={ev => { ev.target.style.borderColor = color }} onBlur={ev => { ev.target.style.borderColor = 'var(--border)' }} />
                    {errors.username && <p style={{ fontSize: 11, color: '#f87171', marginTop: 3 }}>{errors.username}</p>}
                  </div>
                  <div>
                    <label style={labelStyle}>{t('auth.email')} <span style={{ fontWeight: 400, opacity: 0.5 }}>({t('auth.optional')})</span></label>
                    <input type="email" style={inputStyle(false)} placeholder="john@example.com"
                      value={form.email} onChange={e => set('email', e.target.value)} autoComplete="email"
                      onFocus={ev => { ev.target.style.borderColor = color }} onBlur={ev => { ev.target.style.borderColor = 'var(--border)' }} />
                  </div>
                  <div>
                    <label style={labelStyle}>{t('auth.password')}</label>
                    <div style={{ position: 'relative' }}>
                      <input type={showPass ? 'text' : 'password'}
                        style={{ ...inputStyle(!!errors.password), paddingRight: 44 }}
                        placeholder={t('auth.min_password')}
                        value={form.password} onChange={e => set('password', e.target.value)} autoComplete="new-password"
                        onFocus={ev => { ev.target.style.borderColor = color }} onBlur={ev => { ev.target.style.borderColor = 'var(--border)' }} />
                      <button type="button" onClick={() => setShowPass(s => !s)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.password && <p style={{ fontSize: 11, color: '#f87171', marginTop: 3 }}>{errors.password}</p>}
                  </div>
                  <div>
                    <label style={labelStyle}>{t('auth.confirm_password')}</label>
                    <div style={{ position: 'relative' }}>
                      <input type={showConfirm ? 'text' : 'password'}
                        style={{ ...inputStyle(!!errors.confirm), paddingRight: 44 }}
                        placeholder={t('auth.repeat_password')}
                        value={form.confirm} onChange={e => set('confirm', e.target.value)} autoComplete="new-password"
                        onFocus={ev => { ev.target.style.borderColor = color }} onBlur={ev => { ev.target.style.borderColor = 'var(--border)' }} />
                      <button type="button" onClick={() => setShowConfirm(s => !s)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.confirm && <p style={{ fontSize: 11, color: '#f87171', marginTop: 3 }}>{errors.confirm}</p>}
                  </div>
                  <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    style={{
                      width: '100%', padding: '14px 0', marginTop: 4, borderRadius: 14, border: 'none',
                      background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                      color: '#fff', fontWeight: 800, fontSize: 15,
                      cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: `0 8px 24px rgba(${colorRgb},0.3)`,
                    }}>
                    {loading
                      ? <><Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> {t('auth.creating')}</>
                      : <>{t('invite.join_btn', { name: invite.academy.name })} <ArrowRight size={16} /></>
                    }
                  </motion.button>
                </form>
              </motion.div>
            )}

            {/* Step: login */}
            {languageSelected && mode === 'login' && (
              <motion.div key="login" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <button onClick={() => setMode('choose')}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {t('invite.back')}
                </button>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 20 }}>{t('invite.login_title')}</h2>
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>{t('auth.username')}</label>
                    <input style={inputStyle(!!errors.username)} placeholder={t('auth.username_placeholder')}
                      value={loginForm.username} onChange={e => setL('username', e.target.value)} autoComplete="username"
                      onFocus={ev => { ev.target.style.borderColor = color }} onBlur={ev => { ev.target.style.borderColor = 'var(--border)' }} />
                    {errors.username && <p style={{ fontSize: 11, color: '#f87171', marginTop: 3 }}>{errors.username}</p>}
                  </div>
                  <div>
                    <label style={labelStyle}>{t('auth.password')}</label>
                    <div style={{ position: 'relative' }}>
                      <input type={showPass ? 'text' : 'password'}
                        style={{ ...inputStyle(!!errors.password), paddingRight: 44 }}
                        placeholder={t('auth.your_password')}
                        value={loginForm.password} onChange={e => setL('password', e.target.value)} autoComplete="current-password"
                        onFocus={ev => { ev.target.style.borderColor = color }} onBlur={ev => { ev.target.style.borderColor = 'var(--border)' }} />
                      <button type="button" onClick={() => setShowPass(s => !s)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.password && <p style={{ fontSize: 11, color: '#f87171', marginTop: 3 }}>{errors.password}</p>}
                  </div>
                  <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    style={{
                      width: '100%', padding: '14px 0', marginTop: 4, borderRadius: 14, border: 'none',
                      background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                      color: '#fff', fontWeight: 800, fontSize: 15,
                      cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: `0 8px 24px rgba(${colorRgb},0.3)`,
                    }}>
                    {loading
                      ? <><Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> {t('auth.signing_in')}</>
                      : <>{t('invite.signin_join')} <ArrowRight size={16} /></>
                    }
                  </motion.button>
                </form>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--text-muted)' }}>
          {t('invite.powered_by')}
        </p>
      </motion.div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
