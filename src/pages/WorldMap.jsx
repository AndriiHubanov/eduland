// ─── WorldMap — Фаза 14: Візуальна карта терену ───

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
import GameImage from '../components/GameImage'
import { fieldImg } from '../config/assets'
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

// ─── Карта: константи ─────────────────────────────────────────
const MAP_SIZE  = 800
const CELL_SIZE = MAP_SIZE / 10   // 80px — для city positions (0-9 → пікселі)

// 31 фіксована позиція [x, y] для полів (за полем field.index 0-30)
const FIELD_POSITIONS = [
  [100,  80], [250,  65], [420,  90], [600,  70], [740, 110],  // 0-4
  [ 60, 200], [190, 170], [360, 180], [530, 200], [700, 190],  // 5-9
  [130, 310], [300, 290], [460, 320], [630, 300], [760, 330],  // 10-14
  [200, 420], [380, 400], [560, 420], [ 80, 490], [250, 480],  // 15-19
  [430, 510], [620, 490], [740, 500], [160, 600], [340, 620],  // 20-24
  [510, 600], [680, 620], [100, 710], [280, 720], [450, 710],  // 25-29
  [640, 700],                                                   // 30
]

const TERRAIN_BG = [
  'radial-gradient(ellipse at 15% 15%, rgba(20,50,15,0.9) 0%, transparent 40%)',
  'radial-gradient(ellipse at 85% 25%, rgba(15,45,12,0.8) 0%, transparent 35%)',
  'radial-gradient(ellipse at 30% 70%, rgba(22,52,18,0.8) 0%, transparent 45%)',
  'radial-gradient(ellipse at 75% 80%, rgba(18,48,14,0.7) 0%, transparent 40%)',
  'radial-gradient(ellipse at 55% 45%, rgba(12,40,10,0.6) 0%, transparent 50%)',
  'radial-gradient(ellipse at 10% 90%, rgba(20,55,15,0.7) 0%, transparent 35%)',
  'radial-gradient(ellipse at 90% 60%, rgba(16,45,12,0.7) 0%, transparent 38%)',
  'linear-gradient(160deg, #091a09 0%, #071408 50%, #0a1c0a 100%)',
].join(', ')

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
  const [myExps, setMyExps]       = useState([])
  const [groupExps, setGroupExps] = useState([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState('all')
  const [selected, setSelected]   = useState(null)
  const [showLb, setShowLb]       = useState(false)
  const [action, setAction]       = useState(null)
  const [battle, setBattle]       = useState(null)
  const [toast, setToast]         = useState(null)
  const [tick, setTick]           = useState(0)

  const tickRef   = useRef(null)
  const scrollRef = useRef(null)

  // Таймер — оновлюємо UI кожну секунду
  useEffect(() => {
    tickRef.current = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(tickRef.current)
  }, [])

  // Центрування карти на місті гравця при завантаженні
  useEffect(() => {
    if (!scrollRef.current) return
    const el = scrollRef.current
    let cx = MAP_SIZE / 2
    let cy = MAP_SIZE / 2
    if (player?.cityPosition) {
      cx = (player.cityPosition.x + 0.5) * CELL_SIZE
      cy = (player.cityPosition.y + 0.5) * CELL_SIZE
    }
    el.scrollLeft = Math.max(0, cx - el.clientWidth  / 2)
    el.scrollTop  = Math.max(0, cy - el.clientHeight / 2)
  }, [player?.cityPosition, loading])

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

  function getMyExpForField(fieldId) {
    return myExps.find(e => e.fieldId === fieldId) || null
  }

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

  // Фільтр видимості маркера (dimming замість приховування)
  function isFieldVisible(field) {
    if (filter === 'all')       return true
    if (filter === 'resource')  return field.type === 'resource'
    if (filter === 'ruin')      return field.type === 'ruin'
    if (filter === 'available') return !getMyExpForField(field.id) && !getOtherExpForField(field.id)
    if (filter === 'mine')      return !!getMyExpForField(field.id)
    return true
  }

  if (loading) return <Spinner text="Завантаження карти полів..." />

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

      {/* ─── Карта терену ─── */}
      <div className="flex-1 relative overflow-hidden">
        <div
          ref={scrollRef}
          className="w-full h-full overflow-auto"
          style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'thin', scrollbarColor: '#1a2a1a transparent' }}
        >
          <div
            className="relative"
            style={{ width: MAP_SIZE, height: MAP_SIZE, background: TERRAIN_BG, flexShrink: 0 }}
          >
            {/* SVG: річки */}
            <svg className="absolute inset-0 pointer-events-none" width={MAP_SIZE} height={MAP_SIZE}>
              {/* Головна річка: діагональ зверху-праворуч до низу-ліворуч */}
              <path
                d="M 760 0 C 700 120, 600 160, 540 220 C 480 280, 460 340, 400 390 C 340 440, 280 470, 220 540 C 160 610, 140 660, 80 740"
                stroke="#1a4565" strokeWidth="24" fill="none" opacity="0.6" strokeLinecap="round"
              />
              <path
                d="M 760 0 C 700 120, 600 160, 540 220 C 480 280, 460 340, 400 390 C 340 440, 280 470, 220 540 C 160 610, 140 660, 80 740"
                stroke="#0e2a40" strokeWidth="14" fill="none" opacity="0.85" strokeLinecap="round"
              />
              {/* Притока: зі сходу вливається в головну */}
              <path
                d="M 800 520 C 700 500, 630 480, 570 450 C 510 420, 470 400, 400 390"
                stroke="#1a4565" strokeWidth="16" fill="none" opacity="0.5" strokeLinecap="round"
              />
              <path
                d="M 800 520 C 700 500, 630 480, 570 450 C 510 420, 470 400, 400 390"
                stroke="#0e2a40" strokeWidth="9" fill="none" opacity="0.75" strokeLinecap="round"
              />
              {/* Мала притока з півночі */}
              <path
                d="M 320 0 C 330 80, 350 140, 360 180"
                stroke="#1a4565" strokeWidth="10" fill="none" opacity="0.4" strokeLinecap="round"
              />
              <path
                d="M 320 0 C 330 80, 350 140, 360 180"
                stroke="#0e2a40" strokeWidth="6" fill="none" opacity="0.6" strokeLinecap="round"
              />
            </svg>

            {/* Маркери міст гравців */}
            {players.map(p => {
              if (!p.cityPosition) return null
              const cx = (p.cityPosition.x + 0.5) * CELL_SIZE
              const cy = (p.cityPosition.y + 0.5) * CELL_SIZE
              return (
                <CityMarker key={p.id} x={cx} y={cy} player={p} isOwn={p.id === player?.id} />
              )
            })}

            {/* Маркери полів */}
            {fields.map(field => {
              const pos = FIELD_POSITIONS[field.index]
              if (!pos) return null
              const fogStatus = (player?.fogState || {})[field.index]
              const isHidden  = !fogStatus || fogStatus === 'hidden'
              const isScanning = fogStatus === 'scanning'

              if (isHidden || isScanning) {
                return (
                  <HiddenFieldMarker
                    key={field.id}
                    x={pos[0]}
                    y={pos[1]}
                    isScanning={isScanning}
                    myExp={isScanning ? getMyExpForField(field.id) : null}
                    tick={tick}
                    visible={isFieldVisible(field)}
                    onScout={() => handleStartExp(field.id, 'scout')}
                    disabled={!!action}
                  />
                )
              }

              return (
                <FieldMarker
                  key={field.id}
                  field={field}
                  x={pos[0]}
                  y={pos[1]}
                  myExp={getMyExpForField(field.id)}
                  otherExp={getOtherExpForField(field.id)}
                  tick={tick}
                  visible={isFieldVisible(field)}
                  onClick={() => { setSelected(field); setShowLb(false) }}
                />
              )
            })}
          </div>
        </div>

        {/* Легенда */}
        <div className="absolute top-2 right-2 bg-[rgba(0,0,0,0.75)] border border-[var(--border)] rounded-lg p-2 pointer-events-none">
          <div className="text-[8px] font-mono text-[#444] uppercase tracking-wider mb-1">Легенда</div>
          <div className="space-y-0.5 text-[9px] font-mono">
            <div className="flex items-center gap-1.5"><span>⚡🧬💎💾🔐🪙</span><span className="text-[#555]">Ресурс</span></div>
            <div className="flex items-center gap-1.5"><span>🏚️🏗️🏰</span><span className="text-[#555]">Руїна</span></div>
            <div className="flex items-center gap-1.5"><span>🌫️</span><span className="text-[#555]">Нейтральне</span></div>
            <div className="flex items-center gap-1.5"><span>🛡️</span><span className="text-[#555]">Місто</span></div>
          </div>
        </div>
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

// ─── Маркер поля на карті ─────────────────────────────────────
function FieldMarker({ field, x, y, myExp, otherExp, tick, visible, onClick }) {
  const visual      = getFieldVisual(field)
  const tier        = field.tier ? FIELD_TIERS[field.tier] : null
  const isRuinDead  = field.type === 'ruin' && field.ruinHP <= 0
  const hasMyExp    = Boolean(myExp)
  const isReady     = myExp?.status === 'ready'
  const hasOtherExp = Boolean(otherExp) && !hasMyExp

  let expCountdown = null
  if (myExp?.status === 'active') {
    const endsAt = myExp.endsAt?.toDate ? myExp.endsAt.toDate() : new Date(myExp.endsAt)
    expCountdown = formatCountdown(endsAt - Date.now())
  }

  const SIZE = 56

  const borderColor = isReady
    ? 'var(--neon)'
    : hasMyExp
      ? 'var(--accent)'
      : tier
        ? `${tier.color}99`
        : '#2a2a2a'

  const bg = isRuinDead
    ? 'rgba(0,0,0,0.55)'
    : isReady
      ? 'rgba(0,255,136,0.18)'
      : hasMyExp
        ? 'rgba(255,69,0,0.15)'
        : 'rgba(0,0,0,0.58)'

  return (
    <button
      onClick={onClick}
      className="absolute flex flex-col items-center justify-center rounded-full border transition-all duration-150 active:scale-90 hover:brightness-125"
      style={{
        left: x - SIZE / 2,
        top:  y - SIZE / 2,
        width:  SIZE,
        height: SIZE,
        background:  bg,
        borderColor,
        borderWidth: isReady ? 2 : 1.5,
        opacity:    visible ? 1 : 0.15,
        boxShadow:  isReady
          ? '0 0 14px var(--neon)'
          : tier?.color
            ? `0 0 8px ${tier.color}55`
            : 'none',
        backdropFilter: 'blur(4px)',
        zIndex: isReady ? 10 : hasMyExp ? 8 : 5,
      }}
    >
      {/* Іконка / зображення */}
      <GameImage
        src={fieldImg(field.type, field.tier)}
        fallback={visual.icon}
        alt={visual.name}
        className="w-10 h-10 object-contain leading-none drop-shadow-md"
        style={{ opacity: isRuinDead ? 0.25 : 1 }}
      />

      {/* Tier badge */}
      {tier && (
        <div
          className="absolute bottom-0 right-0 translate-x-1 translate-y-1 text-[7px] font-mono font-bold px-0.5 rounded"
          style={{ color: tier.color, background: `${tier.color}33`, border: `1px solid ${tier.color}55` }}
        >
          {tier.label}
        </div>
      )}

      {/* Статус dot */}
      {isReady && (
        <div className="absolute top-0 right-0 -translate-y-0.5 translate-x-0.5 w-2.5 h-2.5 rounded-full bg-[var(--neon)] animate-pulse shadow-[0_0_6px_var(--neon)]" />
      )}
      {hasMyExp && !isReady && (
        <div className="absolute top-0 right-0 -translate-y-0.5 translate-x-0.5 w-2 h-2 rounded-full bg-[var(--accent)]" />
      )}
      {hasOtherExp && (
        <div className="absolute top-0 right-0 -translate-y-0.5 translate-x-0.5 w-2 h-2 rounded-full bg-[#555]" />
      )}

      {/* Countdown під маркером */}
      {myExp?.status === 'active' && expCountdown && (
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[7px] font-mono text-[var(--accent)] whitespace-nowrap pointer-events-none">
          {expCountdown}
        </div>
      )}

      {/* Руїна знищена */}
      {isRuinDead && (
        <div className="absolute inset-0 flex items-center justify-center rounded-full">
          <span className="text-[8px] font-mono text-[#333]">✕</span>
        </div>
      )}
    </button>
  )
}

// ─── Маркер прихованого поля (Fog of War) ─────────────────────
function HiddenFieldMarker({ x, y, isScanning, myExp, tick, visible, onScout, disabled }) {
  const SIZE = 56

  let scanCountdown = null
  if (isScanning && myExp?.status === 'active') {
    const endsAt = myExp.endsAt?.toDate ? myExp.endsAt.toDate() : new Date(myExp.endsAt)
    scanCountdown = formatCountdown(endsAt - Date.now())
  }

  return (
    <button
      onClick={!isScanning ? onScout : undefined}
      disabled={disabled || isScanning}
      className="absolute flex flex-col items-center justify-center rounded-full border transition-all duration-150 active:scale-90 field-fog"
      style={{
        left: x - SIZE / 2,
        top:  y - SIZE / 2,
        width:  SIZE,
        height: SIZE,
        borderColor: isScanning ? 'rgba(255,170,0,0.5)' : 'rgba(0,255,136,0.2)',
        borderWidth: 1.5,
        opacity: visible ? 1 : 0.15,
        zIndex: 5,
      }}
    >
      {isScanning ? (
        <>
          <span className="text-[9px] font-mono text-[rgba(255,170,0,0.7)]">🔭</span>
          {scanCountdown && (
            <span className="text-[6px] font-mono text-[rgba(255,170,0,0.6)] whitespace-nowrap mt-0.5">{scanCountdown}</span>
          )}
        </>
      ) : (
        <>
          <span className="text-base leading-none" style={{ color: 'rgba(0,255,136,0.45)' }}>?</span>
          <span className="text-[6px] font-mono text-[rgba(0,255,136,0.3)] whitespace-nowrap">сканувати</span>
        </>
      )}
    </button>
  )
}

// ─── Маркер міста гравця ──────────────────────────────────────
function CityMarker({ x, y, player, isOwn }) {
  const cls = HERO_CLASSES[player.heroClass] || HERO_CLASSES.guardian
  const SIZE = 40

  return (
    <div
      className="absolute flex flex-col items-center pointer-events-none"
      style={{ left: x - SIZE / 2, top: y - SIZE / 2, zIndex: 20 }}
    >
      <div
        className="flex items-center justify-center rounded-lg text-lg"
        style={{
          width:  SIZE,
          height: SIZE,
          background: isOwn ? 'rgba(255,69,0,0.25)' : 'rgba(0,0,0,0.65)',
          border: isOwn ? '2px solid var(--accent)' : '1.5px solid #3a3a3a',
          boxShadow: isOwn ? '0 0 12px var(--accent)' : 'none',
        }}
      >
        {cls.icon}
      </div>
      <div
        className="mt-0.5 text-[7px] font-mono whitespace-nowrap px-1 rounded"
        style={{
          color:      isOwn ? 'var(--accent)' : '#555',
          background: isOwn ? 'rgba(255,69,0,0.12)' : 'rgba(0,0,0,0.5)',
        }}
      >
        {player.heroName || player.name}
      </div>
    </div>
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

  const labLevels = {
    geolab:             player?.buildings?.geolab?.level              || 0,
    extraction_station: player?.buildings?.extraction_station?.level  || 0,
    assault_base:       player?.buildings?.assault_base?.level        || 0,
    signal_tower:       player?.buildings?.signal_tower?.level        || 0,
  }

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

  const todayKey    = new Date().toISOString().split('T')[0]
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

                {field.type === 'neutral' && (
                  <p className="text-xs text-[#444] text-center py-1">
                    Нейтральна зона. Активується після наступного рефрешу.
                  </p>
                )}
              </>
            )}
          </div>

          {/* Кнопки дій */}
          {!myExp && (
            <div className="px-3 pb-3 space-y-2">
              {labLevels.geolab >= 1 && field.type !== 'neutral' && (
                <button className="w-full btn btn-secondary text-xs" disabled={!!action}
                  onClick={() => onStartExp(field.id, 'scout')}>
                  {action === 'scout' ? 'Відправляємо...' : `🔭 РОЗВІДАТИ (Геолаб рів.${labLevels.geolab})`}
                </button>
              )}
              {labLevels.geolab < 1 && (
                <p className="text-center text-[10px] text-[#444] font-mono">Геолаб рів.1 — розвідка</p>
              )}

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
function hexToRgb(hex) {
  if (!hex || hex.length < 7) return '128,128,128'
  return `${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)}`
}
