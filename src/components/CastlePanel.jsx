// ─── CastlePanel ───
// Відображення і апгрейд замку в City

import { useState } from 'react'
import { CASTLE_ICONS, RESOURCE_ICONS } from '../store/gameStore'
import {
  CASTLE_UPGRADE_COSTS, CASTLE_NAMES, CASTLE_BONUSES, CASTLE_MAX_UNITS,
} from '../firebase/castleService'
import { Button, Card } from './UI'

export default function CastlePanel({ player, onUpgrade }) {
  const [loading, setLoading] = useState(false)

  const castleLevel = player.castle?.level || 1
  const heroClass   = player.heroClass || 'guardian'
  const name        = CASTLE_NAMES[heroClass]?.[castleLevel] || 'Замок'
  const icon        = CASTLE_ICONS[castleLevel] || '🏠'
  const maxUnits    = CASTLE_MAX_UNITS[castleLevel] || 3
  const bonuses     = CASTLE_BONUSES[heroClass]?.[castleLevel] || {}
  const nextCost    = CASTLE_UPGRADE_COSTS[castleLevel + 1]
  const canAfford   = nextCost && Object.entries(nextCost).every(
    ([res, amt]) => (player.resources?.[res] || 0) >= amt
  )

  async function handleUpgrade() {
    setLoading(true)
    try { await onUpgrade() } finally { setLoading(false) }
  }

  return (
    <Card>
      {/* Заголовок */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-14 h-14 rounded-xl bg-[var(--bg3)] flex items-center justify-center text-3xl">
          {icon}
        </div>
        <div className="flex-1">
          <div className="font-bebas text-xl text-white tracking-wide">{name}</div>
          <div className="text-xs text-[#888]">
            Рівень {castleLevel}/5 · Ліміт юнітів: {maxUnits}
          </div>
        </div>
        {/* Індикатор рівня */}
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-6 rounded-sm transition-colors ${
                i < castleLevel ? 'bg-[var(--gold)]' : 'bg-[var(--border)]'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Бонуси поточного рівня */}
      <div className="flex flex-wrap gap-2 mb-3">
        {bonuses.workersMax > 0 && (
          <span className="text-xs bg-[var(--bg3)] px-2 py-1 rounded text-[var(--neon)]">
            👥 +{bonuses.workersMax} робітники
          </span>
        )}
        {bonuses.defenseBoost > 0 && (
          <span className="text-xs bg-[var(--bg3)] px-2 py-1 rounded text-[#4488ff]">
            🛡️ +{Math.round(bonuses.defenseBoost * 100)}% захист
          </span>
        )}
        {bonuses.xpMultiplier > 1 && (
          <span className="text-xs bg-[var(--bg3)] px-2 py-1 rounded text-[var(--gold)]">
            ⭐ ×{bonuses.xpMultiplier} XP
          </span>
        )}
        {bonuses.researchSpeed > 0 && (
          <span className="text-xs bg-[var(--bg3)] px-2 py-1 rounded text-[var(--accent)]">
            🔬 +{Math.round(bonuses.researchSpeed * 100)}% дослідж.
          </span>
        )}
        {bonuses.tradeSlots > 0 && (
          <span className="text-xs bg-[var(--bg3)] px-2 py-1 rounded text-[#aa88ff]">
            🔄 +{bonuses.tradeSlots} торг. слоти
          </span>
        )}
        {bonuses.revealFree > 0 && (
          <span className="text-xs bg-[var(--bg3)] px-2 py-1 rounded text-[var(--neon)]">
            ✨ {bonuses.revealFree} безкошт. розкриття
          </span>
        )}
        {bonuses.mineSpeed > 0 && (
          <span className="text-xs bg-[var(--bg3)] px-2 py-1 rounded text-[var(--gold)]">
            ⛏️ +{Math.round(bonuses.mineSpeed * 100)}% копальні
          </span>
        )}
      </div>

      {/* Апгрейд */}
      {castleLevel < 5 ? (
        <>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
            {nextCost && Object.entries(nextCost).map(([res, amt]) => {
              const info = RESOURCE_ICONS[res]
              const have = player.resources?.[res] || 0
              return (
                <span
                  key={res}
                  className={`text-xs font-mono ${have >= amt ? 'text-[var(--neon)]' : 'text-[var(--accent)]'}`}
                >
                  {info?.icon} {amt}
                </span>
              )
            })}
          </div>
          <Button
            variant={canAfford ? 'gold' : 'ghost'}
            className="w-full text-sm"
            disabled={!canAfford || loading}
            onClick={handleUpgrade}
          >
            {loading ? '...' : `⬆️ ПОКРАЩИТИ ДО РВ. ${castleLevel + 1}`}
          </Button>
        </>
      ) : (
        <div className="text-center text-xs text-[var(--gold)] font-mono py-1 tracking-widest">
          ✦ МАКСИМАЛЬНИЙ РІВЕНЬ ✦
        </div>
      )}
    </Card>
  )
}
