// ─── WorldMap — Фаза 9: 31 поле з 48г рефрешем ───

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import useGameStore, { HERO_CLASSES, getHeroLevel } from '../store/gameStore'
import { subscribeGroupPlayers } from '../firebase/service'
import { subscribeGroupFields, extractFieldResources, attackFieldRuin, getFieldTimeLeft } from '../firebase/fieldService'
import { RUINS } from '../firebase/ruinService'
import { getFieldVisual, FIELD_TIERS } from '../config/fields'
import { Spinner, BottomNav } from '../components/UI'
import BattleScreen from '../components/BattleScreen'
import { UNITS, getUnitStats } from '../firebase/unitService'

const NAV_ITEMS = [
  { id: 'city',   icon: '🏙️', label: 'Місто'   },
  { id: 'map',    icon: '🗺️', label: 'Карта'   },
  { id: 'tasks',  icon: '⚔️', label: 'Завдання' },
  { id: 'inbox',  icon: '📬', label: 'Пошта'   },
  { id: 'trade',  icon: '🔄', label: 'Торгівля' },
]

// ─── Шанс перемоги проти руїни ────────────────────────────────
function calcWinChance(player, ruinTier) {
  const ruinConfig = RUINS[`tier${ruinTier}`]
  if (!player || !ruinConfig) return null
  const formation = player.army?.formation || []
  if (formation.length === 0) return null

  function armyRating(armyData, heroClass, isRuin = false) {
    let total = 0
    for (const slot of armyData) {
      const unit = UNITS[slot.unitId]
      if (!unit) continue
      const stats = getUnitStats(slot.unitId, slot.level || 1, heroClass)
      if (!stats) continue
      const siegeMult = isRuin && slot.unitId === 'siege_mech' ? 1.5 : 1
      total += (stats.atk * siegeMult + stats.def + stats.hp * 0.1) * (slot.count || 1)
    }
    return total
  }

  const attackerArmy = formation.map(unitId => ({
    unitId,
    count: player.units?.[unitId]?.count || 0,
    level: player.units?.[unitId]?.level || 1,
  })).filter(u => u.count > 0)

  const atkRating = armyRating(attackerArmy, player.heroClass, true)
  const defRating = armyRating(ruinConfig.enemyArmy, null)

  if (atkRating === 0) return 0
  if (defRating === 0) return 100

  const ratio = atkRating / defRating
  const chance = Math.round(100 / (1 + Math.exp(-2.5 * (ratio - 1))))
  return Math.max(5, Math.min(95, chance))
}

// ─── Фільтри ─────────────────────────────────────────────────
const FILTERS = [
  { id: 'all',       label: 'Всі'        },
  { id: 'resource',  label: '⚡ Ресурси'  },
  { id: 'ruin',      label: '🏚️ Руїни'   },
  { id: 'available', label: '✅ Вільні'  },
]

// ─── Головний компонент ───────────────────────────────────────
export default function WorldMap() {
  const navigate = useNavigate()
  const { player, unreadMessages } = useGameStore()

  const [fields, setFields]     = useState([])
  const [players, setPlayers]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const [selected, setSelected] = useState(null)
  const [showLb, setShowLb]     = useState(false)
  const [action, setAction]     = useState(null)
  const [battle, setBattle]     = useState(null)
  const [toast, setToast]       = useState(null)

  useEffect(() => {
    if (!player?.group) return
    const unsub = subscribeGroupFields(player.group, (data) => {
      setFields(data)
      setLoading(false)
    })
    return () => unsub()
  }, [player?.group])

  useEffect(() => {
    if (!player?.group) return
    const unsub = subscribeGroupPlayers(player.group, setPlayers)
    return () => unsub()
  }, [player?.group])

  useEffect(() => {
    if (!player) navigate('/')
  }, [player])

  const showToast = useCallback((type, text) => {
    setToast({ type, text })
    setTimeout(() => setToast(null), 3000)
  }, [])

  function handleNavChange(tabId) {
    const routes = { city: '/city', tasks: '/tasks', inbox: '/inbox', trade: '/trade' }
    if (routes[tabId]) navigate(routes[tabId])
  }

  async function handleExtract(field) {
    if (action) return
    setAction('extracting')
    try {
      const result = await extractFieldResources(player.id, field.id)
      setSelected(null)
      showToast('neon', `+${result.amount} ${result.resource}`)
    } catch (err) {
      showToast('accent', err.message)
    } finally {
      setAction(null)
    }
  }

  async function handleAttack(field) {
    if (action) return
    setAction('attacking')
    try {
      const data = await attackFieldRuin(player.id, field.id)
      setSelected(null)
      setBattle({ field, data })
    } catch (err) {
      showToast('accent', err.message)
    } finally {
      setAction(null)
    }
  }

  if (loading) return <Spinner text="Завантаження карти полів..." />

  const visibleFields = fields.filter(f => {
    if (filter === 'resource')  return f.type === 'resource'
    if (filter === 'ruin')      return f.type === 'ruin'
    if (filter === 'available') return !f.lastOccupiedBy || f.lastOccupiedBy === player?.id
    return true
  })

  const stats = {
    resource: fields.filter(f => f.type === 'resource').length,
    ruin:     fields.filter(f => f.type === 'ruin').length,
    free:     fields.filter(f => !f.lastOccupiedBy).length,
  }

  return (
    <div className="fixed inset-0 bg-[var(--bg)] flex flex-col" style={{ paddingBottom: 56 }}>

      {/* Заголовок */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] shrink-0">
        <div>
          <span className="font-bebas text-lg tracking-widest text-white">КАРТА ПОЛІВ</span>
          <span className="text-xs text-[#444] ml-2 font-mono">{player?.group}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 text-[10px] font-mono">
            <span className="bg-[var(--bg3)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[var(--neon)]">
              ⚡{stats.resource}
            </span>
            <span className="bg-[var(--bg3)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[var(--gold)]">
              🏚️{stats.ruin}
            </span>
            <span className="bg-[var(--bg3)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[#555]">
              ⬜{stats.free}
            </span>
          </div>
          <button
            onClick={() => { setShowLb(true); setSelected(null) }}
            className="text-sm bg-[rgba(255,215,0,0.1)] border border-[rgba(255,215,0,0.25)] text-[var(--gold)] rounded px-2 py-1 font-mono"
          >
            🏆
          </button>
        </div>
      </div>

      {/* Фільтри */}
      <div className="flex gap-1.5 px-3 py-2 overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`
              whitespace-nowrap text-xs font-mono px-2.5 py-1 rounded border transition-colors
              ${filter === f.id
                ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                : 'bg-[var(--bg3)] border-[var(--border)] text-[#666] hover:border-[var(--accent)]'
              }
            `}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Сітка 31 поля */}
      <div className="flex-1 overflow-y-auto px-3 pb-2">
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))' }}>
          {visibleFields.map(field => (
            <FieldTile
              key={field.id}
              field={field}
              currentPlayerId={player?.id}
              onClick={() => { setSelected(field); setShowLb(false) }}
            />
          ))}
        </div>
        {visibleFields.length === 0 && (
          <div className="text-center py-12 text-[#444] text-sm font-mono">
            Немає полів за фільтром
          </div>
        )}
      </div>

      {/* Нижня навігація */}
      <div className="fixed bottom-0 left-0 right-0">
        <BottomNav
          items={NAV_ITEMS.map(item => ({
            ...item,
            badge: item.id === 'inbox' ? unreadMessages : 0,
          }))}
          active="map"
          onChange={handleNavChange}
        />
      </div>

      {/* Toast */}
      {toast && (
        <div className={`
          fixed top-16 left-1/2 -translate-x-1/2 z-50
          px-4 py-2 rounded-xl text-sm font-mono font-semibold
          border shadow-lg animate-slide-up
          ${toast.type === 'neon'
            ? 'bg-[rgba(0,255,136,0.15)] border-[var(--neon)] text-[var(--neon)]'
            : 'bg-[rgba(255,69,0,0.15)] border-[var(--accent)] text-[var(--accent)]'
          }
        `}>
          {toast.text}
        </div>
      )}

      {/* Деталі поля */}
      {selected && !showLb && (
        <FieldDetailPanel
          field={selected}
          player={player}
          winChance={selected.type === 'ruin' ? calcWinChance(player, selected.tier) : null}
          action={action}
          onClose={() => setSelected(null)}
          onExtract={() => handleExtract(selected)}
          onAttack={() => handleAttack(selected)}
        />
      )}

      {/* Рейтинг */}
      {showLb && (
        <LeaderboardPanel
          players={players}
          currentPlayerId={player?.id}
          onClose={() => setShowLb(false)}
        />
      )}

      {/* Бойовий екран */}
      {battle && (
        <BattleScreen
          ruin={battle.field}
          battleData={battle.data}
          onClose={() => setBattle(null)}
        />
      )}
    </div>
  )
}

// ─── Тайл поля ───────────────────────────────────────────────
function FieldTile({ field, currentPlayerId, onClick }) {
  const visual    = getFieldVisual(field)
  const tier      = field.tier ? FIELD_TIERS[field.tier] : null
  const timeLeft  = getFieldTimeLeft(field)
  const isMine    = field.lastOccupiedBy === currentPlayerId
  const isOccupied = Boolean(field.lastOccupiedBy) && !isMine
  const isRuinDead = field.type === 'ruin' && field.ruinHP <= 0

  const borderColor = isRuinDead
    ? '#222'
    : isMine ? 'var(--accent)'
    : field.type !== 'neutral' ? `${visual.color}44`
    : 'var(--border)'

  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-center justify-between rounded-lg border p-2 text-center transition-all duration-150 active:scale-95 hover:border-[var(--accent)]"
      style={{
        background: isRuinDead
          ? 'var(--bg2)'
          : field.type === 'resource'
            ? `rgba(${hexToRgb(visual.color)},0.06)`
            : field.type === 'ruin'
              ? `rgba(${hexToRgb(visual.color)},0.05)`
              : 'var(--bg2)',
        borderColor,
        minHeight: 82,
      }}
    >
      {/* Іконка */}
      <span className="text-[28px] leading-none" style={{ opacity: isRuinDead ? 0.25 : 1 }}>
        {visual.icon}
      </span>

      {/* Назва */}
      <div className="mt-1 w-full space-y-0.5">
        {tier && (
          <div className="text-[9px] font-mono font-bold" style={{ color: tier.color }}>
            {tier.label}
          </div>
        )}
        <div className="text-[9px] font-mono leading-tight text-[#555] truncate px-0.5">
          {truncate(visual.name, 11)}
        </div>
      </div>

      {/* Таймер */}
      {timeLeft && (
        <div className="text-[8px] font-mono text-[#3a3a4a] mt-0.5">⏱ {timeLeft}</div>
      )}

      {/* Мій маркер */}
      {isMine && !isRuinDead && (
        <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
      )}
      {/* Зайнятий */}
      {isOccupied && field.type === 'resource' && (
        <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#444]" />
      )}

      {/* HP bar для руїн */}
      {field.type === 'ruin' && !isRuinDead && field.ruinHP !== null && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] rounded-b overflow-hidden">
          <div
            className="h-full"
            style={{ width: `${field.ruinHP ?? 100}%`, background: visual.color, opacity: 0.7 }}
          />
        </div>
      )}

      {/* Знищено overlay */}
      {isRuinDead && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg">
          <span className="text-[9px] font-mono text-[#333]">знищено</span>
        </div>
      )}
    </button>
  )
}

// ─── Деталі поля ─────────────────────────────────────────────
function FieldDetailPanel({ field, player, winChance, action, onClose, onExtract, onAttack }) {
  const visual     = getFieldVisual(field)
  const tier       = field.tier ? FIELD_TIERS[field.tier] : null
  const timeLeft   = getFieldTimeLeft(field)
  const ruinConfig = field.type === 'ruin' ? RUINS[`tier${field.tier}`] : null
  const isMine     = field.lastOccupiedBy === player?.id
  const isOccupied = Boolean(field.lastOccupiedBy) && !isMine
  const isRuinDead = field.type === 'ruin' && field.ruinHP <= 0
  const hasArmy    = (player?.army?.formation?.length || 0) > 0

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="fixed bottom-[56px] left-0 right-0 z-40 animate-slide-up">
        <div
          className="mx-2 mb-2 rounded-xl border overflow-hidden"
          style={{
            background: 'rgba(12,12,20,0.98)',
            backdropFilter: 'blur(16px)',
            borderColor: `${visual.color}44`,
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Шапка */}
          <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: `${visual.color}22` }}>
            <div className="flex items-center gap-2.5">
              <span className="text-3xl">{visual.icon}</span>
              <div>
                <div className="font-bebas text-[17px] text-white tracking-wide leading-tight">{visual.name}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {tier && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
                      style={{ color: tier.color, borderColor: `${tier.color}44`, background: `${tier.color}11` }}>
                      {tier.label}
                    </span>
                  )}
                  {timeLeft && <span className="text-[10px] font-mono text-[#444]">⏱ {timeLeft}</span>}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-[#555] hover:text-white">✕</button>
          </div>

          <div className="p-3 space-y-3">

            {/* РЕСУРСНЕ */}
            {field.type === 'resource' && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#555]">Ресурс</span>
                  <span style={{ color: visual.color }} className="font-mono">{visual.icon} {field.resourceType}</span>
                </div>
                {field.extractionBonus > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#555]">Бонус</span>
                    <span className="text-[var(--neon)] font-mono">+{field.extractionBonus}%</span>
                  </div>
                )}
                {isMine && (
                  <div className="text-[10px] text-[var(--accent)] font-mono bg-[rgba(255,69,0,0.08)] rounded p-1.5">
                    ✓ Вже видобував в поточному циклі
                  </div>
                )}
                {isOccupied && (
                  <div className="text-[10px] text-[#555] font-mono bg-[var(--bg3)] rounded p-1.5">
                    ⚠ Зайнято іншим гравцем
                  </div>
                )}
              </>
            )}

            {/* РУЇНА */}
            {field.type === 'ruin' && ruinConfig && (
              <>
                {!isRuinDead && (
                  <div>
                    <div className="flex items-center justify-between text-xs font-mono mb-1">
                      <span className="text-[#555]">HP руїни</span>
                      <span style={{ color: visual.color }}>{field.ruinHP ?? 100}%</span>
                    </div>
                    <div className="h-2 bg-[var(--bg)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${field.ruinHP ?? 100}%`, background: visual.color }} />
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-[10px] text-[#444] uppercase tracking-wider mb-1.5">Охорона</p>
                  <div className="flex flex-wrap gap-1">
                    {ruinConfig.enemyArmy?.map((u, i) => {
                      const unit = UNITS[u.unitId]
                      return (
                        <span key={i} className="text-[10px] bg-[var(--bg3)] border border-[var(--border)] rounded px-1.5 py-0.5 font-mono">
                          {unit?.icon} ×{u.count} рів.{u.level}
                        </span>
                      )
                    })}
                  </div>
                </div>

                {hasArmy && winChance !== null && !isRuinDead && (
                  <div>
                    <div className="flex items-center justify-between text-xs font-mono mb-1">
                      <span className="text-[#555]">Шанс перемоги</span>
                      <span style={{ color: winChance >= 65 ? 'var(--neon)' : winChance >= 40 ? 'var(--gold)' : 'var(--accent)' }}>
                        {winChance}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{
                        width: `${winChance}%`,
                        background: winChance >= 65 ? 'var(--neon)' : winChance >= 40 ? 'var(--gold)' : 'var(--accent)',
                      }} />
                    </div>
                    <div className="text-[10px] text-[#444] mt-1 text-right">
                      {winChance >= 75 ? 'Висока перевага' : winChance >= 50 ? 'Рівний бій' : winChance >= 30 ? 'Ризиковано' : 'Дуже небезпечно'}
                    </div>
                  </div>
                )}

                {isRuinDead && (
                  <p className="text-center text-xs text-[#333] font-mono">Руїну знищено — відновиться при рефреші</p>
                )}
              </>
            )}

            {/* НЕЙТРАЛЬНЕ */}
            {field.type === 'neutral' && (
              <p className="text-xs text-[#444] text-center py-1">
                Нейтральна зона. Активується після наступного рефрешу.
              </p>
            )}
          </div>

          {/* Кнопки */}
          <div className="px-3 pb-3">
            {field.type === 'resource' && !isMine && !isOccupied && (
              <button className="w-full btn btn-neon text-sm" disabled={!!action} onClick={onExtract}>
                {action === 'extracting' ? '⛏️ Видобуваємо...' : '⛏️ ВИДОБУТИ РЕСУРСИ'}
              </button>
            )}
            {field.type === 'ruin' && !isRuinDead && (
              !hasArmy
                ? <p className="text-center text-xs text-[var(--accent)]">Сформуй армію в місті перед атакою</p>
                : <button className="w-full btn btn-accent text-sm" disabled={!!action} onClick={onAttack}>
                    {action === 'attacking' ? '⚔️ Бій...' : '⚔️ АТАКУВАТИ РУЇНУ'}
                  </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Рейтинг ─────────────────────────────────────────────────
function LeaderboardPanel({ players, currentPlayerId, onClose }) {
  const sorted     = [...players].sort((a, b) => (b.heroXP || 0) - (a.heroXP || 0))
  const rankColors = ['text-[var(--gold)]', 'text-[#aaa]', 'text-[#cd7f32]']

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="fixed bottom-[56px] left-0 right-0 z-40 animate-slide-up">
        <div className="mx-2 mb-2 rounded-xl border border-[var(--border)] overflow-hidden"
          style={{ background: 'rgba(12,12,20,0.98)', backdropFilter: 'blur(16px)' }}
          onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-3 border-b border-[var(--border)]">
            <span className="font-bebas text-lg tracking-widest text-[var(--gold)]">🏆 РЕЙТИНГ</span>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-[#555] hover:text-white">✕</button>
          </div>
          <div className="overflow-y-auto max-h-60 divide-y divide-[var(--border)]">
            {sorted.map((p, i) => {
              const cls   = HERO_CLASSES[p.heroClass] || HERO_CLASSES.guardian
              const level = getHeroLevel(p.heroXP || 0)
              const isOwn = p.id === currentPlayerId
              return (
                <div key={p.id} className={`flex items-center gap-3 px-3 py-2 ${isOwn ? 'bg-[rgba(255,69,0,0.06)]' : ''}`}>
                  <span className={`font-bebas text-lg w-6 text-center ${rankColors[i] || 'text-[#444]'}`}>{i + 1}</span>
                  <span className="text-xl w-7 text-center">{cls.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold text-sm truncate ${isOwn ? 'text-[var(--accent)]' : 'text-white'}`}>{p.heroName}</div>
                    <div className="text-xs text-[#555] truncate">{p.name}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-sm text-[var(--gold)]">Рів.{level}</div>
                    <div className="text-[10px] text-[#444] font-mono">{p.heroXP || 0} XP</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Утиліти ─────────────────────────────────────────────────
function truncate(str, len) {
  return str && str.length > len ? str.slice(0, len) + '…' : str
}

function hexToRgb(hex) {
  if (!hex || hex.length < 7) return '128,128,128'
  const r = parseInt(hex.slice(1, 3), 16) || 128
  const g = parseInt(hex.slice(3, 5), 16) || 128
  const b = parseInt(hex.slice(5, 7), 16) || 128
  return `${r},${g},${b}`
}
