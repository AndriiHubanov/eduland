// ─── exchangeService: Динамічний ринок обміну ресурсів ───

import {
  doc, getDoc, setDoc, updateDoc,
  onSnapshot, serverTimestamp, runTransaction,
} from 'firebase/firestore'
import { db } from './service'

// Базові ставки: 1 Золото = N одиниць ресурсу
const BASE_RATES = {
  wood:     1.5,
  stone:    1.2,
  crystals: 0.3,
  bits:     1.8,
  code:     0.8,
  bio:      1.1,
  energy:   1.4,
}

// Мін/макс відхилення від бази (щоб ринок не виходив за межі)
const RATE_MIN_MULTIPLIER = 0.4
const RATE_MAX_MULTIPLIER = 4.0

function generateNewRates(currentRates) {
  const rates = {}
  for (const [res, current] of Object.entries(currentRates || BASE_RATES)) {
    const change  = (Math.random() - 0.5) * 0.3  // -15% до +15%
    const raw     = current * (1 + change)
    const minRate = BASE_RATES[res] * RATE_MIN_MULTIPLIER
    const maxRate = BASE_RATES[res] * RATE_MAX_MULTIPLIER
    rates[res]    = Math.round(Math.max(minRate, Math.min(maxRate, raw)) * 100) / 100
  }
  return rates
}

// Повертає doc із поточними ставками; якщо немає — ініціалізує
export async function getOrInitExchangeRates(group) {
  const ref  = doc(db, 'exchange', group)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    const now  = Date.now()
    const data = {
      group,
      rates:        { ...BASE_RATES },
      updatedAt:    serverTimestamp(),
      nextUpdateAt: now + 60 * 60 * 1000,
      priceHistory: [],
    }
    await setDoc(ref, data)
    return data
  }
  return { id: snap.id, ...snap.data() }
}

// Оновлює ставки якщо час минув (викликати при відкритті сторінки)
export async function refreshRatesIfExpired(group) {
  const ref  = doc(db, 'exchange', group)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    return getOrInitExchangeRates(group)
  }
  const data         = snap.data()
  const nextUpdate   = data.nextUpdateAt
  const now          = Date.now()
  // nextUpdateAt зберігається як мс або Firestore Timestamp
  const nextUpdateMs = typeof nextUpdate === 'number'
    ? nextUpdate
    : nextUpdate?.toMillis?.() ?? 0

  if (now < nextUpdateMs) return { id: snap.id, ...data } // ще не час

  const newRates    = generateNewRates(data.rates)
  const histEntry   = { rates: data.rates, ts: Date.now() }
  const history     = [histEntry, ...(data.priceHistory || [])].slice(0, 24)

  await updateDoc(ref, {
    rates:        newRates,
    updatedAt:    serverTimestamp(),
    nextUpdateAt: now + 60 * 60 * 1000,
    priceHistory: history,
  })
  return { id: snap.id, ...data, rates: newRates, priceHistory: history }
}

// Підписка на поточні ставки (real-time)
export function subscribeExchangeRates(group, callback) {
  const ref = doc(db, 'exchange', group)
  return onSnapshot(ref, snap => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() })
  })
}

// Купити ресурс за золото: витрачає goldAmount золота, отримує goldAmount * rate ресурсу
export async function buyResource(playerId, group, resource, goldAmount) {
  if (!goldAmount || goldAmount <= 0) throw new Error('Невірна кількість')
  const rateSnap = await getDoc(doc(db, 'exchange', group))
  if (!rateSnap.exists()) throw new Error('Ринок недоступний')
  const rate    = rateSnap.data().rates?.[resource]
  if (!rate)    throw new Error('Ресурс не знайдено')
  const gained  = Math.floor(goldAmount * rate)
  if (gained <= 0) throw new Error('Занадто мала сума')

  await runTransaction(db, async tx => {
    const pRef = doc(db, 'players', playerId)
    const pDoc = await tx.get(pRef)
    if (!pDoc.exists()) throw new Error('Гравця не знайдено')
    const res = pDoc.data().resources || {}
    if ((res.gold || 0) < goldAmount) throw new Error('Недостатньо золота')
    tx.update(pRef, {
      [`resources.gold`]:     (res.gold || 0) - goldAmount,
      [`resources.${resource}`]: (res[resource] || 0) + gained,
    })
  })
  return gained
}

// Продати ресурс за золото: витрачає resourceAmount ресурсу, отримує floor(amount/rate) золота
export async function sellResource(playerId, group, resource, resourceAmount) {
  if (!resourceAmount || resourceAmount <= 0) throw new Error('Невірна кількість')
  const rateSnap = await getDoc(doc(db, 'exchange', group))
  if (!rateSnap.exists()) throw new Error('Ринок недоступний')
  const rate   = rateSnap.data().rates?.[resource]
  if (!rate)   throw new Error('Ресурс не знайдено')
  const gained = Math.floor(resourceAmount / rate)
  if (gained <= 0) throw new Error('Занадто мала сума')

  await runTransaction(db, async tx => {
    const pRef = doc(db, 'players', playerId)
    const pDoc = await tx.get(pRef)
    if (!pDoc.exists()) throw new Error('Гравця не знайдено')
    const res = pDoc.data().resources || {}
    if ((res[resource] || 0) < resourceAmount) throw new Error(`Недостатньо ${resource}`)
    tx.update(pRef, {
      [`resources.${resource}`]: (res[resource] || 0) - resourceAmount,
      [`resources.gold`]:        (res.gold || 0) + gained,
    })
  })
  return gained
}
