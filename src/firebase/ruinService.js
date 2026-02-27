// ─── Ruin Service ───
// Руїни на WorldMap: 3 тіри, бій, лут, кулдаун

import {
  doc, getDoc, updateDoc, runTransaction, serverTimestamp,
} from 'firebase/firestore'
import { db } from './config'
import { simulateBattle, saveBattleResult, applyCasualties } from './battleService'

// ─── Константи ───────────────────────────────────────────────

export const RUINS = {
  tier1: {
    tier: 1,
    icon: '🏚️',
    color: '#00ff88',
    cooldownHours: 12,
    enemyArmy: [
      { unitId: 'scout_drone', count: 2, level: 1 },
      { unitId: 'shield_bot', count: 1, level: 1 },
    ],
    lootTable: {
      gold:     [50, 150],
      bits:     [20, 60],
      stone:    [10, 40],
      wood:     [10, 30],
    },
    diamondChance: 0,
    diamondRange: [0, 0],
    xpReward: 15,
  },
  tier2: {
    tier: 2,
    icon: '🏗️',
    color: '#ffd700',
    cooldownHours: 24,
    enemyArmy: [
      { unitId: 'shield_bot', count: 2, level: 2 },
      { unitId: 'hack_spider', count: 2, level: 2 },
      { unitId: 'scout_drone', count: 1, level: 2 },
    ],
    lootTable: {
      gold:     [150, 400],
      bits:     [60, 150],
      code:     [20, 60],
      crystals: [5, 20],
    },
    diamondChance: 0.10,
    diamondRange: [1, 2],
    xpReward: 35,
  },
  tier3: {
    tier: 3,
    icon: '🏰',
    color: '#ff4500',
    cooldownHours: 48,
    enemyArmy: [
      { unitId: 'guardian_core', count: 2, level: 2 },
      { unitId: 'hack_spider', count: 2, level: 3 },
      { unitId: 'siege_mech', count: 2, level: 2 },
      { unitId: 'medic_unit', count: 1, level: 2 },
      { unitId: 'code_phantom', count: 1, level: 3 },
    ],
    lootTable: {
      gold:     [400, 1000],
      bits:     [150, 400],
      code:     [60, 150],
      crystals: [20, 60],
      bio:      [10, 30],
      energy:   [10, 30],
    },
    diamondChance: 0.30,
    diamondRange: [2, 5],
    xpReward: 70,
  },
}

// Шаблони руїн для генерації на карті (per група)
export const RUIN_TEMPLATES = [
  {
    id: 'ruin_abandoned_warehouse',
    tier: 1,
    name: 'Покинутий склад Сектору 7',
    description: 'Напівзруйнований склад з часів Першої Хвилі. Всередині — роботи-охоронці, що досі виконують протоколи безпеки.',
    icon: '🏚️',
  },
  {
    id: 'ruin_destroyed_lab',
    tier: 2,
    name: 'Зруйнована лабораторія "Генезис"',
    description: 'Колись тут створювали перших біороботів. Тепер лабораторія кишить збоженілими прототипами, що захищають залишки технологій.',
    icon: '🏗️',
  },
  {
    id: 'ruin_old_world_bunker',
    tier: 3,
    name: 'Бункер Старого Світу',
    description: 'Легендарний бункер командування до-апокаліптичної ери. Кажуть, всередині зберігаються коди доступу до орбітальних супутників.',
    icon: '🏰',
  },
]

// ─── Генерація позицій руїн для групи ────────────────────────

export function generateRuinPositions(takenPositions = []) {
  const taken = new Set(takenPositions.map(p => `${p.x},${p.y}`))
  const available = []
  for (let x = 0; x < 10; x++) {
    for (let y = 0; y < 10; y++) {
      if (!taken.has(`${x},${y}`)) available.push({ x, y })
    }
  }
  // Перемішуємо
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]]
  }

  return RUIN_TEMPLATES.map((template, idx) => ({
    ...template,
    x: available[idx]?.x ?? idx,
    y: available[idx]?.y ?? idx,
    ...RUINS[`tier${template.tier}`],
  }))
}

// ─── Атака руїни ─────────────────────────────────────────────

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export async function attackRuin(playerId, ruinId, ruinTier) {
  const ruinConfig = RUINS[`tier${ruinTier}`]
  if (!ruinConfig) throw new Error('Невідомий тір руїни')

  // Читаємо гравця
  const playerRef = doc(db, 'players', playerId)
  const playerSnap = await getDoc(playerRef)
  if (!playerSnap.exists()) throw new Error('Гравець не знайдений')
  const player = playerSnap.data()

  // Перевірка кулдауну
  const cooldownKey = ruinId
  const cooldownUntil = player.ruinCooldowns?.[cooldownKey]
  if (cooldownUntil) {
    const until = cooldownUntil.toDate ? cooldownUntil.toDate() : new Date(cooldownUntil)
    if (Date.now() < until.getTime()) {
      const hoursLeft = Math.ceil((until.getTime() - Date.now()) / 3600000)
      throw new Error(`Кулдаун: ще ${hoursLeft} год.`)
    }
  }

  // Перевірка армії
  const formation = player.army?.formation || []
  if (formation.length === 0) throw new Error('Сформуй армію перед атакою')

  // Підготовка армій
  const attackerArmy = formation.map(unitId => ({
    unitId,
    count: player.units?.[unitId]?.count || 0,
    level: player.units?.[unitId]?.level || 1,
  })).filter(u => u.count > 0)

  // Симуляція бою
  const battleResult = simulateBattle(
    attackerArmy,
    ruinConfig.enemyArmy,
    player.heroClass,
    null,
    true // isRuin
  )

  // Генеруємо лут (тільки при перемозі)
  let loot = null
  let xpGain = 0
  let diamondsGained = 0

  if (battleResult.result === 'win') {
    loot = {}
    for (const [res, [min, max]] of Object.entries(ruinConfig.lootTable)) {
      loot[res] = randInt(min, max)
    }

    // Diamonds
    if (Math.random() < ruinConfig.diamondChance) {
      diamondsGained = randInt(ruinConfig.diamondRange[0], ruinConfig.diamondRange[1])
      loot.diamonds = diamondsGained
    }

    xpGain = ruinConfig.xpReward
  }

  // Зберігаємо бій
  const battleId = await saveBattleResult({
    type: 'ruin',
    attackerId: playerId,
    ruinId,
    ruinTier,
    attackerArmy,
    defenderArmy: ruinConfig.enemyArmy,
    battleResult,
    loot,
    xpGain,
    casualties: battleResult.attackerLosses,
  })

  // Застосовуємо результат транзакцією
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(playerRef)
    const p = snap.data()
    const updates = { lastActive: serverTimestamp() }

    // Втрати юнітів
    for (const [unitId, lostCount] of Object.entries(battleResult.attackerLosses)) {
      const current = p.units?.[unitId]?.count || 0
      updates[`units.${unitId}.count`] = Math.max(0, current - lostCount)
    }

    // Статистика
    if (battleResult.result === 'win') {
      updates['battleStats.wins'] = (p.battleStats?.wins || 0) + 1
      updates['battleStats.ruinsCleared'] = (p.battleStats?.ruinsCleared || 0) + 1

      // Нараховуємо лут
      for (const [res, amount] of Object.entries(loot)) {
        if (res === 'diamonds') {
          updates.diamonds = (p.diamonds || 0) + amount
        } else {
          updates[`resources.${res}`] = (p.resources?.[res] || 0) + amount
        }
      }

      // XP
      updates.heroXP = (p.heroXP || 0) + xpGain

      // Кулдаун
      const cooldownEnd = new Date(Date.now() + ruinConfig.cooldownHours * 3600000)
      updates[`ruinCooldowns.${cooldownKey}`] = cooldownEnd
    } else {
      updates['battleStats.losses'] = (p.battleStats?.losses || 0) + 1
    }

    tx.update(playerRef, updates)
  })

  return {
    battleId,
    result: battleResult.result,
    rounds: battleResult.rounds,
    loot,
    xpGain,
    diamondsGained,
    casualties: battleResult.attackerLosses,
    survivingAttackers: battleResult.survivingAttackers,
  }
}
