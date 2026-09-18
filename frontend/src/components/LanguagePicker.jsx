import { Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const LANGS = [
  { code: 'uz', label: "O'zbek" },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
]

export default function LanguagePicker({ compact = false }) {
  const { i18n, t } = useTranslation()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 4 : 7 }} aria-label={t('nav.language')}>
      <Globe size={compact ? 14 : 16} color="var(--text-muted)" />
      {LANGS.map(lang => (
        <button key={lang.code} type="button" onClick={() => i18n.changeLanguage(lang.code)}
          aria-pressed={i18n.language === lang.code} title={lang.label}
          style={{ minWidth: compact ? 34 : 46, padding: compact ? '5px 6px' : '6px 8px', borderRadius: 8,
            border: `1px solid ${i18n.language === lang.code ? 'var(--accent)' : 'var(--border)'}`,
            background: i18n.language === lang.code ? 'rgba(20,184,168,0.12)' : 'transparent',
            color: i18n.language === lang.code ? 'var(--accent)' : 'var(--text-muted)', fontSize: 11,
            fontWeight: 700, cursor: 'pointer' }}>
          {lang.code.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
