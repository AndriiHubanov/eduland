# 🔀 @Git Deploy — Коміти для вранці

## Рекомендовані коміти (по порядку)

### 1. feat(phase8): castle service + constants
```
git add src/firebase/castleService.js src/store/gameStore.js
git commit -m "feat(phase8): add castle service (5 levels per class) + new game constants (bio, energy, diamonds, units, ruins)"
```

### 2. feat(phase8): unit service (8 robot units)
```
git add src/firebase/unitService.js
git commit -m "feat(phase8): add unit service - 8 robot units, recruit/upgrade/formation"
```

### 3. feat(phase8): battle system (MyLands-style)
```
git add src/firebase/battleService.js
git commit -m "feat(phase8): add battle simulation - round-based, specials, initiative system"
```

### 4. feat(phase8): ruins + loot system
```
git add src/firebase/ruinService.js
git commit -m "feat(phase8): add ruin service - 3 tiers, battle+loot+cooldown cycle"
```

### 5. feat(phase8): psychological surveys
```
git add src/firebase/surveyService.js
git commit -m "feat(phase8): add survey service - CRUD, cooldowns, auto-rewards"
```

### 6. docs(phase8): schemas + lore + plan
```
git add docs/ PHASE8_PLAN.md DAILY_LOG.md COMMITS_READY.md
git commit -m "docs(phase8): architecture schemas, ruin lore, 7-day plan, daily log"
```

## Ще НЕ закомічено (потрібно зробити)
- [ ] Оновити `service.js` → createPlayer (castle, diamonds, bio, energy, units, army, battleStats)
- [ ] Оновити `service.js` → approveSubmission (diamonds reward)
- [ ] Seed `natural_science` дисципліну в seedInitialData()
- [ ] Seed 4 нові будівлі (greenhouse, reactor, biolab, solar_array)

### 7. feat(phase9): mission system
```
git add src/firebase/missionService.js
git commit -m "feat(phase9): add mission service - daily/weekly/story/achievements (666 lines)"
```

### 8. docs: wiki + roadmap + image prompts
```
git add docs/WIKI.md docs/ROADMAP_PHASES_9_12.md docs/PHASE8_IMAGE_PROMPTS.md
git commit -m "docs: game wiki, phases 9-12 roadmap, Nano Banana image prompts"
```
