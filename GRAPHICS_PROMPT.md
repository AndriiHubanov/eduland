# GRAPHICS_PROMPT — Eduland Game Assets (Phase 16)

> Цей файл містить промпти для генерації всієї графіки гри.
> Стиль: **постапокаліптичний кіберпанк**, темна палітра, ізометрія або вид зверху-під-кутом.
> Формат: PNG з прозорим фоном, 512×512px для будівель, 128×128px для маркерів/юнітів/іконок.

---

## ЗАГАЛЬНИЙ СТИЛЬ (додавай до кожного промпту)

```
Style: post-apocalyptic cyberpunk game asset, dark concrete and rust aesthetic,
green neon accents (#00ff88), orange warning lights (#ff6600), blue data streams (#00aaff),
isometric or 3/4 top-down view, clean black transparent background,
detailed pixel-art or stylized painted illustration, game UI icon quality,
no text, no watermarks.
```

---

## 1. БУДІВЛІ МІСТА (City Grid — 7×7 map)

> Кожна будівля — 3 рівні (Level 1 = маленька/базова, Level 2 = середня, Level 3 = велика/прокачана)
> Розмір: 512×512px PNG, transparent background
> Підпапка: `public/assets/buildings/`

---

### 1.1 ЗАМОК (Castle) — центральна 2×2 будівля

```
[LEVEL 1] post-apocalyptic bunker castle, reinforced concrete fortress with cyberpunk elements,
small fortified walls, glowing green energy shields, surveillance cameras, makeshift battlements,
dark weathered concrete, orange emergency lights, isometric view, 512x512, transparent background,
game asset style

[LEVEL 2] post-apocalyptic cyberpunk castle, medium-sized reinforced fortress, concrete walls
with metal plating, green energy barriers, radar towers, multiple guard posts, neon lights,
cracked but reinforced structure, isometric view, 512x512, transparent background, game asset

[LEVEL 3] massive post-apocalyptic cyber-fortress, large castle with advanced defensive systems,
multiple towers, glowing green energy shields, satellite dishes, armed battlements, holographic
projections, dominant structure, imposing and powerful, isometric view, 512x512, transparent background
```

Файли: `castle_1.png`, `castle_2.png`, `castle_3.png`

---

### 1.2 СЕРВЕР (Server Hub)

```
[LEVEL 1] small post-apocalyptic server room, salvaged computer racks in concrete bunker,
blinking blue LEDs, bundled cables, cooling fans, rusted metal doors,
isometric view, 512x512, transparent background, game asset

[LEVEL 2] medium cyberpunk server complex, multiple server towers with blue neon lighting,
holographic data streams, secure blast doors, cable management system, heat vents,
isometric view, 512x512, transparent background, game asset

[LEVEL 3] large post-apocalyptic data center, massive server arrays with blue glowing lights,
floating holographic dashboards, armored exterior, multiple access terminals,
industrial scale data processing hub, isometric view, 512x512, transparent background
```

Файли: `server_1.png`, `server_2.png`, `server_3.png`

---

### 1.3 ЛАБОРАТОРІЯ (Lab)

```
[LEVEL 1] small makeshift laboratory, salvaged scientific equipment, bubbling vials,
holographic microscope screen, concrete walls with greenish chemical glow,
post-apocalyptic science station, isometric view, 512x512, transparent background

[LEVEL 2] medium cyberpunk research lab, multiple workstations, chemical synthesis equipment,
holographic displays showing DNA/code patterns, green neon accents, sealed glass chambers,
isometric view, 512x512, transparent background, game asset

[LEVEL 3] large advanced post-apocalyptic laboratory complex, multiple research wings,
advanced synthesis chambers, AI-assisted research terminals, green and blue neon lighting,
high-tech scientific facility in ruins but functional, isometric view, 512x512, transparent background
```

Файли: `lab_1.png`, `lab_2.png`, `lab_3.png`

---

### 1.4 ВЕЖА ЗВ'ЯЗКУ (Communications Tower)

```
[LEVEL 1] small post-apocalyptic radio tower, makeshift antenna on concrete base,
orange warning light on top, wires and cables, basic signal equipment,
isometric view, 512x512, transparent background, game asset

[LEVEL 2] medium cyberpunk communications tower, multi-band antenna array,
blinking signal lights, transmission dishes, armored base with electronics,
data transmission beams effect, isometric view, 512x512, transparent background

[LEVEL 3] tall advanced post-apocalyptic broadcast tower, massive antenna complex,
multiple satellite dishes, holographic signal visualizer, long-range radar,
neon-lit transmission tower dominating the skyline, isometric view, 512x512, transparent background
```

Файли: `tower_1.png`, `tower_2.png`, `tower_3.png`

---

### 1.5 СХОВИЩЕ ДАНИХ (Data Archive)

```
[LEVEL 1] small fortified data vault, reinforced concrete bunker with data storage units,
secured access door, small glowing data indicators, post-apocalyptic archive,
isometric view, 512x512, transparent background, game asset

[LEVEL 2] medium cyberpunk data repository, armored storage facility, multiple vault doors,
holographic data catalog display, blue scanning beams, organized data drives visible through glass,
isometric view, 512x512, transparent background, game asset

[LEVEL 3] large high-security post-apocalyptic data archive, massive reinforced structure,
multiple secured floors visible, holographic inventory system, laser grid security,
the ultimate data preservation vault, isometric view, 512x512, transparent background
```

Файли: `archive_1.png`, `archive_2.png`, `archive_3.png`

---

### 1.6 БРАНДМАУЕР (Firewall Defense)

```
[LEVEL 1] small post-apocalyptic defensive barrier system, concrete wall with electronic
surveillance nodes, small energy projectors, basic firewall tower with glowing orange shields,
isometric view, 512x512, transparent background, game asset

[LEVEL 2] medium cyberpunk firewall installation, reinforced defensive wall with energy shield
generators, multiple sensor arrays, orange-red warning lights, electronic countermeasure pods,
isometric view, 512x512, transparent background, game asset

[LEVEL 3] advanced post-apocalyptic firewall fortress, massive defensive structure with layered
energy shields, EMP cannons, network intrusion detection systems, orange-red energy barriers,
impenetrable cyber-defense installation, isometric view, 512x512, transparent background
```

Файли: `firewall_1.png`, `firewall_2.png`, `firewall_3.png`

---

## 2. ДИСЦИПЛІНАРНІ БУДІВЛІ (Production Buildings)

> Розмір: 256×256px або 512×512px PNG, transparent background
> Підпапка: `public/assets/buildings/discipline/`

### 2.1 ТЕПЛИЦЯ (Greenhouse)

```
post-apocalyptic greenhouse, salvaged glass structure with mutated plants growing inside,
bioluminescent flora, green neon glow from vegetation, cracked glass patched with metal,
overgrown but cultivated, isometric view, 512x512, transparent background, game asset
```

### 2.2 РЕАКТОР (Reactor)

```
post-apocalyptic energy reactor, compact nuclear/plasma reactor with glowing core,
armored containment vessel, orange-red energy glow, steam vents, warning symbols,
surrounded by protective barriers, isometric view, 512x512, transparent background, game asset
```

### 2.3 БІОЛАБОРАТОРІЯ (Biolab)

```
post-apocalyptic biolab, biological research facility with tanks of green liquid,
DNA strand holograms, biohazard containment pods, green and teal neon lighting,
specialized research equipment, isometric view, 512x512, transparent background, game asset
```

### 2.4 СОНЯЧНА БАТАРЕЯ (Solar Array)

```
post-apocalyptic solar power array, salvaged solar panels on concrete base,
partially damaged but operational, energy storage batteries, blue-white solar cells,
power distribution cables, isometric view, 512x512, transparent background, game asset
```

Файли: `greenhouse_1.png`, `reactor_1.png`, `biolab_1.png`, `solar_array_1.png`

---

## 3. ЛАБОРАТОРНІ БУДІВЛІ (Expedition/Map Buildings)

> Розмір: 256×256px PNG, transparent background
> Підпапка: `public/assets/buildings/labs/`

### 3.1 ГЕОЛАБ (Geolab — Field Scout)
```
post-apocalyptic geological survey station, ground-penetrating radar equipment,
compact scout vehicle nearby, holographic terrain map display, brown/grey dust aesthetic,
isometric view, 256x256, transparent background, game icon
```

### 3.2 ЕКСТРАКЦІЙНА СТАНЦІЯ (Extraction Station)
```
post-apocalyptic resource extraction station, industrial drilling equipment, resource
collection tanks, mechanical crane, conveyor belt, steampunk-cyberpunk hybrid aesthetic,
isometric view, 256x256, transparent background, game icon
```

### 3.3 ШТУРМОВА БАЗА (Assault Base)
```
post-apocalyptic military assault base, armored vehicle bay, weapon storage,
tactical operations center, red warning lights, military-industrial aesthetic,
isometric view, 256x256, transparent background, game icon
```

### 3.4 СИГНАЛЬНА ВЕЖА (Signal Tower)
```
post-apocalyptic signal relay tower, compact communication tower with rotating dish,
signal amplifiers, electronic countermeasures, white/blue signal pulse effect,
isometric view, 256x256, transparent background, game icon
```

Файли: `geolab_1.png`, `extraction_station_1.png`, `assault_base_1.png`, `signal_tower_1.png`

---

## 4. ЮНІТИ (Army / Battle Units)

> Розмір: 128×128px PNG, transparent background
> Підпапка: `public/assets/units/`
> Стиль: top-down або 3/4 view, consistent scale

```
[scout_drone] flying reconnaissance drone, circular body with camera eye, small weapons,
blue scanning beam, post-apocalyptic cyberpunk style, 128x128, transparent background, game unit icon

[shieldbot] humanoid robot with massive energy shield, heavy armor plating, green shield glow,
defensive combat robot, orange power core, 128x128, transparent background, game unit icon

[hacker_spider] spider-shaped hacking robot, 6-8 legs, central computer core body,
data injection needles, black and green color scheme, sinister AI design,
128x128, transparent background, game unit icon

[medic_module] hovering medical support robot, white and green colors, healing beams,
medical cross symbol, repair arms, gentle neon glow, 128x128, transparent background, game unit icon

[siege_mech] massive bipedal siege mech, heavy armor, missile launchers, energy cannon arm,
powerful war machine, dark grey and orange, imposing stance,
128x128, transparent background, game unit icon

[guardian_core] floating energy sphere with protective aura, crystalline blue-green core,
orbiting defensive drones, ancient meets cyberpunk design, defensive glow,
128x128, transparent background, game unit icon

[code_phantom] ghost-like hacker entity, translucent digital body, code streams visible,
ghostly cyan-green color, unsettling AI specter, intangible but deadly,
128x128, transparent background, game unit icon

[relay_tower] compact automated relay tower unit, signal transmitter on tracked base,
support equipment, communication dishes, white-blue signal waves,
128x128, transparent background, game unit icon
```

Файли: `scout_drone.png`, `shieldbot.png`, `hacker_spider.png`, `medic_module.png`,
`siege_mech.png`, `guardian_core.png`, `code_phantom.png`, `relay_tower.png`

---

## 5. КЛАСИ ГЕРОЇВ (Hero Class Portraits)

> Розмір: 256×256px PNG, transparent background або круглий портрет
> Підпапка: `public/assets/heroes/`

```
[guardian] post-apocalyptic guardian warrior, heavy cyberpunk armor, energy shield,
face partially visible in helmet, defender of the bunker, dark heroic pose,
close-up portrait or bust, orange-red color scheme, 256x256, transparent background

[archivist] post-apocalyptic archivist, long coat with data storage devices, holographic
book/database interface, intelligent face, blue-white color scheme, keeper of knowledge,
close-up portrait or bust, 256x256, transparent background

[detective] post-apocalyptic detective, trench coat with cyberpunk gadgets, magnifying glass
replaced by holographic scanner, sharp eyes, investigative pose,
blue-grey color scheme, 256x256, transparent background

[coordinator] post-apocalyptic coordinator/trader, charismatic figure with communication gear,
trade routes hologram display, gold and brown color scheme, confident leader,
close-up portrait or bust, 256x256, transparent background
```

Файли: `hero_guardian.png`, `hero_archivist.png`, `hero_detective.png`, `hero_coordinator.png`

---

## 6. МАРКЕРИ ПОЛІВ (World Map Field Markers)

> Розмір: 96×96px PNG, transparent background (буде показано в колі 44px)
> Підпапка: `public/assets/fields/`

```
[field_energy] glowing energy well icon, electric plasma vortex, yellow-orange glow,
post-apocalyptic power node, top-down view, 96x96, transparent background

[field_bio] bioluminescent plant cluster icon, mutated glowing vegetation,
green organic growth, sci-fi biome marker, top-down view, 96x96, transparent background

[field_crystal] crystal cave entrance icon, glowing cyan crystals emerging from ground,
geometric crystal formation, top-down view, 96x96, transparent background

[field_bits] data server node icon, compact glowing server with blue data streams,
digital data well, top-down view, 96x96, transparent background

[field_code] locked data vault icon, sealed bunker with code/encryption symbols,
purple glowing lock mechanism, top-down view, 96x96, transparent background

[field_gold] gold vein/deposit icon, shimmering gold material in cracked ground,
wealth cache marker, yellow-gold glow, top-down view, 96x96, transparent background

[field_ruin_t1] light ruins marker, partially collapsed small building, green overgrowth,
accessible ruins, top-down view, 96x96, transparent background

[field_ruin_t2] medium fortress ruins marker, damaged but imposing structure,
golden structural elements, contested territory, top-down view, 96x96, transparent background

[field_ruin_t3] massive fortress ruins marker, dominant ruined stronghold,
red danger glow, heavily fortified ruins, top-down view, 96x96, transparent background

[field_neutral] neutral territory marker, empty wasteland patch, grey/brown tones,
featureless ground, top-down view, 96x96, transparent background
```

Файли: `field_energy.png`, `field_bio.png`, `field_crystal.png`, `field_bits.png`,
`field_code.png`, `field_gold.png`, `field_ruin_t1.png`, `field_ruin_t2.png`,
`field_ruin_t3.png`, `field_neutral.png`

---

## 7. ДЕКОРАТИВНІ ЕЛЕМЕНТИ (City Grid Decorations)

> Розмір: 64×64px PNG, transparent background
> Підпапка: `public/assets/decor/`

```
[skull] post-apocalyptic skull icon, stylized weathered skull with cracks,
dark gritty style, 64x64, transparent background

[rock] cracked concrete rubble/rock chunk, grey weathered stone,
64x64, transparent background

[plant] small mutated plant/weeds growing through concrete,
post-apocalyptic green growth, 64x64, transparent background

[spark] electrical spark/lightning hazard, warning sign,
orange-yellow electrical discharge, 64x64, transparent background

[path_h] horizontal cracked concrete path tile for city grid,
post-apocalyptic road/walkway, top-down view, 64x64, transparent background

[path_v] vertical cracked concrete path tile, post-apocalyptic road,
top-down view, 64x64, transparent background

[terrain] post-apocalyptic wasteland ground tile, dark cracked earth,
rubble and ash, seamless tile, top-down view, 64x64, transparent background
```

Файли: `decor_skull.png`, `decor_rock.png`, `decor_plant.png`, `decor_spark.png`,
`path_h.png`, `path_v.png`, `terrain_base.png`

---

## ПІДСУМОК ФАЙЛІВ

```
public/assets/
├── buildings/
│   ├── castle_1.png, castle_2.png, castle_3.png
│   ├── server_1.png, server_2.png, server_3.png
│   ├── lab_1.png, lab_2.png, lab_3.png
│   ├── tower_1.png, tower_2.png, tower_3.png
│   ├── archive_1.png, archive_2.png, archive_3.png
│   ├── firewall_1.png, firewall_2.png, firewall_3.png
│   └── discipline/
│       ├── greenhouse_1.png, reactor_1.png, biolab_1.png, solar_array_1.png
│   └── labs/
│       ├── geolab_1.png, extraction_station_1.png, assault_base_1.png, signal_tower_1.png
├── units/
│   ├── scout_drone.png, shieldbot.png, hacker_spider.png, medic_module.png
│   ├── siege_mech.png, guardian_core.png, code_phantom.png, relay_tower.png
├── heroes/
│   ├── hero_guardian.png, hero_archivist.png, hero_detective.png, hero_coordinator.png
├── fields/
│   ├── field_energy.png, field_bio.png, field_crystal.png, field_bits.png
│   ├── field_code.png, field_gold.png, field_ruin_t1.png, field_ruin_t2.png
│   ├── field_ruin_t3.png, field_neutral.png
└── decor/
    ├── decor_skull.png, decor_rock.png, decor_plant.png, decor_spark.png
    ├── path_h.png, path_v.png, terrain_base.png
```

**Разом:** ~57 файлів

---

## ПРІОРИТЕТИ ГЕНЕРАЦІЇ

**Пріоритет 1 (найвідчутніший ефект):**
- castle_1/2/3 (центральна будівля міста)
- server_1, lab_1, tower_1, archive_1, firewall_1 (місто)
- 4 класи героїв (вибір персонажа)

**Пріоритет 2:**
- Всі 8 юнітів
- Поля (field_energy, field_bio, field_ruin_t1/t2/t3)

**Пріоритет 3:**
- Рівні 2 та 3 для основних будівель
- Дисциплінарні та лабораторні будівлі
- Декоративні елементи

---

## ПРО ФАЗУ 16

Як тільки матимеш картинки, в новому чаті скажи:
> "Фаза 16: маю картинки в `public/assets/`. Прочитай CONTEXT_FOR_NEXT_SESSION.md і реалізуй підключення графіки."

Claude замінить emoji на `<img>` теги у:
- `src/components/CityGrid.jsx` — будівлі міста
- `src/pages/WorldMap.jsx` → `FieldMarker` — маркери полів
- `src/pages/HeroCreate.jsx` — портрети героїв
- `src/components/BattleScreen.jsx` — іконки юнітів
