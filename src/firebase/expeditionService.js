// ─── Expedition Service (Phase 10) ───
// Таймерні місії на поля, як у MyLands
// Scout / Extract / Attack — з часом маршу і збором результату

import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc,
  query, where, onSnapshot, runTransaction, serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from './config'
import { calcFieldYield } from '../config/fields'
import { getExpeditionTime, getExtractionBonus } from '../config/labs'
import { simulateBattle, saveBattleResult, applyCasualties } from './battleService'
import { RUINS } from './ruinService'
import { UNITS, getUnitStats } from './unitService'

// ─── Firebase схема ──────────────────────────────────────────
/*
  /expeditions/{id}
    playerId: string
    group:    string
    fieldId:  string
    fieldType: "resource" | "ruin" | "neutral"
    type:     "scout" | "extract" | "attack"
    status:   "active" | "ready" | "claimed"
    endsAt:   Timestamp
    createdAt: Timestamp
    result:   null | { resource?, amount?, won?, log? }
*/

// ─── Підписка на всі активні/ready місії гравця ───────────────

export function subscribePlayerExpeditions(playerId, callback) {
  const q = query(
    collection(db, 'expeditions'),
    where('playerId', '==', playerId),
    where('status', 'in', ['active', 'ready']),
  )
  return onSnapshot(q, snap => {
    const exps = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    callback(exps)
  })
}

// ─── Підписка на всі місії групи (для WorldMap — бачити чужі) ──

export function subscribeGroupExpeditions(group, callback) {
  const q = query(
    collection(db, 'expeditions'),
    where('group', '==', group),
    where('status', 'in', ['active', 'ready']),
  )
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

// ─── Перевірка: чи є вже активна місія на це поле від цього гравця ─

export async function getActiveExpeditionForField(playerId, fieldId) {
  const q = query(
    collection(db, 'expeditions'),
    where('playerId', '==', playerId),
    where('fieldId', '==', fieldId),
    where('status', 'in', ['active', 'ready']),
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() }
}

// ─── Старт місії ────────────────────────────────────────────

export async function startExpedition(playerId, fieldId, type) {
  // Читаємо гравця і поле
  const [playerSnap, fieldSnap] = await Promise.all([
    getDoc(doc(db, 'players', playerId)),
    getDoc(doc(db, 'fields', fieldId)),
  ])

  if (!playerSnap.exists()) throw new Error('Гравець не знайдений')
  if (!fieldSnap.exists())  throw new Error('Поле не знайдено')

  const player = playerSnap.data()
  const field  = { id: fieldSnap.id, ...fieldSnap.data() }

  // Перевірка: нема активної місії на це поле від цього гравця
  const existing = await getActiveExpeditionForField(playerId, fieldId)
  if (existing) throw new Error('Вже є активна місія на це поле')

  // Перевірка: тип місії відповідає типу поля
  if (type === 'extract' && field.type !== 'resource') throw new Error('Видобуток тільки на ресурсних полях')
  if (type === 'attack'  && field.type !== 'ruin')     throw new Error('Атака тільки на полях-руїнах')

  // Перевірка руїна не знищена
  if (type === 'attack' && field.ruinHP <= 0) throw new Error('Руїна вже знищена')

  // Перевірка поле не зайняте іншим для extract
  if (type === 'extract' && field.lastOccupiedBy && field.lastOccupiedBy !== playerId) {
    throw new Error('Це поле вже видобувається іншим гравцем')
  }

  // Перевірка армії для attack
  if (type === 'attack') {
    const formation = player.army?.formation || []
    const hasUnits  = formation.some(unitId => (player.units?.[unitId]?.count || 0) > 0)
    if (!hasUnits) throw new Error('Сформуй армію перед атакою')
  }

  // Перевірка лабораторій (рівень будівлі)
  const labMap = {
    scout:   { building: 'geolab',              minLevel: 1 },
    extract: { building: 'extraction_station',  minLevel: 1 },
    attack:  { building: 'assault_base',        minLevel: 1 },
  }
  const labCheck = labMap[type]
  if (labCheck) {
    const labLevel = player.buildings?.[labCheck.building]?.level || 0
    if (labLevel < labCheck.minLevel) {
      const labNames = { geolab: 'Геолаб', extraction_station: 'Екстракційну станцію', assault_base: 'Штурмову базу' }
      throw new Error(`Потрібна ${labNames[labCheck.building]} рівня ${labCheck.minLevel}`)
    }
  }

  // Розрахунок часу маршу
  const labBuilding = labCheck ? player.buildings?.[labCheck.building] : null
  const labLevel    = labBuilding?.level || 1
  const duration    = getExpeditionTime(labLevel, field.tier || 1, type) * 1000 // у мс
  const endsAt      = new Date(Date.now() + duration)

  // Позначаємо поле як зайняте (для extract)
  if (type === 'extract') {
    await updateDoc(doc(db, 'fields', fieldId), { lastOccupiedBy: playerId })
  }

  // Зберігаємо місію
  const ref = await addDoc(collection(db, 'expeditions'), {
    playerId,
    group:     player.group,
    fieldId,
    fieldType: field.type,
    fieldTier: field.tier || 1,
    type,
    status:    'active',
    endsAt,
    createdAt: new Date(),
    result:    null,
    // snapshot полезних даних (щоб не читати поле при resolve)
    resourceType:    field.resourceType || null,
    extractionBonus: type === 'extract' ? getExtractionBonus(labLevel) : 0,
  })

  return { id: ref.id, endsAt }
}

// ─── Автоматичне resolve коли час вийшов (client-side) ───────

export async function resolveExpeditionIfReady(playerId, expeditionId) {
  const expRef  = doc(db, 'expeditions', expeditionId)
  const expSnap = await getDoc(expRef)
  if (!expSnap.exists()) return null

  const exp = expSnap.data()
  if (exp.status !== 'active') return null

  const endsAt = exp.endsAt?.toDate ? exp.endsAt.toDate() : new Date(exp.endsAt)
  if (endsAt > new Date()) return null // ще не час

  // Розраховуємо результат
  let result = null

  if (exp.type === 'scout') {
    const fieldSnap = await getDoc(doc(db, 'fields', exp.fieldId))
    if (fieldSnap.exists()) {
      const f = fieldSnap.data()
      result = {
        fieldType:    f.type,
        resourceType: f.resourceType,
        tier:         f.tier,
        ruinHP:       f.ruinHP,
      }
    }
  }

  if (exp.type === 'extract') {
    const fieldSnap = await getDoc(doc(db, 'fields', exp.fieldId))
    if (fieldSnap.exists()) {
      const f = { id: fieldSnap.id, ...fieldSnap.data() }
      const amount = calcFieldYield(f, exp.extractionBonus || 0)
      result = { resource: exp.resourceType, amount }
    }
  }

  if (exp.type === 'attack') {
    const [playerSnap, fieldSnap] = await Promise.all([
      getDoc(doc(db, 'players', playerId)),
      getDoc(doc(db, 'fields', exp.fieldId)),
    ])

    if (playerSnap.exists() && fieldSnap.exists()) {
      const player   = playerSnap.data()
      const field    = fieldSnap.data()
      const ruinKey  = `tier${exp.fieldTier}`
      const ruinConf = RUINS[ruinKey]

      if (ruinConf) {
        const formation = player.army?.formation || []
        const attackerArmy = formation
          .map(unitId => ({
            unitId,
            count: player.units?.[unitId]?.count || 0,
            level: player.units?.[unitId]?.level  || 1,
          }))
          .filter(u => u.count > 0)

        const battleData = simulateBattle(attackerArmy, ruinConf.enemyArmy, player.heroClass, ruinConf)
        result = {
          won:    battleData.result === 'win',
          log:    battleData.log,
          loot:   battleData.result === 'win' ? ruinConf.lootTable : null,
          xp:     battleData.result === 'win' ? ruinConf.xpReward : 0,
        }
      }
    }
  }

  await updateDoc(expRef, { status: 'ready', result })
  return { id: expeditionId, ...exp, status: 'ready', result }
}

// ─── Забрати нагороду (claim) ─────────────────────────────────

export async function claimExpedition(playerId, expeditionId) {
  let claimed = { type: null, result: null }

  await runTransaction(db, async (tx) => {
    const expRef    = doc(db, 'expeditions', expeditionId)
    const playerRef = doc(db, 'players', playerId)

    const [expSnap, playerSnap] = await Promise.all([
      tx.get(expRef), tx.get(playerRef),
    ])

    if (!expSnap.exists())    throw new Error('Місія не знайдена')
    if (!playerSnap.exists()) throw new Error('Гравець не знайдений')

    const exp    = expSnap.data()
    const player = playerSnap.data()

    if (exp.playerId !== playerId) throw new Error('Це не ваша місія')
    if (exp.status !== 'ready')   throw new Error('Місія ще не завершена')
    if (!exp.result)              throw new Error('Результат не розрахований')

    const updates = { lastActive: serverTimestamp() }
    claimed = { type: exp.type, result: exp.result }

    if (exp.type === 'extract' && exp.result.amount > 0) {
      const res = exp.result.resource
      updates[`resources.${res}`] = (player.resources?.[res] || 0) + exp.result.amount
    }

    if (exp.type === 'attack' && exp.result.won && exp.result.loot) {
      // Видаємо лут
      for (const [res, range] of Object.entries(exp.result.loot)) {
        const amount = Math.floor(range[0] + Math.random() * (range[1] - range[0]))
        if (res === 'diamonds') {
          updates.diamonds = (player.diamonds || 0) + amount
        } else {
          updates[`resources.${res}`] = (player.resources?.[res] || 0) + amount
        }
      }
      // Видаємо XP
      if (exp.result.xp) {
        updates.heroXP = (player.heroXP || 0) + exp.result.xp
      }

      // Оновлюємо HP руїни
      if (exp.fieldId) {
        const fieldRef  = doc(db, 'fields', exp.fieldId)
        const fieldSnap = await tx.get(fieldRef)
        if (fieldSnap.exists()) {
          const curHP = fieldSnap.data().ruinHP ?? 100
          const newHP = Math.max(0, curHP - 35)
          tx.update(fieldRef, { ruinHP: newHP, lastOccupiedBy: playerId })
        }
      }
    }

    tx.update(playerRef, updates)
    tx.update(expRef, { status: 'claimed' })
  })

  return claimed
}

// ─── Форс-рефреш поля через Сигнальну вежу ──────────────────

export async function forceRefreshField(playerId, fieldId) {
  const playerRef = doc(db, 'players', playerId)
  const playerSnap = await getDoc(playerRef)
  if (!playerSnap.exists()) throw new Error('Гравець не знайдений')

  const player = playerSnap.data()
  const towerLevel = player.buildings?.signal_tower?.level || 0
  if (towerLevel < 1) throw new Error('Потрібна Сигнальна вежа рівня 1')

  // Перевірка ліміту (dailyRefreshes)
  const todayKey = new Date().toISOString().split('T')[0]
  const usedToday = player.fieldRefreshesToday?.[todayKey] || 0
  const maxRefreshes = towerLevel // 1/2/3 per level
  if (usedToday >= maxRefreshes) {
    throw new Error(`Ліміт рефрешів на сьогодні вичерпано (${maxRefreshes}/доба)`)
  }

  // Рефреш поля
  const newResetAt = new Date(Date.now() + 48 * 3600 * 1000)
  await updateDoc(doc(db, 'fields', fieldId), {
    lastOccupiedBy: null,
    ruinHP:         null, // буде перераховано при re-read
    extractionBonus: 0,
    resetAt:        newResetAt,
  })

  // Записуємо використання
  await updateDoc(playerRef, {
    [`fieldRefreshesToday.${todayKey}`]: usedToday + 1,
  })
}
