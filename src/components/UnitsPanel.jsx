// ─── UnitsPanel ───
// Найм, апгрейд юнітів + формування армії (5 слотів)

import { useState } from 'react'
import GameImage from './GameImage'
import { unitImg } from '../config/assets'
import { RESOURCE_ICONS, getHeroLevel } from '../store/gameStore'
import { UNITS, UNIT_LEVEL_MULTIPLIER, getUnitStats, getTotalUnits } from '../firebase/unitService'
import { CASTLE_MAX_UNITS } from '../firebase/castleService'
import { Button, Card } from './UI'

const TYPE_COLOR = {
  tank:    '#4488ff',
  dps:     '#ff4444',
  support: '#44ff88',
}
const TYPE_LABEL = {
  tank:    'Танк',
  dps:     'Атака',
  support: 'Підтримка',
}

export default function UnitsPanel({ player, onRecruit, onUpgrade, onSetFormation }) {
  const [activeTab, setActiveTab] = useState('units') // 'units' | 'army'
  const [selected, setSelected] = useState(null)      // unitId для деталей

  const castleLevel  = player.castle?.level || 1
  const heroClass    = player.heroClass || 'guardian'
  const maxUnits     = CASTLE_MAX_UNITS[castleLevel] || 3
  const totalUnits   = getTotalUnits(player.units)
  const formation    = player.army?.formation || []
  const power        = player.army?.power || 0
  const heroLevel    = getHeroLevel(player.xp || 0)
  const canUseArmy   = heroLevel >= 2

  return (
    <Card className="p-0 overflow-hidden">
      {/* Вкладки */}
      <div className="flex border-b border-[var(--border)]">
        {[
          { id: 'units', label: `⚙️ Юніти (${totalUnits}/${maxUnits})` },
          { id: 'army',  label: `⚔️ Армія (${formation.length}/5)` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[#555] hover:text-[var(--text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {!canUseArmy && (
        <div className="mx-3 mt-3 p-2 rounded-lg bg-[rgba(255,69,0,0.08)] border border-[rgba(255,69,0,0.2)] text-xs text-[var(--accent)] text-center font-mono">
          🔒 Армія доступна з рівня 2 героя
        </div>
      )}

      <div className="p-3">
        {activeTab === 'units' && (
          <UnitsList
            player={player}
            heroClass={heroClass}
            maxUnits={maxUnits}
            totalUnits={totalUnits}
            canUseArmy={canUseArmy}
            selected={selected}
            onSelect={setSelected}
            onRecruit={onRecruit}
            onUpgrade={onUpgrade}
          />
        )}
        {activeTab === 'army' && (
          <ArmyTab
            player={player}
            heroClass={heroClass}
            formation={formation}
            power={power}
            onSetFormation={onSetFormation}
          />
        )}
      </div>
    </Card>
  )
}

// ─── Список юнітів ─────────────────────────────────────────────
function UnitsList({ player, heroClass, maxUnits, totalUnits, canUseArmy, selected, onSelect, onRecruit, onUpgrade }) {
  return (
    <div className="flex flex-col gap-2">
      {Object.entries(UNITS).map(([unitId, unit]) => {
        const playerUnit = player.units?.[unitId]
        const count      = playerUnit?.count || 0
        const level      = playerUnit?.level || 1
        const stats      = getUnitStats(unitId, level, heroClass)
        const isSelected = selected === unitId
        const hasBonus   = unit.heroClassBonus === heroClass
        const canRecruit = canUseArmy && totalUnits < maxUnits
        const costAfford = Object.entries(unit.cost).every(
          ([res, amt]) => (player.resources?.[res] || 0) >= amt
        )
        const nextLevel    = level + 1
        const upgradeCost  = unit.upgradeCost?.[nextLevel]
        const upgradeAfford = upgradeCost && Object.entries(upgradeCost).every(
          ([res, amt]) => (player.resources?.[res] || 0) >= amt
        )

        return (
          <div key={unitId}>
            {/* Картка юніта */}
            <button
              onClick={() => onSelect(isSelected ? null : unitId)}
              className={`w-full text-left p-4 rounded-lg border transition-all ${
                isSelected
                  ? 'border-[var(--accent)] bg-[rgba(255,69,0,0.08)]'
                  : 'border-[var(--border)] bg-[var(--bg3)] hover:border-[#333]'
              }`}
            >
              <div className="flex items-center gap-2">
                <GameImage
                  src={unitImg(unitId)}
                  fallback={unit.icon}
                  alt={unit.name}
                  className="w-16 h-16 object-contain shrink-0 rounded"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base font-semibold text-white truncate">{unit.name}</span>
                    {hasBonus && (
                      <span className="text-[10px] text-[var(--gold)] shrink-0">★ клас</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                      style={{ color: TYPE_COLOR[unit.type], background: `${TYPE_COLOR[unit.type]}22` }}
                    >
                      {TYPE_LABEL[unit.type]}
                    </span>
                    {count > 0 && (
                      <span className="text-[10px] text-[#888] font-mono">
                        ×{count} · Рів.{level}
                      </span>
                    )}
                  </div>
                </div>
                {/* Стати */}
                {stats && (
                  <div className="text-right text-xs font-mono text-[#666] shrink-0">
                    <div>❤️ {stats.hp}</div>
                    <div>⚔️ {stats.atk}</div>
                    <div>🛡 {stats.def}</div>
                  </div>
                )}
              </div>
            </button>

            {/* Розгорнута панель */}
            {isSelected && (
              <div className="mx-1 p-3 bg-[var(--bg2)] border border-[var(--border)] border-t-0 rounded-b-lg">
                {/* Special */}
                <p className="text-xs text-[#888] mb-2 italic">💡 {unit.special}</p>

                {/* Вартість найму */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {Object.entries(unit.cost).map(([res, amt]) => {
                    const info = RESOURCE_ICONS[res]
                    const have = player.resources?.[res] || 0
                    return (
                      <span key={res} className={`text-xs font-mono ${have >= amt ? 'text-[var(--neon)]' : 'text-[var(--accent)]'}`}>
                        {info?.icon} {amt}
                      </span>
                    )
                  })}
                </div>

                <div className="flex gap-2">
                  {/* Найняти */}
                  <Button
                    variant={canRecruit && costAfford ? 'neon' : 'ghost'}
                    className="flex-1 text-xs py-1.5"
                    disabled={!canRecruit || !costAfford}
                    onClick={() => onRecruit(unitId)}
                  >
                    {!canUseArmy ? '🔒 Рів.2' : !canRecruit ? `Ліміт ${maxUnits}` : '+ НАЙНЯТИ'}
                  </Button>

                  {/* Апгрейд */}
                  {count > 0 && level < 3 && (
                    <Button
                      variant={upgradeAfford ? 'gold' : 'ghost'}
                      className="flex-1 text-xs py-1.5"
                      disabled={!upgradeAfford}
                      onClick={() => onUpgrade(unitId)}
                    >
                      ⬆️ РВ.{nextLevel}
                    </Button>
                  )}
                  {count > 0 && level >= 3 && (
                    <div className="flex-1 text-center text-[10px] text-[var(--gold)] font-mono py-1.5">
                      МАКС РВ.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Армія і формація ──────────────────────────────────────────
function ArmyTab({ player, heroClass, formation, power, onSetFormation }) {
  const [localFormation, setLocalFormation] = useState([...formation])
  const [loading, setLoading] = useState(false)
  const hasChanges = JSON.stringify(localFormation) !== JSON.stringify(formation)

  function toggleUnit(unitId) {
    setLocalFormation(prev => {
      if (prev.includes(unitId)) return prev.filter(id => id !== unitId)
      if (prev.length >= 5) return prev
      return [...prev, unitId]
    })
  }

  async function handleSave() {
    setLoading(true)
    try { await onSetFormation(localFormation) } finally { setLoading(false) }
  }

  const ownedUnits = Object.entries(player.units || {}).filter(([, u]) => (u.count || 0) > 0)

  return (
    <div className="flex flex-col gap-3">
      {/* Бойова сила */}
      <div className="flex items-center justify-between p-2 bg-[var(--bg3)] rounded">
        <span className="text-xs text-[#555]">Бойова сила армії</span>
        <span className="font-bebas text-lg text-[var(--accent)]">⚔️ {power}</span>
      </div>

      {/* Слоти формації */}
      <div>
        <p className="text-xs text-[#555] mb-2 uppercase tracking-wider">Формація (до 5 юнітів)</p>
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 5 }).map((_, i) => {
            const unitId = localFormation[i]
            const unit   = unitId ? UNITS[unitId] : null
            return (
              <div
                key={i}
                className={`aspect-square rounded-lg flex items-center justify-center text-xl border ${
                  unit
                    ? 'border-[var(--accent)] bg-[rgba(255,69,0,0.1)]'
                    : 'border-dashed border-[var(--border)] bg-[var(--bg3)]'
                }`}
              >
                {unit ? (
                  <button onClick={() => toggleUnit(unitId)} className="w-full h-full flex items-center justify-center p-1">
                    <GameImage
                      src={unitImg(unitId)}
                      fallback={unit.icon}
                      alt={unit.name}
                      className="w-full h-full object-contain"
                    />
                  </button>
                ) : (
                  <span className="text-[#333] text-sm">+</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Доступні юніти */}
      {ownedUnits.length === 0 ? (
        <p className="text-xs text-[#555] text-center py-4">Ще немає юнітів — найми їх на вкладці «Юніти»</p>
      ) : (
        <div>
          <p className="text-xs text-[#555] mb-2 uppercase tracking-wider">Твої юніти</p>
          <div className="flex flex-wrap gap-2">
            {ownedUnits.map(([unitId, unitData]) => {
              const unit      = UNITS[unitId]
              const inFormation = localFormation.includes(unitId)
              return (
                <button
                  key={unitId}
                  onClick={() => toggleUnit(unitId)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-all ${
                    inFormation
                      ? 'border-[var(--accent)] bg-[rgba(255,69,0,0.12)] text-white'
                      : 'border-[var(--border)] bg-[var(--bg3)] text-[#888] hover:border-[#444]'
                  }`}
                >
                  <GameImage
                    src={unitImg(unitId)}
                    fallback={unit?.icon}
                    alt={unit?.name}
                    className="w-8 h-8 object-contain shrink-0"
                  />
                  <span>{unit?.name}</span>
                  <span className="text-[10px] font-mono opacity-60">×{unitData.count} рів.{unitData.level}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Зберегти */}
      {hasChanges && (
        <Button
          variant="accent"
          className="w-full text-sm"
          disabled={loading}
          onClick={handleSave}
        >
          {loading ? '...' : '💾 ЗБЕРЕГТИ ФОРМАЦІЮ'}
        </Button>
      )}
    </div>
  )
}
