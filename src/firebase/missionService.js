// ─── Mission Service ───
// Місії: щоденні, тижневі, сюжетні, досягнення

import {
  doc, getDoc, getDocs, addDoc, updateDoc,
  collection, query, where, onSnapshot,
  runTransaction, serverTimestamp, writeBatch,
} from 'firebase/firestore'
import { db } from './config'
import { addResearchPoints } from './scienceService'

// ─── Константи ───────────────────────────────────────────────

export const MISSION_TYPES = {
  daily:       { name: 'Щоденна',    icon: '📅', color: '#00ff88' },
  weekly:      { name: 'Тижнева',    icon: '📆', color: '#ffd700' },
  story:       { name: 'Сюжетна',    icon: '📖', color: '#ff4500' },
  achievement: { name: 'Досягнення', icon: '🏆', color: '#b9f2ff' },
}

// ─── Дефолтні місії (генеруються для всіх) ───────────────────

export const DEFAULT_DAILY_MISSIONS = [
  {
    id: 'daily_collect_resources',
    title: 'Збирач',
    description: 'Зібрати ресурси з будь-якої копальні',
    flavorText: '«Надра ще зберігають скарби старого світу. Копальня — твій ключ до них.»',
    type: 'daily',
    objective: { action: 'collect_mine', count: 1 },
    reward: { gold: 50 },
    xpReward: 5,
  },
  {
    id: 'daily_upgrade_building',
    title: 'Будівельник',
    description: 'Покращити будь-яку будівлю',
    flavorText: '«Кожна нова будівля — доказ того, що руїни можна перетворити на місто.»',
    type: 'daily',
    objective: { action: 'upgrade_building', count: 1 },
    reward: { gold: 80, bits: 10 },
    xpReward: 10,
  },
  {
    id: 'daily_complete_task',
    title: 'Студент',
    description: 'Виконати будь-яке завдання',
    flavorText: '«Знання — єдина зброя, яка не ржавіє. Nova Academy це пам\'ятає.»',
    type: 'daily',
    objective: { action: 'complete_task', count: 1 },
    reward: { gold: 100, bits: 20 },
    xpReward: 15,
  },
  {
    id: 'daily_trade',
    title: 'Торговець',
    description: 'Здійснити торгову операцію',
    flavorText: '«Торгівля після Колапсу — це довіра. Кожна угода відновлює зв\'язки між таборами.»',
    type: 'daily',
    objective: { action: 'trade', count: 1 },
    reward: { gold: 60 },
    xpReward: 5,
  },
  {
    id: 'daily_research',
    title: 'Дослідник',
    description: 'Запустити дослідження клітинки',
    flavorText: '«Карта руїн не повна. Кожна розвідана клітинка — крок до розуміння катастрофи 2039.»',
    type: 'daily',
    objective: { action: 'start_research', count: 1 },
    reward: { bits: 30 },
    xpReward: 5,
  },
  {
    id: 'daily_place_workers',
    title: 'Менеджер',
    description: 'Розмістити 3 робітників',
    flavorText: '«Без праці немає прогресу. Академія живе зусиллями кожного студента.»',
    type: 'daily',
    objective: { action: 'place_workers', count: 3 },
    reward: { gold: 40 },
    xpReward: 5,
  },
  {
    id: 'daily_field_expedition',
    title: 'Першовідкривач',
    description: 'Відправ команду на будь-яке поле',
    flavorText: '«Зовні стін — невідомість. Але тільки ті, хто виходить назовні, знають, що там насправді.»',
    type: 'daily',
    objective: { action: 'start_expedition', count: 1 },
    reward: { energy: 30, gold: 50 },
    xpReward: 10,
    rpReward: 2,
  },
  {
    id: 'daily_extract_field',
    title: 'Видобувач',
    description: 'Видобудь ресурси з ресурсного поля',
    flavorText: '«Земля ще не спустошена. Правильні руки і правильні інструменти — і вона віддасть усе.»',
    type: 'daily',
    objective: { action: 'claim_extract', count: 1 },
    reward: { bio: 30, energy: 20 },
    xpReward: 12,
    rpReward: 3,
  },
  {
    id: 'daily_field_ruin',
    title: 'Штурмовик',
    description: 'Штурмуй руїну через поле',
    flavorText: '«Руїни — не просто уламки. Там схована технологія, яка може врятувати або знищити.»',
    type: 'daily',
    objective: { action: 'claim_attack', count: 1 },
    reward: { gold: 120, code: 20 },
    xpReward: 15,
    rpReward: 3,
  },
]

export const DEFAULT_WEEKLY_MISSIONS = [
  {
    id: 'weekly_5_tasks',
    title: 'Відмінник',
    description: 'Виконати 5 завдань за тиждень',
    type: 'weekly',
    objective: { action: 'complete_task', count: 5 },
    reward: { gold: 500, bits: 100, code: 30 },
    xpReward: 50,
    diamondReward: 1,
  },
  {
    id: 'weekly_3_trades',
    title: 'Підприємець',
    description: 'Здійснити 3 торгові операції',
    type: 'weekly',
    objective: { action: 'trade', count: 3 },
    reward: { gold: 300, crystals: 10 },
    xpReward: 30,
  },
  {
    id: 'weekly_ruin_clear',
    title: 'Мисливець на руїни',
    description: 'Зачистити 2 руїни',
    type: 'weekly',
    objective: { action: 'clear_ruin', count: 2 },
    reward: { gold: 400, bits: 80, code: 20 },
    xpReward: 40,
    diamondReward: 1,
  },
  {
    id: 'weekly_upgrade_3',
    title: 'Архітектор тижня',
    description: 'Покращити 3 будівлі',
    type: 'weekly',
    objective: { action: 'upgrade_building', count: 3 },
    reward: { gold: 350, stone: 50 },
    xpReward: 30,
  },
  {
    id: 'weekly_collect_500',
    title: 'Шахтар',
    description: 'Зібрати 500 одиниць ресурсів з копалень',
    type: 'weekly',
    objective: { action: 'collect_total', count: 500 },
    reward: { gold: 300, crystals: 15 },
    xpReward: 35,
  },
  {
    id: 'weekly_recruit_units',
    title: 'Командир',
    description: 'Найняти 3 юніти',
    type: 'weekly',
    objective: { action: 'recruit_unit', count: 3 },
    reward: { gold: 250, bits: 50 },
    xpReward: 25,
  },
  {
    id: 'weekly_field_expeditions',
    title: 'Дослідник полів',
    description: 'Відправ 5 місій на поля',
    type: 'weekly',
    objective: { action: 'start_expedition', count: 5 },
    reward: { gold: 400, energy: 80, bits: 60 },
    xpReward: 50,
    rpReward: 8,
  },
  {
    id: 'weekly_field_extractions',
    title: 'Промисловець',
    description: 'Видобудь ресурси з 3 різних полів',
    type: 'weekly',
    objective: { action: 'claim_extract', count: 3 },
    reward: { gold: 350, bio: 60, crystals: 20 },
    xpReward: 40,
    rpReward: 6,
  },
]

export const DEFAULT_STORY_MISSIONS = [
  // ─── Глава 1: Початок ─────────────────────────────────────
  {
    id: 'story_1_1',
    title: 'Пробудження',
    description: 'Ти прокидаєшся в бункері. Навколо — руїни старого світу. Час відбудовувати.',
    type: 'story',
    chapter: 1,
    order: 1,
    objective: { action: 'upgrade_building', target: 'server', targetLevel: 1, count: 1 },
    reward: { gold: 100 },
    xpReward: 10,
    nextMission: 'story_1_2',
    loreText: 'Стародавній сервер гуде, оживаючи вперше за десятиліття. Дані починають текти — залишки знань минулого.',
  },
  {
    id: 'story_1_2',
    title: 'Перші ресурси',
    description: 'Дослідж територію навколо бункера. Знайди поклади ресурсів.',
    type: 'story',
    chapter: 1,
    order: 2,
    objective: { action: 'start_research', count: 1 },
    reward: { gold: 150, bits: 30 },
    xpReward: 15,
    nextMission: 'story_1_3',
    requires: 'story_1_1',
    loreText: 'Сканер показує слабкі сигнали під землею. Щось там є — потрібна лабораторія для аналізу.',
  },
  {
    id: 'story_1_3',
    title: 'Лабораторія',
    description: 'Збудуй лабораторію для аналізу зразків.',
    type: 'story',
    chapter: 1,
    order: 3,
    objective: { action: 'upgrade_building', target: 'lab', targetLevel: 1, count: 1 },
    reward: { gold: 200, bits: 50 },
    xpReward: 20,
    nextMission: 'story_1_4',
    requires: 'story_1_2',
    loreText: 'Лабораторія оживає. Тепер ти можеш аналізувати поклади і будувати копальні. Це змінює все.',
  },
  {
    id: 'story_1_4',
    title: 'Перша копальня',
    description: 'Побудуй свою першу копальню на розкритому покладі.',
    type: 'story',
    chapter: 1,
    order: 4,
    objective: { action: 'build_mine', count: 1 },
    reward: { gold: 200, bits: 40, code: 10 },
    xpReward: 20,
    nextMission: 'story_1_5',
    requires: 'story_1_3',
    loreText: 'Бур входить у землю. Перші кристали блищать. Цивілізація повертається — крок за кроком.',
  },
  {
    id: 'story_1_5',
    title: 'Комунікація',
    description: 'Збудуй Вежу зв\'язку і зв\'яжись з іншими поселеннями.',
    type: 'story',
    chapter: 1,
    order: 5,
    objective: { action: 'upgrade_building', target: 'tower', targetLevel: 1, count: 1 },
    reward: { gold: 250, code: 20 },
    xpReward: 25,
    nextMission: 'story_2_1',
    requires: 'story_1_4',
    loreText: 'Вежа випромінює сигнал. Через хвилину — відповідь. Ти не один. На карті з\'являються інші поселення.',
  },

  // ─── Глава 2: Розвиток ────────────────────────────────────
  {
    id: 'story_2_1',
    title: 'Торгові шляхи',
    description: 'Здійсни свою першу торгову операцію з іншим гравцем.',
    type: 'story',
    chapter: 2,
    order: 1,
    objective: { action: 'trade', count: 1 },
    reward: { gold: 300, crystals: 5 },
    xpReward: 20,
    nextMission: 'story_2_2',
    requires: 'story_1_5',
    loreText: 'Каравани знову рухаються дорогами. Торгівля — кров нової цивілізації.',
  },
  {
    id: 'story_2_2',
    title: 'Укріплення',
    description: 'Покращи замок до 2 рівня. Твоє поселення росте.',
    type: 'story',
    chapter: 2,
    order: 2,
    objective: { action: 'upgrade_castle', targetLevel: 2, count: 1 },
    reward: { gold: 400, stone: 100 },
    xpReward: 30,
    nextMission: 'story_2_3',
    requires: 'story_2_1',
    loreText: 'Стіни стають вищими. Тепер це не просто бункер — це дім.',
  },
  {
    id: 'story_2_3',
    title: 'Перший солдат',
    description: 'Найми свого першого юніта-робота.',
    type: 'story',
    chapter: 2,
    order: 3,
    objective: { action: 'recruit_unit', count: 1 },
    reward: { gold: 300, bits: 50 },
    xpReward: 25,
    nextMission: 'story_2_4',
    requires: 'story_2_2',
    loreText: 'Механічний воїн активується. Його червоні очі спалахують. "Протокол захисту — активовано."',
  },
  {
    id: 'story_2_4',
    title: 'Розвідка руїн',
    description: 'Атакуй руїну тіру 1 і здобудь ресурси.',
    type: 'story',
    chapter: 2,
    order: 4,
    objective: { action: 'clear_ruin', tier: 1, count: 1 },
    reward: { gold: 500, bits: 100, code: 30 },
    xpReward: 40,
    diamondReward: 1,
    nextMission: 'story_3_1',
    requires: 'story_2_3',
    loreText: 'Склад зачищено. Серед уламків — старі технології, які ще можна відновити. І записка: "Генезис чекає."',
  },

  // ─── Глава 3: Наука ───────────────────────────────────────
  {
    id: 'story_3_1',
    title: 'Нова ера',
    description: 'Збудуй Теплицю і почни вивчати природничі науки.',
    type: 'story',
    chapter: 3,
    order: 1,
    objective: { action: 'upgrade_building', target: 'greenhouse', targetLevel: 1, count: 1 },
    reward: { gold: 400, bio: 30 },
    xpReward: 30,
    nextMission: 'story_3_2',
    requires: 'story_2_4',
    loreText: 'Перші паростки пробиваються крізь бетон. Життя повертається.',
  },
  {
    id: 'story_3_2',
    title: 'Енергія майбутнього',
    description: 'Збудуй Реактор або Сонячну батарею.',
    type: 'story',
    chapter: 3,
    order: 2,
    objective: { action: 'upgrade_building', target: ['reactor', 'solar_array'], targetLevel: 1, count: 1 },
    reward: { gold: 400, energy: 30 },
    xpReward: 30,
    nextMission: 'story_3_3',
    requires: 'story_3_1',
    loreText: 'Реактор гуде. Або сонячні панелі блищать. Енергія тече — і з нею приходять нові можливості.',
  },
  {
    id: 'story_3_3',
    title: 'Генезис',
    description: 'Атакуй Зруйновану лабораторію "Генезис" (тір 2).',
    type: 'story',
    chapter: 3,
    order: 3,
    objective: { action: 'clear_ruin', tier: 2, count: 1 },
    reward: { gold: 800, bits: 200, bio: 50, energy: 50 },
    xpReward: 60,
    diamondReward: 2,
    nextMission: 'story_4_1',
    requires: 'story_3_2',
    loreText: 'Прототипи серії GN деактивовано. У серці лабораторії — креслення "Протоколу Відродження". Частина перша з трьох.',
  },

  // ─── Глава 4: Фінал бети ──────────────────────────────────
  {
    id: 'story_4_1',
    title: 'Бункер Старого Світу',
    description: 'Підготуй армію і штурмуй Бункер Старого Світу (тір 3).',
    type: 'story',
    chapter: 4,
    order: 1,
    objective: { action: 'clear_ruin', tier: 3, count: 1 },
    reward: { gold: 1500, bits: 500, code: 200, crystals: 100, bio: 100, energy: 100 },
    xpReward: 100,
    diamondReward: 5,
    nextMission: null,
    requires: 'story_3_3',
    loreText: 'Масивні двері відчиняються. Всередині — Протокол Відродження. Повний. Ти тримаєш в руках ключ до відновлення цивілізації. Але це лише початок...',
  },
]

export const DEFAULT_ACHIEVEMENTS = [
  // ─── Будівництво ───
  { id: 'ach_first_building', title: 'Перший камінь', description: 'Побудуй першу будівлю', objective: { action: 'upgrade_building', count: 1 }, reward: {}, diamondReward: 1, icon: '🧱' },
  { id: 'ach_all_buildings', title: 'Містобудівник', description: 'Збудуй всі 5 основних будівель', objective: { action: 'own_buildings', count: 5 }, reward: { gold: 500 }, diamondReward: 2, icon: '🏗️' },
  { id: 'ach_max_building', title: 'Максимальна потужність', description: 'Покращи будь-яку будівлю до рівня 3', objective: { action: 'building_level', targetLevel: 3, count: 1 }, reward: { gold: 300 }, diamondReward: 1, icon: '⚡' },
  { id: 'ach_all_natural', title: 'Науковець', description: 'Збудуй всі 4 будівлі природничих наук', objective: { action: 'own_natural_buildings', count: 4 }, reward: { bio: 50, energy: 50 }, diamondReward: 3, icon: '🔬' },

  // ─── Копальні ───
  { id: 'ach_first_mine', title: 'Золота жила', description: 'Побудуй першу копальню', objective: { action: 'build_mine', count: 1 }, reward: { gold: 100 }, diamondReward: 1, icon: '⛏️' },
  { id: 'ach_5_mines', title: 'Магнат', description: 'Маєш 5 копалень', objective: { action: 'own_mines', count: 5 }, reward: { gold: 500 }, diamondReward: 2, icon: '💰' },
  { id: 'ach_collect_1000', title: 'Збирач тисячі', description: 'Зібрати 1000 ресурсів з копалень', objective: { action: 'collect_total', count: 1000 }, reward: { gold: 300 }, diamondReward: 1, icon: '🏆' },

  // ─── Бій ───
  { id: 'ach_first_battle', title: 'Хрещення вогнем', description: 'Вижити в першому бою', objective: { action: 'battle', count: 1 }, reward: { gold: 200 }, diamondReward: 1, icon: '⚔️' },
  { id: 'ach_10_wins', title: 'Ветеран', description: 'Перемогти 10 разів', objective: { action: 'win_battle', count: 10 }, reward: { gold: 500 }, diamondReward: 3, icon: '🎖️' },
  { id: 'ach_tier3_clear', title: 'Легенда', description: 'Зачистити Бункер Старого Світу', objective: { action: 'clear_ruin', tier: 3, count: 1 }, reward: { gold: 1000 }, diamondReward: 5, icon: '👑' },

  // ─── Армія ───
  { id: 'ach_first_unit', title: 'Командир', description: 'Найняти першого юніта', objective: { action: 'recruit_unit', count: 1 }, reward: { gold: 100 }, diamondReward: 1, icon: '🤖' },
  { id: 'ach_full_army', title: 'Генерал', description: 'Мати 15 юнітів (максимум)', objective: { action: 'own_units', count: 15 }, reward: { gold: 800 }, diamondReward: 3, icon: '🎖️' },
  { id: 'ach_all_unit_types', title: 'Колекціонер', description: 'Мати хоча б по 1 юніту кожного типу', objective: { action: 'own_unit_types', count: 8 }, reward: { gold: 600 }, diamondReward: 2, icon: '🃏' },

  // ─── Замок ───
  { id: 'ach_castle_3', title: 'Фортифікатор', description: 'Замок рівня 3', objective: { action: 'castle_level', targetLevel: 3, count: 1 }, reward: { gold: 500 }, diamondReward: 2, icon: '🏰' },
  { id: 'ach_castle_5', title: 'Імператор', description: 'Замок рівня 5', objective: { action: 'castle_level', targetLevel: 5, count: 1 }, reward: { gold: 2000 }, diamondReward: 5, icon: '👑' },

  // ─── Торгівля ───
  { id: 'ach_first_trade', title: 'Купець', description: 'Здійснити першу торгову операцію', objective: { action: 'trade', count: 1 }, reward: { gold: 100 }, diamondReward: 1, icon: '🤝' },
  { id: 'ach_10_trades', title: 'Торговий барон', description: 'Здійснити 10 операцій', objective: { action: 'trade', count: 10 }, reward: { gold: 400 }, diamondReward: 2, icon: '💎' },

  // ─── Навчання ───
  { id: 'ach_first_task', title: 'Учень', description: 'Виконати перше завдання', objective: { action: 'complete_task', count: 1 }, reward: { gold: 100 }, diamondReward: 1, icon: '📚' },
  { id: 'ach_10_tasks', title: 'Знавець', description: 'Виконати 10 завдань', objective: { action: 'complete_task', count: 10 }, reward: { gold: 500 }, diamondReward: 3, icon: '🎓' },
  { id: 'ach_perfect_test', title: 'Перфекціоніст', description: 'Здати тест на 100%', objective: { action: 'perfect_test', count: 1 }, reward: { gold: 300, crystals: 10 }, diamondReward: 2, icon: '💯' },

  // ─── Соціальне ───
  { id: 'ach_survey', title: 'Відвертий', description: 'Пройти психологічне опитування', objective: { action: 'complete_survey', count: 1 }, reward: { gold: 50 }, diamondReward: 1, icon: '💬' },
  { id: 'ach_hero_lvl_6', title: 'Максимальна еволюція', description: 'Досягти 6 рівня героя', objective: { action: 'hero_level', targetLevel: 6, count: 1 }, reward: { gold: 1000 }, diamondReward: 5, icon: '⭐' },
]

// ─── Підписки ────────────────────────────────────────────────

// Активні місії гравця
export function subscribePlayerMissions(playerId, callback) {
  const q = query(
    collection(db, 'playerMissions'),
    where('playerId', '==', playerId)
  )
  return onSnapshot(q, (snap) => {
    const missions = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order || 0) - (b.order || 0))
    callback(missions)
  })
}

// ─── Ініціалізація місій для нового гравця ───────────────────

export async function initPlayerMissions(playerId) {
  const batch = writeBatch(db)

  // Вибираємо 3 рандомні щоденні місії
  const shuffledDaily = [...DEFAULT_DAILY_MISSIONS].sort(() => Math.random() - 0.5)
  const todayDailies = shuffledDaily.slice(0, 3)

  for (const mission of todayDailies) {
    const ref = doc(collection(db, 'playerMissions'))
    batch.set(ref, {
      playerId,
      missionId: mission.id,
      title: mission.title,
      description: mission.description,
      flavorText: mission.flavorText || '',
      type: 'daily',
      objective: mission.objective,
      reward: mission.reward,
      xpReward: mission.xpReward || 0,
      diamondReward: mission.diamondReward || 0,
      rpReward: mission.rpReward || 0,
      progress: 0,
      target: mission.objective.count,
      status: 'active',    // active | completed | claimed
      expiresAt: getEndOfDay(),
      createdAt: new Date(),
    })
  }

  // Вибираємо 2 рандомні тижневі місії
  const shuffledWeekly = [...DEFAULT_WEEKLY_MISSIONS].sort(() => Math.random() - 0.5)
  const weeklyMissions = shuffledWeekly.slice(0, 2)

  for (const mission of weeklyMissions) {
    const ref = doc(collection(db, 'playerMissions'))
    batch.set(ref, {
      playerId,
      missionId: mission.id,
      title: mission.title,
      description: mission.description,
      type: 'weekly',
      objective: mission.objective,
      reward: mission.reward,
      xpReward: mission.xpReward || 0,
      diamondReward: mission.diamondReward || 0,
      rpReward: mission.rpReward || 0,
      progress: 0,
      target: mission.objective.count,
      status: 'active',
      expiresAt: getEndOfWeek(),
      createdAt: new Date(),
    })
  }

  // Перша сюжетна місія
  const firstStory = DEFAULT_STORY_MISSIONS[0]
  const storyRef = doc(collection(db, 'playerMissions'))
  batch.set(storyRef, {
    playerId,
    missionId: firstStory.id,
    title: firstStory.title,
    description: firstStory.description,
    type: 'story',
    chapter: firstStory.chapter,
    order: firstStory.order,
    objective: firstStory.objective,
    reward: firstStory.reward,
    xpReward: firstStory.xpReward || 0,
    diamondReward: firstStory.diamondReward || 0,
    loreText: firstStory.loreText || '',
    nextMission: firstStory.nextMission || null,
    progress: 0,
    target: firstStory.objective.count,
    status: 'active',
    expiresAt: null, // сюжетні не закінчуються
    createdAt: new Date(),
  })

  // Всі досягнення
  for (const ach of DEFAULT_ACHIEVEMENTS) {
    const ref = doc(collection(db, 'playerMissions'))
    batch.set(ref, {
      playerId,
      missionId: ach.id,
      title: ach.title,
      description: ach.description,
      type: 'achievement',
      icon: ach.icon,
      objective: ach.objective,
      reward: ach.reward || {},
      xpReward: 0,
      diamondReward: ach.diamondReward || 0,
      progress: 0,
      target: ach.objective.count,
      status: 'active',
      expiresAt: null,
      createdAt: new Date(),
    })
  }

  await batch.commit()
}

// ─── Оновлення прогресу місій ────────────────────────────────

/**
 * Викликається після кожної ігрової дії.
 * action: 'collect_mine' | 'upgrade_building' | 'complete_task' | 'trade' | ...
 * details: { target, tier, amount, ... }
 */
export async function updateMissionProgress(playerId, action, details = {}) {
  const q = query(
    collection(db, 'playerMissions'),
    where('playerId', '==', playerId),
    where('status', '==', 'active')
  )
  const snap = await getDocs(q)

  const batch = writeBatch(db)
  let updated = 0

  for (const docSnap of snap.docs) {
    const mission = docSnap.data()
    const obj = mission.objective

    // Перевірка чи дія відповідає місії
    if (obj.action !== action) continue

    // Перевірка target (конкретна будівля / тір руїни)
    if (obj.target) {
      if (Array.isArray(obj.target)) {
        if (!obj.target.includes(details.target)) continue
      } else if (obj.target !== details.target) continue
    }
    if (obj.tier && obj.tier !== details.tier) continue
    if (obj.targetLevel && (details.level || 0) < obj.targetLevel) continue

    // Оновлюємо прогрес
    const increment = details.amount || 1
    const newProgress = Math.min((mission.progress || 0) + increment, mission.target)
    const isComplete = newProgress >= mission.target

    batch.update(docSnap.ref, {
      progress: newProgress,
      ...(isComplete ? { status: 'completed', completedAt: new Date() } : {}),
    })
    updated++
  }

  if (updated > 0) await batch.commit()
  return updated
}

// ─── Забрати нагороду за місію ───────────────────────────────

export async function claimMissionReward(playerId, missionDocId) {
  await runTransaction(db, async (tx) => {
    const missionRef = doc(db, 'playerMissions', missionDocId)
    const missionSnap = await tx.get(missionRef)
    if (!missionSnap.exists()) throw new Error('Місія не знайдена')

    const mission = missionSnap.data()
    if (mission.playerId !== playerId) throw new Error('Не ваша місія')
    if (mission.status !== 'completed') throw new Error('Місія ще не виконана')

    const playerRef = doc(db, 'players', playerId)
    const playerSnap = await tx.get(playerRef)
    if (!playerSnap.exists()) throw new Error('Гравець не знайдений')

    const player = playerSnap.data()
    const updates = { lastActive: serverTimestamp() }

    // Ресурси
    for (const [res, amount] of Object.entries(mission.reward || {})) {
      updates[`resources.${res}`] = (player.resources?.[res] || 0) + amount
    }

    // XP
    if (mission.xpReward) {
      updates.heroXP = (player.heroXP || 0) + mission.xpReward
    }

    // Diamonds
    if (mission.diamondReward) {
      updates.diamonds = (player.diamonds || 0) + mission.diamondReward
    }

    tx.update(playerRef, updates)
    tx.update(missionRef, { status: 'claimed', claimedAt: new Date() })

    // RP (Research Points) — окремо після транзакції (updateDoc)
    if (mission.rpReward) {
      await addResearchPoints(playerId, mission.rpReward)
    }

    // Якщо сюжетна місія — розблокувати наступну
    if (mission.type === 'story' && mission.nextMission) {
      const nextMission = DEFAULT_STORY_MISSIONS.find(m => m.id === mission.nextMission)
      if (nextMission) {
        const nextRef = doc(collection(db, 'playerMissions'))
        tx.set(nextRef, {
          playerId,
          missionId: nextMission.id,
          title: nextMission.title,
          description: nextMission.description,
          type: 'story',
          chapter: nextMission.chapter,
          order: nextMission.order,
          objective: nextMission.objective,
          reward: nextMission.reward,
          xpReward: nextMission.xpReward || 0,
          diamondReward: nextMission.diamondReward || 0,
          loreText: nextMission.loreText || '',
          nextMission: nextMission.nextMission || null,
          progress: 0,
          target: nextMission.objective.count,
          status: 'active',
          expiresAt: null,
          createdAt: new Date(),
        })
      }
    }
  })
}

// ─── Ротація щоденних/тижневих місій ─────────────────────────

export async function rotateDailyMissions(playerId) {
  // Видаляємо старі щоденні (expired)
  const q = query(
    collection(db, 'playerMissions'),
    where('playerId', '==', playerId),
    where('type', '==', 'daily')
  )
  const snap = await getDocs(q)
  const batch = writeBatch(db)

  for (const d of snap.docs) {
    const data = d.data()
    const expires = data.expiresAt?.toDate?.() || new Date(data.expiresAt)
    if (Date.now() > expires.getTime()) {
      batch.delete(d.ref)
    }
  }

  // Додаємо нові 3 щоденні
  const shuffled = [...DEFAULT_DAILY_MISSIONS].sort(() => Math.random() - 0.5)
  for (const mission of shuffled.slice(0, 3)) {
    const ref = doc(collection(db, 'playerMissions'))
    batch.set(ref, {
      playerId,
      missionId: mission.id,
      title: mission.title,
      description: mission.description,
      flavorText: mission.flavorText || '',
      type: 'daily',
      objective: mission.objective,
      reward: mission.reward,
      xpReward: mission.xpReward || 0,
      diamondReward: mission.diamondReward || 0,
      rpReward: mission.rpReward || 0,
      progress: 0,
      target: mission.objective.count,
      status: 'active',
      expiresAt: getEndOfDay(),
      createdAt: new Date(),
    })
  }

  await batch.commit()
}

// ─── Утиліти ─────────────────────────────────────────────────

function getEndOfDay() {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

function getEndOfWeek() {
  const d = new Date()
  const daysUntilSunday = 7 - d.getDay()
  d.setDate(d.getDate() + daysUntilSunday)
  d.setHours(23, 59, 59, 999)
  return d
}
