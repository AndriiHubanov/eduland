# Eduland — Контекст для нового чату Claude

## Що це за проєкт

**Eduland** — браузерна гра для студентів на парах. Викладач використовує її як інструмент гейміфікації навчання. Студенти будують місто, виконують завдання, торгують ресурсами та змагаються в рейтингу групи.

**Технологічний стек:**
- React 18 + Vite 5, Tailwind CSS 3, Zustand, React Router v6, Firebase 10
- Тільки JavaScript (без TypeScript)
- Firebase Firestore як база даних (клієнт-сайд, без Cloud Functions)

**Дизайн:** пост-апокаліптична тема, шрифти Bebas Neue + Share Tech Mono + Rajdhani
CSS-змінні: `--bg`, `--bg2`, `--bg3`, `--card`, `--border`, `--accent(#ff4500)`, `--neon(#00ff88)`, `--gold`, `--info`, `--text`

---

## Структура проєкту

```
src/
├── components/
│   ├── BattleScreen.jsx   — Анімований екран бою (раунди → результат)   ← ФАЗА 8
│   ├── BuildingCard.jsx   — Картка будівлі (рівень, робітники, апгрейд)
│   ├── CastlePanel.jsx    — Замок: апгрейд, бонуси, ліміт юнітів        ← ФАЗА 8
│   ├── CompletionCard.jsx — Картка виконаного завдання
│   ├── MiningGrid.jsx     — Сітка міста 6×5 (будівлі + видобуток)       ← ФАЗА 7
│   ├── MissionsPanel.jsx  — Місії (щоденні/тижневі/сюжет/досягнення)    ← ФАЗА 8
│   ├── UnitsPanel.jsx     — Юніти: найм, апгрейд, формування армії       ← ФАЗА 8
│   └── UI.jsx             — ResourceBar, XPBar, Spinner, Card, BottomNav тощо
├── firebase/
│   ├── adminService.js    — Операції тільки для адміна
│   ├── battleService.js   — Симуляція бою (ATK/DEF/HP, раунди, жертви)  ← ФАЗА 8
│   ├── castleService.js   — Замки: 5 рівнів × 4 класи, апгрейд           ← ФАЗА 8
│   ├── config.js          — Ініціалізація Firebase (змінні з .env)
│   ├── explorationService.js
│   ├── missionService.js  — Місії: 4 типи, трекінг прогресу, нагороди   ← ФАЗА 8
│   ├── productionService.js
│   ├── ruinService.js     — Руїни 3 тирів: бій, лут, кулдаун            ← ФАЗА 8
│   ├── scienceService.js
│   ├── seasonService.js
│   ├── service.js         — ВСІ базові операції з Firestore
│   ├── surveyService.js   — Опитування: створення, відповіді             ← ФАЗА 8
│   └── unitService.js     — 6 юнітів: найм, апгрейд, формування         ← ФАЗА 8
├── pages/
│   ├── Admin.jsx          — Адмінка (approvals/tasks/stats/surveys)
│   ├── City.jsx           — ГОЛОВНА: одна сторінка з вкладками (🏙️/⚔️/📬) ← ФАЗА 8
│   ├── HeroCreate.jsx     — Створення персонажа
│   ├── Landing.jsx        — Вхід/пошук гравця
│   ├── SurveyPage.jsx     — Психологічні опитування                      ← ФАЗА 8
│   ├── Tasks.jsx          — Завдання (тепер вбудовані в City)
│   ├── Trade.jsx          — Торгівля між гравцями
│   └── WorldMap.jsx       — Карта регіону (10×10, руїни, рейтинг)        ← ФАЗА 8
└── store/
    └── gameStore.js       — Zustand store + константи (GROUPS, HERO_CLASSES, RESOURCE_ICONS)
```

---

## Структура даних Firebase

### Колекції:
- `/players/{playerId}` — дані гравців (`id = {group}_{timestamp}`)
- `/tasks/{taskId}` — завдання (тести + відкриті)
- `/submissions/{id}` — здачі завдань
- `/trades/{id}` — торгові запити
- `/messages/{id}` — повідомлення між гравцями
- `/config/buildings/buildings/{id}` — конфіг будівель
- `/config/disciplines/disciplines/{id}` — конфіг дисциплін
- `/surveys/{id}` — опитування ← ФАЗА 8
- `/surveyResponses/{id}` — відповіді на опитування ← ФАЗА 8

### Структура документа гравця (`/players/{id}`):
```js
{
  id: "PD11_1700000000000",
  name: "Іван Петренко",
  normalizedName: "іван петренко",
  group: "PD11",
  gender: "male",
  heroName: "Залізний Кулак",
  heroClass: "guardian",   // guardian | archivist | detective | coordinator
  heroLevel: 1,
  heroXP: 0,
  heroStats: { intellect: 5, endurance: 8, charisma: 5 },
  resources: { gold: 200, wood: 100, stone: 50, crystals: 0, bits: 0, code: 0 },
  buildings: {
    server:   { level: 1, workers: 0 },
    lab:      { level: 0, workers: 0 },
    tower:    { level: 0, workers: 0 },
    archive:  { level: 0, workers: 0 },
    firewall: { level: 0, workers: 0 },
  },
  workers: { total: 5, placed: 0 },

  // ── Фаза 7: Поле міста ──
  buildingPositions: { server: 2, lab: null },
  resourceMap: { "3": "gold", "7": "bits" },  // 12 прихованих клітинок
  cellStates: {
    "3": { status: "researching", startedAt: Timestamp, endsAt: Timestamp },
    "7": { status: "mine", resource: "bits", mineLevel: 1, lastCollected: Timestamp },
  },

  // ── Фаза 8: Замок + Армія ──
  castle: {
    level: 1,              // 1-5
  },
  units: {
    scout_drone: { count: 2, level: 1 },
    shield_bot:  { count: 1, level: 1 },
  },
  army: {
    formation: ["scout_drone", "shield_bot"],   // до 5 слотів
    power: 150,                                  // сумарна бойова потужність
  },

  // ── Фаза 8: Руїни (кулдауни) ──
  ruinCooldowns: {
    tier1: Timestamp,
    tier2: Timestamp,
    tier3: Timestamp,
  },

  cityPosition: { x: 3, y: 5 },
  lastWorkerReset: Timestamp,
  lastActive: Timestamp,
  createdAt: Timestamp,
}
```

---

## Константи гри

### Ресурси (`RESOURCE_ICONS` в gameStore.js):
```js
gold:     { icon: '🪙', name: 'Золото',  color: '#ffd700' }
wood:     { icon: '🪵', name: 'Деревина', color: '#8B4513' }
stone:    { icon: '🪨', name: 'Камінь',   color: '#808080' }
crystals: { icon: '💎', name: 'Кристали', color: '#00ffff' }
bits:     { icon: '💾', name: 'Біти',     color: '#00aaff' }
code:     { icon: '🔐', name: 'Код',      color: '#00ff88' }
```

### Будівлі (5 штук, конфіг у Firebase `/config/buildings/buildings/`):
| ID | Назва | Іконка | Виробляє | Синергія (2+ робітники) |
|---|---|---|---|---|
| server | Сервер | 🖥️ | bits + gold | +5 bits |
| lab | Лабораторія | 🔬 | bits + code | +3 code |
| tower | Вежа зв'язку | 📡 | code + gold | +5 gold |
| archive | Сховище даних | 🗄️ | bits + stone | +4 bits |
| firewall | Брандмауер | 🛡️ | code + gold | +6 code |

### Класи героїв (`HERO_CLASSES`):
- guardian (🛡️) — +3 Витривалість
- archivist (📋) — +3 Інтелект
- detective (🔍) — +2 Інтелект +1 Харизма
- coordinator (🗺️) — +3 Харизма

### XP рівні: `[0, 100, 250, 450, 700, 1000]` (6 рівнів максимум)

---

## Фаза 8 — Що реалізовано (поточна)

### Нові компоненти:

**`BattleScreen.jsx`** — екран бою після атаки руїни:
- Покроково показує раунди (кожні 800 мс)
- Три результати: ПЕРЕМОГА 🏆 / ПОРАЗКА 💀 / НІЧИЯ ⚔️
- Показує лут, XP, жертви, юнітів що вижили

**`CastlePanel.jsx`** — панель замку в City:
- Назва замку залежить від класу героя (4×5 = 20 унікальних назв)
- Бонуси: workersMax, defenseBoost, researchSpeed, tradeSlots, xpMultiplier (залежать від класу)
- Кнопка апгрейду з вартістю в ресурсах

**`UnitsPanel.jsx`** — панель юнітів в City:
- 2 вкладки: Юніти | Армія
- Вкладка Юніти: найм, деталі (ATK/DEF/HP, спецздібність), апгрейд (рівні 1-3)
- Вкладка Армія: формування (drag-and-drop слотів), показ бойової потужності

**`MissionsPanel.jsx`** — повноекранна панель місій:
- 4 вкладки: Щоденні / Тижневі / Сюжет / Досягнення
- Прогрес-бар для кожної місії
- Кнопка "Забрати" для виконаних місій

### Нові Firebase-сервіси:

**`castleService.js`** — замки:
```js
CASTLE_UPGRADE_COSTS = { 2: { gold: 500, stone: 200 }, 3: {...}, 4: {...}, 5: {...} }
CASTLE_MAX_UNITS = { 1: 3, 2: 5, 3: 8, 4: 12, 5: 15 }
CASTLE_NAMES = { guardian: { 1: 'Бункер', ... }, archivist: {...}, ... }
CASTLE_BONUSES = { guardian: { 1: { workersMax: 1, ... }, ... }, ... }
async upgradeCastle(playerId)
```

**`unitService.js`** — 6 юнітів:
```js
UNITS = {
  scout_drone:   { type: 'dps',     baseHP: 30, baseATK: 25, baseDEF: 5,  special: 'Перший удар' }
  shield_bot:    { type: 'tank',    baseHP: 80, baseATK: 8,  baseDEF: 30, special: 'Блок першої атаки' }
  hack_spider:   { type: 'dps',     baseHP: 25, baseATK: 35, baseDEF: 3,  special: 'Ігнорує 50% DEF' }
  medic_unit:    { type: 'support', baseHP: 40, baseATK: 5,  baseDEF: 15, special: 'Лікує -HP союзника +20/раунд' }
  guardian_core: { type: 'tank',    ... }
  siege_mech:    { type: 'siege',   ..., special: '+50% проти руїн' }
}
async recruitUnit(playerId, unitId)
async upgradeUnit(playerId, unitId)
async setFormation(playerId, formation)  // formation: string[] (unitIds)
```

**`ruinService.js`** — 3 тири руїн:
```js
RUINS = {
  tier1: { icon:'🏚️', cooldownHours: 12, enemyArmy:[...], lootTable:{...}, xpReward: 15 }
  tier2: { icon:'🏗️', cooldownHours: 24, enemyArmy:[...], diamondChance: 0.10, xpReward: 35 }
  tier3: { icon:'🏰', cooldownHours: 48, enemyArmy:[...], diamondChance: 0.25, xpReward: 80 }
}
// RUIN_TEMPLATES: масив { tier, position:{x,y} } — позиції на карті 10×10
async attackRuin(playerId, tier)  // повертає battleData
```

**`battleService.js`** — симуляція:
```js
// Раундова симуляція: ATK/DEF/HP, special abilities, щоб зробити 20 раундів max
simulateBattle(attackers, defenders, heroClass)
// → { result: 'win'|'lose'|'draw', rounds:[...], casualties, survivingAttackers }
async saveBattleResult(playerId, tier, result, loot, xpGain, casualties)
async applyCasualties(playerId, casualties)
```

**`missionService.js`** — місії:
```js
MISSION_TYPES = { daily, weekly, story, achievement }
DEFAULT_DAILY_MISSIONS = [
  { id:'daily_collect_resources', objective:{ action:'collect_mine', count:1 }, reward:{gold:50} }
  { id:'daily_upgrade_building',  objective:{ action:'upgrade_building', count:1 }, reward:{gold:80} }
  { id:'daily_complete_task',     objective:{ action:'complete_task', count:1 }, reward:{gold:100} }
  { id:'daily_trade',             objective:{ action:'trade', count:1 }, reward:{gold:60} }
  ...
]
async initPlayerMissions(playerId)
subscribePlayerMissions(playerId, callback)
async updateMissionProgress(playerId, action)  // викликати після кожної дії
async claimMissionReward(playerId, missionId)
```

**`surveyService.js`** — опитування:
```js
subscribeSurveys(group, callback)
subscribePlayerSurveyResponses(playerId, callback)
canTakeSurvey(playerId, surveyId, responses) → boolean
async submitSurvey(playerId, surveyId, answers, survey)
// Admin:
async createSurvey({ group, title, questions[] })
async deactivateSurvey(surveyId)
async getSurveyResponses(surveyId)
```

### Зміни City.jsx (єдина сторінка):

**Архітектура вкладок:**
```jsx
NAV_ITEMS = [city, map, tasks, inbox, trade]
// Клік на tasks/inbox не переходить на окрему сторінку —
// змінює activeTab в City → рендерить inline Tasks/Inbox
```

**Collapsible секції** (з localStorage):
- Секції: hero, production, workers, buildings, grid, castle, army
- DEFAULT_OPEN = ['hero', 'production', 'buildings', 'castle', 'army']

**Mission progress hooks** — після кожної дії гравця:
```js
updateMissionProgress(playerId, 'collect_mine')
updateMissionProgress(playerId, 'upgrade_building')
updateMissionProgress(playerId, 'complete_task')
// тощо
```

### Зміни WorldMap.jsx:

**Руїни на карті** — відображаються як клітинки `🏚️/🏗️/🏰` поверх гравців за фіксованими позиціями з `RUIN_TEMPLATES`.

**RuinPanel** — слайд-ап з деталями руїни:
- Шанс перемоги (логістична крива від ATK-рейтингу гравця vs руїни):
  ```js
  chance = 100 / (1 + exp(-2.5 * (atkRating/defRating - 1)))
  // кольори: зелений (>60%), золотий (40-60%), червоний (<40%)
  ```
- Лут (діапазони), XP, кулдаун

**BattleScreen** — модальний після атаки.

### Зміни Admin.jsx:

Нова вкладка **Surveys** (опитування):
- Форма створення (title + N питань типу text/scale/choice)
- Список активних опитувань
- Кнопка деактивації
- Перегляд відповідей по гравцях

---

## Реалізовані фази

- ✅ **Фаза 1:** Landing, HeroCreate, Firebase init, City (базова), Admin, всі сторінки
- ✅ **Фаза 2:** Виробництво ресурсів + апгрейди + WorkerResetTimer
- ✅ **Фаза 3:** Завдання (тести + відкриті), CompletionCard, Admin ApprovalsTab/TasksTab
- ✅ **Фаза 4:** Trade (cancel/per-card loading), Inbox (mark all read)
- ✅ **Фаза 5:** WorldMap leaderboard, unread badge global, HeroCreate stat allocation
- ✅ **Фаза 6:** Tasks filter tabs, City level-up modal, Admin StatsTab, BuildingCard next-level preview
- ✅ **Фаза 7:** Поле міста (MiningGrid) — будівлі + дослідження + копальні
- ✅ **Фаза 8:** Замок, Армія (6 юнітів), Руїни, Бій, Місії, Опитування, City single-page з вкладками
- ✅ **Фаза 9:** Система полів (31 поле на групу), захоплення, доходи, рейтинг полів
- ✅ **Фаза 10:** Лабораторії (expeditionService), дослідження полів, бонуси
- ✅ **Фаза 11:** Tech Tree (scienceService) + Місії (missionService) розширення
- ✅ **Фаза 12:** Візуальний polish — анімації, glassmorphism, tile-based WorldMap

---

## НОВИЙ ПЛАН: Фази 13–15 (Візуальний редизайн)

### Концепція
Перехід від карткового UI до **повноцінного ігрового вигляду** у стилі браузерних RTS (MyLands / Legends).
- Стиль міста: **пост-апокаліптичний** (темний, бетон, руїни)
- Стиль карти: **ліс + річки** (зелений, природний)
- Будівлі: поточний набір (server, lab, tower, archive, firewall + castle)
- Зображення: генеруються по запиту (користувач генерує)

---

### Фаза 13 — Visual City Grid (Візуальне місто)

**Мета:** Замінити список карток будівель на **ізометричну/top-down сітку** міста.

**Що буде:**
- Сітка 8×8 клітинок у `City.jsx` (або окремий компонент `CityGrid.jsx`)
- CSS-фон: темний бетон + трава (пост-апок стиль), паркан навколо міста
- Будівлі як **великі emoji-спрайти** (48–64px) + рівень-бейдж + статус робітників
- Якщо є `building.png` зображення → показувати його замість emoji
- Порожні клітинки: темна сітка з ефектом "будувати тут"
- Клік на будівлю → floating card (апгрейд / воркери / інфо), без навігації
- Фіксовані позиції будівель на сітці:
  ```
  castle   → центр (3,3) + (3,4) + (4,3) + (4,4) (2×2)
  server   → (1,1)
  lab      → (6,1)
  tower    → (1,6)
  archive  → (6,6)
  firewall → (1,3)
  ```
- Верхній HUD: ресурси + герой (як зараз)
- Нижня навігаційна панель (як зараз)

**Файли для зміни:**
- `src/pages/City.jsx` — замінити секцію будівель на `<CityGrid />`
- `src/components/CityGrid.jsx` — НОВИЙ файл (сітка)

---

### Фаза 14 — Visual World Map (Карта-терен)

**Мета:** Замінити tile-сітку на **скролабельну карту з терейном** (ліс + річки).

**Що буде:**
- Повноекранний `<div>` з CSS-терейном: зелений ліс + сині річки (SVG або CSS градієнти)
- 31 поле — позиціоновані маркери з **фіксованими координатами** (x%, y%) в межах карти
- Кожен маркер: велика іконка типу поля, назва, власник (якщо є)
- Скрол/pan на мобілі (touch events або CSS overflow)
- Місто гравця — виділене міське місце на карті
- Міста інших гравців групи — менші маркери
- При кліку на поле → existing FieldPanel (вже є)
- Легенда типів полів у куті

**Файли для зміни:**
- `src/pages/WorldMap.jsx` — повний редизайн

---

### Фаза 15 — Фінальний polish + Launch

- Адмін-панель: таблиця гравців з прогресом, CSV-export
- Season 1 balance check
- Performance оптимізація (lazy loading, code splitting)
- Firebase indexes review

---

## Поточний стан: що ще НЕ зроблено / можливі напрями

- **Зображення** для будівель, замків, юнітів — можна генерувати по запиту
- **Ліміт досліджень одночасно** (Lab рів.1 → 1, Рів.2 → 2, Рів.3 → 3)
- **PvP** — гравець проти гравця через WorldMap
- **Нотифікації** — push або in-app
- **Admin**: Firebase offline error fix (done в fix-firebase-offline-error branch)

---

## Ключові патерни кодової бази

### Оновлення Firebase (через dot notation):
```js
await updateDoc(playerRef, {
  [`buildings.${buildingId}.workers`]: newCount,
  [`cellStates.${cellIndex}.lastCollected`]: new Date(),
  lastActive: serverTimestamp(),
})
```

### Транзакції (для атомарних операцій):
```js
await runTransaction(db, async (tx) => {
  const snap = await tx.get(playerRef)
  const player = snap.data()
  // валідація...
  tx.update(playerRef, { ... })
})
```

### Підписки (реальний час):
```js
const unsub = subscribePlayer(playerId, (data) => setPlayer(data))
// cleanup в useEffect return
```

### Слайд-ап панелі (CSS анімація):
```jsx
<div className="fixed bottom-[56px] left-0 right-0 z-40 animate-slide-up">
  ...
</div>
```

### Feedback (success/error повідомлення у City):
```js
showFeedback('success', 'Текст повідомлення')
showFeedback('error', err.message)
```

---

## Для швидкого старту в новому чаті

Скажи Claude:
> "Я розробляю навчальну гру Eduland на React + Firebase. Прочитай файл CONTEXT_FOR_CLAUDE.md у корені проєкту — там повний контекст проєкту, що реалізовано і що я хочу зробити далі. Давай продовжимо з [конкретна задача]."
