// ─── Конфігурація 31 поля (Field System — Фаза 9) ───

export const FIELDS_CONFIG = {
  total:         31,
  resourceFields: 12,   // видобуток ресурсів
  ruinFields:     7,    // руїни для штурму
  neutralFields:  12,   // нейтральні / запасні
  refreshHours:   48,   // рефреш кожні 48 год
}

// ─── Типи ресурсних полів ──────────────────────────────────
export const RESOURCE_FIELD_TYPES = {
  energy: {
    name:     'Енергетична свердловина',
    icon:     '⚡',
    color:    '#ffaa00',
    resource: 'energy',
    baseYield: { min: 40, max: 100 }, // per tier1
  },
  bio: {
    name:     'Біогай',
    icon:     '🧬',
    color:    '#00ff88',
    resource: 'bio',
    baseYield: { min: 30, max: 80 },
  },
  crystal: {
    name:     'Кришталева печера',
    icon:     '💎',
    color:    '#00ffff',
    resource: 'crystals',
    baseYield: { min: 10, max: 30 },
  },
  bits: {
    name:     'Вузол даних',
    icon:     '💾',
    color:    '#00aaff',
    resource: 'bits',
    baseYield: { min: 50, max: 120 },
  },
  code: {
    name:     'Кодовий архів',
    icon:     '🔐',
    color:    '#8888ff',
    resource: 'code',
    baseYield: { min: 20, max: 60 },
  },
  gold: {
    name:     'Золоте родовище',
    icon:     '🪙',
    color:    '#ffd700',
    resource: 'gold',
    baseYield: { min: 100, max: 250 },
  },
}

// ─── Тири полів ──────────────────────────────────────────────
export const FIELD_TIERS = {
  1: { multiplier: 1.0, label: 'T1', color: '#00ff88' },
  2: { multiplier: 2.0, label: 'T2', color: '#ffd700' },
  3: { multiplier: 3.5, label: 'T3', color: '#ff4500' },
}

// ─── Стартовий розподіл 31 поля ──────────────────────────────
// Фіксована конфігурація (однакова для всіх груп, але позиції рандомні)
export const FIELD_SEED = [
  // 12 ресурсних полів
  { type: 'resource', resourceType: 'energy',  tier: 1 },
  { type: 'resource', resourceType: 'energy',  tier: 2 },
  { type: 'resource', resourceType: 'energy',  tier: 1 },
  { type: 'resource', resourceType: 'bio',     tier: 1 },
  { type: 'resource', resourceType: 'bio',     tier: 2 },
  { type: 'resource', resourceType: 'bio',     tier: 3 },
  { type: 'resource', resourceType: 'crystal', tier: 1 },
  { type: 'resource', resourceType: 'crystal', tier: 2 },
  { type: 'resource', resourceType: 'bits',    tier: 1 },
  { type: 'resource', resourceType: 'bits',    tier: 2 },
  { type: 'resource', resourceType: 'code',    tier: 1 },
  { type: 'resource', resourceType: 'gold',    tier: 2 },

  // 7 руїн
  { type: 'ruin', tier: 1 },
  { type: 'ruin', tier: 1 },
  { type: 'ruin', tier: 1 },
  { type: 'ruin', tier: 2 },
  { type: 'ruin', tier: 2 },
  { type: 'ruin', tier: 2 },
  { type: 'ruin', tier: 3 },

  // 12 нейтральних
  { type: 'neutral' },
  { type: 'neutral' },
  { type: 'neutral' },
  { type: 'neutral' },
  { type: 'neutral' },
  { type: 'neutral' },
  { type: 'neutral' },
  { type: 'neutral' },
  { type: 'neutral' },
  { type: 'neutral' },
  { type: 'neutral' },
  { type: 'neutral' },
]

// ─── Іконки та кольори для типів полів ────────────────────────
export function getFieldVisual(field) {
  if (field.type === 'neutral') {
    return { icon: '🌫️', color: '#444', name: 'Нейтральне поле' }
  }
  if (field.type === 'ruin') {
    const colors = { 1: '#00ff88', 2: '#ffd700', 3: '#ff4500' }
    const icons  = { 1: '🏚️',     2: '🏗️',     3: '🏰' }
    const names  = { 1: 'Руїна T1', 2: 'Руїна T2', 3: 'Руїна T3' }
    return {
      icon:  icons[field.tier]  || '🏚️',
      color: colors[field.tier] || '#888',
      name:  names[field.tier]  || 'Руїна',
    }
  }
  if (field.type === 'resource') {
    const rt = RESOURCE_FIELD_TYPES[field.resourceType]
    return rt
      ? { icon: rt.icon, color: rt.color, name: rt.name }
      : { icon: '⛏️', color: '#888', name: 'Ресурсне поле' }
  }
  return { icon: '❓', color: '#555', name: 'Невідоме' }
}

// ─── Розрахунок видобутку з поля ─────────────────────────────
export function calcFieldYield(field, extractionBonus = 0) {
  if (field.type !== 'resource') return 0
  const rt = RESOURCE_FIELD_TYPES[field.resourceType]
  if (!rt) return 0
  const tier = FIELD_TIERS[field.tier] || FIELD_TIERS[1]
  const base = Math.floor(
    (rt.baseYield.min + Math.random() * (rt.baseYield.max - rt.baseYield.min)) * tier.multiplier
  )
  return Math.floor(base * (1 + extractionBonus / 100))
}
