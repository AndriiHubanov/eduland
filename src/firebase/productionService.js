// ─── Production Service ───
// Черга будівництва + виробничий цикл (як у MyLands)
// Будівлі будуються з часом, не миттєво

import {
  doc, getDoc, updateDoc, runTransaction, serverTimestamp,
} from 'firebase/firestore'
import { db } from './config'
import { getActiveEffects } from './scienceService'
import { getCastleBonus } from './castleService'

// ─── Час будівництва (секунди) ───────────────────────────────

export const BUILD_TIMES = {
  // Основні будівлі
  server:   { 1: 300, 2: 1800, 3: 7200 },    // 5хв → 30хв → 2год
  lab:      { 1: 300, 2: 1800, 3: 7200 },
  tower:    { 1: 600, 2: 2400, 3: 9000 },
  archive:  { 1: 300, 2: 1800, 3: 7200 },
  firewall: { 1: 900, 2: 3600, 3: 10800 },
  // Природничі
  greenhouse:  { 1: 600, 2: 2400, 3: 9000 },
  reactor:     { 1: 900, 2: 3600, 3: 10800 },
  biolab:      { 1: 1200, 2: 5400, 3: 14400 },
  solar_array: { 1: 600, 2: 2400, 3: 9000 },
}

// ─── Нові поля в /players/{id} ───────────────────────────────
/*
  buildQueue: {
    buildingId: string | null,   // що будується
    targetLevel: number | null,
    startedAt: Timestamp | null,
    endsAt: Timestamp | null,
  }
  
  productionLog: {             // накопичене виробництво
    lastCalculated: Timestamp,
  }
*/

// ─── Черга будівництва ───────────────────────────────────────

export async function startBuild(playerId, buildingId, buildingConfig) {
  await runTransaction(db, async (tx) => {
    const playerRef = doc(db, 'players', playerId)
    const snap = await tx.get(playerRef)
    if (!snap.exists()) throw new Error('Гравець не знайдений')

    const player = snap.data()

    // Перевірка чи вже будується
    if (player.buildQueue?.buildingId) {
      throw new Error('Вже йде будівництво. Дочекайся завершення.')
    }

    const currentLevel = player.buildings?.[buildingId]?.level || 0
    const targetLevel = currentLevel + 1

    if (targetLevel > 3) throw new Error('Максимальний рівень будівлі')

    // Перевірка hero level
    if (buildingConfig.unlockHeroLevel && (player.heroLevel || 1) < buildingConfig.unlockHeroLevel) {
      throw new Error(`Потрібен рівень героя ${buildingConfig.unlockHeroLevel}+`)
    }

    // Знаходимо конфіг рівня
    const levelConfig = buildingConfig.levels?.find(l => l.level === targetLevel)
    if (!levelConfig) throw new Error('Конфіг рівня не знайдений')

    // Перевірка ресурсів
    for (const [res, amount] of Object.entries(levelConfig.cost)) {
      if ((player.resources?.[res] || 0) < amount) {
        throw new Error(`Недостатньо ${res} (потрібно ${amount})`)
      }
    }

    // Обчислюємо час з бонусами
    const baseBuildTime = BUILD_TIMES[buildingId]?.[targetLevel] || 1800
    const effects = getActiveEffects(player.sciences)
    const castleBonus = getCastleBonus(player.heroClass, player.castle?.level || 1)
    // Лаба прискорює будівництво (10% per рівень)
    const labSpeedBonus = (player.buildings?.lab?.level || 0) * 0.1
    const totalSpeedBonus = labSpeedBonus + (effects.buildSpeed || 0)
    const actualTime = Math.max(60, Math.floor(baseBuildTime * (1 - totalSpeedBonus)))

    const now = new Date()
    const endsAt = new Date(now.getTime() + actualTime * 1000)

    // Списуємо ресурси + ставимо в чергу
    const updates = {
      buildQueue: {
        buildingId,
        targetLevel,
        startedAt: now,
        endsAt,
      },
      lastActive: serverTimestamp(),
    }
    for (const [res, amount] of Object.entries(levelConfig.cost)) {
      updates[`resources.${res}`] = (player.resources?.[res] || 0) - amount
    }

    tx.update(playerRef, updates)
  })
}

// Завершити будівництво
export async function completeBuild(playerId) {
  await runTransaction(db, async (tx) => {
    const playerRef = doc(db, 'players', playerId)
    const snap = await tx.get(playerRef)
    if (!snap.exists()) throw new Error('Гравець не знайдений')

    const player = snap.data()
    const queue = player.buildQueue
    if (!queue?.buildingId) throw new Error('Немає активного будівництва')

    const endsAt = queue.endsAt?.toDate?.() || new Date(queue.endsAt)
    if (Date.now() < endsAt.getTime()) throw new Error('Будівництво ще не завершено')

    tx.update(playerRef, {
      [`buildings.${queue.buildingId}.level`]: queue.targetLevel,
      buildQueue: { buildingId: null, targetLevel: null, startedAt: null, endsAt: null },
      lastActive: serverTimestamp(),
    })
  })
}

// Скасувати будівництво (повертає 50% ресурсів)
export async function cancelBuild(playerId, buildingConfig) {
  await runTransaction(db, async (tx) => {
    const playerRef = doc(db, 'players', playerId)
    const snap = await tx.get(playerRef)
    if (!snap.exists()) throw new Error('Гравець не знайдений')

    const player = snap.data()
    const queue = player.buildQueue
    if (!queue?.buildingId) throw new Error('Немає активного будівництва')

    const levelConfig = buildingConfig?.levels?.find(l => l.level === queue.targetLevel)
    const updates = {
      buildQueue: { buildingId: null, targetLevel: null, startedAt: null, endsAt: null },
      lastActive: serverTimestamp(),
    }

    // Повертаємо 50% ресурсів
    if (levelConfig?.cost) {
      for (const [res, amount] of Object.entries(levelConfig.cost)) {
        const refund = Math.floor(amount * 0.5)
        updates[`resources.${res}`] = (player.resources?.[res] || 0) + refund
      }
    }

    tx.update(playerRef, updates)
  })
}

// ─── Збирання виробництва (офлайн прогрес) ──────────────────

/**
 * Розраховує і нараховує виробництво будівель за час відсутності.
 * Викликається при вході гравця.
 * Як у MyLands — будівлі виробляють навіть коли ти офлайн.
 */
export async function collectOfflineProduction(playerId, buildingsConfig) {
  await runTransaction(db, async (tx) => {
    const playerRef = doc(db, 'players', playerId)
    const snap = await tx.get(playerRef)
    if (!snap.exists()) return

    const player = snap.data()
    const lastCalc = player.productionLog?.lastCalculated?.toDate?.()
      || player.lastActive?.toDate?.()
      || new Date()

    const now = new Date()
    const hoursPassed = Math.min(24, (now.getTime() - lastCalc.getTime()) / 3600000) // макс 24 години
    if (hoursPassed < 0.1) return // менше 6 хвилин — ігноруємо

    const effects = getActiveEffects(player.sciences)
    const productionBonus = 1 + (effects.buildingProduction || 0)

    const totalProduction = {}

    for (const [buildingId, building] of Object.entries(player.buildings || {})) {
      if (!building.level || building.level < 1) continue

      // Знаходимо конфіг будівлі
      const config = buildingsConfig?.find(b => b.id === buildingId)
      if (!config) continue

      const levelConfig = config.levels?.find(l => l.level === building.level)
      if (!levelConfig?.production) continue

      // Робітники множник (0 workers = 50% виробництва, 1+ = 100%+)
      const workers = building.workers || 0
      const workerMult = workers > 0 ? 1 + (workers - 1) * 0.2 : 0.5

      // Синергія
      let synergyMult = 1
      if (config.synergyBonus && workers >= config.synergyBonus.minWorkers) {
        // Синергія додає фіксований бонус, не множник
      }

      for (const [res, amountPerHour] of Object.entries(levelConfig.production)) {
        const produced = amountPerHour * hoursPassed * workerMult * productionBonus
        totalProduction[res] = (totalProduction[res] || 0) + produced

        // Синергія
        if (config.synergyBonus && workers >= config.synergyBonus.minWorkers) {
          const synergyRes = config.synergyBonus.bonus
          for (const [sRes, sAmount] of Object.entries(synergyRes)) {
            totalProduction[sRes] = (totalProduction[sRes] || 0) + sAmount * hoursPassed
          }
        }
      }
    }

    // Нараховуємо
    const updates = {
      'productionLog.lastCalculated': now,
      lastActive: serverTimestamp(),
    }
    const produced = {}
    for (const [res, amount] of Object.entries(totalProduction)) {
      const rounded = Math.floor(amount)
      if (rounded > 0) {
        updates[`resources.${res}`] = (player.resources?.[res] || 0) + rounded
        produced[res] = rounded
      }
    }

    tx.update(playerRef, updates)

    return produced
  })
}

// ─── Прискорення (за diamonds) ───────────────────────────────

export async function speedUpBuild(playerId, diamondCost) {
  await runTransaction(db, async (tx) => {
    const playerRef = doc(db, 'players', playerId)
    const snap = await tx.get(playerRef)
    if (!snap.exists()) throw new Error('Гравець не знайдений')

    const player = snap.data()
    if (!player.buildQueue?.buildingId) throw new Error('Немає активного будівництва')
    if ((player.diamonds || 0) < diamondCost) throw new Error('Недостатньо діамантів')

    tx.update(playerRef, {
      [`buildings.${player.buildQueue.buildingId}.level`]: player.buildQueue.targetLevel,
      buildQueue: { buildingId: null, targetLevel: null, startedAt: null, endsAt: null },
      diamonds: (player.diamonds || 0) - diamondCost,
      lastActive: serverTimestamp(),
    })
  })
}

// Розрахувати вартість прискорення
export function getSpeedUpCost(endsAt) {
  const remaining = Math.max(0, (new Date(endsAt).getTime() - Date.now()) / 1000)
  // 1 diamond per 30 хвилин, мінімум 1
  return Math.max(1, Math.ceil(remaining / 1800))
}
