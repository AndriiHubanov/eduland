// ─── Admin Service ───
// Потужні інструменти для викладача: аналітика, управління, PDF, експорт

import {
  doc, getDoc, getDocs, updateDoc, addDoc, deleteDoc,
  collection, query, where, orderBy, limit,
  onSnapshot, serverTimestamp, writeBatch,
} from 'firebase/firestore'
import { db } from './config'

// ─── АНАЛІТИКА СТУДЕНТІВ ─────────────────────────────────────

/**
 * Повний профіль студента для викладача
 * Повертає все що потрібно для оцінки активності
 */
export async function getStudentProfile(playerId) {
  const [playerSnap, subsSnap, tradesSnap, battlesSnap, missionsSnap, surveySnap] = await Promise.all([
    getDoc(doc(db, 'players', playerId)),
    getDocs(query(collection(db, 'submissions'), where('playerId', '==', playerId))),
    getDocs(query(collection(db, 'trades'), where('fromPlayerId', '==', playerId))),
    getDocs(query(collection(db, 'battles'), where('attackerId', '==', playerId))),
    getDocs(query(collection(db, 'playerMissions'), where('playerId', '==', playerId))),
    getDocs(query(collection(db, 'surveyResponses'), where('playerId', '==', playerId))),
  ])

  if (!playerSnap.exists()) return null
  const player = playerSnap.data()

  const submissions = subsSnap.docs.map(d => d.data())
  const trades = tradesSnap.docs.map(d => d.data())
  const battles = battlesSnap.docs.map(d => d.data())
  const missions = missionsSnap.docs.map(d => d.data())
  const surveys = surveySnap.docs.map(d => d.data())

  // Обчислюємо метрики
  const tasksApproved = submissions.filter(s => s.status === 'approved').length
  const tasksRejected = submissions.filter(s => s.status === 'rejected').length
  const tasksPending  = submissions.filter(s => s.status === 'pending').length
  const testsTotal    = submissions.filter(s => s.type === 'test').length
  const testsPerfect  = submissions.filter(s => s.type === 'test' && s.testScore === s.testTotal).length
  const avgTestScore  = testsTotal > 0
    ? Math.round(submissions.filter(s => s.type === 'test').reduce((sum, s) => sum + (s.testScore / s.testTotal) * 100, 0) / testsTotal)
    : null

  const battlesWon  = battles.filter(b => b.result === 'win').length
  const battlesLost = battles.filter(b => b.result === 'lose').length

  const missionsCompleted = missions.filter(m => m.status === 'claimed' || m.status === 'completed').length
  const achievementsEarned = missions.filter(m => m.type === 'achievement' && (m.status === 'claimed' || m.status === 'completed')).length

  // Активність (дні з останнім входом)
  const lastActive = player.lastActive?.toDate?.() || new Date(player.lastActive)
  const daysSinceActive = Math.floor((Date.now() - lastActive.getTime()) / 86400000)
  const createdAt = player.createdAt?.toDate?.() || new Date(player.createdAt)
  const daysPlaying = Math.max(1, Math.floor((Date.now() - createdAt.getTime()) / 86400000))

  // Ресурсна ефективність
  const totalResources = Object.values(player.resources || {}).reduce((sum, v) => sum + v, 0)
  const totalBuildings = Object.values(player.buildings || {}).reduce((sum, b) => sum + (b.level || 0), 0)

  return {
    // Базові дані
    id: player.id,
    name: player.name,
    group: player.group,
    heroName: player.heroName,
    heroClass: player.heroClass,
    heroLevel: player.heroLevel,
    heroXP: player.heroXP,

    // Метрики навчання
    learning: {
      tasksApproved,
      tasksRejected,
      tasksPending,
      testsTotal,
      testsPerfect,
      avgTestScore,
      surveysCompleted: surveys.length,
    },

    // Метрики гри
    game: {
      totalResources,
      diamonds: player.diamonds || 0,
      totalBuildings,
      castleLevel: player.castle?.level || 1,
      totalUnits: Object.values(player.units || {}).reduce((sum, u) => sum + (u.count || 0), 0),
      battlesWon,
      battlesLost,
      ruinsCleared: player.battleStats?.ruinsCleared || 0,
      tradesCompleted: trades.filter(t => t.status === 'accepted').length,
      missionsCompleted,
      achievementsEarned,
      sciencesCompleted: Object.values(player.sciences || {}).filter(s => s.status === 'completed').length,
      seasonLevel: player.season?.passLevel || 0,
    },

    // Активність
    activity: {
      daysSinceActive,
      daysPlaying,
      isActive: daysSinceActive <= 3,
      isInactive: daysSinceActive > 7,
      activityScore: Math.max(0, 100 - daysSinceActive * 10),
    },

    // Оцінка (0-100)
    overallScore: calculateOverallScore({
      tasksApproved, avgTestScore, battlesWon, totalBuildings,
      missionsCompleted, daysSinceActive, daysPlaying,
    }),
  }
}

function calculateOverallScore({ tasksApproved, avgTestScore, battlesWon, totalBuildings, missionsCompleted, daysSinceActive, daysPlaying }) {
  let score = 0
  score += Math.min(30, tasksApproved * 3)          // макс 30 балів за завдання
  score += Math.min(25, (avgTestScore || 0) * 0.25) // макс 25 за тести
  score += Math.min(15, missionsCompleted * 1.5)     // макс 15 за місії
  score += Math.min(10, totalBuildings * 1)          // макс 10 за будівлі
  score += Math.min(10, battlesWon * 2)              // макс 10 за бої
  score += Math.min(10, daysSinceActive <= 1 ? 10 : daysSinceActive <= 3 ? 7 : daysSinceActive <= 7 ? 3 : 0)
  return Math.min(100, Math.round(score))
}

// ─── ДАШБОРД ГРУПИ ───────────────────────────────────────────

export async function getGroupDashboard(group) {
  const playersSnap = await getDocs(query(collection(db, 'players'), where('group', '==', group)))
  const players = playersSnap.docs.map(d => ({ id: d.id, ...d.data() }))

  const subsSnap = await getDocs(query(collection(db, 'submissions'), where('group', '==', group)))
  const submissions = subsSnap.docs.map(d => d.data())

  // Активні/неактивні
  const now = Date.now()
  const active = players.filter(p => {
    const la = p.lastActive?.toDate?.() || new Date(p.lastActive || 0)
    return (now - la.getTime()) < 3 * 86400000
  })
  const inactive = players.filter(p => {
    const la = p.lastActive?.toDate?.() || new Date(p.lastActive || 0)
    return (now - la.getTime()) > 7 * 86400000
  })

  // Середні показники
  const avgLevel = players.length > 0
    ? Math.round(players.reduce((s, p) => s + (p.heroLevel || 1), 0) / players.length * 10) / 10
    : 0
  const avgXP = players.length > 0
    ? Math.round(players.reduce((s, p) => s + (p.heroXP || 0), 0) / players.length)
    : 0

  // Здачі завдань
  const approved = submissions.filter(s => s.status === 'approved').length
  const pending  = submissions.filter(s => s.status === 'pending').length
  const rejected = submissions.filter(s => s.status === 'rejected').length

  // Розподіл по класах
  const classDist = {}
  for (const p of players) {
    classDist[p.heroClass] = (classDist[p.heroClass] || 0) + 1
  }

  // Топ гравці
  const topByXP = [...players].sort((a, b) => (b.heroXP || 0) - (a.heroXP || 0)).slice(0, 5)
  const topByPower = [...players].sort((a, b) => (b.army?.power || 0) - (a.army?.power || 0)).slice(0, 5)

  return {
    totalPlayers: players.length,
    activePlayers: active.length,
    inactivePlayers: inactive.length,
    avgLevel,
    avgXP,
    submissions: { approved, pending, rejected, total: submissions.length },
    classDist,
    topByXP: topByXP.map(p => ({ name: p.heroName, xp: p.heroXP, level: p.heroLevel })),
    topByPower: topByPower.map(p => ({ name: p.heroName, power: p.army?.power || 0 })),
    inactiveList: inactive.map(p => ({
      name: p.name,
      heroName: p.heroName,
      lastActive: p.lastActive,
    })),
  }
}

// ─── BULK ОПЕРАЦІЇ ───────────────────────────────────────────

// Видати ресурси всій групі
export async function grantResourcesToGroup(group, resources) {
  const q = query(collection(db, 'players'), where('group', '==', group))
  const snap = await getDocs(q)
  const batch = writeBatch(db)

  for (const d of snap.docs) {
    const player = d.data()
    const updates = {}
    for (const [res, amount] of Object.entries(resources)) {
      if (res === 'diamonds') {
        updates.diamonds = (player.diamonds || 0) + amount
      } else {
        updates[`resources.${res}`] = (player.resources?.[res] || 0) + amount
      }
    }
    batch.update(d.ref, updates)
  }

  await batch.commit()
  return snap.size
}

// Видати ресурси конкретному гравцю
export async function grantResourcesToPlayer(playerId, resources) {
  const playerRef = doc(db, 'players', playerId)
  const snap = await getDoc(playerRef)
  if (!snap.exists()) throw new Error('Гравець не знайдений')

  const player = snap.data()
  const updates = { lastActive: serverTimestamp() }
  for (const [res, amount] of Object.entries(resources)) {
    if (res === 'diamonds') {
      updates.diamonds = (player.diamonds || 0) + amount
    } else {
      updates[`resources.${res}`] = (player.resources?.[res] || 0) + amount
    }
  }
  await updateDoc(playerRef, updates)
}

// Скинути гравця (нові гравці, тестування)
export async function resetPlayer(playerId) {
  const playerRef = doc(db, 'players', playerId)
  await updateDoc(playerRef, {
    heroLevel: 1,
    heroXP: 0,
    resources: { gold: 200, wood: 100, stone: 50, crystals: 0, bits: 0, code: 0, bio: 0, energy: 0 },
    diamonds: 0,
    buildings: {
      server: { level: 1, workers: 0 },
      lab: { level: 0, workers: 0 },
      tower: { level: 0, workers: 0 },
      archive: { level: 0, workers: 0 },
      firewall: { level: 0, workers: 0 },
    },
    castle: { level: 1, builtAt: new Date(), skin: null },
    units: {},
    army: { formation: [], power: 0 },
    battleStats: { wins: 0, losses: 0, ruinsCleared: 0 },
    sciences: {},
    workers: { total: 5, placed: 0 },
    lastActive: serverTimestamp(),
  })
}

// ─── ЕКСПОРТ ДАНИХ ───────────────────────────────────────────

// Експорт CSV для журналу
export async function exportGroupCSV(group) {
  const players = await getDocs(query(collection(db, 'players'), where('group', '==', group)))
  const subs = await getDocs(query(collection(db, 'submissions'), where('group', '==', group)))

  const subsByPlayer = {}
  subs.docs.forEach(d => {
    const s = d.data()
    if (!subsByPlayer[s.playerId]) subsByPlayer[s.playerId] = []
    subsByPlayer[s.playerId].push(s)
  })

  const rows = [['Ім\'я', 'Герой', 'Клас', 'Рівень', 'XP', 'Завдань здано', 'Тестів', 'Середній бал тестів', 'Замок', 'Бої виграно', 'Діаманти', 'Остання активність'].join(',')]

  for (const d of players.docs) {
    const p = d.data()
    const playerSubs = subsByPlayer[p.id] || []
    const approved = playerSubs.filter(s => s.status === 'approved').length
    const tests = playerSubs.filter(s => s.type === 'test')
    const avgTest = tests.length > 0
      ? Math.round(tests.reduce((sum, t) => sum + (t.testScore / t.testTotal) * 100, 0) / tests.length)
      : '-'

    const la = p.lastActive?.toDate?.() || new Date(p.lastActive || 0)
    const lastActiveStr = la.toLocaleDateString('uk-UA')

    rows.push([
      `"${p.name}"`,
      `"${p.heroName}"`,
      p.heroClass,
      p.heroLevel || 1,
      p.heroXP || 0,
      approved,
      tests.length,
      avgTest,
      p.castle?.level || 1,
      p.battleStats?.wins || 0,
      p.diamonds || 0,
      lastActiveStr,
    ].join(','))
  }

  return rows.join('\n')
}

// ─── ЗАВДАННЯ: АВТОГЕНЕРАЦІЯ З PDF ──────────────────────────

/**
 * Парсить текст (з PDF) і генерує структуру тестового завдання.
 * Формат вхідного тексту:
 * 
 * TITLE: Назва тесту
 * REWARD: gold=100,bits=50
 * GROUPS: PD11,PD12
 * ---
 * Q: Текст питання?
 * A: Варіант 1
 * B: Варіант 2
 * C: Варіант 3 *
 * D: Варіант 4
 * ---
 * Q: Наступне питання?
 * ...
 * 
 * Правильна відповідь позначена *
 */
export function parseTestFromText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l)
  
  let title = 'Без назви'
  let reward = {}
  let groups = []
  const questions = []
  
  let currentQ = null
  let headerDone = false
  
  for (const line of lines) {
    if (line === '---') {
      if (currentQ) {
        questions.push(currentQ)
        currentQ = null
      }
      headerDone = true
      continue
    }
    
    if (!headerDone) {
      if (line.startsWith('TITLE:')) title = line.slice(6).trim()
      else if (line.startsWith('REWARD:')) {
        line.slice(7).trim().split(',').forEach(pair => {
          const [res, amount] = pair.split('=')
          if (res && amount) reward[res.trim()] = parseInt(amount.trim())
        })
      }
      else if (line.startsWith('GROUPS:')) {
        groups = line.slice(7).trim().split(',').map(g => g.trim())
      }
      continue
    }
    
    if (line.startsWith('Q:')) {
      if (currentQ) questions.push(currentQ)
      currentQ = {
        id: `q${questions.length + 1}`,
        text: line.slice(2).trim(),
        options: [],
        correct: null,
      }
    } else if (/^[A-D]:/.test(line) && currentQ) {
      const letter = line[0]
      const isCorrect = line.includes('*')
      const text = line.slice(2).replace('*', '').trim()
      currentQ.options.push({ id: letter.toLowerCase(), text })
      if (isCorrect) currentQ.correct = letter.toLowerCase()
    }
  }
  
  if (currentQ) questions.push(currentQ)
  
  return {
    title,
    type: 'test',
    reward,
    groups,
    questions: questions.map(q => ({
      id: q.id,
      text: q.text,
      options: q.options,
      correct: q.correct,
    })),
  }
}

// Створити завдання з парсеного тексту
export async function createTaskFromParsed(parsedTask) {
  const ref = await addDoc(collection(db, 'tasks'), {
    ...parsedTask,
    active: true,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

// ─── НОТИФІКАЦІЇ / ПОПЕРЕДЖЕННЯ ──────────────────────────────

// Знайти гравців що потребують уваги
export async function getAlerts(group) {
  const players = await getDocs(query(collection(db, 'players'), where('group', '==', group)))
  const alerts = []
  const now = Date.now()

  for (const d of players.docs) {
    const p = d.data()
    const la = p.lastActive?.toDate?.() || new Date(p.lastActive || 0)
    const daysInactive = Math.floor((now - la.getTime()) / 86400000)

    // Неактивний більше 3 днів
    if (daysInactive > 3) {
      alerts.push({
        type: 'inactive',
        severity: daysInactive > 7 ? 'high' : 'medium',
        playerId: p.id,
        playerName: p.name,
        heroName: p.heroName,
        message: `Неактивний ${daysInactive} днів`,
        daysInactive,
      })
    }

    // Рівень героя 1 більше 5 днів (не розвивається)
    const created = p.createdAt?.toDate?.() || new Date(p.createdAt || 0)
    const daysPlaying = Math.floor((now - created.getTime()) / 86400000)
    if (p.heroLevel === 1 && daysPlaying > 5) {
      alerts.push({
        type: 'stuck',
        severity: 'medium',
        playerId: p.id,
        playerName: p.name,
        heroName: p.heroName,
        message: `Грає ${daysPlaying} днів, досі рівень 1`,
      })
    }

    // 0 завершених завдань
    // (потребує окремий запит, спрощуємо — перевіримо за XP)
    if ((p.heroXP || 0) < 20 && daysPlaying > 3) {
      alerts.push({
        type: 'no_tasks',
        severity: 'low',
        playerId: p.id,
        playerName: p.name,
        heroName: p.heroName,
        message: `Менше 20 XP за ${daysPlaying} днів — можливо не виконує завдання`,
      })
    }
  }

  return alerts.sort((a, b) => {
    const sev = { high: 3, medium: 2, low: 1 }
    return (sev[b.severity] || 0) - (sev[a.severity] || 0)
  })
}

// ─── БАЛАНС / НАЛАШТУВАННЯ ───────────────────────────────────

// Зберегти кастомні налаштування балансу для групи
export async function setGroupBalance(group, settings) {
  const ref = doc(db, 'config/balance/groups', group)
  await updateDoc(ref, {
    ...settings,
    updatedAt: serverTimestamp(),
  }).catch(async () => {
    // Якщо документ не існує — створюємо
    const { setDoc } = await import('firebase/firestore')
    await setDoc(ref, { ...settings, updatedAt: serverTimestamp() })
  })
}

export async function getGroupBalance(group) {
  const ref = doc(db, 'config/balance/groups', group)
  const snap = await getDoc(ref)
  return snap.exists() ? snap.data() : null
}

// ─── СТАТИСТИКА ДЛЯ ГРАФІКІВ ────────────────────────────────

// Щоденна активність (скільки гравців було активно per день)
export async function getDailyActivity(group, days = 14) {
  const players = await getDocs(query(collection(db, 'players'), where('group', '==', group)))
  const activity = {}
  const now = Date.now()

  // Ініціалізуємо дні
  for (let i = 0; i < days; i++) {
    const date = new Date(now - i * 86400000)
    const key = date.toISOString().split('T')[0]
    activity[key] = 0
  }

  // Рахуємо (спрощено — по lastActive, для точності потрібен activity log)
  for (const d of players.docs) {
    const la = d.data().lastActive?.toDate?.() || new Date(0)
    const key = la.toISOString().split('T')[0]
    if (activity[key] !== undefined) activity[key]++
  }

  return Object.entries(activity)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
