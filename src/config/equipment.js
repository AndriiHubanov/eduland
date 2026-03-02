// ─── Конфігурація спорядження героя (8 наборів × 6 слотів) ───

export const EQUIPMENT_SLOTS = ['head', 'torso', 'arms', 'legs', 'accessory', 'neuromodule']

export const SLOT_LABELS = {
  head:        'Голова',
  torso:       'Торс',
  arms:        'Руки',
  legs:        'Ноги',
  accessory:   'Аксесуар',
  neuromodule: 'Нейромодуль',
}

export const SLOT_ICONS = {
  head:        '🪖',
  torso:       '🦺',
  arms:        '🥊',
  legs:        '👢',
  accessory:   '🔩',
  neuromodule: '💾',
}

// 8 тематичних наборів
export const EQUIPMENT_SETS = {
  cyber_miner: {
    name:        'Cyber-Miner',
    icon:        '⛏️',
    color:       '#ffd700',
    description: 'Шахтарський набір — підвищує видобуток Бітів',
    items: {
      head:        { name: 'Шахтарський Візор',    bonus: { bits_production: 0.05 } },
      torso:       { name: 'Бронежилет Бурівника', bonus: { endurance: 1 } },
      arms:        { name: 'Кігті Шахтаря',        bonus: { bits_production: 0.05 } },
      legs:        { name: 'Чоботи Руди',          bonus: { stone_production: 0.05 } },
      accessory:   { name: 'Ядро Свердла',         bonus: { bits_production: 0.05 } },
      neuromodule: { name: 'ScanChip',             bonus: { intellect: 1 } },
    },
    setBonus: { bits_production: 0.25, description: '+25% виробництво Бітів' },
  },

  void_stalker: {
    name:        'Void Stalker',
    icon:        '👁️',
    color:       '#00aaff',
    description: 'Розвідувальний набір — зменшує час сканування',
    items: {
      head:        { name: 'Окуляри Пустоти',    bonus: { scout_speed: 0.1 } },
      torso:       { name: 'Плащ Тіні',          bonus: { charisma: 1 } },
      arms:        { name: 'Рукавиці Привида',   bonus: { scout_speed: 0.1 } },
      legs:        { name: 'Поножі Безшумності', bonus: { scout_speed: 0.1 } },
      accessory:   { name: 'Маяк Сигналу',       bonus: { scout_speed: 0.1 } },
      neuromodule: { name: 'NavChip',            bonus: { intellect: 1 } },
    },
    setBonus: { scout_speed: 0.4, description: '-40% час розвідки' },
  },

  neon_knight: {
    name:        'Neon Knight',
    icon:        '⚔️',
    color:       '#ff4500',
    description: 'Бойовий набір — посилює атаку у руїнах',
    items: {
      head:        { name: 'Шолом Неонового Лицаря', bonus: { endurance: 1 } },
      torso:       { name: 'Броня Лицаря',           bonus: { endurance: 2 } },
      arms:        { name: 'Клинки Неону',           bonus: { attack_bonus: 0.05 } },
      legs:        { name: 'Поножі Захисника',       bonus: { endurance: 1 } },
      accessory:   { name: 'Варп-Генератор',         bonus: { attack_bonus: 0.05 } },
      neuromodule: { name: 'CombatChip',            bonus: { endurance: 1 } },
    },
    setBonus: { attack_bonus: 0.3, description: '+30% ATK у боях' },
  },

  bio_weaver: {
    name:        'Bio-Weaver',
    icon:        '🧬',
    color:       '#00ff88',
    description: 'Біотехнологічний набір — виробництво Біо',
    items: {
      head:        { name: 'Органічний Шолом',   bonus: { bio_production: 0.05 } },
      torso:       { name: 'Симбіотична Броня',  bonus: { bio_production: 0.05 } },
      arms:        { name: 'Плющові Рукавиці',   bonus: { bio_production: 0.05 } },
      legs:        { name: 'Грибні Поножі',      bonus: { wood_production: 0.05 } },
      accessory:   { name: 'Споровий Реактор',   bonus: { bio_production: 0.05 } },
      neuromodule: { name: 'BioChip',            bonus: { intellect: 1 } },
    },
    setBonus: { bio_production: 0.25, description: '+25% виробництво Біо' },
  },

  code_phantom: {
    name:        'Code Phantom',
    icon:        '🔐',
    color:       '#8888ff',
    description: 'Хакерський набір — виробництво Коду',
    items: {
      head:        { name: 'Нейроінтерфейс',   bonus: { code_production: 0.05 } },
      torso:       { name: 'Цифровий Плащ',    bonus: { code_production: 0.05 } },
      arms:        { name: 'Рукавиці Хакера',  bonus: { code_production: 0.05 } },
      legs:        { name: 'Сервоноги',        bonus: { code_production: 0.05 } },
      accessory:   { name: 'Декодер',          bonus: { bits_production: 0.05 } },
      neuromodule: { name: 'HackChip',         bonus: { intellect: 2 } },
    },
    setBonus: { code_production: 0.25, description: '+25% виробництво Коду' },
  },

  solar_sentinel: {
    name:        'Solar Sentinel',
    icon:        '☀️',
    color:       '#ffaa00',
    description: 'Енергетичний набір — виробництво Енергії',
    items: {
      head:        { name: 'Сонячний Шолом',    bonus: { energy_production: 0.05 } },
      torso:       { name: 'Фотонна Броня',     bonus: { energy_production: 0.05 } },
      arms:        { name: 'Плазмові Рукавиці', bonus: { energy_production: 0.05 } },
      legs:        { name: 'Реактивні Поножі',  bonus: { energy_production: 0.05 } },
      accessory:   { name: 'Сонячна Батарея',   bonus: { energy_production: 0.08 } },
      neuromodule: { name: 'SolarChip',         bonus: { charisma: 1 } },
    },
    setBonus: { energy_production: 0.3, description: '+30% виробництво Енергії' },
  },

  iron_archon: {
    name:        'Iron Archon',
    icon:        '🛡️',
    color:       '#c0c0c0',
    description: 'Захисний набір — збільшує надходження Золота',
    items: {
      head:        { name: 'Залізна Корона',     bonus: { gold_production: 0.05 } },
      torso:       { name: 'Сталева Кіраса',     bonus: { gold_production: 0.05 } },
      arms:        { name: 'Титанові Рукавиці',  bonus: { endurance: 1 } },
      legs:        { name: 'Залізні Поножі',     bonus: { gold_production: 0.05 } },
      accessory:   { name: 'Архонський Кристал', bonus: { gold_production: 0.05 } },
      neuromodule: { name: 'ArmorChip',          bonus: { endurance: 2 } },
    },
    setBonus: { gold_production: 0.25, description: '+25% виробництво Золота' },
  },

  crystal_shard: {
    name:        'Crystal Shard',
    icon:        '💎',
    color:       '#00ffff',
    description: 'Кристалічний набір — видобуток рідкісних ресурсів',
    items: {
      head:        { name: 'Кристалічна Корона', bonus: { crystals_production: 0.08 } },
      torso:       { name: 'Шардова Броня',      bonus: { crystals_production: 0.08 } },
      arms:        { name: 'Кристалічні Кігті',  bonus: { crystals_production: 0.08 } },
      legs:        { name: 'Призматичні Поножі', bonus: { crystals_production: 0.08 } },
      accessory:   { name: 'Ядро Призми',        bonus: { crystals_production: 0.10 } },
      neuromodule: { name: 'CrystalChip',        bonus: { intellect: 2 } },
    },
    setBonus: { crystals_production: 0.50, description: '+50% виробництво Кристалів' },
  },
}

// Утиліти
export function itemId(setId, slot) {
  return `${setId}_${slot}`
}

export function parseItemId(id) {
  const parts = id.split('_')
  const slot  = parts.pop()
  return { setId: parts.join('_'), slot }
}

export function getAllItemIds() {
  return Object.keys(EQUIPMENT_SETS).flatMap(setId =>
    EQUIPMENT_SLOTS.map(slot => itemId(setId, slot))
  )
}

// Підрахунок бонусів від поточного спорядження
export function calcEquipmentBonuses(inventory) {
  if (!inventory) return {}
  const equipped = inventory.equipped || {}
  const bonuses  = {}

  for (const slot of EQUIPMENT_SLOTS) {
    const id = equipped[slot]
    if (!id) continue
    const { setId, slot: s } = parseItemId(id)
    const set  = EQUIPMENT_SETS[setId]
    if (!set) continue
    const item = set.items[s]
    if (!item) continue
    for (const [key, val] of Object.entries(item.bonus || {})) {
      bonuses[key] = (bonuses[key] || 0) + val
    }
  }

  // Перевірка повних наборів
  for (const [setId, set] of Object.entries(EQUIPMENT_SETS)) {
    const fullSet = EQUIPMENT_SLOTS.every(slot => equipped[slot] === itemId(setId, slot))
    if (fullSet) {
      for (const [key, val] of Object.entries(set.setBonus || {})) {
        if (typeof val === 'number') bonuses[key] = (bonuses[key] || 0) + val
      }
    }
  }

  return bonuses
}

// Кількість предметів набору у гравця
export function countSetItems(inventory, setId) {
  const items = inventory?.items || []
  return EQUIPMENT_SLOTS.filter(slot => items.includes(itemId(setId, slot))).length
}
