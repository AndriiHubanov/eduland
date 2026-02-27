// ─── Season Service ───
// Сезонна система: пас, прогрес, рейтинг, перехід між сезонами

import {
  doc, getDoc, getDocs, updateDoc,
  collection, query, where, onSnapshot,
  runTransaction, serverTimestamp,
} from 'firebase/firestore'
import { db } from './config'

// ─── Поточний сезон ──────────────────────────────────────────

export const CURRENT_SEASON = {
  id: 'season_1',
  number: 1,
  name: 'Пробудження',
  subtitle: 'Рік 2147. Прокинься. Відбудуй. Виживи.',
  icon: '⚡',
  theme: 'awakening',
  startDate: '2026-02-28',
  endDate: '2026-06-30',
  disciplines: ['informatics', 'natural_science'],
  maxPassLevel: 30,
  xpPerLevel: 100,
}

// ─── Сезонний пас ────────────────────────────────────────────

export const SEASON_PASS_REWARDS = {
  // Безкоштовний трек
  free: {
    1:  { gold: 100 },
    2:  { bits: 30 },
    3:  { gold: 150 },
    4:  { stone: 50 },
    5:  { bits: 50, code: 10 },
    6:  { gold: 200 },
    7:  { wood: 80 },
    8:  { crystals: 10 },
    9:  { gold: 250 },
    10: { gold: 300, bits: 50 },
    12: { bio: 20 },
    14: { energy: 20 },
    15: { gold: 400, code: 20 },
    18: { crystals: 20 },
    20: { gold: 500, code: 30, bits: 80 },
    22: { bio: 30, energy: 30 },
    25: { diamonds: 3 },
    28: { gold: 800 },
    30: { diamonds: 5 },
  },
  // Преміум трек (потрібно "активувати" за diamonds)
  premium: {
    1:  { title: 'Першопрохідник' },
    5:  { skin: 'castle_rusty_bunker', skinName: 'Іржавий бункер' },
    10: { skin: 'unit_golden_drone', skinName: 'Золотий дрон' },
    15: { emote: 'victory', emoteName: 'Перемога' },
    20: { skin: 'castle_neon_shelter', skinName: 'Неоновий притулок' },
    25: { frame: 'season_1_frame', frameName: 'Рамка Сезону 1' },
    30: { skin: 'castle_founder', skinName: 'Засновник (ексклюзив)', title: 'Засновник' },
  },
  premiumCost: 15, // diamonds для активації преміум-треку
}

// ─── Нові поля гравця ────────────────────────────────────────

/*
  Додати до /players/{id}:
  
  season: {
    id: 'season_1',
    passXP: 0,
    passLevel: 0,
    premiumActive: false,
    claimedFree: [],      // [1, 2, 5, ...]
    claimedPremium: [],
    titles: [],           // ['Першопрохідник', ...]
    activeTitle: null,
    frames: [],
    activeFrame: null,
  },
  seasonRating: {
    score: 0,             // обнуляється кожен сезон
  }
*/

// ─── Підписка на сезонні дані ────────────────────────────────

export function getSeasonLevel(passXP) {
  return Math.min(Math.floor(passXP / CURRENT_SEASON.xpPerLevel), CURRENT_SEASON.maxPassLevel)
}

export function getSeasonProgress(passXP) {
  const level = getSeasonLevel(passXP)
  if (level >= CURRENT_SEASON.maxPassLevel) return { level, progress: 100, current: 0, needed: 0 }
  const currentXP = passXP - (level * CURRENT_SEASON.xpPerLevel)
  return {
    level,
    progress: Math.floor((currentXP / CURRENT_SEASON.xpPerLevel) * 100),
    current: currentXP,
    needed: CURRENT_SEASON.xpPerLevel,
  }
}

// ─── Додати XP сезону ───────────────────────────────────────

export async function addSeasonXP(playerId, amount) {
  await runTransaction(db, async (tx) => {
    const playerRef = doc(db, 'players', playerId)
    const snap = await tx.get(playerRef)
    if (!snap.exists()) return

    const player = snap.data()
    const season = player.season || { id: CURRENT_SEASON.id, passXP: 0, passLevel: 0 }
    const newXP = (season.passXP || 0) + amount
    const newLevel = getSeasonLevel(newXP)

    tx.update(playerRef, {
      'season.passXP': newXP,
      'season.passLevel': newLevel,
      lastActive: serverTimestamp(),
    })
  })
}

// ─── Забрати нагороду сезонного пасу ─────────────────────────

export async function claimSeasonReward(playerId, level, track) {
  const rewards = SEASON_PASS_REWARDS[track]
  if (!rewards || !rewards[level]) throw new Error('Нагорода не знайдена')

  await runTransaction(db, async (tx) => {
    const playerRef = doc(db, 'players', playerId)
    const snap = await tx.get(playerRef)
    if (!snap.exists()) throw new Error('Гравець не знайдений')

    const player = snap.data()
    const season = player.season || {}

    // Перевірка рівня
    if ((season.passLevel || 0) < level) throw new Error('Недостатній рівень пасу')

    // Перевірка преміум
    if (track === 'premium' && !season.premiumActive) throw new Error('Преміум пас не активовано')

    // Перевірка чи вже забрано
    const claimedKey = track === 'free' ? 'claimedFree' : 'claimedPremium'
    const claimed = season[claimedKey] || []
    if (claimed.includes(level)) throw new Error('Вже забрано')

    const reward = rewards[level]
    const updates = {
      [`season.${claimedKey}`]: [...claimed, level],
      lastActive: serverTimestamp(),
    }

    // Ресурси
    for (const [res, amount] of Object.entries(reward)) {
      if (['title', 'skin', 'skinName', 'emote', 'emoteName', 'frame', 'frameName'].includes(res)) continue
      if (res === 'diamonds') {
        updates.diamonds = (player.diamonds || 0) + amount
      } else {
        updates[`resources.${res}`] = (player.resources?.[res] || 0) + amount
      }
    }

    // Титул
    if (reward.title) {
      const titles = season.titles || []
      updates['season.titles'] = [...titles, reward.title]
    }

    // Рамка
    if (reward.frame) {
      const frames = season.frames || []
      updates['season.frames'] = [...frames, reward.frame]
    }

    tx.update(playerRef, updates)
  })
}

// ─── Активувати преміум пас ──────────────────────────────────

export async function activatePremiumPass(playerId) {
  const cost = SEASON_PASS_REWARDS.premiumCost

  await runTransaction(db, async (tx) => {
    const playerRef = doc(db, 'players', playerId)
    const snap = await tx.get(playerRef)
    if (!snap.exists()) throw new Error('Гравець не знайдений')

    const player = snap.data()
    if ((player.diamonds || 0) < cost) throw new Error(`Потрібно ${cost} 💠`)
    if (player.season?.premiumActive) throw new Error('Вже активовано')

    tx.update(playerRef, {
      diamonds: (player.diamonds || 0) - cost,
      'season.premiumActive': true,
      lastActive: serverTimestamp(),
    })
  })
}

// ─── Сезонний рейтинг ───────────────────────────────────────

export function subscribeSeasonLeaderboard(group, callback) {
  const q = query(
    collection(db, 'players'),
    where('group', '==', group)
  )
  return onSnapshot(q, (snap) => {
    const players = snap.docs
      .map(d => {
        const data = d.data()
        return {
          id: d.id,
          name: data.heroName || data.name,
          heroClass: data.heroClass,
          seasonLevel: data.season?.passLevel || 0,
          seasonScore: data.seasonRating?.score || 0,
          title: data.season?.activeTitle || null,
          frame: data.season?.activeFrame || null,
        }
      })
      .sort((a, b) => b.seasonScore - a.seasonScore)
    callback(players)
  })
}

// ─── Оновити рейтинг сезону ─────────────────────────────────

export async function updateSeasonRating(playerId, points) {
  await updateDoc(doc(db, 'players', playerId), {
    'seasonRating.score': points,
    lastActive: serverTimestamp(),
  })
}

// ─── Ініціалізація сезону для гравця ─────────────────────────

export function getDefaultSeasonData() {
  return {
    id: CURRENT_SEASON.id,
    passXP: 0,
    passLevel: 0,
    premiumActive: false,
    claimedFree: [],
    claimedPremium: [],
    titles: [],
    activeTitle: null,
    frames: [],
    activeFrame: null,
  }
}
