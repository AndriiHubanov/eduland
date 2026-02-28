// ─── WorldMap Page (/map): Карта світу — повний екран ───

import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useGameStore, { HERO_CLASSES, getHeroLevel } from '../store/gameStore'
import { subscribeGroupPlayers } from '../firebase/service'
import { Spinner, Button, BottomNav } from '../components/UI'
import { RUIN_TEMPLATES, RUINS, attackRuin } from '../firebase/ruinService'
import { UNITS } from '../firebase/unitService'
import BattleScreen from '../components/BattleScreen'

const NAV_ITEMS = [
  { id: 'city',   icon: '🏙️', label: 'Місто'   },
  { id: 'map',    icon: '🗺️', label: 'Карта'   },
  { id: 'tasks',  icon: '⚔️', label: 'Завдання' },
  { id: 'inbox',  icon: '📬', label: 'Пошта'   },
  { id: 'trade',  icon: '🔄', label: 'Торгівля' },
]

const GRID_SIZE = 10
const NAV_HEIGHT = 56 // px — висота нижньої навігації

export default function WorldMap() {
  const navigate = useNavigate()
  const { player, unreadMessages } = useGameStore()

  const [players, setPlayers]         = useState([])
  const [selected, setSelected]       = useState(null)
  const [showLeaderboard, setShowLb]  = useState(false)
  const [loading, setLoading]         = useState(true)
  const [cellSize, setCellSize]       = useState(32)
  const [selectedRuin, setSelectedRuin] = useState(null)  // { ruin, x, y }
  const [battle, setBattle]           = useState(null)    // { ruin, data } або null
  const [attacking, setAttacking]     = useState(false)

  const containerRef = useRef(null)

  // Підписка на гравців групи
  useEffect(() => {
    if (!player) { navigate('/'); return }
    const unsub = subscribeGroupPlayers(player.group, (data) => {
      setPlayers(data)
      setLoading(false)
    })
    return () => unsub()
  }, [player])

  // Обраховуємо розмір клітинки під поточний екран
  useEffect(() => {
    function calcSize() {
      const w = window.innerWidth
      const h = window.innerHeight - NAV_HEIGHT
      // Квадрат що вписується в екран з невеликим відступом
      const side = Math.floor(Math.min(w, h) * 0.97)
      setCellSize(Math.floor(side / GRID_SIZE))
    }
    calcSize()
    window.addEventListener('resize', calcSize)
    return () => window.removeEventListener('resize', calcSize)
  }, [])

  function handleNavChange(tabId) {
    if (tabId === 'city')  navigate('/city')
    if (tabId === 'tasks') navigate('/tasks')
    if (tabId === 'inbox') navigate('/inbox')
    if (tabId === 'trade') navigate('/trade')
  }

  if (loading) return <Spinner text="Завантаження карти..." />

  // Будуємо lookup гравців по позиції
  const playerMap = {}
  for (const p of players) {
    const key = `${p.cityPosition?.x},${p.cityPosition?.y}`
    playerMap[key] = p
  }

  // Позиції руїн — фіксовані по тіру (детерміновано від group-рядка)
  const ruinPositions = [
    { ...RUIN_TEMPLATES[0], x: 2, y: 7 },
    { ...RUIN_TEMPLATES[1], x: 7, y: 2 },
    { ...RUIN_TEMPLATES[2], x: 5, y: 5 },
  ]
  const ruinMap = {}
  for (const r of ruinPositions) {
    ruinMap[`${r.x},${r.y}`] = r
  }

  // Перевіряємо кулдаун руїни для поточного гравця
  function getRuinCooldown(ruinId) {
    const until = player?.ruinCooldowns?.[ruinId]
    if (!until) return null
    const d = until?.toDate ? until.toDate() : new Date(until)
    if (Date.now() < d.getTime()) return d
    return null
  }

  async function handleAttackRuin(ruin) {
    if (attacking) return
    setAttacking(true)
    try {
      const data = await attackRuin(player.id, ruin.id, ruin.tier)
      setSelectedRuin(null)
      setBattle({ ruin, data })
    } catch (err) {
      alert(err.message)
    } finally {
      setAttacking(false)
    }
  }

  const gridSidePx = cellSize * GRID_SIZE

  return (
    <div className="fixed inset-0 bg-[var(--bg)] flex flex-col" style={{ bottom: NAV_HEIGHT }}>

      {/* ─── Плаваючий оверлей-заголовок ─── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-3 py-2"
           style={{ background: 'linear-gradient(to bottom, rgba(10,10,15,0.9) 0%, transparent 100%)' }}>
        <div>
          <span className="font-bebas text-lg tracking-widest text-white">КАРТА РЕГІОНУ</span>
          <span className="text-xs text-[#555] ml-2">{player?.group}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#555] font-mono">{players.length} міст</span>
          <button
            onClick={() => { setShowLb(true); setSelected(null) }}
            className="text-sm bg-[rgba(255,215,0,0.15)] border border-[rgba(255,215,0,0.3)] text-[var(--gold)] rounded px-2 py-1 font-mono tracking-wider hover:bg-[rgba(255,215,0,0.25)] transition-colors"
          >
            🏆
          </button>
        </div>
      </div>

      {/* ─── Карта (центрована, квадратна) ─── */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden"
      >
        <div
          style={{
            width:  gridSidePx,
            height: gridSidePx,
            display: 'grid',
            gridTemplateColumns: `repeat(${GRID_SIZE}, ${cellSize}px)`,
            gridTemplateRows:    `repeat(${GRID_SIZE}, ${cellSize}px)`,
            border: '1px solid var(--border)',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, idx) => {
            const x = idx % GRID_SIZE
            const y = Math.floor(idx / GRID_SIZE)
            const cellPlayer = playerMap[`${x},${y}`] || null
            const cellRuin   = ruinMap[`${x},${y}`]   || null
            const isOwn      = cellPlayer?.id === player?.id
            const cls        = cellPlayer ? HERO_CLASSES[cellPlayer.heroClass] : null

            return (
              <MapCell
                key={`${x}-${y}`}
                cellPlayer={cellPlayer}
                cellRuin={cellRuin}
                isOwn={isOwn}
                heroClass={cls}
                cellSize={cellSize}
                onClick={() => {
                  if (cellRuin)   { setSelectedRuin(cellRuin); setSelected(null) }
                  else if (cellPlayer) { setSelected(cellPlayer); setSelectedRuin(null) }
                }}
              />
            )
          })}
        </div>
      </div>

      {/* ─── Нижня навігація ─── */}
      <div className="fixed bottom-0 left-0 right-0">
        <BottomNav
          items={NAV_ITEMS.map(item => ({ ...item, badge: item.id === 'inbox' ? unreadMessages : 0 }))}
          active="map"
          onChange={handleNavChange}
        />
      </div>

      {/* ─── Панель вибраного гравця ─── */}
      {selected && !showLeaderboard && (
        <PlayerPanel
          player={selected}
          isOwn={selected.id === player?.id}
          onClose={() => setSelected(null)}
          onTrade={() => { navigate('/trade'); setSelected(null) }}
        />
      )}

      {/* ─── Панель руїни ─── */}
      {selectedRuin && !showLeaderboard && (
        <RuinPanel
          ruin={selectedRuin}
          cooldownUntil={getRuinCooldown(selectedRuin.id)}
          hasArmy={(player?.army?.formation?.length || 0) > 0}
          attacking={attacking}
          onClose={() => setSelectedRuin(null)}
          onAttack={() => handleAttackRuin(selectedRuin)}
        />
      )}

      {/* ─── Рейтинг групи ─── */}
      {showLeaderboard && (
        <LeaderboardPanel
          players={players}
          currentPlayerId={player?.id}
          onClose={() => setShowLb(false)}
        />
      )}

      {/* ─── Бойовий екран ─── */}
      {battle && (
        <BattleScreen
          ruin={battle.ruin}
          battleData={battle.data}
          onClose={() => setBattle(null)}
        />
      )}
    </div>
  )
}

// ─── Клітинка карти ──────────────────────────────────────────
function MapCell({ cellPlayer, cellRuin, isOwn, heroClass, cellSize, onClick }) {
  const showName = cellSize >= 44

  const hasContent = cellPlayer || cellRuin
  const tierColor  = cellRuin ? RUINS[`tier${cellRuin.tier}`]?.color : null

  return (
    <div
      onClick={onClick}
      className={`
        relative flex flex-col items-center justify-center
        border-[0.5px] border-[var(--border)]
        transition-all duration-150 select-none
        ${hasContent ? 'cursor-pointer active:scale-95' : 'cursor-default'}
        ${isOwn
          ? 'bg-[rgba(255,69,0,0.12)]'
          : cellRuin
            ? 'bg-[rgba(255,165,0,0.06)] hover:bg-[rgba(255,165,0,0.12)]'
            : cellPlayer
              ? 'bg-[var(--bg3)] hover:bg-[rgba(255,255,255,0.04)]'
              : 'bg-[var(--bg2)]'
        }
      `}
      style={{
        width:     cellSize,
        height:    cellSize,
        boxShadow: isOwn
          ? 'inset 0 0 0 2px var(--accent)'
          : cellRuin
            ? `inset 0 0 0 1px ${tierColor}44`
            : undefined,
      }}
    >
      {cellRuin ? (
        <>
          <span style={{ fontSize: Math.max(cellSize * 0.38, 12) }} className="leading-none">
            {cellRuin.icon}
          </span>
          {showName && (
            <span
              className="absolute bottom-0.5 left-0 right-0 text-center truncate px-0.5 font-mono"
              style={{ fontSize: Math.max(Math.floor(cellSize * 0.12), 6), color: tierColor || '#888' }}
            >
              T{cellRuin.tier}
            </span>
          )}
        </>
      ) : cellPlayer ? (
        <>
          <span style={{ fontSize: Math.max(cellSize * 0.38, 12) }} className="leading-none">
            {heroClass?.icon || '🏘️'}
          </span>
          {showName && (
            <span
              className="absolute bottom-0.5 left-0 right-0 text-center truncate px-0.5"
              style={{
                fontSize: Math.max(Math.floor(cellSize * 0.13), 7),
                color: isOwn ? 'var(--accent)' : '#666',
                lineHeight: 1.2,
              }}
            >
              {cellPlayer.heroName || cellPlayer.name.split(' ')[0]}
            </span>
          )}
          {isOwn && (
            <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
          )}
        </>
      ) : (
        <span className="text-[var(--border)]" style={{ fontSize: Math.max(cellSize * 0.2, 8) }}>·</span>
      )}
    </div>
  )
}

// ─── Панель руїни (знизу) ─────────────────────────────────────
function RuinPanel({ ruin, cooldownUntil, hasArmy, attacking, onClose, onAttack }) {
  const ruinConfig = RUINS[`tier${ruin.tier}`]
  const tierColor  = ruinConfig?.color || '#888'

  function formatCooldown(date) {
    const hours = Math.ceil((date.getTime() - Date.now()) / 3600000)
    if (hours < 1) return 'менше 1 год.'
    return `${hours} год.`
  }

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="fixed bottom-[56px] left-0 right-0 z-40 animate-slide-up">
        <div
          className="mx-2 mb-2 rounded-xl border overflow-hidden"
          style={{ background: 'rgba(18,18,30,0.97)', backdropFilter: 'blur(12px)', borderColor: `${tierColor}44` }}
          onClick={e => e.stopPropagation()}
        >
          {/* Шапка */}
          <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: `${tierColor}33` }}>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{ruin.icon}</span>
              <div>
                <div className="font-bebas text-base text-white tracking-wide leading-tight">{ruin.name}</div>
                <div className="text-xs" style={{ color: tierColor }}>Тір {ruin.tier} · {ruinConfig?.xpReward} XP</div>
              </div>
            </div>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-[#555] hover:text-white">✕</button>
          </div>

          {/* Опис */}
          <div className="px-3 pt-2">
            <p className="text-xs text-[#666] italic leading-relaxed">{ruin.description}</p>
          </div>

          {/* Ворожа армія */}
          <div className="px-3 py-2">
            <p className="text-[10px] text-[#555] uppercase tracking-wider mb-1.5">Охорона руїни</p>
            <div className="flex flex-wrap gap-1.5">
              {ruinConfig?.enemyArmy?.map((u, i) => {
                const unit = UNITS[u.unitId]
                return (
                  <span key={i} className="text-xs bg-[var(--bg3)] border border-[var(--border)] rounded px-2 py-0.5 font-mono">
                    {unit?.icon} {unit?.name} ×{u.count} рів.{u.level}
                  </span>
                )
              })}
            </div>
          </div>

          {/* Кнопка атаки */}
          <div className="p-3 pt-1">
            {cooldownUntil ? (
              <div className="text-center text-xs text-[#555] py-2 font-mono">
                ⏳ Кулдаун: ще {formatCooldown(cooldownUntil)}
              </div>
            ) : !hasArmy ? (
              <div className="text-center text-xs text-[var(--accent)] py-2">
                Сформуй армію в місті перед атакою
              </div>
            ) : (
              <button
                className="w-full btn btn-accent text-sm"
                disabled={attacking}
                onClick={onAttack}
              >
                {attacking ? '⚔️ Бій...' : '⚔️ АТАКУВАТИ'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Рейтинг групи (знизу) ────────────────────────────────────
function LeaderboardPanel({ players, currentPlayerId, onClose }) {
  const sorted = [...players].sort((a, b) => (b.heroXP || 0) - (a.heroXP || 0))

  const rankStyle = ['text-[var(--gold)]', 'text-[#aaa]', 'text-[#cd7f32]']

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />

      <div className="fixed bottom-[56px] left-0 right-0 z-40 animate-slide-up">
        <div
          className="mx-2 mb-2 rounded-xl border border-[var(--border)] overflow-hidden"
          style={{ background: 'rgba(18,18,30,0.97)', backdropFilter: 'blur(12px)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Шапка */}
          <div className="flex items-center justify-between p-3 border-b border-[var(--border)]">
            <span className="font-bebas text-lg tracking-widest text-[var(--gold)]">🏆 РЕЙТИНГ РЕГІОНУ</span>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center text-[#555] hover:text-white rounded"
            >
              ✕
            </button>
          </div>

          {/* Список */}
          <div className="overflow-y-auto max-h-64 divide-y divide-[var(--border)]">
            {sorted.map((p, i) => {
              const cls    = HERO_CLASSES[p.heroClass] || HERO_CLASSES.guardian
              const level  = getHeroLevel(p.heroXP || 0)
              const isOwn  = p.id === currentPlayerId
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 px-3 py-2 ${isOwn ? 'bg-[rgba(255,69,0,0.07)]' : ''}`}
                >
                  {/* Ранг */}
                  <span className={`font-bebas text-lg w-6 text-center ${rankStyle[i] || 'text-[#444]'}`}>
                    {i + 1}
                  </span>
                  {/* Клас */}
                  <span className="text-xl w-7 text-center">{cls.icon}</span>
                  {/* Ім'я */}
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold text-sm truncate ${isOwn ? 'text-[var(--accent)]' : 'text-white'}`}>
                      {p.heroName}
                      {isOwn && <span className="ml-1 text-[10px] text-[var(--accent)] opacity-70">(ти)</span>}
                    </div>
                    <div className="text-xs text-[#555] truncate">{p.name}</div>
                  </div>
                  {/* Рівень + XP */}
                  <div className="text-right shrink-0">
                    <div className="font-mono text-sm text-[var(--gold)]">Рів. {level}</div>
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

// ─── Панель гравця (знизу) ────────────────────────────────────
function PlayerPanel({ player, isOwn, onClose, onTrade }) {
  const cls = HERO_CLASSES[player.heroClass] || HERO_CLASSES.guardian

  // Топ-3 будівлі за рівнем
  const topBuildings = Object.entries(player.buildings || {})
    .filter(([, b]) => b.level > 0)
    .sort((a, b) => b[1].level - a[1].level)
    .slice(0, 3)

  // Назви будівель (спрощені)
  const BUILDING_NAMES = {
    server:   'Сервер',
    lab:      'Лабораторія',
    tower:    'Вежа',
    archive:  'Сховище',
    firewall: 'Брандмауер',
  }

  return (
    <>
      {/* Фон */}
      <div
        className="fixed inset-0 z-30"
        style={{ background: 'transparent' }}
        onClick={onClose}
      />

      {/* Панель */}
      <div className="fixed bottom-[56px] left-0 right-0 z-40 animate-slide-up">
        <div
          className="mx-2 mb-2 rounded-xl border border-[var(--border)] overflow-hidden"
          style={{ background: 'rgba(18,18,30,0.97)', backdropFilter: 'blur(12px)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Шапка панелі */}
          <div className="flex items-center justify-between p-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{cls.icon}</span>
              <div>
                <div className="font-bebas text-lg text-white tracking-wide leading-tight">
                  {player.heroName}
                  {isOwn && <span className="ml-2 text-xs text-[var(--accent)] font-raj">(ваше місто)</span>}
                </div>
                <div className="text-xs text-[#666]">
                  {player.name} · {cls.name} · Рівень {player.heroLevel || 1}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center text-[#555] hover:text-white rounded"
            >
              ✕
            </button>
          </div>

          {/* Тіло панелі */}
          <div className="p-3 flex items-center justify-between gap-3">
            {/* Будівлі */}
            {topBuildings.length > 0 ? (
              <div className="flex gap-2">
                {topBuildings.map(([id, b]) => (
                  <div key={id} className="flex flex-col items-center gap-0.5 bg-[var(--bg3)] rounded px-2 py-1">
                    <span className="text-xs text-[#888]">{BUILDING_NAMES[id] || id}</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3].map(lvl => (
                        <div
                          key={lvl}
                          className={`w-1.5 h-1.5 rounded-full ${lvl <= b.level ? 'bg-[var(--gold)]' : 'bg-[var(--border)]'}`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-xs text-[#555] italic">Будівлі ще не збудовані</span>
            )}

            {/* Кнопка торгівлі */}
            {!isOwn && (
              <button
                onClick={onTrade}
                className="btn btn-neon text-sm py-2 px-4 shrink-0"
              >
                🔄 Торгувати
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
