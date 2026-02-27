# Фаза 8 — Firebase схеми (Архітектор)

Дата: 2026-02-28

---

## 1. CASTLE (Замок)

### Нові поля в `/players/{id}`
```
castle.level           : number (1–5, дефолт 1 при HeroCreate)
castle.builtAt         : Timestamp
castle.skin            : string | null
diamonds               : number (0)
```

### Конфіг `/config/castles/{heroClass}`
```
className, levels.{1-5}: { name, cost, bonus, heroLevelRequired }
```

#### Вартість апгрейду
| Перехід | gold | stone | crystals | bits | code |
|---------|------|-------|----------|------|------|
| 1→2 | 500 | 200 | — | — | — |
| 2→3 | 1200 | 500 | 50 | — | — |
| 3→4 | 3000 | 1000 | 200 | — | 100 |
| 4→5 | 6000 | 2000 | 500 | 500 | 300 |

## 2. UNITS (8 юнітів-роботів)

### Нові поля в `/players/{id}`
```
units: { [unitId]: { count, level } }
army: { formation: [unitId...], power: number }
battleStats: { wins: 0, losses: 0, ruinsCleared: 0 }
```

### 8 юнітів
| ID | Назва | Тип | HP | ATK | DEF |
|----|-------|-----|----|-----|-----|
| scout_drone | Дрон-розвідник | dps | 30 | 25 | 5 |
| shield_bot | Щитобот | tank | 80 | 8 | 30 |
| hack_spider | Хакер-павук | dps | 25 | 35 | 3 |
| medic_unit | Медик-модуль | support | 40 | 5 | 15 |
| siege_mech | Осадний мех | dps | 50 | 40 | 10 |
| guardian_core | Ядро Стражів | tank | 100 | 15 | 40 |
| code_phantom | Код-Фантом | dps | 20 | 45 | 0 |
| relay_tower | Ретрансляційна вежа | support | 35 | 0 | 20 |

## 3. BATTLE (MyLands-стиль)
```
damage = ATK * (1 + classBonus) * random(0.85..1.15) - DEF * 0.5
damage = max(1, floor(damage))
initiative = ATK * 0.3 + DEF * 0.1 + random(0, 10)
Max 10 раундів.
```

## 4. RUINS (3 типи на WorldMap)
```
/config/ruins/{groupId} → ruins: [{ x, y, tier, name, enemyArmy, lootTable, cooldownHours }]
Tier 1 (🟢): 12h, no diamonds
Tier 2 (🟡): 24h, 10% chance 1-2💠
Tier 3 (🔴): 48h, 30% chance 2-5💠
```

## 5. DIAMONDS — тільки за завдання + руїни. Не торгуються.

## 6. BIO + ENERGY
```
resources: { ...existing, bio: 0, energy: 0 }
4 нові будівлі: greenhouse🌿, reactor⚛️, biolab🧬, solar_array☀️
Нова дисципліна: natural_science
```

## 7. SURVEYS (Психологічні опитування)
```
/surveys/{id}: { title, questions[], reward, active, groups[], cooldownDays }
/surveyResponses/{id}: { surveyId, playerId, answers, rewardGiven, completedAt }
Ресурси одразу, без approve. Без XP і diamonds.
```
