// ─── Science Service (Tech Tree) ───
// Науки як у MyLands: дерево технологій per дисципліна
// Кожна наука вимагає ресурси + час + попередню науку
// Лабораторія прискорює дослідження (як Alchemist Lab у ML)

import {
  doc, getDoc, getDocs, updateDoc,
  collection, query, where, onSnapshot,
  runTransaction, serverTimestamp,
} from 'firebase/firestore'
import { db } from './config'

// ─── Дерево наук ─────────────────────────────────────────────

export const SCIENCES = {
  // ═══ ЕКОНОМІКА ═══
  econ_mining_1: {
    id: 'econ_mining_1',
    name: 'Основи видобутку',
    description: 'Копальні виробляють на 20% більше',
    icon: '⛏️',
    branch: 'economy',
    discipline: null, // універсальна
    level: 1,
    requires: [],
    cost: { gold: 200, bits: 30 },
    researchTime: 3600, // секунди (1 год)
    effect: { mineProduction: 0.2 },
  },
  econ_mining_2: {
    id: 'econ_mining_2',
    name: 'Просунутий видобуток',
    description: 'Копальні виробляють на 50% більше. Макс рівень копальні +1 ефективності.',
    icon: '⛏️',
    branch: 'economy',
    discipline: null,
    level: 2,
    requires: ['econ_mining_1'],
    cost: { gold: 600, bits: 80, code: 20 },
    researchTime: 10800, // 3 год
    effect: { mineProduction: 0.5 },
  },
  econ_trade_1: {
    id: 'econ_trade_1',
    name: 'Торгові шляхи',
    description: 'Можна мати 2 одночасні торгові запити',
    icon: '🤝',
    branch: 'economy',
    discipline: null,
    level: 1,
    requires: [],
    cost: { gold: 300 },
    researchTime: 1800, // 30 хв
    effect: { maxTrades: 2 },
  },
  econ_trade_2: {
    id: 'econ_trade_2',
    name: 'Торгова імперія',
    description: '5 одночасних запитів + 10% бонус при обміні',
    icon: '💰',
    branch: 'economy',
    discipline: null,
    level: 2,
    requires: ['econ_trade_1'],
    cost: { gold: 800, crystals: 20 },
    researchTime: 7200, // 2 год
    effect: { maxTrades: 5, tradeBonus: 0.1 },
  },
  econ_workers_1: {
    id: 'econ_workers_1',
    name: 'Оптимізація праці',
    description: '+2 до максимуму робітників',
    icon: '👷',
    branch: 'economy',
    discipline: null,
    level: 1,
    requires: [],
    cost: { gold: 400, stone: 50 },
    researchTime: 5400, // 1.5 год
    effect: { workersMax: 2 },
  },
  econ_production_1: {
    id: 'econ_production_1',
    name: 'Ефективне виробництво',
    description: 'Всі будівлі виробляють на 15% більше',
    icon: '🏭',
    branch: 'economy',
    discipline: null,
    level: 1,
    requires: ['econ_workers_1'],
    cost: { gold: 500, bits: 50, code: 15 },
    researchTime: 7200,
    effect: { buildingProduction: 0.15 },
  },

  // ═══ ВІЙСЬКО ═══
  mil_army_1: {
    id: 'mil_army_1',
    name: 'Військова доктрина',
    description: 'Юніти отримують +10% HP',
    icon: '⚔️',
    branch: 'military',
    discipline: null,
    level: 1,
    requires: [],
    cost: { gold: 300, stone: 40 },
    researchTime: 3600,
    effect: { unitHPBonus: 0.1 },
  },
  mil_army_2: {
    id: 'mil_army_2',
    name: 'Тактична перевага',
    description: 'Юніти +20% ATK',
    icon: '⚔️',
    branch: 'military',
    discipline: null,
    level: 2,
    requires: ['mil_army_1'],
    cost: { gold: 700, bits: 60, code: 30 },
    researchTime: 10800,
    effect: { unitATKBonus: 0.2 },
  },
  mil_defense_1: {
    id: 'mil_defense_1',
    name: 'Укріплення',
    description: '+15% DEF всім юнітам',
    icon: '🛡️',
    branch: 'military',
    discipline: null,
    level: 1,
    requires: [],
    cost: { gold: 350, stone: 60 },
    researchTime: 3600,
    effect: { unitDEFBonus: 0.15 },
  },
  mil_espionage_1: {
    id: 'mil_espionage_1',
    name: 'Розвідка',
    description: 'Бачиш армію ворога перед атакою руїни',
    icon: '🔍',
    branch: 'military',
    discipline: null,
    level: 1,
    requires: ['mil_army_1'],
    cost: { gold: 500, code: 40 },
    researchTime: 5400,
    effect: { espionage: true },
  },
  mil_tactics_1: {
    id: 'mil_tactics_1',
    name: 'Облога',
    description: '+25% ATK проти руїн (стакається з siege_mech)',
    icon: '🏰',
    branch: 'military',
    discipline: null,
    level: 1,
    requires: ['mil_army_2'],
    cost: { gold: 1000, bits: 100, code: 50 },
    researchTime: 14400, // 4 год
    effect: { siegeBonus: 0.25 },
  },

  // ═══ ІНФОРМАТИКА ═══
  info_hacking_1: {
    id: 'info_hacking_1',
    name: 'Базове хакерство',
    description: 'Хакер-павук ігнорує 60% DEF (замість 50%)',
    icon: '🕷️',
    branch: 'informatics',
    discipline: 'informatics',
    level: 1,
    requires: ['mil_army_1'],
    cost: { bits: 80, code: 40 },
    researchTime: 7200,
    effect: { hackIgnoreDef: 0.6 },
  },
  info_encryption_1: {
    id: 'info_encryption_1',
    name: 'Шифрування',
    description: 'Код-Фантом 40% ухилення (замість 30%)',
    icon: '🔐',
    branch: 'informatics',
    discipline: 'informatics',
    level: 1,
    requires: [],
    cost: { code: 60, bits: 40 },
    researchTime: 5400,
    effect: { phantomEvasion: 0.4 },
  },
  info_server_boost: {
    id: 'info_server_boost',
    name: 'Серверний кластер',
    description: 'Сервер виробляє на 30% більше',
    icon: '🖥️',
    branch: 'informatics',
    discipline: 'informatics',
    level: 1,
    requires: ['econ_production_1'],
    cost: { bits: 100, code: 30, gold: 300 },
    researchTime: 7200,
    effect: { serverBoost: 0.3 },
  },

  // ═══ ПРИРОДНИЧІ НАУКИ ═══
  nat_biology_1: {
    id: 'nat_biology_1',
    name: 'Біоінженерія',
    description: 'Медик лікує на 50% більше',
    icon: '🧬',
    branch: 'natural_science',
    discipline: 'natural_science',
    level: 1,
    requires: [],
    cost: { bio: 40, energy: 20 },
    researchTime: 5400,
    effect: { medicHealBoost: 0.5 },
  },
  nat_energy_1: {
    id: 'nat_energy_1',
    name: 'Енергетичний щит',
    description: 'Щитобот блокує 2 атаки (замість 1)',
    icon: '⚡',
    branch: 'natural_science',
    discipline: 'natural_science',
    level: 1,
    requires: [],
    cost: { energy: 50, bio: 20 },
    researchTime: 5400,
    effect: { shieldBlocks: 2 },
  },
  nat_greenhouse_boost: {
    id: 'nat_greenhouse_boost',
    name: 'Гідропоніка',
    description: 'Теплиця +40% виробництво',
    icon: '🌿',
    branch: 'natural_science',
    discipline: 'natural_science',
    level: 1,
    requires: ['econ_production_1'],
    cost: { bio: 60, gold: 400 },
    researchTime: 7200,
    effect: { greenhouseBoost: 0.4 },
  },
  nat_reactor_boost: {
    id: 'nat_reactor_boost',
    name: 'Ядерний синтез',
    description: 'Реактор +40% виробництво',
    icon: '⚛️',
    branch: 'natural_science',
    discipline: 'natural_science',
    level: 1,
    requires: ['econ_production_1'],
    cost: { energy: 60, gold: 400, crystals: 15 },
    researchTime: 7200,
    effect: { reactorBoost: 0.4 },
  },
}

export const SCIENCE_BRANCHES = {
  economy:         { name: 'Економіка',         icon: '💰', color: '#ffd700' },
  military:        { name: 'Військо',           icon: '⚔️', color: '#ff4444' },
  informatics:     { name: 'Інформатика',       icon: '💻', color: '#00aaff' },
  natural_science: { name: 'Природничі науки',  icon: '🔬', color: '#00ff88' },
}

// ─── Нові поля в /players/{id} ───────────────────────────────
/*
  sciences: {
    [scienceId]: {
      status: 'completed' | 'researching',
      completedAt: Timestamp | null,
      startedAt: Timestamp | null,
      endsAt: Timestamp | null,
    }
  }
*/

// ─── Функції ─────────────────────────────────────────────────

// Перевірка чи можна почати дослідження
export function canResearchScience(scienceId, playerSciences) {
  const science = SCIENCES[scienceId]
  if (!science) return { can: false, reason: 'Невідома наука' }

  const ps = playerSciences || {}
  if (ps[scienceId]?.status === 'completed') return { can: false, reason: 'Вже досліджено' }
  if (ps[scienceId]?.status === 'researching') return { can: false, reason: 'Вже досліджується' }

  // Перевірка чи щось досліджується (1 одночасно, якщо немає бонусу)
  const researching = Object.values(ps).filter(s => s.status === 'researching')
  if (researching.length >= 1) return { can: false, reason: 'Вже йде дослідження іншої науки' }

  // Перевірка prerequisites
  for (const req of science.requires) {
    if (ps[req]?.status !== 'completed') {
      return { can: false, reason: `Спочатку досліди: ${SCIENCES[req]?.name || req}` }
    }
  }

  return { can: true }
}

// Почати дослідження
export async function startScience(playerId, scienceId) {
  const science = SCIENCES[scienceId]
  if (!science) throw new Error('Невідома наука')

  await runTransaction(db, async (tx) => {
    const playerRef = doc(db, 'players', playerId)
    const snap = await tx.get(playerRef)
    if (!snap.exists()) throw new Error('Гравець не знайдений')

    const player = snap.data()
    const check = canResearchScience(scienceId, player.sciences)
    if (!check.can) throw new Error(check.reason)

    // Перевірка ресурсів
    for (const [res, amount] of Object.entries(science.cost)) {
      if ((player.resources?.[res] || 0) < amount) {
        throw new Error(`Недостатньо ${res} (потрібно ${amount})`)
      }
    }

    // Бонус швидкості від кількості лабораторій
    const labLevel = player.buildings?.lab?.level || 0
    const speedBonus = labLevel * 0.15 // кожен рівень лабораторії -15% часу
    const actualTime = Math.floor(science.researchTime * (1 - speedBonus))

    const now = new Date()
    const endsAt = new Date(now.getTime() + actualTime * 1000)

    const updates = {
      [`sciences.${scienceId}`]: {
        status: 'researching',
        startedAt: now,
        endsAt,
      },
      lastActive: serverTimestamp(),
    }

    // Списуємо ресурси
    for (const [res, amount] of Object.entries(science.cost)) {
      updates[`resources.${res}`] = (player.resources?.[res] || 0) - amount
    }

    tx.update(playerRef, updates)
  })
}

// Завершити дослідження (клієнт викликає коли таймер закінчився)
export async function completeScience(playerId, scienceId) {
  await runTransaction(db, async (tx) => {
    const playerRef = doc(db, 'players', playerId)
    const snap = await tx.get(playerRef)
    if (!snap.exists()) throw new Error('Гравець не знайдений')

    const player = snap.data()
    const scienceState = player.sciences?.[scienceId]
    if (!scienceState || scienceState.status !== 'researching') {
      throw new Error('Ця наука не досліджується')
    }

    const endsAt = scienceState.endsAt?.toDate?.() || new Date(scienceState.endsAt)
    if (Date.now() < endsAt.getTime()) throw new Error('Дослідження ще не завершено')

    tx.update(playerRef, {
      [`sciences.${scienceId}`]: {
        status: 'completed',
        completedAt: new Date(),
        startedAt: scienceState.startedAt,
        endsAt: null,
      },
      lastActive: serverTimestamp(),
    })
  })
}

// Отримати всі активні ефекти наук гравця
export function getActiveEffects(playerSciences) {
  const effects = {}
  if (!playerSciences) return effects

  for (const [sciId, state] of Object.entries(playerSciences)) {
    if (state.status !== 'completed') continue
    const science = SCIENCES[sciId]
    if (!science) continue

    for (const [key, value] of Object.entries(science.effect)) {
      if (typeof value === 'number') {
        effects[key] = (effects[key] || 0) + value
      } else {
        effects[key] = value
      }
    }
  }

  return effects
}

// Список наук доступних для дослідження
export function getAvailableSciences(playerSciences, discipline = null) {
  const ps = playerSciences || {}
  return Object.values(SCIENCES).filter(s => {
    if (discipline && s.discipline && s.discipline !== discipline) return false
    if (ps[s.id]?.status === 'completed') return false
    if (ps[s.id]?.status === 'researching') return false
    // Перевірка prerequisites
    for (const req of s.requires) {
      if (ps[req]?.status !== 'completed') return false
    }
    return true
  })
}
