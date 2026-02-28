// ─── Field Service — Фаза 9 ───
// 31 поле per група: 12 ресурсних, 7 руїн, 12 нейтральних
// Рефреш кожні 48 годин

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, onSnapshot, runTransaction,
  serverTimestamp, writeBatch,
} from 'firebase/firestore'
import { db } from './config'
import { FIELD_SEED, FIELDS_CONFIG, calcFieldYield, RESOURCE_FIELD_TYPES } from '../config/fields'
import { RUINS, attackRuin as attackRuinCore } from './ruinService'

// ─── Ініціалізація полів для нової групи ─────────────────────

export async function initGroupFields(group) {
  const q = query(collection(db, 'fields'), where('group', '==', group))
  const snap = await getDocs(q)
  if (!snap.empty) return // вже ініціалізовано

  // Перемішуємо seed щоб рандомізувати порядок (але розподіл фіксований)
  const shuffled = [...FIELD_SEED]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  const resetAt = new Date(Date.now() + FIELDS_CONFIG.refreshHours * 3600 * 1000)
  const batch = writeBatch(db)

  shuffled.forEach((seed, idx) => {
    const ref = doc(collection(db, 'fields'))
    const field = {
      group,
      index: idx,
      type: seed.type,
      resourceType: seed.resourceType || null,
      tier: seed.tier || null,
      ruinHP: seed.type === 'ruin' ? 100 : null,
      resetAt,
      lastOccupiedBy: null,
      extractionBonus: 0,
      createdAt: new Date(),
    }
    batch.set(ref, field)
  })

  await batch.commit()
  console.log(`[fieldService] Ініціалізовано ${FIELDS_CONFIG.total} полів для групи ${group}`)
}

// ─── Підписка на всі поля групи ──────────────────────────────

export function subscribeGroupFields(group, callback) {
  const q = query(collection(db, 'fields'), where('group', '==', group))
  return onSnapshot(q, (snap) => {
    const fields = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    // Сортуємо по index
    fields.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    callback(checkAndResetFields(fields))
  })
}

// ─── Клієнт-сайд перевірка 48г рефрешу ──────────────────────

function checkAndResetFields(fields) {
  const now = Date.now()
  const toReset = fields.filter(f => {
    const resetAt = f.resetAt?.toDate ? f.resetAt.toDate() : new Date(f.resetAt)
    return resetAt.getTime() <= now
  })

  if (toReset.length > 0) {
    // Тригеримо асинхронний рефреш (без блокування UI)
    resetExpiredFields(toReset).catch(console.error)
  }

  return fields
}

async function resetExpiredFields(fields) {
  const nextResetAt = new Date(Date.now() + FIELDS_CONFIG.refreshHours * 3600 * 1000)
  const batch = writeBatch(db)

  for (const field of fields) {
    const ref = doc(db, 'fields', field.id)
    batch.update(ref, {
      lastOccupiedBy: null,
      ruinHP: field.type === 'ruin' ? 100 : null,
      extractionBonus: 0,
      resetAt: nextResetAt,
    })
  }

  await batch.commit()
  console.log(`[fieldService] Скинуто ${fields.length} прострочених полів`)
}

// ─── Видобуток ресурсу з ресурсного поля ─────────────────────

export async function extractFieldResources(playerId, fieldId) {
  let result = { resource: null, amount: 0 }

  await runTransaction(db, async (tx) => {
    const playerRef = doc(db, 'players', playerId)
    const fieldRef  = doc(db, 'fields', fieldId)

    const [playerSnap, fieldSnap] = await Promise.all([
      tx.get(playerRef), tx.get(fieldRef),
    ])

    if (!playerSnap.exists()) throw new Error('Гравець не знайдений')
    if (!fieldSnap.exists())  throw new Error('Поле не знайдено')

    const player = playerSnap.data()
    const field  = { id: fieldSnap.id, ...fieldSnap.data() }

    if (field.type !== 'resource') throw new Error('Це не ресурсне поле')
    if (field.group !== player.group) throw new Error('Це поле не вашої групи')

    // Поле вже зайнято іншим гравцем в поточному циклі
    if (field.lastOccupiedBy && field.lastOccupiedBy !== playerId) {
      throw new Error('Це поле вже видобувається іншим гравцем')
    }

    // Перевірка рефрешу
    const resetAt = field.resetAt?.toDate ? field.resetAt.toDate() : new Date(field.resetAt)
    if (resetAt.getTime() <= Date.now()) {
      throw new Error('Поле оновлюється — зачекай секунду')
    }

    // Якщо гравець вже видобував це поле — не дозволяємо
    if (field.lastOccupiedBy === playerId) {
      throw new Error('Ти вже видобував це поле в поточному циклі')
    }

    // Розрахунок видобутку
    const amount = calcFieldYield(field, field.extractionBonus || 0)
    const rt = RESOURCE_FIELD_TYPES[field.resourceType]
    if (!rt) throw new Error('Невідомий тип ресурсу')

    result = { resource: rt.resource, amount }

    // Оновлюємо гравця
    const currentAmount = player.resources?.[rt.resource] || 0
    tx.update(playerRef, {
      [`resources.${rt.resource}`]: currentAmount + amount,
      lastActive: serverTimestamp(),
    })

    // Помічаємо поле як зайняте
    tx.update(fieldRef, {
      lastOccupiedBy: playerId,
    })
  })

  return result
}

// ─── Атака руїни через поле ──────────────────────────────────

export async function attackFieldRuin(playerId, fieldId) {
  const fieldRef = doc(db, 'fields', fieldId)
  const fieldSnap = await getDoc(fieldRef)

  if (!fieldSnap.exists()) throw new Error('Поле не знайдено')
  const field = fieldSnap.data()

  if (field.type !== 'ruin') throw new Error('Це не поле-руїна')

  // Використовуємо існуючу логіку attackRuin
  const ruinId = `field_ruin_${fieldId}_t${field.tier}`
  const battleResult = await attackRuinCore(playerId, ruinId, field.tier)

  // Якщо перемога — оновлюємо HP руїни
  if (battleResult.result === 'win') {
    const newHP = Math.max(0, (field.ruinHP || 100) - 35)
    const updates = { lastOccupiedBy: playerId }
    if (newHP <= 0) {
      // Руїна знищена — стає нейтральним до рефрешу
      updates.ruinHP = 0
      updates.lastOccupiedBy = playerId
    } else {
      updates.ruinHP = newHP
    }
    await updateDoc(fieldRef, updates)
  }

  return battleResult
}

// ─── Розрахунок часу до рефрешу ──────────────────────────────

export function getFieldTimeLeft(field) {
  if (!field?.resetAt) return null
  const resetAt = field.resetAt?.toDate ? field.resetAt.toDate() : new Date(field.resetAt)
  const ms = resetAt.getTime() - Date.now()
  if (ms <= 0) return null

  const hours   = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)

  if (hours >= 1) return `${hours}г ${minutes}хв`
  if (minutes >= 1) return `${minutes}хв`
  return 'менше хв'
}
