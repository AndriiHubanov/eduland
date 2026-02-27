// ─── Картка будівлі ───

import { RESOURCE_ICONS } from '../store/gameStore'

// Бейджі виробництва з підсвічуванням синергії
function ProductionBadges({ production, synergyBonus, hasSynergy }) {
  return (
    <div className="flex flex-wrap gap-1">
      {Object.entries(production).map(([res, amount]) => {
        const info = RESOURCE_ICONS[res]
        if (!info || amount <= 0) return null
        const bonusAmt = hasSynergy ? (synergyBonus?.[res] || 0) : 0
        return (
          <span
            key={res}
            className="resource-badge text-xs"
            style={{ color: info.color, borderColor: hasSynergy && bonusAmt > 0 ? 'var(--neon)' : undefined }}
          >
            {info.icon}
            <span className="font-mono">
              +{amount}
              {hasSynergy && bonusAmt > 0 && (
                <span className="text-[var(--neon)]">+{bonusAmt}</span>
              )}
            </span>
            /год
          </span>
        )
      })}
    </div>
  )
}

// Один слот робітника
function WorkerSlot({ filled, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={filled ? 'Зняти робітника' : 'Поставити робітника'}
      className={`
        w-9 h-9 rounded flex items-center justify-center text-base
        border transition-all active:scale-95
        ${filled
          ? 'bg-[rgba(0,255,136,0.15)] border-[var(--neon)] text-[var(--neon)] hover:bg-[rgba(0,255,136,0.25)]'
          : 'bg-[var(--bg3)] border-[var(--border)] text-[#333] hover:border-[#555] hover:text-[#666]'
        }
        ${disabled && !filled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {filled ? '👤' : '+'}
    </button>
  )
}

// Рядок вартості
function CostRow({ cost }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(cost).map(([res, amount]) => {
        const info = RESOURCE_ICONS[res]
        if (!info) return null
        return (
          <span key={res} className="text-xs text-[#666] flex items-center gap-0.5">
            {info.icon}<span className="font-mono">{amount}</span>
          </span>
        )
      })}
    </div>
  )
}

export default function BuildingCard({
  building, playerBuilding, workers,
  onWorkerToggle, onUpgrade, canUpgrade, upgradeDisabled
}) {
  const isBuilt    = playerBuilding.level > 0
  const currentLvl = playerBuilding.level
  const workerCount = playerBuilding.workers || 0
  const config     = building.levels?.[currentLvl - 1]
  const nextConfig = building.levels?.[currentLvl]
  const maxSlots   = config?.workerSlots || 0
  const hasSynergy = workerCount >= (building.synergyBonus?.minWorkers || 99)
  const noFreeWorkers = (workers.placed || 0) >= (workers.total || 5)

  // ─── Не збудована ───────────────────────────────────────────
  if (!isBuilt) {
    const buildConfig = building.levels?.[0]
    return (
      <div className="card flex flex-col gap-3 opacity-60 hover:opacity-80 transition-opacity">
        <div className="flex items-center gap-2">
          <span className="text-2xl grayscale opacity-40">{building.icon}</span>
          <div>
            <div className="font-semibold text-[#666]">{building.name}</div>
            <div className="text-xs text-[#444] leading-snug">{building.description}</div>
          </div>
        </div>

        {buildConfig && (
          <div className="flex flex-col gap-1">
            <div className="text-xs text-[#555]">Вартість:</div>
            <CostRow cost={buildConfig.cost} />
          </div>
        )}

        <button
          onClick={() => onUpgrade(building.id)}
          disabled={upgradeDisabled}
          className={`
            btn text-xs py-2 w-full border
            ${upgradeDisabled
              ? 'border-[var(--border)] text-[#444] cursor-not-allowed'
              : 'border-[var(--neon)] text-[var(--neon)] hover:bg-[rgba(0,255,136,0.08)]'
            }
          `}
        >
          {upgradeDisabled ? 'НЕДОСТАТНЬО РЕСУРСІВ' : '🔨 БУДУВАТИ'}
        </button>
      </div>
    )
  }

  // ─── Збудована ──────────────────────────────────────────────
  return (
    <div className={`
      card flex flex-col gap-3 transition-all
      ${hasSynergy ? 'border-[var(--neon)] shadow-[0_0_12px_rgba(0,255,136,0.15)]' : ''}
    `}>

      {/* Шапка */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl shrink-0">{building.icon}</span>
          <div className="min-w-0">
            <div className="font-semibold text-white leading-tight truncate">{building.name}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {/* Зірочки рівня */}
              <div className="flex gap-0.5">
                {[1, 2, 3].map(lvl => (
                  <div
                    key={lvl}
                    className={`w-2 h-2 rounded-full ${
                      lvl <= currentLvl ? 'bg-[var(--gold)]' : 'bg-[var(--border)]'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs text-[#555]">Рівень {currentLvl}</span>
            </div>
          </div>
        </div>

        {hasSynergy && (
          <span className="text-[10px] font-semibold text-[var(--neon)] border border-[var(--neon)] px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap">
            СИНЕРГІЯ
          </span>
        )}
      </div>

      {/* Виробництво */}
      {config && (
        <ProductionBadges
          production={config.production}
          synergyBonus={building.synergyBonus?.bonus}
          hasSynergy={hasSynergy}
        />
      )}

      {/* Слоти робітників */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#555] uppercase tracking-wider">Робітники</span>
          {building.synergyBonus && !hasSynergy && maxSlots >= building.synergyBonus.minWorkers && (
            <span className="text-[10px] text-[#444]">
              ще {building.synergyBonus.minWorkers - workerCount} для синергії
            </span>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {Array.from({ length: maxSlots }).map((_, i) => (
            <WorkerSlot
              key={i}
              filled={i < workerCount}
              onClick={() => onWorkerToggle(building.id, i < workerCount ? 'remove' : 'add')}
              disabled={i >= workerCount && noFreeWorkers}
            />
          ))}
          {maxSlots === 0 && (
            <span className="text-xs text-[#444] italic">Немає слотів</span>
          )}
        </div>
      </div>

      {/* Кнопка апгрейду */}
      {nextConfig ? (
        <div className="flex flex-col gap-1.5 pt-1 border-t border-[var(--border)]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#555]">Апгрейд → Рівень {currentLvl + 1}</span>
            <CostRow cost={nextConfig.cost} />
          </div>

          {/* Прев'ю нового виробництва */}
          {nextConfig.production && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(nextConfig.production).map(([res, nextAmt]) => {
                const info    = RESOURCE_ICONS[res]
                const curAmt  = config?.production?.[res] || 0
                const diff    = nextAmt - curAmt
                if (!info) return null
                return (
                  <span key={res} className="text-[10px] flex items-center gap-0.5 text-[#666]">
                    {info.icon}
                    <span className="font-mono">{nextAmt}/год</span>
                    {diff > 0 && (
                      <span className="text-[var(--neon)] font-mono">(+{diff})</span>
                    )}
                  </span>
                )
              })}
            </div>
          )}

          <button
            onClick={() => onUpgrade(building.id)}
            disabled={upgradeDisabled}
            className={`
              btn text-xs py-1.5 w-full border transition-all
              ${canUpgrade
                ? 'border-[var(--gold)] text-[var(--gold)] hover:bg-[rgba(255,215,0,0.08)]'
                : 'border-[var(--border)] text-[#444] cursor-not-allowed'
              }
            `}
          >
            {canUpgrade ? '⬆ АПГРЕЙД' : 'НЕДОСТАТНЬО РЕСУРСІВ'}
          </button>
        </div>
      ) : (
        <div className="pt-1 border-t border-[var(--border)] text-xs text-center text-[var(--gold)] font-semibold">
          ★ МАКСИМАЛЬНИЙ РІВЕНЬ
        </div>
      )}
    </div>
  )
}
