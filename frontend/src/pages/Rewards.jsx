import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Gift, Plus, Minus, Loader2, Coins, Pencil, Trash2, ShoppingCart, Receipt, Copy, Check } from 'lucide-react'
import { getRewards, createReward, updateReward, deleteReward } from '../api/rewards'
import { purchaseReward, getMyPurchases } from '../api/purchases'
import { getMyBalance } from '../api/coins'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Modal from '../components/ui/Modal'
import { CardSkeleton } from '../components/ui/Skeleton'
import { formatDate } from '../utils/date'

const CATEGORIES = ['snack', 'stationery', 'merch', 'discount', 'coupon', 'other']
const NAME_MAX_LENGTH = 40
const DESCRIPTION_MAX_LENGTH = 100

const BADGE_COLORS = {
  'badge-soon':    '#F59E0B',
  'badge-soldout': '#DC2626',
  'badge-low':     '#0EA5E9',
}

export default function Rewards() {
  const { user } = useAuth()
  const { show }  = useToast()
  const { t }     = useTranslation()
  const isAdmin   = user?.role === 'admin'
  const isStudent = user?.role === 'student'

  const [rewards, setRewards]             = useState([])
  const [loading, setLoading]             = useState(true)
  const [showCreate, setShowCreate]       = useState(false)
  const [editingReward, setEditingReward] = useState(null)
  const [category, setCategory]           = useState('all')
  const [view, setView]                   = useState('shop') // 'shop' | 'mine'
  const [balance, setBalance]             = useState(null)
  const [buyingReward, setBuyingReward]   = useState(null)
  const [receipt, setReceipt]             = useState(null)
  const [myPurchases, setMyPurchases]     = useState([])
  const [purchasesLoading, setPurchasesLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    getRewards().then(r => setRewards(r.data)).catch(() => show(t('rewards.toast_load_fail'), 'error')).finally(() => setLoading(false))
  }, [show, t])
  useEffect(load, [load])

  const loadBalance = () => {
    if (!isStudent) return
    getMyBalance().then(r => setBalance(r.data.balance)).catch(() => {})
  }
  useEffect(loadBalance, [isStudent])

  const loadMyPurchases = () => {
    setPurchasesLoading(true)
    getMyPurchases().then(r => setMyPurchases(r.data)).catch(() => {}).finally(() => setPurchasesLoading(false))
  }
  useEffect(() => { if (isStudent && view === 'mine') loadMyPurchases() }, [isStudent, view])

  const handlePurchased = (purchase, quantity) => {
    setRewards(rs => rs.map(r => r.id === buyingReward.id ? { ...r, stock: r.stock - quantity } : r))
    setBalance(b => (b ?? 0) - purchase.total_price)
    setBuyingReward(null)
    setReceipt(purchase)
    show(t('rewards.toast_purchased'), 'success')
  }

  const counts = useMemo(() => {
    const c = { all: rewards.length }
    CATEGORIES.forEach(cat => { c[cat] = rewards.filter(r => r.category === cat).length })
    return c
  }, [rewards])

  const visible = useMemo(
    () => category === 'all' ? rewards : rewards.filter(r => r.category === category),
    [rewards, category]
  )

  const handleSaved = (saved, wasEdit) => {
    if (wasEdit) {
      setRewards(rs => rs.map(r => r.id === saved.id ? saved : r))
      show(t('rewards.toast_updated'), 'success')
    } else {
      setRewards(rs => [saved, ...rs])
      show(t('rewards.toast_created'), 'success')
    }
    setShowCreate(false)
    setEditingReward(null)
  }

  const handleDelete = async (id) => {
    try {
      await deleteReward(id)
      setRewards(rs => rs.filter(r => r.id !== id))
      show(t('rewards.toast_deleted'), 'success')
    } catch {
      show(t('rewards.toast_delete_fail'), 'error')
    }
  }

  return (
    <div>
      <div className="page-section-hd" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, marginBottom: 4 }}>{t('rewards.title')}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('rewards.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isStudent && (
            <>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 15, color: 'var(--accent)', background: 'var(--accent-bg)', borderRadius: 8, padding: '7px 14px' }}>
                <Coins size={15} color="var(--accent)" fill="var(--accent)" /> {balance ?? '—'}
              </span>
              <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 7, overflow: 'hidden' }}>
                <button onClick={() => setView('shop')}
                  style={{ padding: '8px 14px', border: 'none', background: view === 'shop' ? 'var(--accent)' : 'var(--surface)', color: view === 'shop' ? '#fff' : 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {t('rewards.view_shop')}
                </button>
                <button onClick={() => setView('mine')}
                  style={{ padding: '8px 14px', border: 'none', borderLeft: '1px solid var(--border)', background: view === 'mine' ? 'var(--accent)' : 'var(--surface)', color: view === 'mine' ? '#fff' : 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {t('rewards.view_mine')}
                </button>
              </div>
            </>
          )}
          {isAdmin && (
            <motion.button whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} onClick={() => setShowCreate(true)} style={primaryBtn}>
              <Plus size={15} /> {t('rewards.add_button')}
            </motion.button>
          )}
        </div>
      </div>

      {isStudent && view === 'mine' ? (
        <MyPurchasesList purchases={myPurchases} loading={purchasesLoading} onOpenReceipt={setReceipt} />
      ) : (
        <>
      {!loading && rewards.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {[{ key: 'all', label: t('rewards.cat_all') }, ...CATEGORIES.map(cat => ({ key: cat, label: t(`rewards.cat_${cat}`) }))].map(tab => {
            const on = category === tab.key
            return (
              <button key={tab.key} onClick={() => setCategory(tab.key)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: 999, border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                  background: on ? 'var(--accent)' : 'var(--surface)', color: on ? '#fff' : 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
                {tab.label}
                <span style={{ fontSize: 11, fontWeight: 700, minWidth: 18, textAlign: 'center', padding: '1px 6px', borderRadius: 999,
                  background: on ? 'rgba(255,255,255,0.25)' : 'color-mix(in srgb, var(--accent) 14%, transparent)',
                  color: on ? '#fff' : 'var(--accent)' }}>{counts[tab.key] ?? 0}</span>
              </button>
            )
          })}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 18 }}>
          {[0, 1, 2, 3].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState hasAny={rewards.length > 0} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 18 }}>
          {visible.map((r, i) => (
            <RewardCard key={r.id} reward={r} index={i} isAdmin={isAdmin} isStudent={isStudent} balance={balance}
              onEdit={() => setEditingReward(r)} onDelete={() => handleDelete(r.id)} onBuy={() => setBuyingReward(r)} />
          ))}
        </div>
      )}
        </>
      )}

      <RewardFormModal open={showCreate || !!editingReward} reward={editingReward}
        onClose={() => { setShowCreate(false); setEditingReward(null) }}
        onSaved={handleSaved} />

      <BuyModal reward={buyingReward} balance={balance} onClose={() => setBuyingReward(null)} onPurchased={handlePurchased} />
      <ReceiptModal purchase={receipt} onClose={() => setReceipt(null)} />
    </div>
  )
}

function RewardCard({ reward, index, isAdmin, isStudent, balance, onEdit, onDelete, onBuy }) {
  const { t } = useTranslation()
  const [confirm, setConfirm] = useState(false)
  const isSoldOut  = reward.status === 'available' && reward.stock <= 0
  const isInactive = reward.status === 'coming_soon' || isSoldOut
  const badgeColor = reward.badge ? BADGE_COLORS[reward.badge.kind] : null
  const canBuy = isStudent && reward.status === 'available' && reward.stock > 0
  const canAfford = balance == null || balance >= reward.price

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
      whileHover={!isInactive ? { y: -3, boxShadow: 'var(--shadow-lg)' } : {}}
      style={{
        position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
        padding: 20, textAlign: 'center', boxShadow: 'var(--shadow-sm)', transition: 'box-shadow 0.2s',
        opacity: isInactive ? 0.55 : 1, filter: isInactive ? 'grayscale(45%)' : 'none',
      }}>
      {reward.badge && (
        <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, color: '#fff', background: badgeColor }}>
          {reward.badge.label}
        </span>
      )}
      {reward.image ? (
        <img src={reward.image} alt={reward.name} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10, marginBottom: 10 }} />
      ) : (
        <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 10 }}>{reward.icon || '🎁'}</div>
      )}
      <p style={{
        fontWeight: 700, fontSize: 15, marginBottom: 4, width: '100%',
        overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
      }}>{reward.name}</p>
      <p style={{
        fontSize: 12, color: 'var(--text-muted)', width: '100%', minHeight: 32, marginBottom: 10,
        overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>{reward.description}</p>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 800, fontSize: 16, color: 'var(--accent)', background: 'var(--accent-bg)', borderRadius: 8, padding: '4px 12px', marginTop: 'auto' }}>
        <Coins size={14} color="var(--accent)" fill="var(--accent)" /> {reward.price}
      </span>

      {isAdmin && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 14 }}>
          {confirm ? (
            <>
              <button onClick={onDelete} style={{ ...dangerBtn, padding: '4px 10px', fontSize: 12 }}>{t('rewards.delete_confirm')}</button>
              <button onClick={() => setConfirm(false)} style={{ ...ghostBtn, padding: '4px 10px', fontSize: 12 }}>{t('rewards.cancel')}</button>
            </>
          ) : (
            <>
              <button onClick={onEdit} title={t('rewards.edit_reward')} style={iconActionBtn}><Pencil size={13} color="var(--text-muted)" /></button>
              <button onClick={() => setConfirm(true)} title={t('rewards.delete_reward')} style={iconActionBtn}><Trash2 size={13} color="var(--text-muted)" /></button>
            </>
          )}
        </div>
      )}

      {canBuy && (
        <motion.button whileHover={canAfford ? { translateY: -1 } : {}} whileTap={canAfford ? { scale: 0.97 } : {}}
          onClick={onBuy} disabled={!canAfford}
          style={{ ...primaryBtn, marginTop: 14, width: '100%', justifyContent: 'center', opacity: canAfford ? 1 : 0.5, cursor: canAfford ? 'pointer' : 'not-allowed' }}>
          <ShoppingCart size={14} /> {t(canAfford ? 'rewards.buy_button' : 'rewards.not_enough')}
        </motion.button>
      )}
    </motion.div>
  )
}

function EmptyState({ hasAny }) {
  const { t } = useTranslation()
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', paddingTop: 60, paddingBottom: 60 }}>
      <div style={{ width: 64, height: 64, background: 'var(--accent-bg)', border: '1px solid var(--accent)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
        <Gift size={28} color="var(--accent)" />
      </div>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{t('rewards.no_rewards')}</h3>
      {!hasAny && <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('rewards.no_rewards_sub')}</p>}
    </motion.div>
  )
}

const emptyForm = { name: '', description: '', icon: '', price: '', stock: 0, category: 'other', status: 'coming_soon' }

function RewardFormModal({ open, reward, onClose, onSaved }) {
  const { show } = useToast(); const { t } = useTranslation()
  const isEdit = !!reward
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')

  useEffect(() => {
    if (open) {
      setForm(reward
        ? { name: reward.name, description: reward.description || '', icon: reward.icon || '', price: reward.price, stock: reward.stock, category: reward.category, status: reward.status }
        : emptyForm)
      setImageFile(null)
      setImagePreview(reward?.image || '')
      setError('')
    }
  }, [open, reward])

  const handleImageChange = e => {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const submit = async e => {
    e.preventDefault()
    if (!form.name.trim()) { setError(t('rewards.err_name_required')); return }
    if (!form.price || Number(form.price) <= 0) { setError(t('rewards.err_price_required')); return }
    setLoading(true)
    try {
      let data
      if (imageFile) {
        const fd = new FormData()
        fd.append('name', form.name)
        fd.append('description', form.description)
        fd.append('icon', form.icon)
        fd.append('price', Number(form.price))
        fd.append('stock', Number(form.stock) || 0)
        fd.append('category', form.category)
        fd.append('status', form.status)
        fd.append('image', imageFile)
        const res = isEdit ? await updateReward(reward.id, fd) : await createReward(fd)
        data = res.data
      } else {
        const payload = { ...form, price: Number(form.price), stock: Number(form.stock) || 0 }
        const res = isEdit ? await updateReward(reward.id, payload) : await createReward(payload)
        data = res.data
      }
      onSaved(data, isEdit)
    } catch {
      show(t(isEdit ? 'rewards.toast_update_fail' : 'rewards.toast_create_fail'), 'error')
    } finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={t(isEdit ? 'rewards.edit_modal_title' : 'rewards.create_modal_title')}>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('rewards.name_label')} <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>{form.name.length}/{NAME_MAX_LENGTH}</span></label>
          <input style={{ ...inputStyle(!!error), marginTop: 6 }} value={form.name} maxLength={NAME_MAX_LENGTH}
            onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setError('') }} autoFocus />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('rewards.icon_label')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('rewards.icon_optional')}</span></label>
          <input style={{ ...inputStyle(false), marginTop: 6, maxWidth: 100 }} maxLength={8} placeholder="🎁"
            value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('rewards.image_label')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('rewards.icon_optional')}</span></label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
            {imagePreview && (
              <img src={imagePreview} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }} />
            )}
            <input type="file" accept="image/*" onChange={handleImageChange} style={{ fontSize: 13, color: 'var(--text-muted)' }} />
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('rewards.description_label')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('rewards.description_optional')}</span></label>
          <textarea style={{ ...inputStyle(false), marginTop: 6, resize: 'vertical', minHeight: 64 }} maxLength={DESCRIPTION_MAX_LENGTH}
            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t('rewards.price_label')}</label>
            <input type="number" min={1} style={{ ...inputStyle(!!error), marginTop: 6 }}
              value={form.price} onChange={e => { setForm(f => ({ ...f, price: e.target.value })); setError('') }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t('rewards.stock_label')}</label>
            <input type="number" min={0} style={{ ...inputStyle(false), marginTop: 6 }}
              value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} />
          </div>
        </div>
        {error && <p style={errorStyle}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, marginTop: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t('rewards.category_label')}</label>
            <select style={{ ...inputStyle(false), marginTop: 6 }} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(cat => <option key={cat} value={cat}>{t(`rewards.cat_${cat}`)}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t('rewards.status_label')}</label>
            <select style={{ ...inputStyle(false), marginTop: 6 }} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="coming_soon">{t('rewards.status_coming_soon')}</option>
              <option value="available">{t('rewards.status_available')}</option>
              <option value="hidden">{t('rewards.status_hidden')}</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
          <button type="button" onClick={onClose} style={ghostBtn}>{t('rewards.cancel')}</button>
          <motion.button type="submit" disabled={loading} whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }} style={{ ...primaryBtn, opacity: loading ? 0.7 : 1 }}>
            {loading && <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />}
            {loading ? t('rewards.creating') : t(isEdit ? 'rewards.save_btn' : 'rewards.create_btn')}
          </motion.button>
        </div>
      </form>
    </Modal>
  )
}

function BuyModal({ reward, balance, onClose, onPurchased }) {
  const { t } = useTranslation()
  const { show } = useToast()
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (reward) setQuantity(1) }, [reward])

  if (!reward) return null
  const maxAffordable = balance == null ? reward.stock : Math.max(0, Math.floor(balance / reward.price))
  const maxQuantity = Math.max(1, Math.min(reward.stock, maxAffordable))
  const total = reward.price * quantity
  const remaining = (balance ?? 0) - total

  const submit = async () => {
    setLoading(true)
    try {
      const res = await purchaseReward(reward.id, quantity)
      onPurchased(res.data, quantity)
    } catch (err) {
      show(err?.response?.data?.detail || t('rewards.toast_purchase_fail'), 'error')
    } finally { setLoading(false) }
  }

  return (
    <Modal open={!!reward} onClose={onClose} title={t('rewards.buy_modal_title')}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        {reward.image ? (
          <img src={reward.image} alt={reward.name} style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8 }} />
        ) : (
          <div style={{ fontSize: 36, lineHeight: 1 }}>{reward.icon || '🎁'}</div>
        )}
        <div>
          <p style={{ fontWeight: 700, fontSize: 15 }}>{reward.name}</p>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
            <Coins size={12} color="var(--accent)" fill="var(--accent)" /> {reward.price} {t('rewards.each')}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>{t('rewards.quantity_label')}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8 }}>
          <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1} style={{ ...iconActionBtn, opacity: quantity <= 1 ? 0.4 : 1 }}>
            <Minus size={14} />
          </button>
          <span style={{ fontSize: 18, fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{quantity}</span>
          <button type="button" onClick={() => setQuantity(q => Math.min(maxQuantity, q + 1))} disabled={quantity >= maxQuantity} style={{ ...iconActionBtn, opacity: quantity >= maxQuantity ? 0.4 : 1 }}>
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 13 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ color: 'var(--text-muted)' }}>{t('rewards.total_label')}</span>
          <span style={{ fontWeight: 700 }}>{total}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)' }}>{t('rewards.remaining_balance')}</span>
          <span style={{ fontWeight: 700, color: remaining < 0 ? 'var(--danger)' : 'var(--text)' }}>{remaining}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose} style={ghostBtn}>{t('rewards.cancel')}</button>
        <motion.button type="button" disabled={loading || remaining < 0} whileHover={{ translateY: -1 }} whileTap={{ scale: 0.97 }}
          onClick={submit} style={{ ...primaryBtn, opacity: loading || remaining < 0 ? 0.6 : 1 }}>
          {loading && <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />}
          {loading ? t('rewards.buying') : t('rewards.confirm_buy')}
        </motion.button>
      </div>
    </Modal>
  )
}

function ReceiptModal({ purchase, onClose }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  if (!purchase) return null

  const copyCode = () => {
    navigator.clipboard?.writeText(purchase.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Modal open={!!purchase} onClose={onClose} title={t('rewards.receipt_title')}>
      <div style={{ textAlign: 'center' }}>
        {purchase.reward_image ? (
          <img src={purchase.reward_image} alt={purchase.reward_name} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 10, margin: '0 auto 10px' }} />
        ) : (
          <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 10 }}>{purchase.reward_icon || '🎁'}</div>
        )}
        <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{purchase.reward_name}</p>
        <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
          {purchase.quantity} × {purchase.price_at_order} = {purchase.total_price} <Coins size={13} color="var(--text-muted)" />
        </p>

        <div style={{ background: 'var(--bg)', border: '1.5px dashed var(--border)', borderRadius: 12, padding: '18px 12px', marginBottom: 16 }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{t('rewards.code_label')}</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '0.15em', fontFamily: 'monospace' }}>{purchase.code}</span>
            <button type="button" onClick={copyCode} style={iconActionBtn} title={t('rewards.copy_code')}>
              {copied ? <Check size={14} color="var(--accent)" /> : <Copy size={14} color="var(--text-muted)" />}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
          <StatusBadge status={purchase.status} t={t} />
          {purchase.expires_at && purchase.status === 'active' && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>
              {t('rewards.expires_on')} {formatDate(purchase.expires_at)}
            </span>
          )}
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 20 }}>{t('rewards.receipt_disclaimer')}</p>

        <button type="button" onClick={onClose} style={{ ...primaryBtn, width: '100%', justifyContent: 'center' }}>{t('rewards.close')}</button>
      </div>
    </Modal>
  )
}

function StatusBadge({ status, t }) {
  const colors = { active: '#0EA5E9', issued: '#16A34A', expired: '#DC2626' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, color: '#fff', background: colors[status] || 'var(--text-muted)' }}>
      {t(`rewards.status_${status}_purchase`)}
    </span>
  )
}

function MyPurchasesList({ purchases, loading, onOpenReceipt }) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Loader2 size={22} style={{ animation: 'spin 0.7s linear infinite', color: 'var(--text-muted)' }} />
      </div>
    )
  }

  if (purchases.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', paddingTop: 60, paddingBottom: 60 }}>
        <div style={{ width: 64, height: 64, background: 'var(--accent-bg)', border: '1px solid var(--accent)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Receipt size={28} color="var(--accent)" />
        </div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{t('rewards.no_purchases')}</h3>
      </motion.div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {purchases.map((p, i) => {
        const clickable = p.status === 'active'
        return (
          <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            onClick={clickable ? () => onOpenReceipt(p) : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '12px 16px', cursor: clickable ? 'pointer' : 'default',
            }}>
            {p.reward_image ? (
              <img src={p.reward_image} alt={p.reward_name} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
            ) : (
              <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{p.reward_icon || '🎁'}</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{p.reward_name} {p.quantity > 1 && `× ${p.quantity}`}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{p.code}</p>
            </div>
            <StatusBadge status={p.status} t={t} />
          </motion.div>
        )
      })}
    </div>
  )
}

const primaryBtn    = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
const ghostBtn       = { padding: '8px 16px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const dangerBtn       = { padding: '8px 16px', borderRadius: 7, border: 'none', background: 'var(--danger)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const iconActionBtn = { width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }
const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }
const errorStyle = { fontSize: 12, color: 'var(--danger)', marginTop: 4 }
const inputStyle = (hasError) => ({ width: '100%', padding: '9px 12px', borderRadius: 7, border: `1.5px solid ${hasError ? 'var(--danger)' : 'var(--border)'}`, background: 'var(--bg)', color: 'var(--text)', fontSize: 14, outline: 'none', fontFamily: 'var(--font-body)', display: 'block', boxSizing: 'border-box' })
