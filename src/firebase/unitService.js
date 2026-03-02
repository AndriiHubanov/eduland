// ─── Unit Service ───
// Юніти-роботи: найм, апгрейд, формування армії

import {
  doc, runTransaction, serverTimestamp,
} from 'firebase/firestore'
import { db } from './config'
import { CASTLE_MAX_UNITS } from './castleService'
import { getHeroLevel } from '../store/gameStore'

// ─── Константи ───────────────────────────────────────────────

export const UNITS = {
  scout_drone: {
    name: 'Дрон-розвідник',
    icon: '🛸',
    type: 'dps',
    baseHP: 30, baseATK: 25, baseDEF: 5,
    special: 'Перший удар — атакує до основної фази',
    cost: { gold: 100, bits: 20 },
    upgradeCost: {
      2: { gold: 200, bits: 40 },
      3: { gold: 400, bits: 80, code: 20 },
    },
    heroClassBonus: 'detective',
  },
  shield_bot: {
    name: 'Щитобот',
    icon: '🤖',
    type: 'tank',
    baseHP: 80, baseATK: 8, baseDEF: 30,
    special: 'Блокує першу атаку по союзнику',
    cost: { gold: 120, stone: 30 },
    upgradeCost: {
      2: { gold: 250, stone: 60 },
      3: { gold: 500, stone: 120, crystals: 15 },
    },
    heroClassBonus: 'guardian',
  },
  hack_spider: {
    name: 'Хакер-павук',
    icon: '🕷️',
    type: 'dps',
    baseHP: 25, baseATK: 35, baseDEF: 3,
    special: 'Ігнорує 50% DEF ворога',
    cost: { gold: 150, code: 15 },
    upgradeCost: {
      2: { gold: 300, code: 30 },
      3: { gold: 600, code: 60, bits: 40 },
    },
    heroClassBonus: 'archivist',
  },
  medic_unit: {
    name: 'Медик-модуль',
    icon: '💊',
    type: 'support',
    baseHP: 40, baseATK: 5, baseDEF: 15,
    special: 'Лікує найслабшого союзника на +20 HP/раунд',
    cost: { gold: 130, bio: 10 },
    upgradeCost: {
      2: { gold: 260, bio: 20 },
      3: { gold: 520, bio: 40, energy: 15 },
    },
    heroClassBonus: null,
  },
  siege_mech: {
    name: 'Осадний мех',
    icon: '🦾',
    type: 'dps',
    baseHP: 50, baseATK: 40, baseDEF: 10,
    special: '+50% ATK проти руїн',
    cost: { gold: 200, bits: 30, stone: 20 },
    upgradeCost: {
      2: { gold: 400, bits: 60, stone: 40 },
      3: { gold: 800, bits: 120, stone: 80, code: 30 },
    },
    heroClassBonus: null,
  },
  guardian_core: {
    name: 'Ядро Стражів',
    icon: '🔮',
    type: 'tank',
    baseHP: 100, baseATK: 15, baseDEF: 40,
    special: 'Тягне всі атаки на себе перші 2 раунди',
    cost: { gold: 250, stone: 50, crystals: 10 },
    upgradeCost: {
      2: { gold: 500, stone: 100, crystals: 20 },
      3: { gold: 1000, stone: 200, crystals: 40, code: 25 },
    },
    heroClassBonus: 'guardian',
  },
  code_phantom: {
    name: 'Код-Фантом',
    icon: '👻',
    type: 'dps',
    baseHP: 20, baseATK: 45, baseDEF: 0,
    special: '30% шанс повного уникнення атаки',
    cost: { gold: 180, code: 25 },
    upgradeCost: {
      2: { gold: 360, code: 50 },
      3: { gold: 720, code: 100, bits: 50 },
    },
    heroClassBonus: 'detective',
  },
  relay_tower: {
    name: 'Ретрансляційна вежа',
    icon: '📡',
    type: 'support',
    baseHP: 35, baseATK: 0, baseDEF: 20,
    special: '+15% ATK всім союзникам',
    cost: { gold: 160, energy: 15 },
    upgradeCost: {
      2: { gold: 320, energy: 30 },
      3: { gold: 640, energy: 60, bits: 30 },
    },
    heroClassBonus: 'coordinator',
  },
}

// Стати юніта per рівень (множник)
export const UNIT_LEVEL_MULTIPLIER = { 1: 1, 2: 1.4, 3: 1.9 }

// Отримати стати юніта з урахуванням рівня і класу героя
export function getUnitStats(unitId, level, heroClass) {
  const unit = UNITS[unitId]
  if (!unit) return null
  const mult = UNIT_LEVEL_MULTIPLIER[level] || 1
  const classBonus = unit.heroClassBonus === heroClass ? 1.1 : 1

  return {
    hp:  Math.floor(unit.baseHP * mult),
    atk: Math.floor(unit.baseATK * mult * classBonus),
    def: Math.floor(unit.baseDEF * mult),
    special: unit.special,
  }
}

// ─── Найм юніта ──────────────────────────────────────────────

export async function recruitUnit(playerId, unitId, amount = 1) {
  const unit = UNITS[unitId]
  if (!unit) throw new Error('Невідомий юніт')

  await runTransaction(db, async (tx) => {
    const playerRef = doc(db, 'players', playerId)
    const snap = await tx.get(playerRef)
    if (!snap.exists()) throw new Error('Гравець не знайдений')

    const player = snap.data()

    // Перевірка рівня героя (рівень обчислюється з player.xp)
    if (getHeroLevel(player.xp || 0) < 2) throw new Error('Потрібен рівень героя 2+')

    // Перевірка ліміту юнітів (від замку)
    const castleLevel = player.castle?.level || 1
    const maxUnits = CASTLE_MAX_UNITS[castleLevel] || 3
    const currentTotal = Object.values(player.units || {}).reduce((sum, u) => sum + (u.count || 0), 0)
    if (currentTotal + amount > maxUnits) {
      throw new Error(`Ліміт юнітів: ${maxUnits} (замок лв.${castleLevel}). Зараз: ${currentTotal}`)
    }

    // Перевірка ресурсів (вартість * кількість)
    for (const [res, cost] of Object.entries(unit.cost)) {
      const totalCost = cost * amount
      if ((player.resources?.[res] || 0) < totalCost) {
        throw new Error(`Недостатньо ${res} (потрібно ${totalCost})`)
      }
    }

    // Списуємо ресурси
    const updates = { lastActive: serverTimestamp() }
    for (const [res, cost] of Object.entries(unit.cost)) {
      updates[`resources.${res}`] = (player.resources?.[res] || 0) - cost * amount
    }

    // Додаємо юніти
    const currentUnit = player.units?.[unitId] || { count: 0, level: 1 }
    updates[`units.${unitId}`] = {
      count: currentUnit.count + amount,
      level: currentUnit.level || 1,
    }

    tx.update(playerRef, updates)
  })
}

// ─── Апгрейд юніта ──────────────────────────────────────────

export async function upgradeUnit(playerId, unitId) {
  const unit = UNITS[unitId]
  if (!unit) throw new Error('Невідомий юніт')

  await runTransaction(db, async (tx) => {
    const playerRef = doc(db, 'players', playerId)
    const snap = await tx.get(playerRef)
    if (!snap.exists()) throw new Error('Гравець не знайдений')

    const player = snap.data()
    const currentUnit = player.units?.[unitId]
    if (!currentUnit || currentUnit.count < 1) throw new Error('Юніт не найнятий')

    const currentLevel = currentUnit.level || 1
    if (currentLevel >= 3) throw new Error('Максимальний рівень юніта')

    const nextLevel = currentLevel + 1
    const cost = unit.upgradeCost[nextLevel]
    if (!cost) throw new Error('Невідома вартість апгрейду')

    for (const [res, amount] of Object.entries(cost)) {
      if ((player.resources?.[res] || 0) < amount) {
        throw new Error(`Недостатньо ${res} (потрібно ${amount})`)
      }
    }

    const updates = { lastActive: serverTimestamp() }
    for (const [res, amount] of Object.entries(cost)) {
      updates[`resources.${res}`] = (player.resources?.[res] || 0) - amount
    }
    updates[`units.${unitId}.level`] = nextLevel

    tx.update(playerRef, updates)
  })
}

// ─── Формування армії ────────────────────────────────────────

export async function setFormation(playerId, formation) {
  if (!Array.isArray(formation) || formation.length > 5) {
    throw new Error('Максимум 5 юнітів у формації')
  }

  await runTransaction(db, async (tx) => {
    const playerRef = doc(db, 'players', playerId)
    const snap = await tx.get(playerRef)
    if (!snap.exists()) throw new Error('Гравець не знайдений')

    const player = snap.data()
    const units = player.units || {}

    // Валідація — кожен юніт має бути найнятий
    for (const unitId of formation) {
      if (!units[unitId] || units[unitId].count < 1) {
        throw new Error(`Юніт ${unitId} не найнятий`)
      }
    }

    // Рахуємо сумарну бойову силу
    const heroClass = player.heroClass
    let power = 0
    for (const unitId of formation) {
      const stats = getUnitStats(unitId, units[unitId].level, heroClass)
      power += stats.hp + stats.atk * 2 + stats.def
    }

    tx.update(playerRef, {
      'army.formation': formation,
      'army.power': power,
      lastActive: serverTimestamp(),
    })
  })
}

// Отримати загальну кількість юнітів гравця
export function getTotalUnits(playerUnits) {
  if (!playerUnits) return 0
  return Object.values(playerUnits).reduce((sum, u) => sum + (u.count || 0), 0)
}
