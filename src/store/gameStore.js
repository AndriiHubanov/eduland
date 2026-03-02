// ─── Zustand Store ───
// Глобальний стейт гри

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Константи гри
export const GROUPS = {
  SOB:  { label: 'СОБ',   name: 'Секретарі' },
  SOI:  { label: 'СОІ',   name: 'Секретарі' },
  PD11: { label: 'ПД-11', name: 'Правоохоронці' },
  PD12: { label: 'ПД-12', name: 'Правоохоронці' },
  PD13: { label: 'ПД-13', name: 'Правоохоронці' },
}

export const HERO_CLASSES = {
  guardian: {
    name: 'Страж',
    icon: '🛡️',
    description: 'Захисник бункеру. +3 Витривалість',
    statBonus: { endurance: 3 },
    resourceBonus: { bits: 0.1 },
  },
  archivist: {
    name: 'Архіваріус',
    icon: '📋',
    description: 'Майстер документів. +3 Інтелект',
    statBonus: { intellect: 3 },
    resourceBonus: { code: 0.1 },
  },
  detective: {
    name: 'Детектив',
    icon: '🔍',
    description: 'Шукач інформації. +2 Інтелект +1 Харизма',
    statBonus: { intellect: 2, charisma: 1 },
    resourceBonus: { bits: 0.15, code: 0.1 },
  },
  coordinator: {
    name: 'Координатор',
    icon: '🗺️',
    description: 'Організатор торгівлі. +3 Харизма',
    statBonus: { charisma: 3 },
    resourceBonus: { gold: 0.15 },
  },
}

// Іконки ресурсів
export const RESOURCE_ICONS = {
  gold:     { icon: '🪙', name: 'Золото',    color: '#ffd700' },
  wood:     { icon: '🪵', name: 'Деревина',  color: '#8B4513' },
  stone:    { icon: '🪨', name: 'Камінь',    color: '#808080' },
  crystals: { icon: '💎', name: 'Кристали',  color: '#00ffff' },
  bits:     { icon: '💾', name: 'Біти',      color: '#00aaff' },
  code:     { icon: '🔐', name: 'Код',       color: '#00ff88' },
  bio:      { icon: '🧬', name: 'Біоматерія', color: '#00ff88' },
  energy:   { icon: '⚡', name: 'Енергія',   color: '#ffaa00' },
}

// Діаманти (окремо від ресурсів)
export const DIAMOND_ICON = { icon: '💠', name: 'Діаманти', color: '#b9f2ff' }

// ─── ЮНІТИ (Фаза 8) ──────────────────────────────────────────

export const UNIT_TYPES = {
  tank:    { name: 'Танк',     color: '#4488ff' },
  dps:     { name: 'Атакуючий', color: '#ff4444' },
  support: { name: 'Підтримка', color: '#44ff88' },
}

// ─── РУЇНИ (Фаза 8) ──────────────────────────────────────────

export const RUIN_TIERS = {
  1: { name: 'Легка',    icon: '🏚️', color: '#00ff88', label: '🟢' },
  2: { name: 'Середня',  icon: '🏗️', color: '#ffd700', label: '🟡' },
  3: { name: 'Важка',    icon: '🏰', color: '#ff4500', label: '🔴' },
}

// ─── ЗАМОК (Фаза 8) ──────────────────────────────────────────

export const CASTLE_ICONS = {
  1: '🏠', 2: '🏡', 3: '🏰', 4: '🏯', 5: '👑',
}

// ─── ПРИРОДНИЧІ БУДІВЛІ (Фаза 8) ────────────────────────────

export const NATURAL_BUILDINGS = {
  greenhouse:  { name: 'Теплиця',            icon: '🌿', produces: 'bio + wood' },
  reactor:     { name: 'Реактор',            icon: '⚛️', produces: 'energy + crystals' },
  biolab:      { name: 'Біолабораторія',     icon: '🧬', produces: 'bio + code' },
  solar_array: { name: 'Сонячна батарея',    icon: '☀️', produces: 'energy + gold' },
}

// XP для рівнів
export const XP_FOR_LEVEL = [0, 80, 200, 380, 620, 950]

export function getHeroLevel(xp) {
  let level = 1
  for (let i = 1; i < XP_FOR_LEVEL.length; i++) {
    if (xp >= XP_FOR_LEVEL[i]) level = i + 1
    else break
  }
  return Math.min(level, XP_FOR_LEVEL.length)
}

export function getXPProgress(xp) {
  const level = getHeroLevel(xp)
  const currentLevelXP = XP_FOR_LEVEL[level - 1]
  const nextLevelXP    = XP_FOR_LEVEL[level] || XP_FOR_LEVEL[XP_FOR_LEVEL.length - 1]
  const progress = level >= XP_FOR_LEVEL.length
    ? 100
    : Math.floor(((xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100)
  return { level, progress, current: xp - currentLevelXP, needed: nextLevelXP - currentLevelXP }
}

// ─── Store ────────────────────────────────────────────────────
const useGameStore = create(
  persist(
    (set, get) => ({
      // Поточний гравець
      player: null,
      playerId: null,
      selectedGroup: null,

      // Дані конфігурації (з Firebase)
      disciplines: [],
      buildings: [],

      // Непрочитані повідомлення (лічильник)
      unreadMessages: 0,

      // ─── Дії ───────────────────────────────────────────
      setPlayer: (player) => set({ player, playerId: player?.id || null }),
      setSelectedGroup: (group) => set({ selectedGroup: group }),
      setDisciplines: (disciplines) => set({ disciplines }),
      setBuildings: (buildings) => set({ buildings }),
      setUnreadMessages: (count) => set({ unreadMessages: count }),

      // Оновити ресурси гравця локально (поки немає підписки)
      updatePlayerResources: (resources) =>
        set((state) => ({
          player: state.player ? { ...state.player, resources } : null,
        })),

      // Вийти з гри
      logout: () => set({ player: null, playerId: null, selectedGroup: null }),
    }),
    {
      name: 'eduland-storage',
      // Зберігаємо тільки ID та групу — решта завантажується з Firebase
      partialize: (state) => ({
        playerId: state.playerId,
        selectedGroup: state.selectedGroup,
      }),
    }
  )
)

export default useGameStore
