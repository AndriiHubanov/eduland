// ─── Equipment Page (/equipment): Спорядження Героя ───

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useGameStore from '../store/gameStore'
import {
  EQUIPMENT_SETS, EQUIPMENT_SLOTS, SLOT_LABELS, SLOT_ICONS,
  parseItemId, itemId, calcEquipmentBonuses, countSetItems,
} from '../config/equipment'
import {
  equipItem, unequipItem,
  getOrRefreshBlackMarket, subscribeBlackMarket, buyBlackMarketItem,
} from '../firebase/equipmentService'
import {
  Button, Card, Spinner, ErrorMsg, SuccessMsg, EmptyState, BottomNav
} from '../components/UI'
import { useHaptic } from '../hooks/useHaptic'

const NAV_ITEMS = [
  { id: 'city',  icon: '🏙️', label: 'Місто'   },
  { id: 'map',   icon: '🗺️', label: 'Карта'   },
  { id: 'tasks', icon: '⚔️', label: 'Завдання' },
  { id: 'inbox', icon: '📬', label: 'Пошта'   },
  { id: 'trade', icon: '🔄', label: 'Торгівля' },
]

export default function Equipment() {
  const navigate = useNavigate()
  const { player, unreadMessages } = useGameStore()
  const [activeTab, setActiveTab]  = useState('equipment')
  const haptic = useHaptic()

  useEffect(() => {
    if (!player) navigate('/')
  }, [player])

  if (!player) return null

  const inventory = player.inventory || { equipped: {}, items: [] }
  const bonuses   = calcEquipmentBonuses(inventory)

  function handleNavChange(id) {
    const routes = { city:'/city', map:'/map', tasks:'/tasks', inbox:'/inbox', trade:'/trade' }
    if (routes[id]) navigate(routes[id])
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <header className="sticky top-0 z-40 bg-[var(--bg2)] border-b border-[var(--border)] p-3">
        <button onClick={() => navigate('/city')} className="text-xs text-[#555] hover:text-[var(--text)]">
          ← Місто
        </button>
        <h1 className="font-bebas text-2xl tracking-widest text-white mt-0.5">СПОРЯДЖЕННЯ</h1>
      </header>

      {/* Підвкладки */}
      <div className="sticky top-[57px] z-30 bg-[var(--bg2)] border-b border-[var(--border)] flex">
        {[
          { id: 'equipment',   label: '⚔️ Набори'     },
          { id: 'inventory',   label: '🎒 Інвентар'   },
          { id: 'market',      label: '🏪 Чорний ринок' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-2.5 text-xs font-semibold tracking-wider uppercase transition-all border-b-2 ${
              activeTab === t.id
                ? 'border-[var(--neon)] text-[var(--neon)]'
                : 'border-transparent text-[#555] hover:text-[var(--text)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main className="flex-1 p-4 pb-20 max-w-2xl mx-auto w-full">
        {activeTab === 'equipment' && (
          <SlotsTab player={player} inventory={inventory} bonuses={bonuses} haptic={haptic} />
        )}
        {activeTab === 'inventory' && (
          <InventoryTab player={player} inventory={inventory} haptic={haptic} />
        )}
        {activeTab === 'market' && (
          <BlackMarketTab player={player} inventory={inventory} haptic={haptic} />
        )}
      </main>

      <BottomNav
        items={NAV_ITEMS.map(i => ({ ...i, badge: i.id === 'inbox' ? unreadMessages : 0 }))}
        active=""
        onChange={handleNavChange}
      />
    </div>
  )
}

// ─── СЛОТИ СПОРЯДЖЕННЯ ────────────────────────────────────────
function SlotsTab({ player, inventory, bonuses, haptic }) {
  const [pickerSlot, setPickerSlot] = useState(null)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState('')

  const equipped = inventory.equipped || {}

  async function handleEquip(id, slot) {
    try {
      await equipItem(player.id, id, slot)
      haptic.success()
      setSuccess('Екіпіровано!')
      setPickerSlot(null)
    } catch (e) {
      haptic.error()
      setError(e.message)
    }
  }

  async function handleUnequip(slot) {
    try {
      await unequipItem(player.id, slot)
      haptic.click()
    } catch (e) {
      setError(e.message)
    }
  }

  // Підрахунок прогресу по наборах
  const setSummary = Object.entries(EQUIPMENT_SETS).map(([setId, set]) => {
    const count    = countSetItems(inventory, setId)
    const equipped = EQUIPMENT_SLOTS.filter(slot => inventory.equipped?.[slot] === itemId(setId, slot)).length
    return { setId, set, count, equipped }
  })

  return (
    <div className="flex flex-col gap-4">
      {error   && <ErrorMsg text={error} />}
      {success && <SuccessMsg text={success} />}

      {/* Слоти */}
      <section>
        <p className="text-xs text-[#555] uppercase tracking-widest mb-3">Слоти спорядження</p>
        <div className="grid grid-cols-2 gap-2">
          {EQUIPMENT_SLOTS.map(slot => {
            const id       = equipped[slot]
            let setData, itemData
            if (id) {
              const { setId, slot: s } = parseItemId(id)
              setData  = EQUIPMENT_SETS[setId]
              itemData = setData?.items?.[s]
            }
            return (
              <button
                key={slot}
                onClick={() => { setPickerSlot(slot); setError('') }}
                className={`flex items-center gap-2 p-3 rounded-lg border transition-all text-left ${
                  id
                    ? 'border-[var(--neon)] bg-[rgba(0,255,136,0.05)]'
                    : 'border-[var(--border)] bg-[var(--card)] hover:border-[#333]'
                }`}
              >
                <span className="text-xl">{SLOT_ICONS[slot]}</span>
                <div className="min-w-0">
                  <div className="text-[10px] text-[#555] uppercase tracking-wider">{SLOT_LABELS[slot]}</div>
                  {itemData ? (
                    <div className="text-xs text-white truncate" style={{ color: setData?.color }}>
                      {itemData.name}
                    </div>
                  ) : (
                    <div className="text-xs text-[#444]">Порожньо</div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Активні бонуси */}
      {Object.keys(bonuses).length > 0 && (
        <section>
          <p className="text-xs text-[#555] uppercase tracking-widest mb-2">Активні бонуси</p>
          <Card className="border-[var(--neon)] bg-[rgba(0,255,136,0.03)]">
            <div className="flex flex-wrap gap-2">
              {Object.entries(bonuses).map(([key, val]) => (
                <span key={key} className="text-xs font-mono text-[var(--neon)] bg-[var(--bg3)] px-2 py-1 rounded border border-[var(--border)]">
                  +{typeof val === 'number' && val < 1 ? `${Math.round(val*100)}%` : val} {key.replace(/_/g,' ')}
                </span>
              ))}
            </div>
          </Card>
        </section>
      )}

      {/* Прогрес наборів */}
      <section>
        <p className="text-xs text-[#555] uppercase tracking-widest mb-2">Колекція наборів</p>
        <div className="flex flex-col gap-2">
          {setSummary.map(({ setId, set, count, equipped: eq }) => {
            const full = count === 6
            return (
              <div key={setId} className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                full ? 'border-[var(--neon)] bg-[rgba(0,255,136,0.05)]' : 'border-[var(--border)] bg-[var(--card)]'
              }`}>
                <span className="text-xl shrink-0">{set.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold" style={{ color: set.color }}>{set.name}</span>
                    <span className="text-[10px] font-mono text-[#555]">{count}/6 предметів</span>
                  </div>
                  <div className="h-1 bg-[var(--border)] rounded overflow-hidden">
                    <div
                      className={count === 6 ? 'bar-fill h-full rounded' : 'h-full rounded transition-all'}
                      style={{ width: `${(count/6)*100}%`, backgroundColor: count < 6 ? set.color : undefined }}
                    />
                  </div>
                  {full && (
                    <p className="text-[10px] text-[var(--neon)] mt-1">{set.setBonus.description}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Піккер предмету */}
      {pickerSlot && (
        <ItemPicker
          slot={pickerSlot}
          inventory={inventory}
          onEquip={handleEquip}
          onUnequip={() => { handleUnequip(pickerSlot); setPickerSlot(null) }}
          onClose={() => setPickerSlot(null)}
        />
      )}
    </div>
  )
}

// ─── Піккер предмету (модальне вікно) ────────────────────────
function ItemPicker({ slot, inventory, onEquip, onUnequip, onClose }) {
  const owned     = inventory.items || []
  const equipped  = inventory.equipped?.[slot]
  // Предмети підходящого слоту
  const available = owned.filter(id => {
    const parsed = parseItemId(id)
    return parsed.slot === slot
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/60"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg mx-auto bg-[var(--bg2)] rounded-t-2xl p-4 animate-slide-up max-h-[70vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="font-bebas text-lg tracking-wider">{SLOT_ICONS[slot]} {SLOT_LABELS[slot]}</p>
          <button onClick={onClose} className="text-[#555] hover:text-white text-xl">✕</button>
        </div>

        {equipped && (
          <button
            onClick={onUnequip}
            className="w-full mb-3 p-2.5 rounded-lg border border-[var(--accent)] bg-[rgba(255,69,0,0.08)] text-xs text-[var(--accent)] font-semibold"
          >
            Зняти поточний предмет
          </button>
        )}

        {available.length === 0 ? (
          <EmptyState icon="🎒" text="Немає предметів для цього слоту" />
        ) : (
          <div className="flex flex-col gap-2">
            {available.map(id => {
              const { setId, slot: s } = parseItemId(id)
              const set  = EQUIPMENT_SETS[setId]
              const item = set?.items?.[s]
              const isEq = equipped === id
              return (
                <button
                  key={id}
                  onClick={() => onEquip(id, slot)}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                    isEq
                      ? 'border-[var(--neon)] bg-[rgba(0,255,136,0.08)]'
                      : 'border-[var(--border)] bg-[var(--card)] hover:border-[#333]'
                  }`}
                >
                  <span className="text-2xl">{set?.icon}</span>
                  <div>
                    <div className="text-sm font-semibold text-white">{item?.name}</div>
                    <div className="text-[10px] text-[#555]" style={{ color: set?.color }}>{set?.name}</div>
                    <div className="text-[10px] text-[var(--neon)] mt-0.5">
                      {Object.entries(item?.bonus || {}).map(([k,v]) =>
                        `+${typeof v === 'number' && v < 1 ? Math.round(v*100)+'%' : v} ${k.replace(/_/g,' ')}`
                      ).join(' · ')}
                    </div>
                  </div>
                  {isEq && <span className="ml-auto text-[var(--neon)] text-lg">✓</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ІНВЕНТАР ─────────────────────────────────────────────────
function InventoryTab({ player, inventory, haptic }) {
  const [filterSet, setFilterSet] = useState(null)
  const items = inventory.items || []

  const filtered = filterSet
    ? items.filter(id => id.startsWith(filterSet))
    : items

  return (
    <div className="flex flex-col gap-4">
      {/* Фільтр по набору */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterSet(null)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            !filterSet ? 'border-[var(--neon)] text-[var(--neon)] bg-[rgba(0,255,136,0.08)]' : 'border-[var(--border)] text-[#555]'
          }`}
        >
          Всі ({items.length})
        </button>
        {Object.entries(EQUIPMENT_SETS).map(([setId, set]) => {
          const count = items.filter(id => id.startsWith(setId)).length
          if (!count) return null
          return (
            <button
              key={setId}
              onClick={() => setFilterSet(filterSet === setId ? null : setId)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                filterSet === setId
                  ? 'border-[var(--neon)] text-[var(--neon)] bg-[rgba(0,255,136,0.08)]'
                  : 'border-[var(--border)] text-[#555]'
              }`}
            >
              {set.icon} {set.name} ({count})
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="🎒" text="Інвентар порожній. Виконуй експедиції щоб знаходити предмети!" />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {filtered.map(id => {
            const { setId, slot } = parseItemId(id)
            const set  = EQUIPMENT_SETS[setId]
            const item = set?.items?.[slot]
            const isEq = Object.values(inventory.equipped || {}).includes(id)
            return (
              <div
                key={id}
                className={`p-3 rounded-lg border flex flex-col gap-1 ${
                  isEq
                    ? 'border-[var(--neon)] bg-[rgba(0,255,136,0.05)]'
                    : 'border-[var(--border)] bg-[var(--card)]'
                }`}
                style={{ borderColor: isEq ? undefined : set?.color + '44' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg">{set?.icon}</span>
                  <span className="text-[10px] text-[#555]">{SLOT_ICONS[slot]}</span>
                </div>
                <div className="text-xs font-semibold text-white leading-tight">{item?.name}</div>
                <div className="text-[10px]" style={{ color: set?.color }}>{set?.name}</div>
                {isEq && (
                  <span className="text-[10px] text-[var(--neon)] font-mono">● Екіпіровано</span>
                )}
                <div className="text-[10px] text-[#555] leading-tight">
                  {Object.entries(item?.bonus || {}).map(([k,v]) =>
                    `+${typeof v === 'number' && v < 1 ? Math.round(v*100)+'%' : v} ${k.replace(/_/g,' ')}`
                  ).join(' ')}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── ЧОРНИЙ РИНОК ─────────────────────────────────────────────
function BlackMarketTab({ player, inventory, haptic }) {
  const [market, setMarket]         = useState(null)
  const [loading, setLoading]       = useState(true)
  const [processing, setProcessing] = useState(null)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState('')
  const [countdown, setCountdown]   = useState('')

  useEffect(() => {
    getOrRefreshBlackMarket(player.group).catch(() => {})
    const unsub = subscribeBlackMarket(player.group, data => {
      setMarket(data)
      setLoading(false)
    })
    return () => unsub()
  }, [player.group])

  useEffect(() => {
    if (!market?.refreshAt) return
    const tick = () => {
      const ms   = typeof market.refreshAt === 'number' ? market.refreshAt : market.refreshAt?.toMillis?.() ?? 0
      const diff = ms - Date.now()
      if (diff <= 0) { setCountdown('оновлення...'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(h > 0 ? `${h}г ${m}хв` : `${m}хв ${s.toString().padStart(2,'0')}с`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [market?.refreshAt])

  async function handleBuy(index) {
    setError(''); setSuccess('')
    setProcessing(index)
    haptic.click()
    try {
      await buyBlackMarketItem(player.id, player.group, index)
      haptic.loot()
      setSuccess('Предмет придбано!')
    } catch (e) {
      haptic.error()
      setError(e.message)
    } finally {
      setProcessing(null)
    }
  }

  if (loading) return <Spinner text="Завантаження ринку..." />

  const items = market?.items || []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[#555] uppercase tracking-wider">Чорний ринок</p>
          <p className="text-[10px] text-[#444] font-mono mt-0.5">оновлення через {countdown}</p>
        </div>
        <div className="text-xs text-[var(--gold)] font-mono font-semibold">
          {player.resources?.gold || 0} 🪙
        </div>
      </div>

      {error   && <ErrorMsg text={error} />}
      {success && <SuccessMsg text={success} />}

      {items.length === 0 ? (
        <EmptyState icon="🏪" text="Ринок порожній" />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item, idx) => {
            if (!item) return null
            const { setId, slot } = parseItemId(item.itemId || '')
            const set      = EQUIPMENT_SETS[setId]
            const itemData = set?.items?.[slot]
            const owned    = (inventory.items || []).includes(item.itemId)
            const gold     = player.resources?.gold || 0
            const canBuy   = !item.sold && !owned && gold >= item.price
            const isProc   = processing === idx

            return (
              <Card key={idx} className={`${item.sold ? 'opacity-40' : ''} ${isProc ? 'pointer-events-none opacity-60' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[var(--bg3)] flex items-center justify-center text-2xl shrink-0"
                       style={{ borderColor: set?.color + '55', border: '1px solid' }}>
                    {set?.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white">{itemData?.name || item.itemId}</div>
                    <div className="text-[10px]" style={{ color: set?.color }}>{set?.name} · {SLOT_ICONS[slot]} {SLOT_LABELS[slot]}</div>
                    <div className="text-[10px] text-[#555] mt-0.5">
                      {Object.entries(itemData?.bonus || {}).map(([k,v]) =>
                        `+${typeof v === 'number' && v < 1 ? Math.round(v*100)+'%' : v} ${k.replace(/_/g,' ')}`
                      ).join(' ')}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-sm font-bold text-[var(--gold)]">{item.price} 🪙</div>
                    {item.sold ? (
                      <span className="text-[10px] text-[#555]">Продано</span>
                    ) : owned ? (
                      <span className="text-[10px] text-[var(--neon)]">Є в інвентарі</span>
                    ) : (
                      <Button
                        variant="gold"
                        className="text-xs px-3 py-1 mt-1"
                        disabled={!canBuy || isProc}
                        onClick={() => handleBuy(idx)}
                      >
                        Купити
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
