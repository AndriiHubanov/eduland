// ─── Survey Service ───
// Психологічні опитування: створення, проходження, нагороди

import {
  doc, getDoc, getDocs, addDoc, updateDoc,
  collection, query, where, onSnapshot,
  runTransaction, serverTimestamp,
} from 'firebase/firestore'
import { db } from './config'

// ─── Підписки ────────────────────────────────────────────────

// Активні опитування для групи
export function subscribeSurveys(group, callback) {
  const q = query(
    collection(db, 'surveys'),
    where('active', '==', true),
    where('groups', 'array-contains', group)
  )
  return onSnapshot(q, (snap) => {
    const surveys = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
    callback(surveys)
  })
}

// Відповіді гравця (для перевірки кулдауну)
export function subscribePlayerSurveyResponses(playerId, callback) {
  const q = query(
    collection(db, 'surveyResponses'),
    where('playerId', '==', playerId)
  )
  return onSnapshot(q, (snap) => {
    const responses = {}
    snap.docs.forEach(d => {
      const data = d.data()
      responses[data.surveyId] = { id: d.id, ...data }
    })
    callback(responses)
  })
}

// ─── Перевірка доступності ───────────────────────────────────

export function canTakeSurvey(survey, playerResponse) {
  if (!playerResponse) return true
  if (!survey.cooldownDays) return false // одноразове

  const completedAt = playerResponse.completedAt?.toDate?.()
    || new Date(playerResponse.completedAt)
  const cooldownEnd = new Date(completedAt.getTime() + survey.cooldownDays * 86400000)
  return Date.now() >= cooldownEnd.getTime()
}

// ─── Здача опитування ────────────────────────────────────────

export async function submitSurvey(playerId, playerName, group, surveyId, answers) {
  // Читаємо опитування
  const surveyRef = doc(db, 'surveys', surveyId)
  const surveySnap = await getDoc(surveyRef)
  if (!surveySnap.exists()) throw new Error('Опитування не знайдено')
  const survey = surveySnap.data()

  if (!survey.active) throw new Error('Опитування неактивне')

  // Перевірка кулдауну
  const existingQ = query(
    collection(db, 'surveyResponses'),
    where('playerId', '==', playerId),
    where('surveyId', '==', surveyId)
  )
  const existingSnap = await getDocs(existingQ)

  if (!existingSnap.empty) {
    const lastResponse = existingSnap.docs[0].data()
    if (!canTakeSurvey(survey, lastResponse)) {
      throw new Error('Кулдаун ще не завершився')
    }
  }

  // Зберігаємо відповідь + нараховуємо ресурси атомарно
  const reward = survey.reward || {}

  await runTransaction(db, async (tx) => {
    const playerRef = doc(db, 'players', playerId)
    const playerSnap = await tx.get(playerRef)
    if (!playerSnap.exists()) throw new Error('Гравець не знайдений')

    const player = playerSnap.data()

    // Нараховуємо ресурси
    const updates = { lastActive: serverTimestamp() }
    for (const [res, amount] of Object.entries(reward)) {
      updates[`resources.${res}`] = (player.resources?.[res] || 0) + amount
    }

    tx.update(playerRef, updates)

    // Зберігаємо відповідь
    const responseRef = doc(collection(db, 'surveyResponses'))
    tx.set(responseRef, {
      surveyId,
      playerId,
      playerName,
      group,
      answers,
      rewardGiven: true,
      completedAt: new Date(),
    })
  })

  return { reward }
}

// ─── Адмінка: створення опитування ───────────────────────────

export async function createSurvey({
  title, description, questions, reward, groups, cooldownDays,
}) {
  const ref = await addDoc(collection(db, 'surveys'), {
    title,
    description: description || '',
    questions,
    reward: reward || {},
    groups: groups || [],
    cooldownDays: cooldownDays || null,
    active: true,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function deactivateSurvey(surveyId) {
  await updateDoc(doc(db, 'surveys', surveyId), { active: false })
}

// Всі відповіді на опитування (для адмінки — перегляд результатів)
export async function getSurveyResponses(surveyId) {
  const q = query(
    collection(db, 'surveyResponses'),
    where('surveyId', '==', surveyId)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}
