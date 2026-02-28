// ─── WorldMap — Фаза 10: Місії на поля з таймерами ───

import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useGameStore, { HERO_CLASSES, getHeroLevel } from '../store/gameStore'
import { subscribeGroupPlayers } from '../firebase/service'
import { subscribeGroupFields, getFieldTimeLeft } from '../firebase/fieldService'
import {
  subscribePlayerExpeditions, subscribeGroupExpeditions,
  startExpedition, resolveExpeditionIfReady, claimExpedition,
  forceRefreshField,
} from '../firebase/expeditionService'
import { RUINS } from '../firebase/ruinService'
import { getFieldVisual, FIELD_TIERS } from '../config/fields'
import { LAB_BUILDINGS, formatCountdown } from '../config/labs'
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

const FILTERS = [
  { id: 'all',       label: 'Всі'        },
  { id: 'resource',  label: '⚡ Ресурси'  },
  { id: 'ruin',      label: '🏚️ Руїни'   },
  { id: 'available', label: '✅ Вільні'  },
  { id: 'mine',      label: '📌 Мої'     },
]

// ─── Шанс перемоги ───────────────────────────────────────────
function calcWinChance(player, ruinTier) {
  const ruinConfig = RUINS[`tier${ruinTier}`]
  if (!player || !ruinConfig) return null
  const formation = player.army?.formation || []
  if (!formation.length) return null

  function rating(army, heroClass, siege = false) {
    let t = 0
    for (const s of army) {
      const unit = UNITS[s.unitId]
      if (!unit) continue
      const stats = getUnitStats(s.unitId, s.level || 1, heroClass)
      if (!stats) continue
      const sm = siege && s.unitId === 'siege_mech' ? 1.5 : 1
      t += (stats.atk * sm + stats.def + stats.hp * 0.1) * (s.count || 1)
    }
    return t
  }

  const atk = formation.map(id => ({
    unitId: id,
    count: player.units?.[id]?.count || 0,
    level: player.units?.[id]?.level || 1,
  })).filter(u => u.count > 0)

  const atkR = rating(atk, player.heroClass, true)
  const defR = rating(ruinConfig.enemyArmy, null)
  if (atkR === 0) return 0
  if (defR === 0) return 100
  const chance = Math.round(100 / (1 + Math.exp(-2.5 * (atkR / defR - 1))))
  return Math.max(5, Math.min(95, chance))
}

// ─── Компонент ───────────────────────────────────────────────
export default function WorldMap() {
  const navigate = useNavigate()
  const { player, unreadMessages } = useGameStore()

  const [fields, setFields]       = useState([])
  const [players, setPlayers]     = useState([])
  const [myExps, setMyExps]       = useState([])    // місії поточного гравця
  const [groupExps, setGroupExps] = useState([])   // всі місії групи (для відображення на тайлах)
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState('all')
  const [selected, setSelected]   = useState(null)
  const [showLb, setShowLb]       = useState(false)
  const [action, setAction]       = useState(null)
  const [battle, setBattle]       = useState(null)
  const [toast, setToast]         = useState(null)
  const [tick, setTick]           = useState(0)     // для оновлення таймерів

  const tickRef = useRef(null)

  // Таймер — оновлюємо UI кожну секунду
  useEffect(() => {
    tickRef.current = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(tickRef.current)
  }, [])

  // Авто-resolve готових місій
  useEffect(() => {
    if (!player?.id) return
    myExps.forEach(exp => {
      if (exp.status === 'active') {
        const endsAt = exp.endsAt?.toDate ? exp.endsAt.toDate() : new Date(exp.endsAt)
        if (endsAt <= new Date()) {
          resolveExpeditionIfReady(player.id, exp.id).catch(console.error)
        }
      }
    })
  }, [tick, myExps, player?.id])

  useEffect(() => {
    if (!player?.group) return
    const u1 = subscribeGroupFields(player.group, d => { setFields(d); setLoading(false) })
    const u2 = subscribeGroupPlayers(player.group, setPlayers)
    const u3 = subscribePlayerExpeditions(player.id, setMyExps)
    const u4 = subscribeGroupExpeditions(player.group, setGroupExps)
    return () => { u1(); u2(); u3(); u4() }
  }, [player?.group, player?.id])

  useEffect(() => { if (!player) navigate('/') }, [player])

  const showToast = useCallback((type, text) => {
    setToast({ type, text })
    setTimeout(() => setToast(null), 3500)
  }, [])

  function handleNavChange(tabId) {
    const routes = { city: '/city', tasks: '/tasks', inbox: '/inbox', trade: '/trade' }
    if (routes[tabId]) navigate(routes[tabId])
  }

  // Знайти місію гравця для поля
  function getMyExpForField(fieldId) {
    return myExps.find(e => e.fieldId === fieldId) || null
  }

  // Зайнятість поля іншим гравцем
  function getOtherExpForField(fieldId) {
    return groupExps.find(e => e.fieldId === fieldId && e.playerId !== player?.id) || null
  }

  async function handleStartExp(fieldId, type) {
    if (action) return
    setAction(type)
    try {
      await startExpedition(player.id, fieldId, type)
      setSelected(null)
      const labels = { scout: 'Розвідка', extract: 'Видобуток', attack: 'Штурм' }
      showToast('neon', `${labels[type]} розпочато!`)
    } catch (err) {
      showToast('accent', err.message)
    } finally {
      setAction(null)
    }
  }

  async function handleClaim(expId) {
    if (action) return
    setAction('claim')
    try {
      const res = await claimExpedition(player.id, expId)
      setSelected(null)
      if (res.type === 'extract' && res.result?.amount > 0) {
        showToast('neon', `+${res.result.amount} ${res.result.resource}`)
      } else if (res.type === 'attack') {
        if (res.result?.won) showToast('neon', `⚔️ Перемога! +${res.result.xp} XP`)
        else showToast('accent', '⚔️ Поразка — противник відстояв руїну')
        if (res.result?.won) setBattle({ result: res.result })
      } else if (res.type === 'scout') {
        showToast('neon', '🔭 Поле досліджено!')
      }
    } catch (err) {
      showToast('accent', err.message)
    } finally {
      setAction(null)
    }
  }

  async function handleForceRefresh(fieldId) {
    if (action) return
    setAction('refresh')
    try {
      await forceRefreshField(player.id, fieldId)
      setSelected(null)
      showToast('neon', '📡 Поле примусово оновлено!')
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
    if (filter === 'available') return !getMyExpForField(f.id) && !getOtherExpForField(f.id)
    if (filter === 'mine')      return !!getMyExpForField(f.id)
    return true
  })

  const stats = {
    resource:  fields.filter(f => f.type === 'resource').length,
    ruin:      fields.filter(f => f.type === 'ruin').length,
    myActive:  myExps.filter(e => e.status === 'active').length,
    myReady:   myExps.filter(e => e.status === 'ready').length,
  }

  return (
    <div className="fixed inset-0 bg-[var(--bg)] flex flex-col" style={{ paddingBottom: 56 }}>

      {/* Заголовок */}
      <div className="px-3 pt-2 pb-1.5 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="font-bebas text-lg tracking-widest text-white">КАРТА ПОЛІВ</span>
            <span className="text-[10px] text-[#333] font-mono">{player?.group}</span>
          </div>
          <button
            onClick={() => { setShowLb(true); setSelected(null) }}
            className="text-xs bg-[rgba(255,215,0,0.1)] border border-[rgba(255,215,0,0.2)] text-[var(--gold)] rounded px-2 py-1 font-mono hover:bg-[rgba(255,215,0,0.18)] transition-colors"
          >
            🏆 Рейтинг
          </button>
        </div>

        {/* Ресурси гравця + статистика полів */}
        <div className="flex items-center justify-between">
          {/* Топ ресурси */}
          <div className="flex gap-2 flex-wrap">
            {[
              { icon: '🪙', val: player?.resources?.gold,   color: '#ffd700' },
              { icon: '💾', val: player?.resources?.bits,   color: '#00aaff' },
              { icon: '⚡', val: player?.resources?.energy, color: '#ffaa00' },
              { icon: '🧬', val: player?.resources?.bio,    color: '#00ff88' },
            ].filter(r => r.val > 0).map((r, i) => (
              <span key={i} className="text-[10px] font-mono" style={{ color: r.color }}>
                {r.icon} {r.val}
              </span>
            ))}
            {(player?.researchPoints || 0) > 0 && (
              <span className="text-[10px] font-mono" style={{ color: '#b9f2ff' }}>🧪 {player.researchPoints}</span>
            )}
          </div>

          {/* Статистика полів + місії */}
          <div className="flex gap-1.5 text-[10px] font-mono shrink-0">
            <span className="bg-[var(--bg3)] border border-[var(--border)] rounded px-1.5 py-0.5"
              style={{ color: '#00cc88' }}>⛏️{stats.resource}</span>
            <span className="bg-[var(--bg3)] border border-[var(--border)] rounded px-1.5 py-0.5"
              style={{ color: '#cc4400' }}>🏚️{stats.ruin}</span>
            {stats.myReady > 0 && (
              <span className="bg-[rgba(0,255,136,0.12)] border border-[rgba(0,255,136,0.4)] rounded px-1.5 py-0.5 text-[var(--neon)] animate-pulse">
                ✅{stats.myReady}
              </span>
            )}
            {stats.myActive > 0 && (
              <span className="bg-[var(--bg3)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[#555]">
                ⏳{stats.myActive}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Фільтри */}
      <div className="flex gap-1.5 px-3 py-2 overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`whitespace-nowrap text-xs font-mono px-2.5 py-1 rounded border transition-colors ${
              filter === f.id
                ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                : 'bg-[var(--bg3)] border-[var(--border)] text-[#666] hover:border-[var(--accent)]'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Рядок готових місій */}
      {stats.myReady > 0 && (
        <div className="mx-3 mb-2 p-2.5 rounded-lg border border-[var(--neon)] bg-[rgba(0,255,136,0.06)] flex items-center justify-between shrink-0">
          <div className="text-xs font-mono text-[var(--neon)]">
            ✅ {stats.myReady} {stats.myReady === 1 ? 'місія готова' : 'місії готові'} — забери нагороду!
          </div>
          <button
            className="text-xs font-mono text-[var(--neon)] underline"
            onClick={() => setFilter('mine')}
          >
            Показати →
          </button>
        </div>
      )}

      {/* Сітка полів */}
      <div className="flex-1 overflow-y-auto px-3 pb-2">
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))' }}>
          {visibleFields.map(field => (
            <FieldTile
              key={field.id}
              field={field}
              myExp={getMyExpForField(field.id)}
              otherExp={getOtherExpForField(field.id)}
              currentPlayerId={player?.id}
              tick={tick}
              onClick={() => { setSelected(field); setShowLb(false) }}
            />
          ))}
        </div>
        {visibleFields.length === 0 && (
          <div className="text-center py-12 text-[#444] text-sm font-mono">Немає полів за фільтром</div>
        )}
      </div>

      {/* Нижня навігація */}
      <div className="fixed bottom-0 left-0 right-0">
        <BottomNav
          items={NAV_ITEMS.map(item => ({ ...item, badge: item.id === 'inbox' ? unreadMessages : 0 }))}
          active="map"
          onChange={handleNavChange}
        />
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-mono font-semibold border shadow-lg animate-slide-up ${
          toast.type === 'neon'
            ? 'bg-[rgba(0,255,136,0.15)] border-[var(--neon)] text-[var(--neon)]'
            : 'bg-[rgba(255,69,0,0.15)] border-[var(--accent)] text-[var(--accent)]'
        }`}>
          {toast.text}
        </div>
      )}

      {/* Деталі поля */}
      {selected && !showLb && (
        <FieldDetailPanel
          field={selected}
          player={player}
          myExp={getMyExpForField(selected.id)}
          otherExp={getOtherExpForField(selected.id)}
          winChance={selected.type === 'ruin' ? calcWinChance(player, selected.tier) : null}
          action={action}
          tick={tick}
          onClose={() => setSelected(null)}
          onStartExp={handleStartExp}
          onClaim={handleClaim}
          onForceRefresh={handleForceRefresh}
        />
      )}

      {/* Рейтинг */}
      {showLb && (
        <LeaderboardPanel players={players} currentPlayerId={player?.id} onClose={() => setShowLb(false)} />
      )}

      {/* Бойовий екран */}
      {battle && (
        <BattleScreen ruin={selected?.field} battleData={battle.result} onClose={() => setBattle(null)} />
      )}
    </div>
  )
}

// ─── Тайл поля ───────────────────────────────────────────────
// Tier кольори для градієнтів
const TIER_GRADIENTS = {
  1: { from: 'rgba(0,0,0,0)', glow: 0.05 },
  2: { from: 'rgba(255,215,0,0.04)', glow: 0.08 },
  3: { from: 'rgba(255,215,0,0.10)', glow: 0.14 },
}

function FieldTile({ field, myExp, otherExp, currentPlayerId, tick, onClick }) {
  const visual     = getFieldVisual(field)
  const tier       = field.tier ? FIELD_TIERS[field.tier] : null
  const timeLeft   = getFieldTimeLeft(field)
  const isRuinDead = field.type === 'ruin' && field.ruinHP <= 0
  const tierGrad   = TIER_GRADIENTS[field.tier] || TIER_GRADIENTS[1]
  const rgb        = hexToRgb(visual.color)

  // Стан місії
  const hasMyExp    = Boolean(myExp)
  const hasOtherExp = Boolean(otherExp) && !hasMyExp
  const isReady     = myExp?.status === 'ready'

  // Таймер місії + прогрес
  let expCountdown = null
  let expProgress  = 0
  if (myExp?.status === 'active') {
    const endsAt    = myExp.endsAt?.toDate    ? myExp.endsAt.toDate()    : new Date(myExp.endsAt)
    const createdAt = myExp.createdAt?.toDate ? myExp.createdAt.toDate() : new Date(myExp.createdAt)
    const total     = endsAt - createdAt
    const elapsed   = Date.now() - createdAt
    expProgress     = Math.min(100, Math.round(elapsed / total * 100))
    expCountdown    = formatCountdown(endsAt - Date.now())
  }

  const expIcon = { scout: '🔭', extract: '⛏️', attack: '⚔️' }[myExp?.type] || ''

  // Колір рамки
  const borderColor = isReady
    ? 'var(--neon)'
    : hasMyExp
      ? 'var(--accent)'
      : field.type === 'ruin' && !isRuinDead
        ? `rgba(${rgb},0.35)`
        : field.type !== 'neutral'
          ? `rgba(${rgb},0.28)`
          : 'var(--border)'

  // Фон тайла
  const tileBackground = isReady
    ? 'rgba(0,255,136,0.07)'
    : isRuinDead
      ? 'var(--bg2)'
      : field.type === 'resource'
        ? `linear-gradient(160deg, rgba(${rgb},${tierGrad.glow}) 0%, rgba(${rgb},0.02) 100%)`
        : field.type === 'ruin'
          ? `linear-gradient(160deg, rgba(${rgb},${tierGrad.glow * 0.9}) 0%, rgba(${rgb},0.02) 100%)`
          : 'var(--bg2)'

  // CSS-клас для tier glow
  const tierClass = !isRuinDead && field.tier === 3 ? 'field-tier-3' : field.tier === 2 ? 'field-tier-2' : ''

  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-between rounded-lg border p-2 text-center transition-all duration-150 active:scale-95 hover:brightness-110 ${
        field.type === 'ruin' && !isRuinDead && !hasMyExp && !isReady ? 'animate-ruin-pulse' : ''
      } ${isReady ? 'animate-neon-pulse' : ''} ${tierClass}`}
      style={{
        background: tileBackground,
        borderColor,
        minHeight: 84,
      }}
    >
      {/* Tier badge в лівому куті */}
      {tier && (
        <div className="absolute top-1 left-1 text-[7px] font-mono font-bold leading-none px-0.5 py-px rounded"
          style={{ color: tier.color, background: `${tier.color}22` }}>
          {tier.label}
        </div>
      )}

      {/* Іконка */}
      <span
        className="text-[26px] leading-none mt-2"
        style={{
          opacity: isRuinDead ? 0.2 : 1,
          filter: field.tier === 3 && !isRuinDead ? `drop-shadow(0 0 4px rgba(${rgb},0.6))` : 'none',
        }}
      >
        {visual.icon}
      </span>

      {/* Назва */}
      <div className="mt-0.5 w-full">
        <div className="text-[8px] font-mono leading-tight text-[#555] truncate px-0.5">{truncate(visual.name, 12)}</div>
      </div>

      {/* Статус місії / таймер поля */}
      <div className="mt-0.5 h-[13px] flex items-center justify-center">
        {isReady ? (
          <span className="text-[8px] font-mono text-[var(--neon)] animate-pulse">{expIcon} Готово!</span>
        ) : hasMyExp ? (
          <span className="text-[8px] font-mono text-[var(--accent)]">{expIcon} {expCountdown}</span>
        ) : timeLeft ? (
          <span className="text-[7px] font-mono text-[#333]">⏱ {timeLeft}</span>
        ) : (
          <span className="text-[7px] font-mono text-[#2a2a3a]">вільне</span>
        )}
      </div>

      {/* Dot маркер — правий верхній кут */}
      {isReady && (
        <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--neon)] animate-pulse shadow-[0_0_6px_var(--neon)]" />
      )}
      {hasMyExp && !isReady && (
        <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
      )}
      {hasOtherExp && !hasMyExp && (
        <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#444]" />
      )}

      {/* Прогрес-бар місії (якщо active) */}
      {hasMyExp && !isReady && (
        <div className="field-progress">
          <div className="field-progress-fill" style={{ width: `${expProgress}%`, background: 'var(--accent)' }} />
        </div>
      )}

      {/* HP bar руїни */}
      {field.type === 'ruin' && !isRuinDead && !hasMyExp && field.ruinHP !== null && (
        <div className="field-progress">
          <div className="field-progress-fill" style={{ width: `${field.ruinHP ?? 100}%`, background: visual.color, opacity: 0.7 }} />
        </div>
      )}

      {/* Знищено overlay */}
      {isRuinDead && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-[rgba(0,0,0,0.4)]">
          <span className="text-[8px] font-mono text-[#333] tracking-widest uppercase">знищено</span>
        </div>
      )}
    </button>
  )
}

// ─── Деталі поля + управління місією ─────────────────────────
function FieldDetailPanel({ field, player, myExp, otherExp, winChance, action, tick, onClose, onStartExp, onClaim, onForceRefresh }) {
  const visual     = getFieldVisual(field)
  const tier       = field.tier ? FIELD_TIERS[field.tier] : null
  const timeLeft   = getFieldTimeLeft(field)
  const ruinConfig = field.type === 'ruin' ? RUINS[`tier${field.tier}`] : null
  const isRuinDead = field.type === 'ruin' && field.ruinHP <= 0
  const hasArmy    = (player?.army?.formation?.length || 0) > 0

  // Рівні лабораторій
  const labLevels = {
    geolab:             player?.buildings?.geolab?.level              || 0,
    extraction_station: player?.buildings?.extraction_station?.level  || 0,
    assault_base:       player?.buildings?.assault_base?.level        || 0,
    signal_tower:       player?.buildings?.signal_tower?.level        || 0,
  }

  // Таймер місії
  let expCountdown = null
  let expProgress  = 0
  if (myExp?.status === 'active') {
    const endsAt   = myExp.endsAt?.toDate ? myExp.endsAt.toDate() : new Date(myExp.endsAt)
    const createdAt = myExp.createdAt?.toDate ? myExp.createdAt.toDate() : new Date(myExp.createdAt)
    const total    = endsAt - createdAt
    const elapsed  = Date.now() - createdAt
    expProgress    = Math.min(100, Math.round(elapsed / total * 100))
    expCountdown   = formatCountdown(endsAt - Date.now())
  }

  const expIcons = { scout: '🔭', extract: '⛏️', attack: '⚔️' }
  const expNames = { scout: 'Розвідка', extract: 'Видобуток', attack: 'Штурм' }

  // Todayʼs refreshes
  const todayKey   = new Date().toISOString().split('T')[0]
  const usedRefresh = player?.fieldRefreshesToday?.[todayKey] || 0
  const maxRefresh  = labLevels.signal_tower

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="fixed bottom-[56px] left-0 right-0 z-40 animate-slide-up">
        <div className="mx-2 mb-2 rounded-xl border overflow-hidden"
          style={{ background: 'rgba(12,12,20,0.98)', backdropFilter: 'blur(16px)', borderColor: `${visual.color}44` }}
          onClick={e => e.stopPropagation()}>

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

            {/* ═══ Активна місія ═══ */}
            {myExp && (
              <div className="rounded-lg border p-3 space-y-2"
                style={{
                  borderColor: myExp.status === 'ready' ? 'var(--neon)' : 'var(--accent)',
                  background:  myExp.status === 'ready' ? 'rgba(0,255,136,0.05)' : 'rgba(255,69,0,0.05)',
                }}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">
                    {expIcons[myExp.type]} {expNames[myExp.type]}
                  </span>
                  <span className={`text-xs font-mono ${myExp.status === 'ready' ? 'text-[var(--neon)]' : 'text-[var(--accent)]'}`}>
                    {myExp.status === 'ready' ? '✅ ГОТОВО' : `⏳ ${expCountdown}`}
                  </span>
                </div>

                {myExp.status === 'active' && (
                  <div>
                    <div className="h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${expProgress}%` }} />
                    </div>
                    <div className="text-[10px] font-mono text-[#444] mt-0.5 text-right">{expProgress}%</div>
                  </div>
                )}

                {myExp.status === 'ready' && (
                  <div>
                    {myExp.type === 'extract' && myExp.result?.amount > 0 && (
                      <div className="text-xs font-mono text-[var(--neon)]">
                        +{myExp.result.amount} {myExp.result.resource}
                      </div>
                    )}
                    {myExp.type === 'attack' && (
                      <div className={`text-xs font-mono ${myExp.result?.won ? 'text-[var(--neon)]' : 'text-[var(--accent)]'}`}>
                        {myExp.result?.won ? '⚔️ Перемога!' : '💀 Поразка'}
                      </div>
                    )}
                    {myExp.type === 'scout' && (
                      <div className="text-xs font-mono text-[var(--neon)]">🔭 Поле досліджено</div>
                    )}
                    <button
                      className="mt-2 w-full btn btn-neon text-sm"
                      disabled={!!action}
                      onClick={() => onClaim(myExp.id)}
                    >
                      {action === 'claim' ? 'Забираємо...' : '🎁 ЗАБРАТИ НАГОРОДУ'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ═══ Чужа активна місія ═══ */}
            {!myExp && otherExp && (
              <div className="text-xs text-[#444] font-mono bg-[var(--bg3)] rounded p-2">
                ⚠ Інший гравець вже відправив команду на це поле
              </div>
            )}

            {/* ═══ Дії (якщо немає своєї місії) ═══ */}
            {!myExp && (
              <>
                {/* Ресурсне поле */}
                {field.type === 'resource' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#555]">Ресурс</span>
                      <span style={{ color: visual.color }} className="font-mono">{visual.icon} {field.resourceType}</span>
                    </div>
                    {field.extractionBonus > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#555]">Бонус станції</span>
                        <span className="text-[var(--neon)] font-mono">+{field.extractionBonus}%</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Руїна */}
                {field.type === 'ruin' && ruinConfig && !isRuinDead && (
                  <div className="space-y-2">
                    <div>
                      <div className="flex items-center justify-between text-xs font-mono mb-1">
                        <span className="text-[#555]">HP руїни</span>
                        <span style={{ color: visual.color }}>{field.ruinHP ?? 100}%</span>
                      </div>
                      <div className="h-2 bg-[var(--bg)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${field.ruinHP ?? 100}%`, background: visual.color }} />
                      </div>
                    </div>
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
                    {hasArmy && winChance !== null && (
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
                      </div>
                    )}
                    {isRuinDead && (
                      <p className="text-center text-xs text-[#333] font-mono">Руїну знищено — відновиться при рефреші</p>
                    )}
                  </div>
                )}

                {/* Нейтральне */}
                {field.type === 'neutral' && (
                  <p className="text-xs text-[#444] text-center py-1">
                    Нейтральна зона. Активується після наступного рефрешу.
                  </p>
                )}
              </>
            )}
          </div>

          {/* Кнопки дій (якщо немає активної місії) */}
          {!myExp && (
            <div className="px-3 pb-3 space-y-2">
              {/* Scout */}
              {labLevels.geolab >= 1 && field.type !== 'neutral' && (
                <button className="w-full btn btn-secondary text-xs" disabled={!!action}
                  onClick={() => onStartExp(field.id, 'scout')}>
                  {action === 'scout' ? 'Відправляємо...' : `🔭 РОЗВІДАТИ (Геолаб рів.${labLevels.geolab})`}
                </button>
              )}
              {labLevels.geolab < 1 && (
                <p className="text-center text-[10px] text-[#444] font-mono">Геолаб рів.1 — розвідка</p>
              )}

              {/* Extract */}
              {field.type === 'resource' && (
                labLevels.extraction_station >= 1 ? (
                  <button className="w-full btn btn-neon text-sm" disabled={!!action || !!otherExp}
                    onClick={() => onStartExp(field.id, 'extract')}>
                    {action === 'extract' ? 'Відправляємо...' : `⛏️ ВИДОБУТИ РЕСУРСИ`}
                  </button>
                ) : (
                  <p className="text-center text-xs text-[#444] font-mono">Потрібна Екстракційна станція</p>
                )
              )}

              {/* Attack */}
              {field.type === 'ruin' && !isRuinDead && (
                labLevels.assault_base >= 1 ? (
                  !hasArmy ? (
                    <p className="text-center text-xs text-[var(--accent)]">Сформуй армію перед штурмом</p>
                  ) : (
                    <button className="w-full btn btn-accent text-sm" disabled={!!action}
                      onClick={() => onStartExp(field.id, 'attack')}>
                      {action === 'attack' ? 'Відправляємо...' : `⚔️ ШТУРМУВАТИ`}
                    </button>
                  )
                ) : (
                  <p className="text-center text-xs text-[#444] font-mono">Потрібна Штурмова база</p>
                )
              )}

              {/* Force refresh */}
              {labLevels.signal_tower >= 1 && (
                <button
                  className="w-full text-xs font-mono py-1.5 rounded border border-[var(--border)] text-[#555] hover:border-[var(--neon)] hover:text-[var(--neon)] transition-colors"
                  disabled={!!action || usedRefresh >= maxRefresh}
                  onClick={() => onForceRefresh(field.id)}
                >
                  📡 Форс-рефреш ({maxRefresh - usedRefresh}/{maxRefresh} сьогодні)
                </button>
              )}
            </div>
          )}
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
  return `${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)}`
}
