// ─── equipmentService: Інвентар, Лут, Чорний Ринок ───

import {
  doc, getDoc, setDoc, updateDoc, onSnapshot,
  runTransaction, arrayUnion, serverTimestamp,
} from 'firebase/firestore'
import { db } from './service'
import {
  EQUIPMENT_SETS, EQUIPMENT_SLOTS, getAllItemIds, itemId,
} from '../config/equipment'

const EMPTY_INVENTORY = () => ({
  equipped: {
    head: null, torso: null, arms: null,
    legs: null, accessory: null, neuromodule: null,
  },
  items: [],
})

// ─── Лут (20% шанс після будь-якої експедиції) ───────────────

export async function rollEquipmentLoot(playerId, ownedItems = []) {
  if (Math.random() >= 0.2) return null  // 80% — нічого

  const allItems   = getAllItemIds()
  const available  = allItems.filter(id => !ownedItems.includes(id))
  if (available.length === 0) return null  // всі предмети зібрані

  const rolled = available[Math.floor(Math.random() * available.length)]

  await updateDoc(doc(db, 'players', playerId), {
    'inventory.items': arrayUnion(rolled),
  })
  return rolled
}

// ─── Екіпірування ─────────────────────────────────────────────

export async function equipItem(playerId, id, slot) {
  // Перевіряємо що предмет є в інвентарі
  const pRef = doc(db, 'players', playerId)
  const pDoc = await getDoc(pRef)
  if (!pDoc.exists()) throw new Error('Гравця не знайдено')

  const inventory = pDoc.data().inventory || EMPTY_INVENTORY()
  if (!inventory.items.includes(id)) throw new Error('Предмет відсутній в інвентарі')

  await updateDoc(pRef, { [`inventory.equipped.${slot}`]: id })
}

export async function unequipItem(playerId, slot) {
  await updateDoc(doc(db, 'players', playerId), {
    [`inventory.equipped.${slot}`]: null,
  })
}

// ─── Чорний Ринок ─────────────────────────────────────────────

const BLACK_MARKET_ITEM_COUNT = 6
const PRICE_MIN  = 300
const PRICE_MAX  = 2000

function generateMarketItems() {
  const all      = getAllItemIds()
  const shuffled = [...all].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, BLACK_MARKET_ITEM_COUNT).map(id => ({
    itemId: id,
    price:  Math.floor(PRICE_MIN + Math.random() * (PRICE_MAX - PRICE_MIN)),
    sold:   false,
  }))
}

export async function getOrRefreshBlackMarket(group) {
  const ref  = doc(db, 'black_market', group)
  const snap = await getDoc(ref)

  const now        = Date.now()
  const ONE_DAY_MS = 24 * 60 * 60 * 1000

  if (snap.exists()) {
    const data       = snap.data()
    const refreshAt  = data.refreshAt
    const refreshMs  = typeof refreshAt === 'number'
      ? refreshAt
      : refreshAt?.toMillis?.() ?? 0
    if (now < refreshMs) return { id: snap.id, ...data }
  }

  // Генеруємо новий асортимент
  const data = {
    group,
    items:     generateMarketItems(),
    refreshAt: now + ONE_DAY_MS,
    createdAt: serverTimestamp(),
  }
  await setDoc(ref, data)
  return data
}

export function subscribeBlackMarket(group, callback) {
  return onSnapshot(doc(db, 'black_market', group), snap => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() })
    else callback(null)
  })
}

export async function buyBlackMarketItem(playerId, group, itemIndex) {
  const marketRef = doc(db, 'black_market', group)
  const playerRef = doc(db, 'players', playerId)

  await runTransaction(db, async tx => {
    const [mDoc, pDoc] = await Promise.all([tx.get(marketRef), tx.get(playerRef)])
    if (!mDoc.exists()) throw new Error('Ринок недоступний')
    if (!pDoc.exists()) throw new Error('Гравця не знайдено')

    const market  = mDoc.data()
    const item    = market.items?.[itemIndex]
    if (!item || item.sold) throw new Error('Товар недоступний')

    const player   = pDoc.data()
    const gold     = player.resources?.gold || 0
    if (gold < item.price) throw new Error('Недостатньо золота')

    const inventory = player.inventory || EMPTY_INVENTORY()
    if (inventory.items.includes(item.itemId)) throw new Error('Предмет вже є в інвентарі')

    // Оновлюємо ринок
    const newItems = [...market.items]
    newItems[itemIndex] = { ...item, sold: true }
    tx.update(marketRef, { items: newItems })

    // Оновлюємо гравця
    tx.update(playerRef, {
      'resources.gold':   gold - item.price,
      'inventory.items': arrayUnion(item.itemId),
    })
  })
}
