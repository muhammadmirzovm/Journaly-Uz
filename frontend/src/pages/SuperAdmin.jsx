import { useCallback, useEffect, useState } from 'react'
import { Building2, Check, Link2, Loader2, RefreshCw, Search, Shield, Users, X } from 'lucide-react'
import api from '../api/axios'

const initialInvite = { academy: '', role: 'student', max_uses: 1, days_valid: 7, note: '' }

function Stat({ label, value, icon: Icon, color }) {
  return (
    <div style={{ padding: 18, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 13 }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}18`, color, display: 'grid', placeItems: 'center' }}><Icon size={18} /></div>
      <div><div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{value}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div></div>
    </div>
  )
}

export default function SuperAdmin() {
  const [overview, setOverview] = useState(null)
  const [academies, setAcademies] = useState([])
  const [search, setSearch] = useState('')
  const [invite, setInvite] = useState(initialInvite)
  const [createdLink, setCreatedLink] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [summary, list] = await Promise.all([
        api.get('/platform/overview/'),
        api.get('/platform/academies/', { params: search ? { q: search } : {} }),
      ])
      setOverview(summary.data); setAcademies(list.data)
    } catch (err) { setError(err.response?.data?.detail || 'Platform maʼlumotlarini yuklab bo‘lmadi.') }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  const updateAcademy = async (academy, patch) => {
    setSaving(academy.id); setError('')
    try {
      await api.patch(`/platform/academies/${academy.id}/`, patch)
      await load()
    } catch (err) { setError(err.response?.data?.detail || 'O‘zgarishni saqlab bo‘lmadi.') }
    finally { setSaving(null) }
  }

  const createInvite = async e => {
    e.preventDefault(); setError(''); setCreatedLink('')
    try {
      const { data } = await api.post('/platform/invites/', { ...invite, academy: Number(invite.academy) })
      setCreatedLink(`${window.location.origin}/invite/${data.token}`)
      setInvite(initialInvite)
    } catch (err) { setError(err.response?.data?.detail || 'Invite yaratib bo‘lmadi.') }
  }

  const input = { width: '100%', boxSizing: 'border-box', padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 26 }}>
        <div><p style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Platform boshqaruvi</p><h1 style={{ margin: 0, color: 'var(--text)', fontSize: 28 }}>Superadmin</h1><p style={{ color: 'var(--text-muted)', marginTop: 7 }}>Akademiyalar, limitlar va invite’larni boshqaring.</p></div>
        <button type="button" onClick={load} title="Yangilash" style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', borderRadius: 8, padding: 9, cursor: 'pointer' }}><RefreshCw size={17} /></button>
      </div>
      {error && <div style={{ marginBottom: 18, padding: '11px 14px', borderRadius: 9, color: '#dc2626', background: 'rgba(239,68,68,.08)', display: 'flex', gap: 8, alignItems: 'center' }}><X size={16} />{error}</div>}
      {loading && !overview ? <div style={{ padding: 60, textAlign: 'center' }}><Loader2 size={25} style={{ color: 'var(--accent)', animation: 'spin .8s linear infinite' }} /></div> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 26 }}>
            <Stat label="Akademiyalar" value={overview?.academies ?? 0} icon={Building2} color="#14B8A8" />
            <Stat label="Faol akademiyalar" value={overview?.active_academies ?? 0} icon={Check} color="#22C55E" />
            <Stat label="O‘quvchilar" value={overview?.students ?? 0} icon={Users} color="#3B82F6" />
            <Stat label="O‘qituvchilar" value={overview?.teachers ?? 0} icon={Shield} color="#F59E0B" />
            <Stat label="Guruhlar" value={overview?.groups ?? 0} icon={Building2} color="#8B5CF6" />
          </div>

          <section style={{ marginBottom: 30 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}><h2 style={{ fontSize: 18, color: 'var(--text)', margin: 0 }}>Akademiyalar</h2><div style={{ position: 'relative', width: 240 }}><Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Qidirish..." style={{ ...input, paddingLeft: 32 }} /></div></div>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}><thead><tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>{['Akademiya','Holat','O‘quvchi','O‘qituvchi','Guruh','Limitlar','Amal'].map(x => <th key={x} style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>{x}</th>)}</tr></thead><tbody>{academies.map(a => <tr key={a.id}><td style={{ padding: 14, color: 'var(--text)', fontWeight: 700 }}>{a.name}<div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>{a.slug}</div></td><td style={{ padding: 14 }}><button type="button" disabled={saving === a.id} onClick={() => updateAcademy(a, { is_active: !a.is_active })} style={{ border: 0, borderRadius: 20, padding: '5px 9px', cursor: 'pointer', color: a.is_active ? '#15803D' : '#B91C1C', background: a.is_active ? '#DCFCE7' : '#FEE2E2', fontSize: 11, fontWeight: 700 }}>{a.is_active ? 'Faol' : 'Bloklangan'}</button></td><td style={{ padding: 14, color: 'var(--text)' }}>{a.students} / {a.limits.students}</td><td style={{ padding: 14, color: 'var(--text)' }}>{a.teachers} / {a.limits.teachers}</td><td style={{ padding: 14, color: 'var(--text)' }}>{a.groups} / {a.limits.groups}</td><td style={{ padding: 14, color: 'var(--text-muted)', fontSize: 12 }}>Invite: {a.limits.invites_per_month}/oy</td><td style={{ padding: 14 }}><div style={{ display: 'flex', gap: 6 }}><input type="number" min="1" defaultValue={a.limits.students} title="O‘quvchi limiti" onBlur={e => Number(e.target.value) !== a.limits.students && updateAcademy(a, { max_students: Number(e.target.value) })} style={{ ...input, width: 68 }} /><input type="number" min="1" defaultValue={a.limits.groups} title="Guruh limiti" onBlur={e => Number(e.target.value) !== a.limits.groups && updateAcademy(a, { max_groups: Number(e.target.value) })} style={{ ...input, width: 68 }} /></div></td></tr>)}</tbody></table></div>
          </section>

          <section style={{ maxWidth: 560, borderTop: '1px solid var(--border)', paddingTop: 24 }}><h2 style={{ fontSize: 18, color: 'var(--text)', margin: '0 0 14px' }}>Superadmin invite yaratish</h2><form onSubmit={createInvite} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><select required value={invite.academy} onChange={e => setInvite({ ...invite, academy: e.target.value })} style={input}><option value="">Akademiyani tanlang</option>{academies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select><select value={invite.role} onChange={e => setInvite({ ...invite, role: e.target.value })} style={input}><option value="student">O‘quvchi</option><option value="teacher">O‘qituvchi</option><option value="admin">Admin</option><option value="parent">Ota-ona</option></select><input type="number" min="1" value={invite.max_uses} onChange={e => setInvite({ ...invite, max_uses: e.target.value })} placeholder="Foydalanish soni" style={input} /><input type="number" min="1" value={invite.days_valid} onChange={e => setInvite({ ...invite, days_valid: e.target.value })} placeholder="Amal qilish kuni" style={input} /><input value={invite.note} onChange={e => setInvite({ ...invite, note: e.target.value })} placeholder="Izoh (ixtiyoriy)" style={{ ...input, gridColumn: '1 / -1' }} /><button type="submit" style={{ gridColumn: '1 / -1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 11, border: 0, borderRadius: 8, background: 'var(--accent)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}><Link2 size={16} /> Invite yaratish</button></form>{createdLink && <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: 'rgba(20,184,168,.1)', color: 'var(--text)', fontSize: 13, wordBreak: 'break-all' }}><strong>Link tayyor:</strong> {createdLink}<button type="button" onClick={() => navigator.clipboard?.writeText(createdLink)} style={{ marginLeft: 8, border: 0, background: 'transparent', color: 'var(--accent)', cursor: 'pointer' }}>Nusxalash</button></div>}</section>
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
