// ─── CityGrid.jsx — Візуальне поле міста (пост-апок стиль) ───

import { useState } from 'react'
import { RESOURCE_ICONS } from '../store/gameStore'

const GRID = 7

// Позиції будівель (0-indexed row, col)
const BUILDING_POS = {
  server:   { row: 1, col: 1 },
  lab:      { row: 1, col: 5 },
  firewall: { row: 3, col: 1 },
  tower:    { row: 6, col: 1 },
  archive:  { row: 6, col: 5 },
}

// Замок — 2×2 в центрі
const CASTLE = { row: 3, col: 3 }

// "Доріжки" між будівлями
const PATH_CELLS = new Set([
  '2,1','5,1',        // вертикаль server→firewall→tower
  '2,5','5,5',        // вертикаль lab→archive
  '3,2','4,2',        // горизонталь до замку (зліва)
  '3,5','4,5',        // горизонталь до замку (справа — archive col)
  '1,3',              // center top path
  '6,3',              // center bottom path
])

// Декоративні елементи (пост-апок)
const DECOR = {
  '0,0': null, '0,6': null, '6,0': null, '6,6': null, // кутові стовпи (рендеруємо окремо)
  '0,3': '💀',
  '2,3': '🪨',
  '4,0': '🌿',
  '6,3': '🌿',
  '1,3': '⚡',
  '2,0': '🪨',
  '0,2': '💀',
  '4,6': '🌿',
}

const cellKey = (r, c) => `${r},${c}`

// Яка будівля стоїть у клітинці?
function getBuildingAt(row, col) {
  if ((row === CASTLE.row || row === CASTLE.row + 1) &&
      (col === CASTLE.col || col === CASTLE.col + 1)) return 'castle'
  for (const [id, pos] of Object.entries(BUILDING_POS)) {
    if (pos.row === row && pos.col === col) return id
  }
  return null
}

// ─── Головний компонент ────────────────────────────────────────
export default function CityGrid({
  player, buildings,
  onWorkerToggle, onUpgrade,
}) {
  const [selected, setSelected] = useState(null)

  function handleClick(buildingId) {
    setSelected(prev => prev === buildingId ? null : buildingId)
  }

  // Будуємо набір "зайнятих" клітинок замку (для пропуску)
  const castleCells = new Set([
    cellKey(CASTLE.row,     CASTLE.col + 1),
    cellKey(CASTLE.row + 1, CASTLE.col),
    cellKey(CASTLE.row + 1, CASTLE.col + 1),
  ])

  const cells = []
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      cells.push({ row: r, col: c, key: cellKey(r, c) })
    }
  }

  return (
    <div className="w-full">
      {/* ─── Контейнер міста ─── */}
      <div
        className="relative w-full overflow-hidden rounded-xl"
        style={{
          aspectRatio: '1 / 1',
          background: `
            radial-gradient(ellipse at 20% 20%, rgba(40,30,10,0.5) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(10,30,15,0.4) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, rgba(20,15,5,0.3) 0%, transparent 70%),
            linear-gradient(160deg, #1e1b10 0%, #12110a 50%, #1b1e0e 100%)
          `,
        }}
      >
        {/* Текстура ґрунту (шумовий ефект) */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `
            radial-gradient(circle at 30% 40%, rgba(80,60,20,0.4) 0%, transparent 20%),
            radial-gradient(circle at 70% 20%, rgba(40,60,20,0.3) 0%, transparent 15%),
            radial-gradient(circle at 20% 80%, rgba(60,40,10,0.3) 0%, transparent 18%),
            radial-gradient(circle at 85% 70%, rgba(30,50,15,0.3) 0%, transparent 20%)
          `,
        }} />

        {/* Паркан (зовнішній кордон) */}
        <div className="absolute inset-0 pointer-events-none z-10" style={{
          border: '2px solid #4a4030',
          boxShadow: 'inset 0 0 40px rgba(0,0,0,0.6)',
        }} />

        {/* Кутові стовпи паркану */}
        {[
          { top: 0, left: 0 }, { top: 0, right: 0 },
          { bottom: 0, left: 0 }, { bottom: 0, right: 0 },
        ].map((style, i) => (
          <div
            key={i}
            className="absolute z-20 pointer-events-none flex items-center justify-center text-[10px]"
            style={{
              ...style, width: 18, height: 18,
              background: '#2a2416',
              border: '2px solid #5a4a28',
            }}
          >⬛</div>
        ))}

        {/* ─── CSS Сітка 7×7 ─── */}
        <div
          className="absolute"
          style={{
            inset: '10px',
            display: 'grid',
            gridTemplateColumns: `repeat(${GRID}, 1fr)`,
            gridTemplateRows: `repeat(${GRID}, 1fr)`,
            gap: '2px',
          }}
        >
          {cells.map(({ row, col, key }) => {
            // Пропускаємо зайняті клітинки замку
            if (castleCells.has(key)) return null

            const buildingId = getBuildingAt(row, col)
            const isPath     = PATH_CELLS.has(key)
            const decor      = DECOR[key]

            // ─── Замок (2×2) ───
            if (buildingId === 'castle') {
              const level      = player.castle?.level || 1
              const isSelected = selected === 'castle'
              return (
                <div
                  key={key}
                  onClick={() => handleClick('castle')}
                  className="relative cursor-pointer rounded transition-all duration-200"
                  style={{
                    gridColumn: `${col + 1} / ${col + 3}`,
                    gridRow:    `${row + 1} / ${row + 3}`,
                    background: isSelected
                      ? 'rgba(255,200,50,0.12)'
                      : 'rgba(60,50,20,0.5)',
                    border: `1.5px solid ${isSelected ? '#ffd700' : '#4a3a18'}`,
                    boxShadow: isSelected ? '0 0 16px rgba(255,215,0,0.4)' : '0 0 8px rgba(0,0,0,0.5)',
                  }}
                >
                  <CastleTile level={level} active={isSelected} />
                </div>
              )
            }

            // ─── Будівля ───
            if (buildingId) {
              const bConfig    = buildings.find(b => b.id === buildingId)
              const pBuilding  = player.buildings?.[buildingId] || { level: 0, workers: 0 }
              const isSelected = selected === buildingId
              const isBuilt    = pBuilding.level > 0
              const hasWorkers = pBuilding.workers > 0

              return (
                <div
                  key={key}
                  onClick={() => handleClick(buildingId)}
                  className="relative cursor-pointer rounded transition-all duration-200"
                  style={{
                    background: isSelected
                      ? 'rgba(0,255,136,0.08)'
                      : isBuilt
                        ? 'rgba(30,25,10,0.7)'
                        : 'rgba(15,12,5,0.5)',
                    border: `1.5px solid ${
                      isSelected ? 'var(--neon)' : isBuilt ? '#3a3020' : '#22200e'
                    }`,
                    boxShadow: isSelected
                      ? '0 0 12px rgba(0,255,136,0.3)'
                      : hasWorkers
                        ? '0 0 6px rgba(0,255,136,0.1)'
                        : 'none',
                  }}
                >
                  <BuildingTile bConfig={bConfig} pBuilding={pBuilding} active={isSelected} />
                </div>
              )
            }

            // ─── Доріжка ───
            if (isPath) {
              return (
                <div
                  key={key}
                  className="rounded"
                  style={{
                    background: 'rgba(255,200,100,0.04)',
                    border: '1px solid rgba(255,200,100,0.08)',
                  }}
                />
              )
            }

            // ─── Порожня клітинка ───
            return (
              <div
                key={key}
                className="rounded flex items-center justify-center"
                style={{
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255,255,255,0.02)',
                }}
              >
                {decor && (
                  <span className="text-[10px] opacity-25 select-none">{decor}</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ─── Панель вибраної будівлі ─── */}
      {selected && (
        <BuildingDetailPanel
          buildingId={selected}
          player={player}
          buildings={buildings}
          onClose={() => setSelected(null)}
          onUpgrade={onUpgrade}
          onWorkerToggle={onWorkerToggle}
        />
      )}
    </div>
  )
}

// ─── Тайл замку ───────────────────────────────────────────────
function CastleTile({ level, active }) {
  const CASTLE_NAMES = ['', 'Бункер', 'Опорпункт', 'Цитадель', 'Твердиня', 'Фортеця-Нова']
  return (
    <div className="flex flex-col items-center justify-center h-full gap-0.5 p-1">
      <span className="text-4xl leading-none">🏰</span>
      <span className={`text-[9px] font-mono leading-none mt-0.5 ${active ? 'text-[#ffd700]' : 'text-[#888]'}`}>
        {CASTLE_NAMES[level] || 'Замок'}
      </span>
      <div className="flex gap-[3px] mt-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="w-[4px] h-[4px] rounded-sm"
            style={{ background: i < level ? '#ffd700' : '#2a2a1a' }}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Тайл будівлі ─────────────────────────────────────────────
function BuildingTile({ bConfig, pBuilding, active }) {
  if (!bConfig) return null
  const level   = pBuilding?.level   || 0
  const workers = pBuilding?.workers || 0
  const lvlCfg  = bConfig.levels?.[level - 1]
  const maxSlots = lvlCfg?.workerSlots || 0

  if (level === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-0.5 opacity-30">
        <span className="text-2xl leading-none grayscale">{bConfig.icon}</span>
        <span className="text-[8px] font-mono text-[#444]">🔒</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-0.5 p-0.5">
      <span className="text-2xl leading-none">{bConfig.icon}</span>
      <span className={`text-[8px] font-mono leading-none ${active ? 'text-[var(--neon)]' : 'text-[#666]'}`}>
        рів.{level}
      </span>
      {/* Точки робітників */}
      {maxSlots > 0 && (
        <div className="flex gap-[3px] mt-0.5">
          {Array.from({ length: maxSlots }).map((_, i) => (
            <div
              key={i}
              className="w-[4px] h-[4px] rounded-full"
              style={{ background: i < workers ? 'var(--neon)' : '#2a2a1a' }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Панель деталей будівлі ────────────────────────────────────
function BuildingDetailPanel({ buildingId, player, buildings, onClose, onUpgrade, onWorkerToggle }) {
  // Замок — проста інфо-панель
  if (buildingId === 'castle') {
    const level = player.castle?.level || 1
    return (
      <div className="mt-2 rounded-xl border border-[#4a3a18] bg-[var(--bg2)] p-4 animate-slide-up">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏰</span>
            <div>
              <div className="font-bebas text-base tracking-widest text-[#ffd700]">ЗАМОК</div>
              <div className="text-xs text-[#666] font-mono">Рівень {level} / 5</div>
            </div>
          </div>
          <button onClick={onClose} className="text-[#444] hover:text-white text-lg leading-none">✕</button>
        </div>
        <p className="text-xs text-[#666]">Відкрий секцію <span className="text-[#ffd700]">ЗАМОК</span> нижче для апгрейду та управління армією.</p>
      </div>
    )
  }

  const bConfig   = buildings.find(b => b.id === buildingId)
  if (!bConfig) return null

  const pBuilding = player.buildings?.[buildingId] || { level: 0, workers: 0 }
  const level     = pBuilding.level   || 0
  const workers   = pBuilding.workers || 0
  const lvlCfg    = bConfig.levels?.[level - 1]
  const nextLvl   = bConfig.levels?.[level]
  const maxSlots  = lvlCfg?.workerSlots || 0

  const totalPlaced  = player.workers?.placed || 0
  const totalWorkers = player.workers?.total  || 5
  const canAdd       = workers < maxSlots && totalPlaced < totalWorkers
  const canRemove    = workers > 0

  const canUpgrade = nextLvl
    ? Object.entries(nextLvl.cost).every(([res, cost]) => (player.resources?.[res] || 0) >= cost)
    : false

  const hasSynergy = bConfig.synergyBonus
    ? workers >= (bConfig.synergyBonus.minWorkers || 99)
    : false

  return (
    <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--bg2)] p-4 animate-slide-up">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{bConfig.icon}</span>
          <div>
            <div className="font-bebas text-base tracking-widest text-white">
              {bConfig.name.toUpperCase()}
              {hasSynergy && <span className="ml-2 text-[10px] text-[var(--neon)] border border-[var(--neon)] px-1 py-0.5 rounded">СИНЕРГІЯ</span>}
            </div>
            <div className="text-xs text-[#555] font-mono">
              {level === 0
                ? 'Не збудовано'
                : `Рівень ${level} / ${bConfig.levels?.length || 3}`}
            </div>
          </div>
        </div>
        <button onClick={onClose} className="text-[#444] hover:text-white text-lg leading-none">✕</button>
      </div>

      {level === 0 ? (
        /* ─── Не збудована ─── */
        <div className="flex flex-col gap-3">
          <p className="text-xs text-[#888]">{bConfig.description}</p>
          {nextLvl && (
            <CostRow cost={nextLvl.cost} player={player} label="Вартість:" />
          )}
          <button
            onClick={() => onUpgrade(buildingId)}
            disabled={!canUpgrade}
            className={`btn w-full text-sm py-2.5 border font-semibold tracking-wider transition-all ${
              canUpgrade
                ? 'border-[var(--accent)] text-[var(--accent)] hover:bg-[rgba(255,69,0,0.1)]'
                : 'border-[var(--border)] text-[#444] cursor-not-allowed'
            }`}
          >
            {canUpgrade ? '🔨 БУДУВАТИ' : 'НЕДОСТАТНЬО РЕСУРСІВ'}
          </button>
        </div>
      ) : (
        /* ─── Збудована ─── */
        <div className="flex flex-col gap-3">
          {/* Виробництво */}
          {lvlCfg?.production && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(lvlCfg.production).map(([res, rate]) => {
                const info = RESOURCE_ICONS[res]
                if (!info || rate <= 0) return null
                const bonus = hasSynergy ? (bConfig.synergyBonus?.bonus?.[res] || 0) : 0
                return (
                  <div key={res} className="flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--bg3)]">
                    <span className="text-sm">{info.icon}</span>
                    <span className="font-mono text-xs" style={{ color: info.color }}>
                      +{rate}{bonus > 0 && <span className="text-[var(--neon)]">+{bonus}</span>}/год
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Робітники */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-[#555] uppercase tracking-wider">
                Робітники {workers}/{maxSlots}
              </span>
              {bConfig.synergyBonus && !hasSynergy && maxSlots >= bConfig.synergyBonus.minWorkers && (
                <span className="text-[10px] text-[#444]">
                  ще {bConfig.synergyBonus.minWorkers - workers} для синергії
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5 flex-1">
                {Array.from({ length: maxSlots }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => onWorkerToggle(buildingId, i < workers ? 'remove' : 'add')}
                    disabled={i >= workers && !canAdd}
                    className={`w-9 h-9 rounded flex items-center justify-center text-base border transition-all active:scale-95 ${
                      i < workers
                        ? 'bg-[rgba(0,255,136,0.15)] border-[var(--neon)] text-[var(--neon)]'
                        : 'bg-[var(--bg3)] border-[var(--border)] text-[#333] disabled:opacity-30'
                    }`}
                  >
                    {i < workers ? '👤' : '+'}
                  </button>
                ))}
                {maxSlots === 0 && (
                  <span className="text-xs text-[#444] italic">Немає слотів</span>
                )}
              </div>
            </div>
            <div className="text-[10px] text-[#444] mt-1 font-mono">
              Вільно: {totalWorkers - totalPlaced} з {totalWorkers} робітників
            </div>
          </div>

          {/* Апгрейд */}
          {nextLvl ? (
            <div className="pt-3 border-t border-[var(--border)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[#555]">Апгрейд → Рівень {level + 1}</span>
              </div>
              {/* Прев'ю виробництва */}
              {nextLvl.production && lvlCfg?.production && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {Object.entries(nextLvl.production).map(([res, nextAmt]) => {
                    const info   = RESOURCE_ICONS[res]
                    const curAmt = lvlCfg.production[res] || 0
                    const diff   = nextAmt - curAmt
                    if (!info) return null
                    return (
                      <span key={res} className="text-[10px] flex items-center gap-0.5 text-[#666]">
                        {info.icon}
                        <span className="font-mono">{nextAmt}/год</span>
                        {diff > 0 && <span className="text-[var(--neon)] font-mono">(+{diff})</span>}
                      </span>
                    )
                  })}
                </div>
              )}
              <CostRow cost={nextLvl.cost} player={player} label="Вартість:" />
              <button
                onClick={() => onUpgrade(buildingId)}
                disabled={!canUpgrade}
                className={`btn w-full text-sm py-2.5 mt-2 border font-semibold tracking-wider transition-all ${
                  canUpgrade
                    ? 'border-[var(--gold)] text-[var(--gold)] hover:bg-[rgba(255,215,0,0.08)]'
                    : 'border-[var(--border)] text-[#444] cursor-not-allowed'
                }`}
              >
                {canUpgrade ? '⬆ АПГРЕЙД' : 'НЕДОСТАТНЬО РЕСУРСІВ'}
              </button>
            </div>
          ) : (
            <div className="pt-2 border-t border-[var(--border)] text-xs text-center text-[var(--gold)] font-semibold tracking-wider">
              ★ МАКСИМАЛЬНИЙ РІВЕНЬ
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Відображення вартості ─────────────────────────────────────
function CostRow({ cost, player, label }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {label && <span className="text-xs text-[#555]">{label}</span>}
      {Object.entries(cost).map(([res, amt]) => {
        const info    = RESOURCE_ICONS[res]
        const canAfford = (player.resources?.[res] || 0) >= amt
        if (!info) return null
        return (
          <span
            key={res}
            className="text-xs font-mono flex items-center gap-0.5"
            style={{ color: canAfford ? 'var(--neon)' : 'var(--accent)' }}
          >
            {info.icon} {amt}
          </span>
        )
      })}
    </div>
  )
}
