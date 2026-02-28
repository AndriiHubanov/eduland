// ─── Конфіг лабораторій (Phase 10) ───
// 4 нові будівлі для дослідження полів (як MyLands)

export const LAB_BUILDINGS = {
  geolab: {
    id:          'geolab',
    name:        'Геолаб',
    icon:        '🔭',
    description: 'Розвідка полів — відправляє команду розкрити тип і ресурс поля',
    maxLevel:    3,
    levels: [
      { level: 1, scoutTime: 15 * 60,  cost: { gold: 300, bits: 50 } },
      { level: 2, scoutTime: 10 * 60,  cost: { gold: 700, bits: 120, code: 30 } },
      { level: 3, scoutTime: 5 * 60,   cost: { gold: 1500, bits: 250, code: 100 } },
    ],
  },
  extraction_station: {
    id:          'extraction_station',
    name:        'Екстракційна станція',
    icon:        '⚗️',
    description: 'Видобуток ресурсів із ресурсних полів. Рівень підвищує бонус і зменшує час',
    maxLevel:    3,
    levels: [
      { level: 1, extractTime: 30 * 60, bonus: 0,   cost: { gold: 500, stone: 100 } },
      { level: 2, extractTime: 20 * 60, bonus: 25,  cost: { gold: 1200, stone: 250, crystals: 30 } },
      { level: 3, extractTime: 12 * 60, bonus: 50,  cost: { gold: 2500, stone: 500, crystals: 100, bio: 50 } },
    ],
  },
  assault_base: {
    id:          'assault_base',
    name:        'Штурмова база',
    icon:        '🚀',
    description: 'Відправляє армію на штурм поля-руїни. Рівень зменшує час маршу',
    maxLevel:    3,
    levels: [
      { level: 1, marchTime: 30 * 60, cost: { gold: 800, stone: 200, code: 50 } },
      { level: 2, marchTime: 20 * 60, cost: { gold: 1800, stone: 400, code: 150, crystals: 50 } },
      { level: 3, marchTime: 10 * 60, cost: { gold: 3500, stone: 800, code: 350, crystals: 200 } },
    ],
  },
  signal_tower: {
    id:          'signal_tower',
    name:        'Сигнальна вежа',
    icon:        '📡',
    description: 'Прискорює рефреш одного поля (1 раз на добу)',
    maxLevel:    3,
    levels: [
      { level: 1, dailyRefreshes: 1, cost: { gold: 600, bits: 100, code: 40 } },
      { level: 2, dailyRefreshes: 2, cost: { gold: 1400, bits: 200, code: 120, energy: 50 } },
      { level: 3, dailyRefreshes: 3, cost: { gold: 2800, bits: 400, code: 300, energy: 150 } },
    ],
  },
}

// Час маршу (секунди) залежно від тиру поля + рівня будівлі
export function getExpeditionTime(buildingLevel, fieldTier, action) {
  const tierMultiplier = { 1: 1, 2: 1.5, 3: 2.5 }
  const multi = tierMultiplier[fieldTier] || 1

  if (action === 'scout') {
    const base = LAB_BUILDINGS.geolab.levels[(buildingLevel ?? 1) - 1]?.scoutTime || 15 * 60
    return Math.floor(base * multi)
  }
  if (action === 'extract') {
    const base = LAB_BUILDINGS.extraction_station.levels[(buildingLevel ?? 1) - 1]?.extractTime || 30 * 60
    return Math.floor(base * multi)
  }
  if (action === 'attack') {
    const base = LAB_BUILDINGS.assault_base.levels[(buildingLevel ?? 1) - 1]?.marchTime || 30 * 60
    return Math.floor(base * multi)
  }
  return 30 * 60
}

// Бонус видобутку від рівня екстракційної станції (%)
export function getExtractionBonus(buildingLevel) {
  return LAB_BUILDINGS.extraction_station.levels[(buildingLevel ?? 1) - 1]?.bonus || 0
}

// Форматований таймер для UI (хвилини:секунди або год:хв)
export function formatCountdown(ms) {
  if (ms <= 0) return 'Готово!'
  const totalSec = Math.ceil(ms / 1000)
  const hours   = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60

  if (hours >= 1) return `${hours}г ${minutes}хв`
  if (minutes >= 1) return `${minutes}:${String(seconds).padStart(2, '0')}`
  return `${seconds}с`
}
