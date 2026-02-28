// ─── Firebase Service ───
// Всі операції з Firestore ТІЛЬКИ через цей файл

import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  addDoc, query, where, onSnapshot, serverTimestamp,
  runTransaction, writeBatch,
} from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

// ─── Firebase конфігурація ───
const _config = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Boolean(_config.apiKey && _config.projectId && _config.appId)

if (!isFirebaseConfigured) {
  console.warn('[Firebase] Змінні оточення не знайдені. Перевірте .env або GitHub Secrets.')
}

const _app     = initializeApp(_config)
export const db      = getFirestore(_app)
export const storage = getStorage(_app)

// ─── Константи ───────────────────────────────────────────────

// Нормалізація імені для пошуку
export const normalizeName = (name) =>
  name.toLowerCase().replace(/\s+/g, ' ').trim()

// ─── ІНІЦІАЛІЗАЦІЯ ────────────────────────────────────────────

// Перевірка і створення стартових даних
export async function initializeFirebaseData() {
  if (!isFirebaseConfigured) return
  try {
    const disciplineRef = doc(db, 'config/disciplines/disciplines', 'informatics')
    const disciplineSnap = await getDoc(disciplineRef)

    if (!disciplineSnap.exists()) {
      console.log('Ініціалізую стартові дані Firebase...')
      await seedInitialData()
      console.log('Стартові дані створено!')
    }
  } catch (err) {
    // Мовчазна помилка — не блокує роботу додатку
    console.warn('Firebase ініціалізація пропущена:', err.message)
  }
}

// Стартові дані: дисципліна + будівлі
async function seedInitialData() {
  const batch = writeBatch(db)

  // ─── Дисципліна: Інформатика ───
  const discRef = doc(db, 'config/disciplines/disciplines', 'informatics')
  batch.set(discRef, {
    id: 'informatics',
    name: 'Інформатика',
    icon: '💻',
    color: '#00aaff',
    active: true,
    resources: [
      { id: 'bits',  name: 'Біти', icon: '💾', description: 'За практичні завдання' },
      { id: 'code',  name: 'Код',  icon: '🔐', description: 'За тести' },
    ],
  })

  // ─── Будівлі інформатики ───
  const buildings = [
    {
      id: 'server',
      name: 'Сервер',
      disciplineId: 'informatics',
      icon: '🖥️',
      description: 'Виробляє Біти та Золото',
      unlockHeroLevel: 1,
      levels: [
        { level: 1, cost: { gold: 100 },                       production: { bits: 5, gold: 2 },   workerSlots: 1 },
        { level: 2, cost: { gold: 250, bits: 20 },             production: { bits: 12, gold: 5 },  workerSlots: 2 },
        { level: 3, cost: { gold: 500, bits: 50, code: 10 },   production: { bits: 25, gold: 10 }, workerSlots: 3 },
      ],
      synergyBonus: { minWorkers: 2, bonus: { bits: 5 } },
    },
    {
      id: 'lab',
      name: 'Лабораторія',
      disciplineId: 'informatics',
      icon: '🔬',
      description: 'Виробляє Біти та Код',
      unlockHeroLevel: 1,
      levels: [
        { level: 1, cost: { gold: 120 },                      production: { bits: 3, code: 2 },   workerSlots: 1 },
        { level: 2, cost: { gold: 280, bits: 15 },            production: { bits: 7, code: 5 },   workerSlots: 2 },
        { level: 3, cost: { gold: 550, bits: 40, code: 15 },  production: { bits: 15, code: 12 }, workerSlots: 3 },
      ],
      synergyBonus: { minWorkers: 2, bonus: { code: 3 } },
    },
    {
      id: 'tower',
      name: 'Вежа зв\'язку',
      disciplineId: 'informatics',
      icon: '📡',
      description: 'Виробляє Код та Золото',
      unlockHeroLevel: 1,
      levels: [
        { level: 1, cost: { gold: 150 },                      production: { code: 4, gold: 3 },   workerSlots: 1 },
        { level: 2, cost: { gold: 320, code: 10 },            production: { code: 10, gold: 7 },  workerSlots: 2 },
        { level: 3, cost: { gold: 600, code: 25, bits: 30 },  production: { code: 20, gold: 15 }, workerSlots: 3 },
      ],
      synergyBonus: { minWorkers: 2, bonus: { gold: 5 } },
    },
    {
      id: 'archive',
      name: 'Сховище даних',
      disciplineId: 'informatics',
      icon: '🗄️',
      description: 'Виробляє Біти та Камінь',
      unlockHeroLevel: 1,
      levels: [
        { level: 1, cost: { gold: 80 },                       production: { bits: 4, stone: 3 },  workerSlots: 1 },
        { level: 2, cost: { gold: 200, bits: 10 },            production: { bits: 9, stone: 7 },  workerSlots: 2 },
        { level: 3, cost: { gold: 420, bits: 30, stone: 20 }, production: { bits: 18, stone: 15 }, workerSlots: 3 },
      ],
      synergyBonus: { minWorkers: 2, bonus: { bits: 4 } },
    },
    {
      id: 'firewall',
      name: 'Брандмауер',
      disciplineId: 'informatics',
      icon: '🛡️',
      description: 'Виробляє Код та захищає місто',
      unlockHeroLevel: 1,
      levels: [
        { level: 1, cost: { gold: 200, code: 5 },              production: { code: 6, gold: 1 },   workerSlots: 1 },
        { level: 2, cost: { gold: 400, code: 20 },             production: { code: 14, gold: 3 },  workerSlots: 2 },
        { level: 3, cost: { gold: 700, code: 40, bits: 20 },   production: { code: 28, gold: 6 },  workerSlots: 3 },
      ],
      synergyBonus: { minWorkers: 2, bonus: { code: 6 } },
    },
  ]

  for (const building of buildings) {
    const bRef = doc(db, 'config/buildings/buildings', building.id)
    batch.set(bRef, building)
  }

  // ─── Дисципліна: Природничі науки (Фаза 8) ───
  const natSciRef = doc(db, 'config/disciplines/disciplines', 'natural_science')
  batch.set(natSciRef, {
    id: 'natural_science',
    name: 'Природничі науки',
    icon: '🔬',
    color: '#00ff88',
    active: true,
    resources: [
      { id: 'bio', name: 'Біоматерія', icon: '🧬', description: 'За біологічні завдання' },
      { id: 'energy', name: 'Енергія', icon: '⚡', description: 'За фізичні завдання' },
    ],
  })

  // ─── Будівлі природничих наук (Фаза 8) ───
  const naturalBuildings = [
    {
      id: 'greenhouse',
      name: 'Теплиця',
      disciplineId: 'natural_science',
      icon: '🌿',
      description: 'Вирощує біоматерію та деревину',
      unlockHeroLevel: 2,
      levels: [
        { level: 1, cost: { gold: 150, wood: 30 },                   production: { bio: 4, wood: 3 },     workerSlots: 1 },
        { level: 2, cost: { gold: 350, bio: 15 },                    production: { bio: 10, wood: 7 },    workerSlots: 2 },
        { level: 3, cost: { gold: 700, bio: 40, energy: 10 },        production: { bio: 20, wood: 15 },   workerSlots: 3 },
      ],
      synergyBonus: { minWorkers: 2, bonus: { bio: 5 } },
    },
    {
      id: 'reactor',
      name: 'Реактор',
      disciplineId: 'natural_science',
      icon: '⚛️',
      description: 'Генерує енергію та кристали',
      unlockHeroLevel: 2,
      levels: [
        { level: 1, cost: { gold: 200, stone: 40 },                  production: { energy: 5, crystals: 2 }, workerSlots: 1 },
        { level: 2, cost: { gold: 450, energy: 15, stone: 30 },      production: { energy: 12, crystals: 5 }, workerSlots: 2 },
        { level: 3, cost: { gold: 900, energy: 40, crystals: 20 },   production: { energy: 25, crystals: 12 }, workerSlots: 3 },
      ],
      synergyBonus: { minWorkers: 2, bonus: { energy: 5 } },
    },
    {
      id: 'biolab',
      name: 'Біолабораторія',
      disciplineId: 'natural_science',
      icon: '🧬',
      description: 'Досліджує біоматерію, виробляє Код',
      unlockHeroLevel: 3,
      levels: [
        { level: 1, cost: { gold: 250, bio: 10 },                    production: { bio: 3, code: 3 },     workerSlots: 1 },
        { level: 2, cost: { gold: 500, bio: 25, code: 10 },          production: { bio: 8, code: 7 },     workerSlots: 2 },
        { level: 3, cost: { gold: 1000, bio: 50, code: 25 },         production: { bio: 16, code: 14 },   workerSlots: 3 },
      ],
      synergyBonus: { minWorkers: 2, bonus: { code: 4 } },
    },
    {
      id: 'solar_array',
      name: 'Сонячна батарея',
      disciplineId: 'natural_science',
      icon: '☀️',
      description: 'Перетворює сонячне світло на Енергію та Золото',
      unlockHeroLevel: 2,
      levels: [
        { level: 1, cost: { gold: 180, crystals: 5 },                production: { energy: 4, gold: 3 },  workerSlots: 1 },
        { level: 2, cost: { gold: 400, energy: 10, crystals: 10 },   production: { energy: 10, gold: 7 }, workerSlots: 2 },
        { level: 3, cost: { gold: 800, energy: 30, crystals: 25 },   production: { energy: 22, gold: 15 }, workerSlots: 3 },
      ],
      synergyBonus: { minWorkers: 2, bonus: { gold: 5 } },
    },
  ]

  for (const building of naturalBuildings) {
    const bRef = doc(db, 'config/buildings/buildings', building.id)
    batch.set(bRef, building)
  }

  await batch.commit()
}

// ─── ДИСЦИПЛІНИ ───────────────────────────────────────────────

export async function getDisciplines() {
  const snap = await getDocs(collection(db, 'config/disciplines/disciplines'))
  return snap.docs.map(d => d.data())
}

export async function addDiscipline(data) {
  const ref = doc(db, 'config/disciplines/disciplines', data.id)
  await setDoc(ref, data)
}

// ─── БУДІВЛІ ──────────────────────────────────────────────────

export async function getBuildings(disciplineId = null) {
  let q = collection(db, 'config/buildings/buildings')
  if (disciplineId) {
    q = query(q, where('disciplineId', '==', disciplineId))
  }
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data())
}

export async function addBuilding(data) {
  const ref = doc(db, 'config/buildings/buildings', data.id)
  await setDoc(ref, data)
}

// ─── ГРАВЦІ ───────────────────────────────────────────────────

// Знайти гравця за нормалізованим іменем і групою
export async function findPlayer(name, group) {
  const normalized = normalizeName(name)
  const q = query(
    collection(db, 'players'),
    where('normalizedName', '==', normalized),
    where('group', '==', group)
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  return { id: snap.docs[0].id, ...snap.docs[0].data() }
}

// Отримати гравця за ID
export async function getPlayer(playerId) {
  const snap = await getDoc(doc(db, 'players', playerId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

// Підписка на гравця (реальний час)
export function subscribePlayer(playerId, callback) {
  return onSnapshot(doc(db, 'players', playerId), (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() })
  })
}

// Створити нового гравця
export async function createPlayer({ name, group, heroName, heroClass, heroStats, gender }) {
  // Генеруємо позицію на карті (рандомна вільна клітинка 10x10)
  const cityPosition = await findFreeMapPosition(group)

  const playerId = `${group}_${Date.now()}`
  const playerRef = doc(db, 'players', playerId)

  const playerData = {
    id: playerId,
    name,
    normalizedName: normalizeName(name),
    group,
    gender,
    heroName,
    heroClass,
    heroLevel: 1,
    heroXP: 0,
    heroStats,
    resources: {
      gold: 200,
      wood: 100,
      stone: 50,
      crystals: 0,
      bits: 0,
      code: 0,
      bio: 0,
      energy: 0,
    },
    diamonds: 0,
    castle: {
      level: 1,
      builtAt: new Date(),
      skin: null,
    },
    units: {},
    army: { formation: [], power: 0 },
    battleStats: { wins: 0, losses: 0, ruinsCleared: 0 },
    ruinCooldowns: {},
    season: {
      id: 'season_1',
      passXP: 0,
      passLevel: 0,
      premiumActive: false,
      claimedFree: [],
      claimedPremium: [],
      titles: [],
      activeTitle: null,
      frames: [],
      activeFrame: null,
    },
    seasonRating: { score: 0 },
    sciences: {},
    buildQueue: { buildingId: null, targetLevel: null, startedAt: null, endsAt: null },
    productionLog: { lastCalculated: new Date() },
    buildings: {
      server:   { level: 1, workers: 0 },
      lab:      { level: 0, workers: 0 },
      tower:    { level: 0, workers: 0 },
      archive:  { level: 0, workers: 0 },
      firewall: { level: 0, workers: 0 },
    },
    workers: {
      total: 5,
      placed: 0,
    },
    cityPosition,
    resourceMap:       generateResourceMap(),
    cellStates:        {},
    buildingPositions: {},
    lastWorkerReset: null,
    lastActive: serverTimestamp(),
    createdAt: serverTimestamp(),
  }

  await setDoc(playerRef, playerData)
  return { id: playerId, ...playerData }
}

// Оновити дані гравця
export async function updatePlayer(playerId, data) {
  await updateDoc(doc(db, 'players', playerId), {
    ...data,
    lastActive: serverTimestamp(),
  })
}

// Всі гравці групи (для карти і торгівлі)
export function subscribeGroupPlayers(group, callback) {
  const q = query(
    collection(db, 'players'),
    where('group', '==', group)
  )
  return onSnapshot(q, (snap) => {
    const players = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    callback(players)
  })
}

// ─── КАРТА ────────────────────────────────────────────────────

// Знайти вільну клітинку на карті для групи
async function findFreeMapPosition(group) {
  const q = query(collection(db, 'players'), where('group', '==', group))
  const snap = await getDocs(q)
  const taken = new Set(snap.docs.map(d => {
    const pos = d.data().cityPosition
    return `${pos.x},${pos.y}`
  }))

  // Перебираємо клітинки в рандомному порядку
  const cells = []
  for (let x = 0; x < 10; x++) {
    for (let y = 0; y < 10; y++) {
      cells.push({ x, y })
    }
  }
  // Перемішуємо
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]]
  }

  const free = cells.find(c => !taken.has(`${c.x},${c.y}`))
  return free || { x: Math.floor(Math.random() * 10), y: Math.floor(Math.random() * 10) }
}

// ─── ЗАВДАННЯ ─────────────────────────────────────────────────

// Підписка на завдання групи
export function subscribeTasks(group, callback) {
  const q = query(
    collection(db, 'tasks'),
    where('active', '==', true),
    where('groups', 'array-contains', group)
  )
  return onSnapshot(q, (snap) => {
    const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    callback(tasks)
  })
}

// Отримати статус виконання завдань гравцем
export function subscribePlayerSubmissions(playerId, callback) {
  const q = query(
    collection(db, 'submissions'),
    where('playerId', '==', playerId)
  )
  return onSnapshot(q, (snap) => {
    const subs = {}
    snap.docs.forEach(d => {
      const data = d.data()
      subs[data.taskId] = { id: d.id, ...data }
    })
    callback(subs)
  })
}

// Здати відкрите завдання (підтримує повторну здачу після відхилення)
export async function submitOpenTask({ player, task }) {
  const q = query(
    collection(db, 'submissions'),
    where('playerId', '==', player.id),
    where('taskId', '==', task.id)
  )
  const existing = await getDocs(q)

  if (!existing.empty) {
    const subDoc  = existing.docs[0]
    const status  = subDoc.data().status

    // Вже на перевірці або схвалено — не дозволяємо
    if (status === 'pending' || status === 'approved') {
      return { error: 'Вже здано' }
    }

    // Відхилено — дозволяємо повторно здати (оновлюємо існуючий запис)
    if (status === 'rejected') {
      await updateDoc(doc(db, 'submissions', subDoc.id), {
        status: 'pending',
        submittedAt: serverTimestamp(),
      })
      return { id: subDoc.id }
    }
  }

  // Новий запис
  const subRef = await addDoc(collection(db, 'submissions'), {
    playerId:        player.id,
    playerName:      player.name,
    playerHeroName:  player.heroName,
    taskId:          task.id,
    taskTitle:       task.title,
    group:           player.group,
    type:            'open',
    status:          'pending',
    testScore:       null,
    testTotal:       null,
    submittedAt:     serverTimestamp(),
  })

  return { id: subRef.id }
}

// Здати тест (автоматична перевірка)
export async function submitTest({ player, task, answers }) {
  // Рахуємо правильні відповіді
  let correct = 0
  for (const q of task.questions) {
    if (answers[q.id] === q.correct) correct++
  }
  const total = task.questions.length
  const allCorrect = correct === total

  // Рахуємо нагороду пропорційно
  const reward = {}
  for (const [res, amount] of Object.entries(task.reward || {})) {
    if (res === 'crystals') {
      reward[res] = allCorrect ? amount : 0 // Кристали тільки за 100%
    } else {
      reward[res] = Math.floor((amount * correct) / total)
    }
  }

  // Нараховуємо ресурси гравцю
  const updates = {}
  for (const [res, amount] of Object.entries(reward)) {
    if (amount > 0) {
      updates[`resources.${res}`] = (player.resources[res] || 0) + amount
    }
  }
  // XP за тест
  const xpGain = correct * 5
  updates.heroXP = (player.heroXP || 0) + xpGain

  await updatePlayer(player.id, updates)

  // Зберігаємо результат
  await addDoc(collection(db, 'submissions'), {
    playerId: player.id,
    playerName: player.name,
    playerHeroName: player.heroName,
    taskId: task.id,
    taskTitle: task.title,
    group: player.group,
    type: 'test',
    status: 'approved',
    testScore: correct,
    testTotal: total,
    reward,
    submittedAt: serverTimestamp(),
  })

  return { correct, total, reward, xpGain }
}

// ─── АДМІНКА: ПІДТВЕРДЖЕННЯ ──────────────────────────────────

// Підписка на очікуючі підтвердження
export function subscribePendingSubmissions(callback, onError) {
  const q = query(
    collection(db, 'submissions'),
    where('status', '==', 'pending')
  )
  return onSnapshot(q, (snap) => {
    const subs = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const ta = a.submittedAt?.toMillis?.() || 0
        const tb = b.submittedAt?.toMillis?.() || 0
        return tb - ta
      })
    callback(subs)
  }, onError)
}

// Підтвердити здачу завдання (нараховує ресурси)
export async function approveSubmission(submissionId, playerId, task) {
  await runTransaction(db, async (tx) => {
    const playerRef = doc(db, 'players', playerId)
    const subRef    = doc(db, 'submissions', submissionId)

    const playerSnap = await tx.get(playerRef)
    if (!playerSnap.exists()) throw new Error('Гравець не знайдений')

    const player = playerSnap.data()
    const reward = task.reward || {}

    // Оновлюємо ресурси
    const newResources = { ...player.resources }
    for (const [res, amount] of Object.entries(reward)) {
      newResources[res] = (newResources[res] || 0) + amount
    }

    // XP за виконане завдання
    const xpGain = 20
    const newXP = (player.heroXP || 0) + xpGain

    // Diamonds за завдання (1-3 залежно від кількості нагород)
    const rewardSize = Object.values(reward).reduce((s, v) => s + v, 0)
    const diamondGain = rewardSize >= 100 ? 3 : rewardSize >= 30 ? 2 : 1
    const newDiamonds = (player.diamonds || 0) + diamondGain

    tx.update(playerRef, { resources: newResources, heroXP: newXP, diamonds: newDiamonds, lastActive: serverTimestamp() })
    tx.update(subRef, { status: 'approved', approvedAt: serverTimestamp() })

    // Повідомлення гравцю
    const msgRef = doc(collection(db, 'messages'))
    const rewardText = Object.entries(reward)
      .filter(([, v]) => v > 0)
      .map(([res, amount]) => `+${amount} ${res}`)
      .join(', ')
    tx.set(msgRef, {
      toPlayerId: playerId,
      fromName: 'Викладач',
      text: `✅ Завдання "${task.title}" підтверджено! ${rewardText} +${diamondGain}💠`,
      type: 'task',
      read: false,
      createdAt: serverTimestamp(),
    })
  })
}

// Відхилити здачу завдання
export async function rejectSubmission(submissionId, playerId, taskTitle) {
  await runTransaction(db, async (tx) => {
    const subRef = doc(db, 'submissions', submissionId)
    tx.update(subRef, { status: 'rejected', rejectedAt: serverTimestamp() })

    // Повідомлення гравцю
    const msgRef = doc(collection(db, 'messages'))
    tx.set(msgRef, {
      toPlayerId: playerId,
      fromName: 'Викладач',
      text: `❌ Завдання "${taskTitle}" не зараховано. Спробуй ще.`,
      type: 'task',
      read: false,
      createdAt: serverTimestamp(),
    })
  })
}

// ─── ЗАВДАННЯ (Адмінка) ───────────────────────────────────────

// Всі завдання одним запитом (для адмінки)
export async function getAllTasks() {
  const snap = await getDocs(collection(db, 'tasks'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// Підписка на всі активні завдання (для адмінки)
export function subscribeAllActiveTasks(callback, onError) {
  const q = query(collection(db, 'tasks'), where('active', '==', true))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }, onError)
}

export async function createTask(data) {
  const ref = await addDoc(collection(db, 'tasks'), {
    ...data,
    active: true,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function deactivateTask(taskId) {
  await updateDoc(doc(db, 'tasks', taskId), { active: false })
}

// ─── ПОВІДОМЛЕННЯ ─────────────────────────────────────────────

// Підписка на повідомлення гравця
export function subscribeMessages(playerId, callback) {
  const q = query(
    collection(db, 'messages'),
    where('toPlayerId', '==', playerId)
  )
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
      .slice(0, 50)
    callback(msgs)
  })
}

// Позначити повідомлення як прочитане
export async function markMessageRead(messageId) {
  await updateDoc(doc(db, 'messages', messageId), { read: true })
}

// Підписка на кількість непрочитаних повідомлень (глобально)
export function subscribeUnreadCount(playerId, callback) {
  const q = query(
    collection(db, 'messages'),
    where('toPlayerId', '==', playerId),
    where('read', '==', false)
  )
  return onSnapshot(q, snap => callback(snap.size))
}

// Позначити всі повідомлення гравця як прочитані
export async function markAllMessagesRead(playerId) {
  const q = query(
    collection(db, 'messages'),
    where('toPlayerId', '==', playerId),
    where('read', '==', false)
  )
  const snap = await getDocs(q)
  if (snap.empty) return
  const batch = writeBatch(db)
  snap.docs.forEach(d => batch.update(d.ref, { read: true }))
  await batch.commit()
}

// Надіслати повідомлення (адмінка)
export async function sendAdminMessage({ toPlayerId, toGroup, text }) {
  if (toGroup) {
    // Всім гравцям групи
    const q = query(collection(db, 'players'), where('group', '==', toGroup))
    const snap = await getDocs(q)
    const batch = writeBatch(db)
    snap.docs.forEach(d => {
      const msgRef = doc(collection(db, 'messages'))
      batch.set(msgRef, {
        toPlayerId: d.id,
        fromName: 'Викладач',
        text,
        type: 'admin',
        read: false,
        createdAt: serverTimestamp(),
      })
    })
    await batch.commit()
  } else {
    await addDoc(collection(db, 'messages'), {
      toPlayerId,
      fromName: 'Викладач',
      text,
      type: 'admin',
      read: false,
      createdAt: serverTimestamp(),
    })
  }
}

// ─── ТОРГІВЛЯ ─────────────────────────────────────────────────

// Підписка на торгові запити (вхідні)
export function subscribeIncomingTrades(playerId, callback) {
  const q = query(
    collection(db, 'trades'),
    where('toPlayerId', '==', playerId),
    where('status', '==', 'pending')
  )
  return onSnapshot(q, (snap) => {
    const trades = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
    callback(trades)
  })
}

// Підписка на власні запити
export function subscribeOutgoingTrades(playerId, callback) {
  const q = query(
    collection(db, 'trades'),
    where('fromPlayerId', '==', playerId)
  )
  return onSnapshot(q, (snap) => {
    const trades = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
      .slice(0, 20)
    callback(trades)
  })
}

// Надіслати торговий запит
export async function sendTradeRequest({ fromPlayer, toPlayer, offer, request, message }) {
  // Перевірка наявності ресурсів
  if ((fromPlayer.resources[offer.resource] || 0) < offer.amount) {
    return { error: 'Недостатньо ресурсів' }
  }

  // Блокуємо ресурс у відправника
  await runTransaction(db, async (tx) => {
    const playerRef = doc(db, 'players', fromPlayer.id)
    const playerSnap = await tx.get(playerRef)
    const player = playerSnap.data()

    const currentAmount = player.resources[offer.resource] || 0
    if (currentAmount < offer.amount) throw new Error('Недостатньо ресурсів')

    // Знімаємо ресурс (блокуємо)
    tx.update(playerRef, {
      [`resources.${offer.resource}`]: currentAmount - offer.amount,
    })

    // Створюємо торговий запит
    const tradeRef = doc(collection(db, 'trades'))
    tx.set(tradeRef, {
      fromPlayerId: fromPlayer.id,
      fromPlayerName: fromPlayer.name,
      toPlayerId: toPlayer.id,
      toPlayerName: toPlayer.name,
      group: fromPlayer.group,
      offer,
      request,
      message: message || '',
      status: 'pending',
      createdAt: serverTimestamp(),
      respondedAt: null,
    })

    // Повідомлення отримувачу
    const msgRef = doc(collection(db, 'messages'))
    tx.set(msgRef, {
      toPlayerId: toPlayer.id,
      fromName: fromPlayer.name,
      text: `📦 Торговий запит: ${offer.amount} ${offer.resourceName} → ${request.amount} ${request.resourceName}`,
      type: 'trade',
      read: false,
      createdAt: serverTimestamp(),
    })
  })

  return { success: true }
}

// Прийняти торговий запит
export async function acceptTrade(tradeId) {
  await runTransaction(db, async (tx) => {
    const tradeRef = doc(db, 'trades', tradeId)
    const tradeSnap = await tx.get(tradeRef)
    if (!tradeSnap.exists()) throw new Error('Запит не знайдений')

    const trade = tradeSnap.data()
    if (trade.status !== 'pending') throw new Error('Запит вже оброблено')

    const fromRef = doc(db, 'players', trade.fromPlayerId)
    const toRef   = doc(db, 'players', trade.toPlayerId)

    const [fromSnap, toSnap] = await Promise.all([tx.get(fromRef), tx.get(toRef)])
    const fromPlayer = fromSnap.data()
    const toPlayer   = toSnap.data()

    // Перевірка у отримувача
    if ((toPlayer.resources[trade.request.resource] || 0) < trade.request.amount) {
      throw new Error('Недостатньо ресурсів у отримувача')
    }

    // Оновлюємо ресурси
    // fromPlayer: повертаємо offer, отримуємо request
    tx.update(fromRef, {
      [`resources.${trade.offer.resource}`]:   (fromPlayer.resources[trade.offer.resource] || 0),   // вже знято при відправці
      [`resources.${trade.request.resource}`]: (fromPlayer.resources[trade.request.resource] || 0) + trade.request.amount,
    })

    // toPlayer: знімаємо request, отримуємо offer
    tx.update(toRef, {
      [`resources.${trade.request.resource}`]: (toPlayer.resources[trade.request.resource] || 0) - trade.request.amount,
      [`resources.${trade.offer.resource}`]:   (toPlayer.resources[trade.offer.resource] || 0) + trade.offer.amount,
    })

    // Закриваємо запит
    tx.update(tradeRef, { status: 'accepted', respondedAt: serverTimestamp() })

    // Повідомлення обом
    const msg1Ref = doc(collection(db, 'messages'))
    tx.set(msg1Ref, {
      toPlayerId: trade.fromPlayerId,
      fromName: 'Система',
      text: `✅ ${trade.toPlayerName} прийняв торговий запит! +${trade.request.amount} ${trade.request.resourceName}`,
      type: 'trade',
      read: false,
      createdAt: serverTimestamp(),
    })

    const msg2Ref = doc(collection(db, 'messages'))
    tx.set(msg2Ref, {
      toPlayerId: trade.toPlayerId,
      fromName: 'Система',
      text: `✅ Ви прийняли запит від ${trade.fromPlayerName}! +${trade.offer.amount} ${trade.offer.resourceName}`,
      type: 'trade',
      read: false,
      createdAt: serverTimestamp(),
    })
  })
}

// Скасувати власний торговий запит (відправник)
export async function cancelTrade(tradeId) {
  await runTransaction(db, async (tx) => {
    const tradeRef = doc(db, 'trades', tradeId)
    const tradeSnap = await tx.get(tradeRef)
    if (!tradeSnap.exists()) throw new Error('Запит не знайдений')

    const trade = tradeSnap.data()
    if (trade.status !== 'pending') throw new Error('Запит вже оброблено')

    const fromRef  = doc(db, 'players', trade.fromPlayerId)
    const fromSnap = await tx.get(fromRef)
    const fromPlayer = fromSnap.data()

    // Повертаємо заблокований ресурс відправнику
    tx.update(fromRef, {
      [`resources.${trade.offer.resource}`]: (fromPlayer.resources[trade.offer.resource] || 0) + trade.offer.amount,
    })

    tx.update(tradeRef, { status: 'cancelled', respondedAt: serverTimestamp() })
  })
}

// Відхилити торговий запит
export async function rejectTrade(tradeId) {
  await runTransaction(db, async (tx) => {
    const tradeRef = doc(db, 'trades', tradeId)
    const tradeSnap = await tx.get(tradeRef)
    if (!tradeSnap.exists()) throw new Error('Запит не знайдений')

    const trade = tradeSnap.data()
    const fromRef = doc(db, 'players', trade.fromPlayerId)
    const fromSnap = await tx.get(fromRef)
    const fromPlayer = fromSnap.data()

    // Повертаємо заблокований ресурс
    tx.update(fromRef, {
      [`resources.${trade.offer.resource}`]: (fromPlayer.resources[trade.offer.resource] || 0) + trade.offer.amount,
    })

    tx.update(tradeRef, { status: 'rejected', respondedAt: serverTimestamp() })

    // Повідомлення відправнику
    const msgRef = doc(collection(db, 'messages'))
    tx.set(msgRef, {
      toPlayerId: trade.fromPlayerId,
      fromName: 'Система',
      text: `❌ ${trade.toPlayerName} відхилив ваш торговий запит. Ресурси повернено.`,
      type: 'trade',
      read: false,
      createdAt: serverTimestamp(),
    })
  })
}

// ─── АДМІНКА: ГРАВЦІ ─────────────────────────────────────────

export async function getAllPlayers() {
  const snap = await getDocs(collection(db, 'players'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ─── ВИДОБУТОК (Копальні) ─────────────────────────────────────

const MINE_RATES = {
  1: { rate: 5,  max: 80  },
  2: { rate: 12, max: 200 },
  3: { rate: 25, max: 500 },
}

const MINE_UPGRADE_COSTS = {
  1: { gold: 200, bits: 30 },
  2: { gold: 400, bits: 80, code: 15 },
}

const RESEARCH_COST_BITS   = 50
const MINE_BUILD_COST_GOLD = 150

// Генерація прихованої карти ресурсів (12 випадкових клітинок з 30)
function generateResourceMap() {
  const pool  = ['gold', 'gold', 'gold', 'bits', 'bits', 'bits', 'code', 'code', 'stone', 'stone', 'wood', 'crystals']
  const cells = Array.from({ length: 30 }, (_, i) => i)
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]]
  }
  const map = {}
  cells.slice(0, 12).forEach((cellIdx, i) => { map[cellIdx.toString()] = pool[i] })
  return map
}

// Ініціалізація карти для існуючих гравців (без resourceMap)
export async function ensureResourceMap(playerId) {
  const snap = await getDoc(doc(db, 'players', playerId))
  if (!snap.exists() || snap.data().resourceMap) return
  await updateDoc(doc(db, 'players', playerId), {
    resourceMap: generateResourceMap(),
    cellStates:  {},
  })
}

// Почати дослідження клітинки
export async function startResearch(playerId, cellIndex) {
  const cellKey = cellIndex.toString()
  await runTransaction(db, async (tx) => {
    const playerRef = doc(db, 'players', playerId)
    const snap = await tx.get(playerRef)
    const player = snap.data()

    if ((player.buildings?.lab?.level || 0) < 1) throw new Error('Потрібна Лабораторія Рів. 1+')
    if ((player.resources?.bits || 0) < RESEARCH_COST_BITS) throw new Error('Недостатньо Бітів (потрібно 50)')
    if (player.cellStates?.[cellKey]) throw new Error('Ця ділянка вже досліджується або досліджена')

    const now    = new Date()
    const endsAt = new Date(now.getTime() + 6 * 60 * 60 * 1000) // +6 годин

    tx.update(playerRef, {
      [`cellStates.${cellKey}`]: { status: 'researching', startedAt: now, endsAt },
      'resources.bits': (player.resources?.bits || 0) - RESEARCH_COST_BITS,
      lastActive: serverTimestamp(),
    })
  })
}

// Розкрити клітинку після завершення дослідження
export async function revealCell(playerId, cellIndex) {
  const cellKey = cellIndex.toString()
  await runTransaction(db, async (tx) => {
    const playerRef = doc(db, 'players', playerId)
    const snap = await tx.get(playerRef)
    const player = snap.data()

    const cellState = player.cellStates?.[cellKey]
    if (!cellState || cellState.status !== 'researching') throw new Error('Ця ділянка не досліджується')

    const endsAt = cellState.endsAt?.toDate?.() || new Date(cellState.endsAt)
    if (Date.now() < endsAt.getTime()) throw new Error('Дослідження ще не завершено')

    const resource = player.resourceMap?.[cellKey] || null
    tx.update(playerRef, {
      [`cellStates.${cellKey}`]: { status: 'revealed', resource, revealedAt: new Date() },
      lastActive: serverTimestamp(),
    })
  })
}

// Побудувати копальню на розкритій клітинці
export async function buildMine(playerId, cellIndex) {
  const cellKey = cellIndex.toString()
  await runTransaction(db, async (tx) => {
    const playerRef = doc(db, 'players', playerId)
    const snap = await tx.get(playerRef)
    const player = snap.data()

    const cellState = player.cellStates?.[cellKey]
    if (!cellState || cellState.status !== 'revealed') throw new Error('Спочатку досліди ділянку')
    if ((player.resources?.gold || 0) < MINE_BUILD_COST_GOLD) throw new Error(`Недостатньо Золота (потрібно ${MINE_BUILD_COST_GOLD})`)

    tx.update(playerRef, {
      [`cellStates.${cellKey}`]: {
        status: 'mine',
        resource: cellState.resource,
        mineLevel: 1,
        lastCollected: new Date(),
      },
      'resources.gold': (player.resources?.gold || 0) - MINE_BUILD_COST_GOLD,
      lastActive: serverTimestamp(),
    })
  })
}

// Зібрати ресурси з копальні — повертає { resource, amount }
export async function collectMine(playerId, cellIndex) {
  const cellKey = cellIndex.toString()
  let collectedResource = null
  let collectedAmount   = 0

  await runTransaction(db, async (tx) => {
    const playerRef = doc(db, 'players', playerId)
    const snap = await tx.get(playerRef)
    const player = snap.data()

    const cellState = player.cellStates?.[cellKey]
    if (!cellState || cellState.status !== 'mine') throw new Error('Тут немає копальні')

    const lastCollected = cellState.lastCollected?.toDate?.() || new Date(cellState.lastCollected)
    const hours     = (Date.now() - lastCollected.getTime()) / 3600000
    const mineLevel = cellState.mineLevel || 1
    const cfg       = MINE_RATES[mineLevel]
    const amount    = Math.min(Math.floor(hours * cfg.rate), cfg.max)

    if (amount <= 0) throw new Error('Нічого збирати — приходь пізніше')

    collectedResource = cellState.resource
    collectedAmount   = amount

    tx.update(playerRef, {
      [`resources.${cellState.resource}`]: (player.resources?.[cellState.resource] || 0) + amount,
      [`cellStates.${cellKey}.lastCollected`]: new Date(),
      lastActive: serverTimestamp(),
    })
  })

  return { resource: collectedResource, amount: collectedAmount }
}

// ─── РОЗМІЩЕННЯ БУДІВЕЛЬ НА СІТЦІ ────────────────────────────

// Розмістити (або перемістити) будівлю на клітинку сітки
export async function placeBuildingOnGrid(playerId, buildingId, cellIndex) {
  const cellKey = cellIndex.toString()
  await runTransaction(db, async (tx) => {
    const playerRef = doc(db, 'players', playerId)
    const snap = await tx.get(playerRef)
    const player = snap.data()

    if ((player.buildings?.[buildingId]?.level || 0) < 1) {
      throw new Error('Будівля ще не збудована')
    }
    if (player.resourceMap?.[cellKey]) {
      throw new Error('Не можна розмістити будівлю на ділянці з ресурсами')
    }
    if (player.cellStates?.[cellKey]) {
      throw new Error('Ця ділянка вже зайнята дослідженням або копальнею')
    }
    // Перевірка чи клітинка не зайнята іншою будівлею
    const positions = player.buildingPositions || {}
    const occupant = Object.entries(positions).find(
      ([id, idx]) => idx === cellIndex && id !== buildingId
    )
    if (occupant) throw new Error('Ця клітинка вже зайнята іншою будівлею')

    tx.update(playerRef, {
      [`buildingPositions.${buildingId}`]: cellIndex,
      lastActive: serverTimestamp(),
    })
  })
}

// Зняти будівлю з сітки (повертає в "нерозміщені")
export async function removeBuildingFromGrid(playerId, buildingId) {
  await updateDoc(doc(db, 'players', playerId), {
    [`buildingPositions.${buildingId}`]: null,
    lastActive: serverTimestamp(),
  })
}

// Покращити копальню
export async function upgradeMine(playerId, cellIndex) {
  const cellKey = cellIndex.toString()
  await runTransaction(db, async (tx) => {
    const playerRef = doc(db, 'players', playerId)
    const snap = await tx.get(playerRef)
    const player = snap.data()

    const cellState    = player.cellStates?.[cellKey]
    if (!cellState || cellState.status !== 'mine') throw new Error('Тут немає копальні')

    const currentLevel = cellState.mineLevel || 1
    if (currentLevel >= 3) throw new Error('Максимальний рівень копальні')

    const cost = MINE_UPGRADE_COSTS[currentLevel]
    for (const [res, amt] of Object.entries(cost)) {
      if ((player.resources?.[res] || 0) < amt) throw new Error('Недостатньо ресурсів для апгрейду')
    }

    const updates = {
      [`cellStates.${cellKey}.mineLevel`]: currentLevel + 1,
      lastActive: serverTimestamp(),
    }
    for (const [res, amt] of Object.entries(cost)) {
      updates[`resources.${res}`] = (player.resources?.[res] || 0) - amt
    }
    tx.update(playerRef, updates)
  })
}
