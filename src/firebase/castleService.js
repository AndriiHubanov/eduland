// ─── Castle Service ───
// Замок: 5 рівнів, унікальний per клас героя

import {
  doc, getDoc, updateDoc, runTransaction, serverTimestamp,
} from 'firebase/firestore'
import { db } from './config'

// ─── Константи ───────────────────────────────────────────────

export const CASTLE_UPGRADE_COSTS = {
  2: { gold: 500, stone: 200 },
  3: { gold: 1200, stone: 500, crystals: 50 },
  4: { gold: 3000, stone: 1000, crystals: 200, code: 100 },
  5: { gold: 6000, stone: 2000, crystals: 500, bits: 500, code: 300 },
}

export const CASTLE_MAX_UNITS = { 1: 3, 2: 5, 3: 8, 4: 12, 5: 15 }

export const CASTLE_NAMES = {
  guardian: {
    1: 'Бункер',
    2: 'Укріплений притулок',
    3: 'Фортеця Стражів',
    4: 'Цитадель Залізної Волі',
    5: 'Бастіон Останньої Лінії',
  },
  archivist: {
    1: 'Архів',
    2: 'Бібліотека Кодів',
    3: 'Лабораторія Знань',
    4: 'Сервер Абсолютної Пам\'яті',
    5: 'Сховище Істини',
  },
  detective: {
    1: 'Штаб розвідки',
    2: 'Слідчий центр',
    3: 'Обсерваторія Тіней',
    4: 'Мережа Всевидячих',
    5: 'Око Бурі',
  },
  coordinator: {
    1: 'Комунікаційний пост',
    2: 'Командний вузол',
    3: 'Координаційна башта',
    4: 'Нексус Зв\'язку',
    5: 'Центр Глобального Контролю',
  },
}

export const CASTLE_BONUSES = {
  guardian: {
    1: { workersMax: 1, defenseBoost: 0 },
    2: { workersMax: 2, defenseBoost: 0.05 },
    3: { workersMax: 3, defenseBoost: 0.15, tradeSlots: 0 },
    4: { workersMax: 5, defenseBoost: 0.3, tradeSlots: 1 },
    5: { workersMax: 7, defenseBoost: 0.5, tradeSlots: 2, xpMultiplier: 1.15 },
  },
  archivist: {
    1: { workersMax: 1, researchSpeed: 0 },
    2: { workersMax: 1, researchSpeed: 0.1 },
    3: { workersMax: 2, researchSpeed: 0.25, tradeSlots: 0 },
    4: { workersMax: 3, researchSpeed: 0.4, tradeSlots: 1, xpMultiplier: 1.1 },
    5: { workersMax: 4, researchSpeed: 0.5, tradeSlots: 1, xpMultiplier: 1.2 },
  },
  detective: {
    1: { workersMax: 1, revealFree: 0 },
    2: { workersMax: 1, revealFree: 0, researchSpeed: 0 },
    3: { workersMax: 2, revealFree: 1, researchSpeed: 0.1 },
    4: { workersMax: 3, revealFree: 2, researchSpeed: 0.2, tradeSlots: 1 },
    5: { workersMax: 4, revealFree: 3, researchSpeed: 0.3, tradeSlots: 1, xpMultiplier: 1.1 },
  },
  coordinator: {
    1: { workersMax: 1, tradeSlots: 0, mineSpeed: 0 },
    2: { workersMax: 2, tradeSlots: 1, mineSpeed: 0.05 },
    3: { workersMax: 3, tradeSlots: 2, mineSpeed: 0.1 },
    4: { workersMax: 5, tradeSlots: 3, mineSpeed: 0.15 },
    5: { workersMax: 7, tradeSlots: 4, mineSpeed: 0.25, xpMultiplier: 1.1 },
  },
}

// ─── Функції ─────────────────────────────────────────────────

// Отримати бонуси замку для гравця
export function getCastleBonus(heroClass, castleLevel) {
  return CASTLE_BONUSES[heroClass]?.[castleLevel] || { workersMax: 0 }
}

// Отримати назву замку
export function getCastleName(heroClass, castleLevel) {
  return CASTLE_NAMES[heroClass]?.[castleLevel] || 'Замок'
}

// Апгрейд замку
export async function upgradeCastle(playerId) {
  await runTransaction(db, async (tx) => {
    const playerRef = doc(db, 'players', playerId)
    const snap = await tx.get(playerRef)
    if (!snap.exists()) throw new Error('Гравець не знайдений')

    const player = snap.data()
    const currentLevel = player.castle?.level || 1
    const nextLevel = currentLevel + 1

    if (nextLevel > 5) throw new Error('Максимальний рівень замку')

    // Перевірка рівня героя
    if ((player.heroLevel || 1) < currentLevel) {
      throw new Error(`Потрібен рівень героя ${currentLevel}+`)
    }

    // Перевірка ресурсів
    const cost = CASTLE_UPGRADE_COSTS[nextLevel]
    if (!cost) throw new Error('Невідома вартість апгрейду')

    for (const [res, amount] of Object.entries(cost)) {
      if ((player.resources?.[res] || 0) < amount) {
        throw new Error(`Недостатньо ${res} (потрібно ${amount})`)
      }
    }

    // Списуємо ресурси + апгрейдимо
    const updates = {
      'castle.level': nextLevel,
      'castle.builtAt': new Date(),
      lastActive: serverTimestamp(),
    }
    for (const [res, amount] of Object.entries(cost)) {
      updates[`resources.${res}`] = (player.resources?.[res] || 0) - amount
    }

    tx.update(playerRef, updates)
  })
}

// Купити скін замку
export async function buyCastleSkin(playerId, skinId, skinPrice, skinRequiredLevel, skinForClass) {
  await runTransaction(db, async (tx) => {
    const playerRef = doc(db, 'players', playerId)
    const snap = await tx.get(playerRef)
    if (!snap.exists()) throw new Error('Гравець не знайдений')

    const player = snap.data()
    const castleLevel = player.castle?.level || 1
    const heroClass = player.heroClass

    if (castleLevel < skinRequiredLevel) {
      throw new Error(`Потрібен замок рівня ${skinRequiredLevel}+`)
    }
    if (skinForClass && skinForClass !== heroClass) {
      throw new Error('Цей скін для іншого класу')
    }
    if ((player.diamonds || 0) < skinPrice) {
      throw new Error(`Недостатньо діамантів (потрібно ${skinPrice})`)
    }

    tx.update(playerRef, {
      'castle.skin': skinId,
      diamonds: (player.diamonds || 0) - skinPrice,
      lastActive: serverTimestamp(),
    })
  })
}
