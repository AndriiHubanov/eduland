// ─── Спільні UI компоненти ───

import { RESOURCE_ICONS } from '../store/gameStore'

// Кнопка
export function Button({ children, variant = 'accent', className = '', disabled, onClick, type = 'button', ...props }) {
  const variants = {
    accent: 'btn btn-accent',
    neon:   'btn btn-neon',
    ghost:  'btn btn-ghost',
    gold:   'btn btn-gold',
  }
  return (
    <button
      type={type}
      className={`${variants[variant] || variants.accent} ${className}`}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  )
}

// Картка
export function Card({ children, className = '', glow }) {
  const glowClass = glow === 'accent' ? 'glow-accent' : glow === 'neon' ? 'glow-neon' : glow === 'gold' ? 'glow-gold' : ''
  return (
    <div className={`card ${glowClass} ${className}`}>
      {children}
    </div>
  )
}

// Поле вводу
export function Input({ label, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-semibold uppercase tracking-wider text-[#888]">
          {label}
        </label>
      )}
      <input className="input" {...props} />
    </div>
  )
}

// Ресурс-бейдж (іконка + кількість)
export function ResourceBadge({ resource, amount, showName = false }) {
  const info = RESOURCE_ICONS[resource]
  if (!info) return null
  return (
    <span className="resource-badge" style={{ color: info.color }}>
      <span>{info.icon}</span>
      <span className="font-mono">{amount}</span>
      {showName && <span className="text-[var(--text)]">{info.name}</span>}
    </span>
  )
}

// Рядок всіх ресурсів гравця
export function ResourceBar({ resources, diamonds, className = '' }) {
  const order = ['gold', 'wood', 'stone', 'crystals', 'bits', 'code', 'bio', 'energy']
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {order.filter(r => resources[r] !== undefined && resources[r] > 0).map(r => (
        <ResourceBadge key={r} resource={r} amount={resources[r]} />
      ))}
      {diamonds > 0 && (
        <span className="resource-badge" style={{ color: '#b9f2ff' }}>
          <span>💠</span>
          <span className="font-mono">{diamonds}</span>
        </span>
      )}
    </div>
  )
}

// XP бар
export function XPBar({ progress, current, needed, level }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-[#888]">
        <span>Рівень {level}</span>
        <span className="font-mono">{current}/{needed} XP</span>
      </div>
      <div className="xp-bar">
        <div className="xp-bar-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}

// Лор-банер
export function LoreBanner({ text }) {
  return (
    <div className="lore-banner">
      "{text}"
    </div>
  )
}

// Завантаження
export function Spinner({ text = 'Завантаження...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <div className="w-8 h-8 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
      <span className="text-sm text-[#888] font-mono">{text}</span>
    </div>
  )
}

// Помилка
export function ErrorMsg({ text }) {
  return (
    <div className="p-3 bg-[rgba(255,69,0,0.1)] border border-[var(--accent)] rounded text-sm text-[var(--accent)]">
      {text}
    </div>
  )
}

// Успіх
export function SuccessMsg({ text }) {
  return (
    <div className="p-3 bg-[rgba(0,255,136,0.1)] border border-[var(--neon)] rounded text-sm text-[var(--neon)]">
      {text}
    </div>
  )
}

// Порожній стан
export function EmptyState({ icon, text }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <span className="text-4xl opacity-30">{icon}</span>
      <p className="text-sm text-[#555]">{text}</p>
    </div>
  )
}

// Модальне вікно
export function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      {/* Фон */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      {/* Контент */}
      <div
        className="relative w-full sm:max-w-md bg-[var(--card)] border border-[var(--border)] rounded-t-2xl sm:rounded-xl p-5 z-10 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bebas text-xl text-white tracking-wider">{title}</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-[#555] hover:text-white"
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

// Вкладки (tabs)
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex border-b border-[var(--border)] overflow-x-auto">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`
            px-4 py-2.5 text-sm font-semibold uppercase tracking-wide whitespace-nowrap
            transition-colors border-b-2 -mb-px
            ${active === tab.id
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[#555] hover:text-[var(--text)]'
            }
          `}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

// Нижня навігація
export function BottomNav({ items, active, onChange }) {
  return (
    <nav className="bottom-nav">
      {items.map(item => (
        <button
          key={item.id}
          className={`bottom-nav-item ${active === item.id ? 'active' : ''}`}
          onClick={() => onChange(item.id)}
        >
          <span className="text-lg leading-none">{item.icon}</span>
          <span>{item.label}</span>
          {item.badge > 0 && (
            <span className="absolute top-1 right-1/4 bg-[var(--accent)] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
              {item.badge > 9 ? '9+' : item.badge}
            </span>
          )}
        </button>
      ))}
    </nav>
  )
}
