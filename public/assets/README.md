# Eduland Game Assets

Помісти сюди згенеровані зображення.
Детальний промпт для генерації — у файлі `/GRAPHICS_PROMPT.md` в корені проєкту.

## Структура папок

```
assets/
├── buildings/          ← Міські будівлі: {id}_{level}.png (512×512px)
│   ├── castle_1.png    ← Замок рівень 1
│   ├── castle_2.png
│   ├── castle_3.png
│   ├── server_1.png
│   ├── server_2.png
│   ├── server_3.png
│   ├── lab_1.png ...
│   ├── tower_1.png ...
│   ├── archive_1.png ...
│   ├── firewall_1.png ...
│   ├── discipline/     ← Дисциплінарні будівлі: {id}_1.png
│   │   ├── greenhouse_1.png
│   │   ├── reactor_1.png
│   │   ├── biolab_1.png
│   │   └── solar_array_1.png
│   └── labs/           ← Лабораторні будівлі: {id}_1.png
│       ├── geolab_1.png
│       ├── extraction_station_1.png
│       ├── assault_base_1.png
│       └── signal_tower_1.png
├── units/              ← Юніти: {id}.png (128×128px)
│   ├── scout_drone.png
│   ├── shield_bot.png
│   ├── hack_spider.png
│   ├── medic_unit.png
│   ├── siege_mech.png
│   ├── guardian_core.png
│   ├── code_phantom.png
│   └── relay_tower.png
├── heroes/             ← Портрети героїв: hero_{class}.png (256×256px)
│   ├── hero_guardian.png
│   ├── hero_archivist.png
│   ├── hero_detective.png
│   └── hero_coordinator.png
├── fields/             ← Маркери полів: field_{type}.png (96×96px)
│   ├── field_energy.png
│   ├── field_bio.png
│   ├── field_crystal.png
│   ├── field_bits.png
│   ├── field_code.png
│   ├── field_gold.png
│   ├── field_ruin_t1.png
│   ├── field_ruin_t2.png
│   ├── field_ruin_t3.png
│   └── field_neutral.png
└── decor/              ← Декоративні елементи: 64×64px
    ├── decor_skull.png
    ├── decor_rock.png
    ├── decor_plant.png
    └── decor_spark.png
```

## Формат

- Усі PNG, прозорий фон
- Будівлі: 512×512px
- Юніти: 128×128px
- Герої: 256×256px
- Поля: 96×96px
- Декор: 64×64px

> Поки зображення відсутні — гра автоматично показує emoji-іконки як fallback.
