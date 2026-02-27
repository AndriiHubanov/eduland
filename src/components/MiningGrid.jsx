// ─── MiningGrid: Сітка міста (будівлі + видобуток) ───

import { useState, useEffect } from 'react'
import { RESOURCE_ICONS } from '../store/gameStore'

// ─── Конфіг ──────────────────────────────────────────────────
const GRID_COLS = 6
const GRID_ROWS = 5

const MINE_RATES = {
  1: { rate: 5,  max: 80  },
  2: { rate: 12, max: 200 },
  3: { rate: 25, max: 500 },
}

const MINE_UPGRADE_COSTS = {
  1: { gold: 200, bits: 30 },
  2: { gold: 400, bits: 80, code: 15 },
}

export const RESEARCH_COST   = { bits: 50 }
export const MINE_BUILD_COST = { gold: 150 }

// Рахуємо накопичений видобуток клієнтсайд
export function getMineAccumulated(cellState) {
  if (!cellState || cellState.status !== 'mine') return 0
  const last  = cellState.lastCollected?.toDate?.() || new Date(cellState.lastCollected)
  const hours = (Date.now() - last.getTime()) / 3600000
  const cfg   = MINE_RATES[cellState.mineLevel || 1]
  return Math.min(Math.floor(hours * cfg.rate), cfg.max)
}

// ─── Таймер зворотного відліку ────────────────────────────────
function ResearchTimer({ endsAt }) {
  const [text, setText] = useState('...')
  useEffect(() => {
    function calc() {
      const end  = endsAt?.toDate?.() || new Date(endsAt)
      const diff = Math.max(0, end.getTime() - Date.now())
      if (diff === 0) { setText('готово!'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setText(h > 0 ? `${h}г ${m}хв` : `${m}хв`)
    }
    calc()
    const id = setInterval(calc, 30000)
    return () => clearInterval(id)
  }, [endsAt])
  return <span className="font-mono text-[var(--info)]">{text}</span>
}

// ─── Одна клітинка сітки ─────────────────────────────────────
function GridCell({ cellState, hasResource, building, isSelected, onClick }) {
  let bg      = 'bg-[var(--bg2)]'
  let border  = 'border-[#1a1a24]'
  let content = <span className="text-[#1a1a24] text-[10px] select-none">·</span>

  // ── Будівля (пріоритет над усім) ──
  if (building) {
    const { config, state } = building
    const lvl = state.level || 0
    bg     = lvl > 0 ? 'bg-[var(--bg3)]' : 'bg-[var(--bg2)]'
    border = lvl > 0 ? 'border-[#3a3a50]' : 'border-dashed border-[#222]'
    content = (
      <div className="flex flex-col items-center gap-0 leading-none">
        <span style={{ fontSize: '0.9rem', opacity: lvl > 0 ? 1 : 0.3 }}>
          {config?.icon || '🏘️'}
        </span>
        {lvl > 0 && (
          <div className="flex gap-0.5 mt-0.5">
            {[1, 2, 3].map(l => (
              <div
                key={l}
                className={`w-1 h-1 rounded-full ${l <= lvl ? 'bg-[var(--gold)]' : 'bg-[#333]'}`}
              />
            ))}
          </div>
        )}
      </div>
    )
  // ── Копальня ──
  } else if (cellState?.status === 'mine') {
    const info = RESOURCE_ICONS[cellState.resource]
    const acc  = getMineAccumulated(cellState)
    bg     = 'bg-[var(--bg3)]'
    border = acc > 0 ? 'border-[var(--gold)]' : 'border-[#333]'
    content = (
      <div className="flex flex-col items-center gap-0 leading-none">
        <span style={{ fontSize: '0.9rem' }}>⛏️</span>
        <span
          className="text-[8px] font-mono mt-0.5"
          style={{ color: acc > 0 ? '#ffd700' : (info?.color || '#aaa') }}
        >
          {acc > 0 ? `+${acc}` : `Рів.${cellState.mineLevel || 1}`}
        </span>
      </div>
    )
  // ── Досліджується ──
  } else if (cellState?.status === 'researching') {
    const endsAt = cellState.endsAt?.toDate?.() || new Date(cellState.endsAt)
    const done   = Date.now() >= endsAt.getTime()
    bg     = done ? 'bg-[rgba(0,255,136,0.06)]' : 'bg-[rgba(0,170,255,0.06)]'
    border = done ? 'border-[var(--neon)]'       : 'border-[var(--info)]'
    content = (
      <span style={{ fontSize: '0.9rem' }} className="leading-none animate-pulse">
        {done ? '✨' : '⏳'}
      </span>
    )
  // ── Розкрито ──
  } else if (cellState?.status === 'revealed') {
    const info = RESOURCE_ICONS[cellState.resource]
    bg     = 'bg-[var(--bg3)]'
    border = 'border-[var(--neon)]'
    content = (
      <div className="flex flex-col items-center gap-0 leading-none">
        <span style={{ fontSize: '0.9rem' }}>{info?.icon || '💎'}</span>
        <span className="text-[7px] text-[var(--neon)] mt-0.5">будуй</span>
      </div>
    )
  // ── Прихований ресурс ──
  } else if (hasResource) {
    border  = 'border-[#252535]'
    bg      = 'bg-[rgba(255,255,255,0.015)]'
    content = (
      <span className="text-[10px] font-mono select-none" style={{ color: 'rgba(150,150,200,0.18)' }}>
        ?
      </span>
    )
  }

  return (
    <div
      onClick={onClick}
      className={`
        flex items-center justify-center border transition-all select-none
        ${bg} ${border}
        ${isSelected ? 'ring-1 ring-white/40' : ''}
        cursor-pointer active:scale-95 hover:brightness-125
      `}
      style={{ aspectRatio: '1 / 1' }}
    >
      {content}
    </div>
  )
}

// ─── Оболонка слайд-ап панелі ────────────────────────────────
function PanelShell({ title, onClose, children }) {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="fixed bottom-[56px] left-0 right-0 z-40 animate-slide-up">
        <div
          className="mx-2 mb-2 rounded-xl border border-[var(--border)] overflow-hidden"
          style={{ background: 'rgba(14,14,24,0.97)', backdropFilter: 'blur(12px)' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-3 border-b border-[var(--border)]">
            <span className="font-bebas text-lg tracking-widest text-white">{title}</span>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center text-[#555] hover:text-white rounded transition-colors"
            >✕</button>
          </div>
          <div className="p-3">{children}</div>
        </div>
      </div>
    </>
  )
}

// ─── Панель: Порожня клітинка (розміщення будівлі) ───────────
function EmptyCellPanel({ player, buildings, cellIdx, onClose, onPlaceBuilding }) {
  const positions = player.buildingPositions || {}

  // Будівлі що вже побудовані та ще не мають позиції на сітці
  const unplaced = buildings.filter(b => {
    const lvl = player.buildings?.[b.id]?.level || 0
    return lvl > 0 && positions[b.id] === undefined
  })

  // Будівлі побудовані та розміщені (можна перемістити сюди)
  const placed = buildings.filter(b => {
    const lvl = player.buildings?.[b.id]?.level || 0
    return lvl > 0 && positions[b.id] !== undefined
  })

  return (
    <PanelShell onClose={onClose} title="ПОРОЖНЯ ДІЛЯНКА">
      <div className="flex flex-col gap-3">
        {unplaced.length > 0 ? (
          <>
            <p className="text-xs text-[#888]">Оберіть будівлю для розміщення на цій ділянці:</p>
            <div className="flex flex-col gap-1.5">
              {unplaced.map(b => {
                const state = player.buildings?.[b.id]
                return (
                  <button
                    key={b.id}
                    onClick={() => onPlaceBuilding(b.id, cellIdx)}
                    className="flex items-center gap-3 bg-[var(--bg3)] hover:bg-[rgba(255,255,255,0.04)] border border-[var(--border)] hover:border-[var(--accent)] rounded px-3 py-2 text-left transition-colors"
                  >
                    <span className="text-2xl">{b.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">{b.name}</div>
                      <div className="flex gap-0.5 mt-0.5">
                        {[1, 2, 3].map(l => (
                          <div
                            key={l}
                            className={`w-1.5 h-1.5 rounded-full ${l <= state.level ? 'bg-[var(--gold)]' : 'bg-[#333]'}`}
                          />
                        ))}
                      </div>
                    </div>
                    <span className="text-[var(--accent)] text-xs">Розмістити →</span>
                  </button>
                )
              })}
            </div>
          </>
        ) : placed.length > 0 ? (
          <>
            <p className="text-xs text-[#888]">Всі побудовані будівлі вже розміщені на полі. Можна перемістити одну сюди:</p>
            <div className="flex flex-col gap-1.5">
              {placed.map(b => {
                const state = player.buildings?.[b.id]
                return (
                  <button
                    key={b.id}
                    onClick={() => onPlaceBuilding(b.id, cellIdx)}
                    className="flex items-center gap-3 bg-[var(--bg3)] hover:bg-[rgba(255,255,255,0.04)] border border-[var(--border)] hover:border-[#555] rounded px-3 py-2 text-left transition-colors"
                  >
                    <span className="text-2xl">{b.icon}</span>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">{b.name}</div>
                      <div className="text-[10px] text-[#555]">Перемістити сюди</div>
                    </div>
                    <span className="text-[#555] text-xs">→</span>
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <div className="text-center py-4 text-xs text-[#555]">
            <div className="text-2xl mb-2">🏗️</div>
            Спочатку збудуй будівлі — тоді зможеш розміщати їх на полі.
          </div>
        )}
      </div>
    </PanelShell>
  )
}

// ─── Панель: Будівля на сітці ────────────────────────────────
function BuildingCellPanel({ player, buildings, building, cellIdx, onClose, onRemoveBuilding, onWorkerToggle, onUpgrade }) {
  const { config, state } = building
  const workerCount  = state.workers || 0
  const lvlConfig    = config?.levels?.[state.level - 1]
  const nextLvlCfg   = config?.levels?.[state.level]
  const totalPlaced  = player.workers?.placed || 0
  const totalWorkers = player.workers?.total  || 5
  const noFreeWorkers = totalPlaced >= totalWorkers
  const maxSlots     = lvlConfig?.workerSlots || 0

  const canUpgrade = nextLvlCfg
    ? Object.entries(nextLvlCfg.cost).every(([res, cost]) => (player.resources?.[res] || 0) >= cost)
    : false

  return (
    <PanelShell onClose={onClose} title={config?.name?.toUpperCase() || 'БУДІВЛЯ'}>
      <div className="flex flex-col gap-3">

        {/* Шапка будівлі */}
        <div className="flex items-center gap-3 bg-[var(--bg3)] rounded p-3">
          <span className="text-3xl">{config?.icon}</span>
          <div className="flex-1">
            <div className="font-semibold text-white">{config?.name}</div>
            <div className="flex gap-0.5 mt-1">
              {[1, 2, 3].map(l => (
                <div
                  key={l}
                  className={`w-2 h-2 rounded-full ${l <= state.level ? 'bg-[var(--gold)]' : 'bg-[#333]'}`}
                />
              ))}
              <span className="text-xs text-[#555] ml-1">Рівень {state.level}</span>
            </div>
          </div>
        </div>

        {/* Виробництво */}
        {lvlConfig?.production && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(lvlConfig.production).map(([res, rate]) => {
              const info = RESOURCE_ICONS[res]
              if (!info || rate <= 0) return null
              return (
                <span key={res} className="text-xs font-mono px-2 py-0.5 bg-[var(--bg3)] rounded border border-[var(--border)]" style={{ color: info.color }}>
                  {info.icon}+{rate}/год
                </span>
              )
            })}
          </div>
        )}

        {/* Слоти робітників */}
        {maxSlots > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#555] uppercase tracking-wider">Робітники</span>
              <span className="text-xs text-[#444] font-mono">{workerCount}/{maxSlots}</span>
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: maxSlots }).map((_, i) => {
                const filled   = i < workerCount
                const disabled = i >= workerCount && noFreeWorkers
                return (
                  <button
                    key={i}
                    onClick={() => onWorkerToggle(config.id, filled ? 'remove' : 'add')}
                    disabled={disabled}
                    className={`
                      w-8 h-8 rounded flex items-center justify-center text-sm
                      border transition-all active:scale-95
                      ${filled
                        ? 'bg-[rgba(0,255,136,0.15)] border-[var(--neon)] text-[var(--neon)]'
                        : 'bg-[var(--bg3)] border-[var(--border)] text-[#333]'
                      }
                      ${disabled && !filled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    {filled ? '👤' : '+'}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Апгрейд */}
        {nextLvlCfg && (
          <div className="flex flex-col gap-1.5 pt-2 border-t border-[var(--border)]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#555]">Апгрейд → Рівень {state.level + 1}</span>
              <div className="flex gap-2">
                {Object.entries(nextLvlCfg.cost).map(([res, cost]) => {
                  const info = RESOURCE_ICONS[res]
                  return (
                    <span key={res} className="font-mono text-[#666]">
                      {info?.icon}{cost}
                    </span>
                  )
                })}
              </div>
            </div>
            <button
              onClick={() => canUpgrade && onUpgrade(config.id)}
              disabled={!canUpgrade}
              className={`btn text-xs py-1.5 border ${
                canUpgrade
                  ? 'border-[var(--gold)] text-[var(--gold)] hover:bg-[rgba(255,215,0,0.08)]'
                  : 'border-[var(--border)] text-[#444] cursor-not-allowed'
              }`}
            >
              {canUpgrade ? '⬆ АПГРЕЙД' : 'НЕДОСТАТНЬО РЕСУРСІВ'}
            </button>
          </div>
        )}

        {!nextLvlCfg && (
          <div className="text-center text-xs text-[var(--gold)] font-semibold">
            ★ МАКСИМАЛЬНИЙ РІВЕНЬ
          </div>
        )}

        {/* Зняти з поля */}
        <button
          onClick={() => onRemoveBuilding(config.id, cellIdx)}
          className="btn text-xs py-1.5 border border-[#333] text-[#444] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
        >
          ✕ ЗНЯТИ З ПОЛЯ
        </button>
      </div>
    </PanelShell>
  )
}

// ─── Панель: Прихований ресурс (дослідження) ─────────────────
function HiddenResourcePanel({ player, cellIdx, onClose, onStartResearch }) {
  const labLevel    = player.buildings?.lab?.level || 0
  const canResearch = labLevel >= 1
  const hasEnough   = (player.resources?.bits || 0) >= RESEARCH_COST.bits
  const canStart    = canResearch && hasEnough

  return (
    <PanelShell onClose={onClose} title="НЕВІДОМА ДІЛЯНКА">
      <div className="flex flex-col gap-3">
        <p className="text-xs text-[#888] leading-relaxed">
          Сканери виявили аномалію. Надішли лабораторію для детального аналізу.
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-[var(--bg3)] rounded p-2">
            <div className="text-[#555] mb-0.5">Вартість</div>
            <div className="font-mono text-[var(--info)]">💾 {RESEARCH_COST.bits} Бітів</div>
          </div>
          <div className="bg-[var(--bg3)] rounded p-2">
            <div className="text-[#555] mb-0.5">Час</div>
            <div className="font-mono text-white">6 годин</div>
          </div>
        </div>
        {!canResearch && (
          <div className="text-xs text-center text-[var(--accent)] py-1 border border-[rgba(255,69,0,0.3)] rounded">
            🔬 Потрібна Лабораторія Рів. 1+
          </div>
        )}
        <button
          onClick={() => canStart && onStartResearch(cellIdx)}
          disabled={!canStart}
          className={`btn text-sm py-2 border ${
            canStart
              ? 'border-[var(--info)] text-[var(--info)] hover:bg-[rgba(0,170,255,0.08)]'
              : 'border-[var(--border)] text-[#444] cursor-not-allowed'
          }`}
        >
          {!canResearch ? '🔬 ПОТРІБНА ЛАБОРАТОРІЯ' : !hasEnough ? 'НЕДОСТАТНЬО БІТІВ' : '🔬 ДОСЛІДЖУВАТИ'}
        </button>
      </div>
    </PanelShell>
  )
}

// ─── Панель: Дослідження (в процесі) ─────────────────────────
function ResearchingPanel({ cellState, cellIdx, onClose, onRevealCell }) {
  const endsAt = cellState.endsAt?.toDate?.() || new Date(cellState.endsAt)
  const isDone = Date.now() >= endsAt.getTime()

  return (
    <PanelShell onClose={onClose} title={isDone ? 'ДОСЛІДЖЕННЯ ЗАВЕРШЕНО!' : 'ДОСЛІДЖЕННЯ...'}>
      <div className="flex flex-col gap-3">
        {isDone ? (
          <>
            <p className="text-xs text-[#888] leading-relaxed">
              Лабораторія завершила аналіз. Відкрий результат!
            </p>
            <button
              onClick={() => onRevealCell(cellIdx)}
              className="btn text-sm py-2 border border-[var(--neon)] text-[var(--neon)] hover:bg-[rgba(0,255,136,0.08)]"
            >
              ✨ РОЗКРИТИ РЕЗУЛЬТАТ
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-[#888] leading-relaxed">
              Лабораторія досліджує ділянку. Повертайся пізніше.
            </p>
            <div className="flex items-center justify-between bg-[var(--bg3)] rounded p-2">
              <span className="text-xs text-[#555]">Залишилось:</span>
              <ResearchTimer endsAt={cellState.endsAt} />
            </div>
          </>
        )}
      </div>
    </PanelShell>
  )
}

// ─── Панель: Знайдений ресурс (будуємо копальню) ─────────────
function RevealedPanel({ player, cellState, cellIdx, onClose, onBuildMine }) {
  const info    = RESOURCE_ICONS[cellState.resource]
  const hasGold = (player.resources?.gold || 0) >= MINE_BUILD_COST.gold

  return (
    <PanelShell onClose={onClose} title="РЕСУРС ЗНАЙДЕНО!">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 bg-[var(--bg3)] rounded p-3 border border-[var(--neon)]">
          <span className="text-4xl">{info?.icon || '💎'}</span>
          <div>
            <div className="font-semibold text-white text-base">{info?.name || cellState.resource}</div>
            <div className="text-xs text-[#555]">Тут є поклади ресурсу</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-[var(--bg3)] rounded p-2">
            <div className="text-[#555] mb-0.5">Вартість копальні</div>
            <div className="font-mono text-[var(--gold)]">🪙 {MINE_BUILD_COST.gold} Золота</div>
          </div>
          <div className="bg-[var(--bg3)] rounded p-2">
            <div className="text-[#555] mb-0.5">Видобуток</div>
            <div className="font-mono text-white">5 → 25/год</div>
          </div>
        </div>
        <button
          onClick={() => hasGold && onBuildMine(cellIdx)}
          disabled={!hasGold}
          className={`btn text-sm py-2 border ${
            hasGold
              ? 'border-[var(--gold)] text-[var(--gold)] hover:bg-[rgba(255,215,0,0.08)]'
              : 'border-[var(--border)] text-[#444] cursor-not-allowed'
          }`}
        >
          {hasGold ? '⛏️ ПОБУДУВАТИ КОПАЛЬНЮ' : 'НЕДОСТАТНЬО ЗОЛОТА'}
        </button>
      </div>
    </PanelShell>
  )
}

// ─── Панель: Копальня ─────────────────────────────────────────
function MinePanel({ player, cellState, cellIdx, onClose, onCollectMine, onUpgradeMine }) {
  const mineLevel       = cellState.mineLevel || 1
  const accumulated     = getMineAccumulated(cellState)
  const cfg             = MINE_RATES[mineLevel]
  const info            = RESOURCE_ICONS[cellState.resource]
  const upgradeCost     = MINE_UPGRADE_COSTS[mineLevel]
  const canUpgrade      = mineLevel < 3 && upgradeCost
  const canAffordUpgrade = canUpgrade && Object.entries(upgradeCost).every(
    ([r, a]) => (player.resources?.[r] || 0) >= a
  )

  return (
    <PanelShell onClose={onClose} title={`КОПАЛЬНЯ — ${info?.name?.toUpperCase() || (cellState.resource || '').toUpperCase()}`}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Рівень',    value: `Рів. ${mineLevel}`, icon: info?.icon || '⛏️' },
            { label: 'Видобуток', value: `${cfg.rate}/год`,   icon: '⚡' },
            { label: 'Накоп.',    value: `${accumulated}/${cfg.max}`, icon: '📦' },
          ].map(({ label, value, icon }) => (
            <div key={label} className="text-center bg-[var(--bg3)] rounded p-2">
              <div className="text-base leading-none">{icon}</div>
              <div className="font-mono text-sm text-white mt-1">{value}</div>
              <div className="text-[10px] text-[#555] mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        <div className="h-1 bg-[var(--border)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min((accumulated / cfg.max) * 100, 100)}%`,
              background: info?.color || 'var(--neon)',
            }}
          />
        </div>

        <button
          onClick={() => accumulated > 0 && onCollectMine(cellIdx)}
          disabled={accumulated === 0}
          className={`btn text-sm py-2 border ${
            accumulated > 0
              ? 'border-[var(--neon)] text-[var(--neon)] hover:bg-[rgba(0,255,136,0.08)]'
              : 'border-[var(--border)] text-[#444] cursor-not-allowed'
          }`}
        >
          {accumulated > 0 ? `📥 ЗІБРАТИ ${accumulated} ${info?.icon || ''}` : 'НІЧОГО ЗБИРАТИ'}
        </button>

        {canUpgrade && (
          <div className="flex flex-col gap-2 pt-2 border-t border-[var(--border)]">
            <div className="flex items-center justify-between text-xs text-[#555]">
              <span>Апгрейд → Рів. {mineLevel + 1}</span>
              <div className="flex gap-2">
                {Object.entries(upgradeCost).map(([r, a]) => {
                  const ri = RESOURCE_ICONS[r]
                  return <span key={r} className="font-mono">{ri?.icon}{a}</span>
                })}
              </div>
            </div>
            <button
              onClick={() => canAffordUpgrade && onUpgradeMine(cellIdx)}
              disabled={!canAffordUpgrade}
              className={`btn text-xs py-1.5 border ${
                canAffordUpgrade
                  ? 'border-[var(--gold)] text-[var(--gold)] hover:bg-[rgba(255,215,0,0.08)]'
                  : 'border-[var(--border)] text-[#444] cursor-not-allowed'
              }`}
            >
              {canAffordUpgrade ? '⬆ АПГРЕЙД' : 'НЕДОСТАТНЬО РЕСУРСІВ'}
            </button>
          </div>
        )}

        {mineLevel === 3 && (
          <div className="text-center text-xs text-[var(--gold)] font-semibold pt-1 border-t border-[var(--border)]">
            ★ МАКСИМАЛЬНИЙ РІВЕНЬ
          </div>
        )}
      </div>
    </PanelShell>
  )
}

// ─── Головний компонент ───────────────────────────────────────
export default function MiningGrid({
  player,
  buildings,
  onStartResearch,
  onRevealCell,
  onBuildMine,
  onCollectMine,
  onUpgradeMine,
  onPlaceBuilding,
  onRemoveBuilding,
  onWorkerToggle,
  onUpgrade,
}) {
  const [selectedCell, setSelectedCell] = useState(null)

  const cellStates       = player.cellStates       || {}
  const resourceMap      = player.resourceMap       || {}
  const buildingPositions = player.buildingPositions || {}

  // Будуємо lookup: cellIdx → { id, config, state }
  const buildingMap = {}
  for (const [buildingId, cellIdx] of Object.entries(buildingPositions)) {
    if (cellIdx === null || cellIdx === undefined) continue
    const config = buildings.find(b => b.id === buildingId)
    const state  = player.buildings?.[buildingId] || { level: 0, workers: 0 }
    buildingMap[cellIdx.toString()] = { id: buildingId, config, state }
  }

  function handleCellClick(idx) {
    setSelectedCell(prev => prev === idx ? null : idx)
  }

  // Визначаємо що показати в панелі для вибраної клітинки
  const selKey       = selectedCell !== null ? selectedCell.toString() : null
  const selBuilding  = selKey ? (buildingMap[selKey] || null) : null
  const selCellState = selKey ? (cellStates[selKey] || null) : null
  const selHasRes    = selKey ? Boolean(resourceMap[selKey]) : false
  const showPanel    = selectedCell !== null

  // Статистика
  const mineCount    = Object.values(cellStates).filter(s => s.status === 'mine').length
  const buildingCount = Object.values(buildingPositions).filter(v => v !== null && v !== undefined).length
  const researching  = Object.values(cellStates).filter(s => s.status === 'researching').length

  return (
    <div>
      {/* Коротка статистика */}
      <div className="flex flex-wrap gap-3 mb-2 text-xs text-[#555] font-mono">
        {buildingCount > 0 && <span className="text-[#888]">🏛️ {buildingCount} будівель</span>}
        {mineCount     > 0 && <span>⛏️ {mineCount} копалень</span>}
        {researching   > 0 && <span className="text-[var(--info)]">⏳ {researching} досліджується</span>}
      </div>

      {/* Сітка */}
      <div
        style={{ display: 'grid', gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`, gap: 2 }}
        className="bg-[var(--bg3)] p-1.5 rounded-lg border border-[var(--border)]"
      >
        {Array.from({ length: GRID_COLS * GRID_ROWS }).map((_, idx) => (
          <GridCell
            key={idx}
            cellState={cellStates[idx.toString()] || null}
            hasResource={Boolean(resourceMap[idx.toString()])}
            building={buildingMap[idx.toString()] || null}
            isSelected={selectedCell === idx}
            onClick={() => handleCellClick(idx)}
          />
        ))}
      </div>

      {/* Легенда */}
      <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-[#333]">
        <span>? = ресурс</span>
        <span>⏳ = досліджується</span>
        <span>⛏️ = копальня</span>
        <span>🏛️ = будівля</span>
      </div>

      {/* ─── Панелі дій ─── */}
      {showPanel && selBuilding && (
        <BuildingCellPanel
          player={player}
          buildings={buildings}
          building={selBuilding}
          cellIdx={selectedCell}
          onClose={() => setSelectedCell(null)}
          onRemoveBuilding={(id, idx) => { onRemoveBuilding(id, idx); setSelectedCell(null) }}
          onWorkerToggle={onWorkerToggle}
          onUpgrade={onUpgrade}
        />
      )}

      {showPanel && !selBuilding && selCellState?.status === 'researching' && (
        <ResearchingPanel
          cellState={selCellState}
          cellIdx={selectedCell}
          onClose={() => setSelectedCell(null)}
          onRevealCell={(idx) => { onRevealCell(idx); setSelectedCell(null) }}
        />
      )}

      {showPanel && !selBuilding && selCellState?.status === 'revealed' && (
        <RevealedPanel
          player={player}
          cellState={selCellState}
          cellIdx={selectedCell}
          onClose={() => setSelectedCell(null)}
          onBuildMine={(idx) => { onBuildMine(idx); setSelectedCell(null) }}
        />
      )}

      {showPanel && !selBuilding && selCellState?.status === 'mine' && (
        <MinePanel
          player={player}
          cellState={selCellState}
          cellIdx={selectedCell}
          onClose={() => setSelectedCell(null)}
          onCollectMine={onCollectMine}
          onUpgradeMine={onUpgradeMine}
        />
      )}

      {showPanel && !selBuilding && !selCellState && selHasRes && (
        <HiddenResourcePanel
          player={player}
          cellIdx={selectedCell}
          onClose={() => setSelectedCell(null)}
          onStartResearch={(idx) => { onStartResearch(idx); setSelectedCell(null) }}
        />
      )}

      {showPanel && !selBuilding && !selCellState && !selHasRes && (
        <EmptyCellPanel
          player={player}
          buildings={buildings}
          cellIdx={selectedCell}
          onClose={() => setSelectedCell(null)}
          onPlaceBuilding={(id, idx) => { onPlaceBuilding(id, idx); setSelectedCell(null) }}
        />
      )}
    </div>
  )
}
