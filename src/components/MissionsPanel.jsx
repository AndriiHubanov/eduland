// ─── MissionsPanel ───
// Місії: щоденні / тижневі / сюжетні / досягнення

import { useState, useEffect } from 'react'
import { MISSION_TYPES } from '../firebase/missionService'
import { RESOURCE_ICONS } from '../store/gameStore'

// Словник іконок для типів місій
const TYPE_TABS = [
  { id: 'daily',       label: '📅 Щоденні'    },
  { id: 'weekly',      label: '📆 Тижневі'     },
  { id: 'story',       label: '📖 Сюжет'       },
  { id: 'achievement', label: '🏆 Досягнення'  },
]

export default function MissionsPanel({ missions, onClaim, onClose }) {
  const [tab, setTab] = useState('daily')

  // Групуємо місії по типу
  const byType = {}
  for (const m of missions) {
    if (!byType[m.type]) byType[m.type] = []
    byType[m.type].push(m)
  }

  // Кількість готових до забирання
  const readyCount = missions.filter(m => m.status === 'completed').length

  const filtered = byType[tab] || []

  return (
    <>
      {/* Фон */}
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Панель */}
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up" style={{ maxHeight: '90vh' }}>
        <div
          className="bg-[var(--card)] border-t border-[var(--border)] rounded-t-2xl flex flex-col"
          style={{ maxHeight: '90vh' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Заголовок */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
            <div>
              <h2 className="font-bebas text-xl tracking-widest text-white">МІСІЇ</h2>
              {readyCount > 0 && (
                <span className="text-xs font-mono text-[var(--neon)]">
                  {readyCount} готових до забирання!
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-[#555] hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Вкладки */}
          <div className="flex gap-0 border-b border-[var(--border)] shrink-0 overflow-x-auto">
            {TYPE_TABS.map(t => {
              const count = byType[t.id]?.length || 0
              const readyInTab = (byType[t.id] || []).filter(m => m.status === 'completed').length
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 min-w-0 px-2 py-2.5 text-xs font-mono transition-all whitespace-nowrap
                    ${tab === t.id
                      ? 'border-b-2 border-[var(--neon)] text-white'
                      : 'text-[#555] hover:text-[#888]'
                    }`}
                >
                  {t.label}
                  {count > 0 && (
                    <span className={`ml-1 text-[10px] px-1 rounded ${readyInTab > 0 ? 'text-[var(--neon)]' : 'text-[#444]'}`}>
                      {readyInTab > 0 ? `+${readyInTab}` : count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Список місій */}
          <div className="flex-1 overflow-y-auto p-3 pb-6 flex flex-col gap-2">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <span className="text-4xl opacity-30">
                  {MISSION_TYPES[tab]?.icon || '📋'}
                </span>
                <p className="text-sm text-[#555]">Місій цього типу немає</p>
              </div>
            ) : (
              filtered.map(mission => (
                <MissionCard
                  key={mission.id}
                  mission={mission}
                  onClaim={onClaim}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Картка місії ─────────────────────────────────────────────
function MissionCard({ mission, onClaim }) {
  const [claiming, setClaiming] = useState(false)

  const progress = mission.progress || 0
  const target   = mission.target || 1
  const pct      = Math.min(100, Math.round((progress / target) * 100))

  const statusColor = {
    active:    '#555',
    completed: 'var(--neon)',
    claimed:   '#444',
  }[mission.status] || '#555'

  const isCompleted = mission.status === 'completed'
  const isClaimed   = mission.status === 'claimed'

  // Таймер до кінця (для daily/weekly)
  const [timeLeft, setTimeLeft] = useState('')
  useEffect(() => {
    if (!mission.expiresAt) return
    function calc() {
      const expires = mission.expiresAt?.toDate?.() || new Date(mission.expiresAt)
      const diff = expires.getTime() - Date.now()
      if (diff <= 0) { setTimeLeft('Час вийшов'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setTimeLeft(`${h}г ${m}хв`)
    }
    calc()
    const id = setInterval(calc, 60000)
    return () => clearInterval(id)
  }, [mission.expiresAt])

  async function handleClaim() {
    if (claiming) return
    setClaiming(true)
    try {
      await onClaim(mission.id)
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div
      className={`rounded-lg border p-3 transition-all ${
        isCompleted
          ? 'border-[rgba(0,255,136,0.3)] bg-[rgba(0,255,136,0.05)]'
          : isClaimed
            ? 'border-[var(--border)] bg-[var(--bg3)] opacity-50'
            : 'border-[var(--border)] bg-[var(--bg3)]'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Іконка досягнення */}
        {mission.type === 'achievement' && mission.icon && (
          <span className="text-xl shrink-0 mt-0.5">{mission.icon}</span>
        )}

        <div className="flex-1 min-w-0">
          {/* Заголовок */}
          <div className="flex items-center gap-2 mb-0.5">
            {mission.chapter && (
              <span className="text-[10px] font-mono text-[var(--gold)] shrink-0">
                Гл.{mission.chapter}
              </span>
            )}
            <span className={`font-semibold text-sm truncate ${isClaimed ? 'text-[#555]' : 'text-white'}`}>
              {mission.title}
            </span>
          </div>

          <p className="text-xs text-[#666] mb-2 leading-relaxed">{mission.description}</p>

          {/* Прогрес-бар */}
          {!isClaimed && (
            <div className="mb-2">
              <div className="flex justify-between text-[10px] font-mono mb-1" style={{ color: statusColor }}>
                <span>{progress} / {target}</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: isCompleted ? 'var(--neon)' : 'var(--border)',
                  }}
                />
              </div>
            </div>
          )}

          {/* Нагорода */}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-2">
            {Object.entries(mission.reward || {}).map(([res, amt]) => {
              const info = RESOURCE_ICONS[res]
              return (
                <span key={res} className="text-xs font-mono text-[#888]">
                  {info?.icon || res} +{amt}
                </span>
              )
            })}
            {mission.xpReward > 0 && (
              <span className="text-xs font-mono text-[var(--gold)]">⭐ +{mission.xpReward} XP</span>
            )}
            {mission.diamondReward > 0 && (
              <span className="text-xs font-mono text-[#b9f2ff]">💠 +{mission.diamondReward}</span>
            )}
          </div>

          {/* Лор-текст для сюжетних (тільки завершені) */}
          {isCompleted && mission.loreText && (
            <p className="text-xs text-[var(--gold)] italic border-l-2 border-[var(--gold)] pl-2 mb-2 leading-relaxed">
              {mission.loreText}
            </p>
          )}
        </div>
      </div>

      {/* Кнопка/статус */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] font-mono text-[#444]">
          {mission.expiresAt && !isClaimed ? timeLeft : ''}
        </span>

        {isCompleted && (
          <button
            className="btn btn-neon text-xs py-1 px-4"
            disabled={claiming}
            onClick={handleClaim}
          >
            {claiming ? '...' : '✓ ЗАБРАТИ'}
          </button>
        )}
        {isClaimed && (
          <span className="text-xs font-mono text-[#444]">✓ Отримано</span>
        )}
      </div>
    </div>
  )
}
