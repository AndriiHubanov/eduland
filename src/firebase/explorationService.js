// ─── Exploration Service ───
// Зовнішні домени, розвідка карти, захоплення (як Outer Domains у MyLands)

import {
  doc, getDoc, getDocs, updateDoc, addDoc,
  collection, query, where, onSnapshot,
  runTransaction, serverTimestamp,
} from 'firebase/firestore'
import { db } from './config'

// ─── Типи доменів на карті ───────────────────────────────────

export const DOMAIN_TYPES = {
  gold_mine:    { name: 'Золота копальня',    icon: '🪙', resource: 'gold',     ratePerHour: 15, color: '#ffd700' },
  stone_quarry: { name: 'Кам\'яний кар\'єр',  icon: '🪨', resource: 'stone',    ratePerHour: 12, color: '#808080' },
  crystal_cave: { name: 'Кришталева печера',   icon: '💎', resource: 'crystals', ratePerHour: 5,  color: '#00ffff' },
  data_node:    { name: 'Вузол даних',         icon: '💾', resource: 'bits',     ratePerHour: 10, color: '#00aaff' },
  bio_grove:    { name: 'Біогай',              icon: '🧬', resource: 'bio',      ratePerHour: 8,  color: '#00ff88' },
  energy_well:  { name: 'Енергетична свердловина', icon: '⚡', resource: 'energy', ratePerHour: 8, color: '#ffaa00' },
  ancient_grail:{ name: 'Стародавній Грааль',  icon: '🏆', resource: 'diamonds', ratePerHour: 0.1, color: '#b9f2ff' },
}

// ─── Зовнішні домени per група ───────────────────────────────
/*
  /outerDomains/{id}
  {
    group: string,
    type: string (gold_mine, stone_quarry, ...),
    x: number, y: number,       // позиція на карті 10×10
    name: string,
    discoveredBy: {              // хто відкрив (видно тільки їм)
      [playerId]: true
    },
    ownerId: string | null,      // хто контролює
    ownerName: string | null,
    defenseArmy: [...] | null,   // захисна армія
    capturedAt: Timestamp | null,
    resourceAccumulated: number, // накопичений ресурс
    lastCollected: Timestamp,
  }
*/

// ─── Генерація доменів для нової групи ───────────────────────

export async function generateOuterDomains(group, existingPositions = []) {
  const taken = new Set(existingPositions.map(p => `${p.x},${p.y}`))

  // Генеруємо 15 доменів per група
  const domainTypes = [
    'gold_mine', 'gold_mine', 'gold_mine',
    'stone_quarry', 'stone_quarry',
    'crystal_cave',
    'data_node', 'data_node',
    'bio_grove', 'bio_grove',
    'energy_well', 'energy_well',
    'ancient_grail',  // тільки 1 Грааль!
    'gold_mine',
    'data_node',
  ]

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

  const domains = []
  const { writeBatch } = await import('firebase/firestore')
  const batch = writeBatch(db)

  domainTypes.forEach((type, idx) => {
    if (!available[idx]) return
    const dt = DOMAIN_TYPES[type]
    const ref = doc(collection(db, 'outerDomains'))
    const domain = {
      group,
      type,
      name: `${dt.name} #${idx + 1}`,
      x: available[idx].x,
      y: available[idx].y,
      discoveredBy: {},
      ownerId: null,
      ownerName: null,
      defenseArmy: null,
      capturedAt: null,
      resourceAccumulated: 0,
      lastCollected: new Date(),
    }
    batch.set(ref, domain)
    domains.push(domain)
  })

  await batch.commit()
  return domains
}

// ─── Розвідка (як Explorer unit у MyLands) ───────────────────

/**
 * Розвідати клітинки навколо позиції гравця.
 * Радіус залежить від рівня Вежі зв'язку.
 * Витрачає: 💾 30 bits
 */
export async function exploreArea(playerId) {
  const EXPLORE_COST = 30 // bits

  await runTransaction(db, async (tx) => {
    const playerRef = doc(db, 'players', playerId)
    const snap = await tx.get(playerRef)
    if (!snap.exists()) throw new Error('Гравець не знайдений')

    const player = snap.data()
    if ((player.resources?.bits || 0) < EXPLORE_COST) {
      throw new Error(`Потрібно ${EXPLORE_COST} 💾 для розвідки`)
    }

    const towerLevel = player.buildings?.tower?.level || 0
    const radius = 1 + towerLevel // 1-4 клітинки радіус
    const pos = player.cityPosition || { x: 5, y: 5 }

    tx.update(playerRef, {
      'resources.bits': (player.resources?.bits || 0) - EXPLORE_COST,
      lastActive: serverTimestamp(),
    })

    // Знаходимо домени в радіусі
    // (це потребує окремого кроку після транзакції)
  })

  // Після транзакції — оновлюємо discoveredBy
  const playerSnap = await getDoc(doc(db, 'players', playerId))
  const player = playerSnap.data()
  const pos = player.cityPosition || { x: 5, y: 5 }
  const towerLevel = player.buildings?.tower?.level || 0
  const radius = 1 + towerLevel

  const domainsSnap = await getDocs(query(
    collection(db, 'outerDomains'),
    where('group', '==', player.group)
  ))

  const discovered = []
  const { writeBatch } = await import('firebase/firestore')
  const batch = writeBatch(db)

  for (const d of domainsSnap.docs) {
    const domain = d.data()
    const dx = Math.abs(domain.x - pos.x)
    const dy = Math.abs(domain.y - pos.y)
    if (dx <= radius && dy <= radius) {
      if (!domain.discoveredBy?.[playerId]) {
        batch.update(d.ref, {
          [`discoveredBy.${playerId}`]: true,
        })
        discovered.push({ id: d.id, ...domain })
      }
    }
  }

  if (discovered.length > 0) await batch.commit()
  return discovered
}

// ─── Підписка на видимі домени ───────────────────────────────

export function subscribeVisibleDomains(group, playerId, callback) {
  const q = query(
    collection(db, 'outerDomains'),
    where('group', '==', group)
  )
  return onSnapshot(q, (snap) => {
    const domains = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(d => d.discoveredBy?.[playerId] || d.ownerId === playerId)
    callback(domains)
  })
}

// ─── Захоплення домену ───────────────────────────────────────

export async function captureDomain(playerId, domainId) {
  await runTransaction(db, async (tx) => {
    const playerRef = doc(db, 'players', playerId)
    const domainRef = doc(db, 'outerDomains', domainId)

    const [playerSnap, domainSnap] = await Promise.all([
      tx.get(playerRef), tx.get(domainRef),
    ])

    if (!playerSnap.exists()) throw new Error('Гравець не знайдений')
    if (!domainSnap.exists()) throw new Error('Домен не знайдений')

    const player = playerSnap.data()
    const domain = domainSnap.data()

    // Перевірка що домен відкритий для цього гравця
    if (!domain.discoveredBy?.[playerId]) throw new Error('Спочатку відкрий цей домен')

    // Якщо домен вже зайнятий — потрібен бій (повертаємо інфо)
    if (domain.ownerId && domain.ownerId !== playerId) {
      throw new Error('Домен зайнятий! Потрібно атакувати.')
    }

    // Перевірка ліміту доменів (замок рівень = макс доменів)
    const castleLevel = player.castle?.level || 1
    const ownedDomains = await getDocs(query(
      collection(db, 'outerDomains'),
      where('ownerId', '==', playerId)
    ))
    if (ownedDomains.size >= castleLevel) {
      throw new Error(`Ліміт доменів: ${castleLevel} (замок лв.${castleLevel})`)
    }

    tx.update(domainRef, {
      ownerId: playerId,
      ownerName: player.heroName || player.name,
      capturedAt: new Date(),
      lastCollected: new Date(),
      resourceAccumulated: 0,
    })

    tx.update(playerRef, {
      lastActive: serverTimestamp(),
    })
  })
}

// ─── Збір ресурсів з домену ──────────────────────────────────

export async function collectDomainResources(playerId, domainId) {
  let collected = { resource: null, amount: 0 }

  await runTransaction(db, async (tx) => {
    const playerRef = doc(db, 'players', playerId)
    const domainRef = doc(db, 'outerDomains', domainId)

    const [playerSnap, domainSnap] = await Promise.all([
      tx.get(playerRef), tx.get(domainRef),
    ])

    if (!playerSnap.exists() || !domainSnap.exists()) throw new Error('Не знайдено')

    const player = playerSnap.data()
    const domain = domainSnap.data()

    if (domain.ownerId !== playerId) throw new Error('Це не ваш домен')

    const dt = DOMAIN_TYPES[domain.type]
    if (!dt) throw new Error('Невідомий тип домену')

    const lastCollected = domain.lastCollected?.toDate?.() || new Date(domain.lastCollected)
    const hours = (Date.now() - lastCollected.getTime()) / 3600000
    const amount = Math.floor(hours * dt.ratePerHour)

    if (amount <= 0) throw new Error('Ще нічого не накопичилось')

    collected = { resource: dt.resource, amount }

    if (dt.resource === 'diamonds') {
      tx.update(playerRef, {
        diamonds: (player.diamonds || 0) + amount,
        lastActive: serverTimestamp(),
      })
    } else {
      tx.update(playerRef, {
        [`resources.${dt.resource}`]: (player.resources?.[dt.resource] || 0) + amount,
        lastActive: serverTimestamp(),
      })
    }

    tx.update(domainRef, {
      lastCollected: new Date(),
      resourceAccumulated: 0,
    })
  })

  return collected
}

// ─── Залишити домен ──────────────────────────────────────────

export async function abandonDomain(playerId, domainId) {
  const domainRef = doc(db, 'outerDomains', domainId)
  const snap = await getDoc(domainRef)
  if (!snap.exists()) throw new Error('Домен не знайдений')
  if (snap.data().ownerId !== playerId) throw new Error('Це не ваш домен')

  await updateDoc(domainRef, {
    ownerId: null,
    ownerName: null,
    defenseArmy: null,
    capturedAt: null,
  })
}

// ─── Поставити захисну армію ─────────────────────────────────

export async function setDomainDefense(playerId, domainId, formation) {
  if (formation.length > 3) throw new Error('Максимум 3 юніти для захисту домену')

  await runTransaction(db, async (tx) => {
    const playerRef = doc(db, 'players', playerId)
    const domainRef = doc(db, 'outerDomains', domainId)

    const [playerSnap, domainSnap] = await Promise.all([
      tx.get(playerRef), tx.get(domainRef),
    ])

    const player = playerSnap.data()
    const domain = domainSnap.data()

    if (domain.ownerId !== playerId) throw new Error('Це не ваш домен')

    // Валідація юнітів
    for (const unitId of formation) {
      if (!player.units?.[unitId] || player.units[unitId].count < 1) {
        throw new Error(`Юніт ${unitId} не найнятий`)
      }
    }

    const defenseArmy = formation.map(unitId => ({
      unitId,
      count: 1, // 1 юніт per слот
      level: player.units[unitId].level || 1,
    }))

    tx.update(domainRef, { defenseArmy })
  })
}
