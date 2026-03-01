// ─── Wiki — Eduland Game Guide ───
// Вікі для студентів + структурований контекст для AI-агентів

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HERO_CLASSES } from '../store/gameStore'
import { UNITS } from '../firebase/unitService'
import GameImage from '../components/GameImage'
import { heroImg, unitImg } from '../config/assets'

// ─── Дані гри (єдине джерело правди для вікі) ────────────────

const RESOURCES = [
  { id: 'gold',     icon: '🪙', name: 'Золото',       color: '#ffd700', how: 'Виробляється будівлями, нагорода за завдання' },
  { id: 'bits',     icon: '💾', name: 'Біти',          color: '#00aaff', how: 'Сервер, Лабораторія, виконання практичних завдань' },
  { id: 'code',     icon: '🔐', name: 'Код',           color: '#8888ff', how: 'Лабораторія, Вежа, Брандмауер, завдання з тестами' },
  { id: 'bio',      icon: '🧬', name: 'Біоматерія',    color: '#00ff88', how: 'Теплиця, Біолабораторія, завдання з біології' },
  { id: 'energy',   icon: '⚡', name: 'Енергія',       color: '#ffaa00', how: 'Реактор, Сонячна батарея, завдання з фізики' },
  { id: 'crystals', icon: '💎', name: 'Кристали',      color: '#00ffff', how: 'Видобуток на карті, crafting матеріал' },
  { id: 'stone',    icon: '🪨', name: 'Камінь',        color: '#888888', how: 'Сховище даних, crafting матеріал' },
  { id: 'wood',     icon: '🪵', name: 'Деревина',      color: '#8B4513', how: 'Crafting матеріал (поки в резерві)' },
]

const CASTLE_CLASS_NAMES = {
  guardian:    { 1: 'Бункер', 2: 'Укріплений притулок', 3: 'Фортеця Стражів', 4: 'Цитадель Залізної Волі', 5: 'Бастіон Останньої Лінії' },
  archivist:   { 1: 'Архів', 2: 'Бібліотека Кодів', 3: 'Лабораторія Знань', 4: 'Сервер Абсолютної Пам\'яті', 5: 'Сховище Істини' },
  detective:   { 1: 'Штаб розвідки', 2: 'Слідчий центр', 3: 'Обсерваторія Тіней', 4: 'Мережа Всевидячих', 5: 'Око Бурі' },
  coordinator: { 1: 'Комунікаційний пост', 2: 'Командний вузол', 3: 'Координаційна башта', 4: 'Нексус Зв\'язку', 5: 'Центр Глобального Контролю' },
}

const CITY_BUILDINGS = [
  {
    id: 'castle', name: 'Замок', icon: '🏰', maxLevel: 5,
    description: 'Центральна будівля. Визначає максимальний розмір армії та відкриває функції.',
    levels: [
      { lvl: 1, cost: 'старт',                                          unlocks: 'Базові функції, армія до 3 юнітів' },
      { lvl: 2, cost: '500🪙 + 200🪨',                                  unlocks: 'Армія до 5, торгівля (Координатор)' },
      { lvl: 3, cost: '1200🪙 + 500🪨 + 50💎',                          unlocks: 'Армія до 8' },
      { lvl: 4, cost: '3000🪙 + 1000🪨 + 200💎 + 100🔐',               unlocks: 'Армія до 12' },
      { lvl: 5, cost: '6000🪙 + 2000🪨 + 500💎 + 500💾 + 300🔐',       unlocks: 'Максимальна армія до 15' },
    ],
  },
  {
    id: 'server', name: 'Сервер', icon: '🖥️', maxLevel: 3,
    description: 'Виробляє Біти та Золото. Кожен робітник збільшує виробництво.',
    production: { 1: '5💾 + 2🪙/год', 2: '12💾 + 5🪙/год', 3: '25💾 + 10🪙/год' },
    cost: { 1: '100🪙', 2: '250🪙 + 20💾', 3: '500🪙 + 50💾 + 10🔐' },
    synergy: '2+ робітники → +5💾/год',
  },
  {
    id: 'lab', name: 'Лабораторія', icon: '🔬', maxLevel: 3,
    description: 'Виробляє Біти та Код.',
    production: { 1: '3💾 + 2🔐/год', 2: '7💾 + 5🔐/год', 3: '15💾 + 12🔐/год' },
    cost: { 1: '120🪙', 2: '280🪙 + 15💾', 3: '550🪙 + 40💾 + 15🔐' },
    synergy: '2+ робітники → +3🔐/год',
  },
  {
    id: 'tower', name: 'Вежа зв\'язку', icon: '📡', maxLevel: 3,
    description: 'Виробляє Код та Золото.',
    production: { 1: '4🔐 + 3🪙/год', 2: '10🔐 + 7🪙/год', 3: '20🔐 + 15🪙/год' },
    cost: { 1: '150🪙', 2: '320🪙 + 10🔐', 3: '600🪙 + 25🔐 + 30💾' },
    synergy: '2+ робітники → +5🪙/год',
  },
  {
    id: 'archive', name: 'Сховище даних', icon: '🗄️', maxLevel: 3,
    description: 'Виробляє Біти та Камінь.',
    production: { 1: '4💾 + 3🪨/год', 2: '9💾 + 7🪨/год', 3: '18💾 + 15🪨/год' },
    cost: { 1: '80🪙', 2: '200🪙 + 10💾', 3: '420🪙 + 30💾 + 20🪨' },
    synergy: '2+ робітники → +4💾/год',
  },
  {
    id: 'firewall', name: 'Брандмауер', icon: '🛡️', maxLevel: 3,
    description: 'Виробляє Код та Золото. Захищає місто.',
    production: { 1: '6🔐 + 1🪙/год', 2: '14🔐 + 3🪙/год', 3: '28🔐 + 6🪙/год' },
    cost: { 1: '200🪙 + 5🔐', 2: '400🪙 + 20🔐', 3: '700🪙 + 40🔐 + 20💾' },
    synergy: '2+ робітники → +6🔐/год',
  },
]

const LAB_BUILDINGS_INFO = [
  {
    id: 'geolab', name: 'Геолаб', icon: '🔭', maxLevel: 3,
    purpose: 'Розвідка полів на карті',
    effect: { 1: 'Розвідка 15 хв', 2: '10 хв', 3: '5 хв' },
    cost: { 1: '300🪙 + 50💾', 2: '700🪙 + 120💾 + 30🔐', 3: '1500🪙 + 250💾 + 100🔐' },
  },
  {
    id: 'extraction_station', name: 'Екстракційна станція', icon: '⚗️', maxLevel: 3,
    purpose: 'Видобуток ресурсів із полів',
    effect: { 1: 'Видобуток 30 хв, бонус 0%', 2: '20 хв, бонус +25%', 3: '12 хв, бонус +50%' },
    cost: { 1: '500🪙 + 100🪨', 2: '1200🪙 + 250🪨 + 30💎', 3: '2500🪙 + 500🪨 + 100💎 + 50🧬' },
  },
  {
    id: 'assault_base', name: 'Штурмова база', icon: '🚀', maxLevel: 3,
    purpose: 'Штурм руїн',
    effect: { 1: 'Марш 30 хв', 2: '20 хв', 3: '10 хв' },
    cost: { 1: '800🪙 + 200🪨 + 50🔐', 2: '1800🪙 + 400🪨 + 150🔐 + 50💎', 3: '3500🪙 + 800🪨 + 350🔐 + 200💎' },
  },
  {
    id: 'signal_tower', name: 'Сигнальна вежа', icon: '📡', maxLevel: 3,
    purpose: 'Форс-рефреш поля (1 раз/добу)',
    effect: { 1: '1 рефреш/день', 2: '2/день', 3: '3/день' },
    cost: { 1: '600🪙 + 100💾 + 40🔐', 2: '1400🪙 + 200💾 + 120🔐 + 50⚡', 3: '2800🪙 + 400💾 + 300🔐 + 150⚡' },
  },
]

const NATURE_BUILDINGS = [
  {
    id: 'greenhouse', name: 'Теплиця', icon: '🌿', unlockLevel: 2,
    description: 'Вирощує біоматерію та деревину',
    production: { 1: '4🧬 + 3🪵/год', 2: '10🧬 + 7🪵/год', 3: '20🧬 + 15🪵/год' },
    cost: { 1: '150🪙 + 30🪵', 2: '350🪙 + 15🧬', 3: '700🪙 + 40🧬 + 10⚡' },
    synergy: '2+ робітники → +5🧬/год',
  },
  {
    id: 'reactor', name: 'Реактор', icon: '⚛️', unlockLevel: 2,
    description: 'Генерує енергію та кристали',
    production: { 1: '5⚡ + 2💎/год', 2: '12⚡ + 5💎/год', 3: '25⚡ + 12💎/год' },
    cost: { 1: '200🪙 + 40🪨', 2: '450🪙 + 15⚡ + 30🪨', 3: '900🪙 + 40⚡ + 20💎' },
    synergy: '2+ робітники → +5⚡/год',
  },
  {
    id: 'biolab', name: 'Біолабораторія', icon: '🧬', unlockLevel: 3,
    description: 'Досліджує біоматерію, виробляє Код',
    production: { 1: '3🧬 + 3🔐/год', 2: '8🧬 + 7🔐/год', 3: '16🧬 + 14🔐/год' },
    cost: { 1: '250🪙 + 10🧬', 2: '500🪙 + 25🧬 + 10🔐', 3: '1000🪙 + 50🧬 + 25🔐' },
    synergy: '2+ робітники → +4🔐/год',
  },
  {
    id: 'solar_array', name: 'Сонячна батарея', icon: '☀️', unlockLevel: 2,
    description: 'Перетворює сонячне світло на Енергію та Золото',
    production: { 1: '4⚡ + 3🪙/год', 2: '10⚡ + 7🪙/год', 3: '22⚡ + 15🪙/год' },
    cost: { 1: '180🪙 + 5💎', 2: '400🪙 + 10⚡ + 10💎', 3: '800🪙 + 30⚡ + 25💎' },
    synergy: '2+ робітники → +5🪙/год',
  },
]

const FIELDS_INFO = [
  { type: 'resource', name: 'Ресурсне поле', icon: '⚡🧬💎💾🔐🪙', tiers: 3, action: 'Видобуток (Екстракційна станція рів.1+)', yield: 'T1: 40-100, T2: x2, T3: x3.5' },
  { type: 'ruin',     name: 'Руїна',          icon: '🏚️🏗️🏰',        tiers: 3, action: 'Штурм (Штурмова база рів.1+ + Армія)', yield: 'XP для героя при перемозі' },
  { type: 'neutral',  name: 'Нейтральне',     icon: '🌫️',             tiers: 1, action: 'Немає (активується після рефрешу)', yield: '—' },
]

const EXPEDITION_TYPES = [
  { id: 'scout',   name: 'Розвідка',  icon: '🔭', requires: 'Геолаб рів.1',            reward: 'Відкриває тип і ресурс поля' },
  { id: 'extract', name: 'Видобуток', icon: '⛏️', requires: 'Екстракційна станція рів.1', reward: 'Ресурс поля (40-350+ залежно від тиру/бонусу)' },
  { id: 'attack',  name: 'Штурм',     icon: '⚔️', requires: 'Штурмова база рів.1 + Армія', reward: 'XP героя, -35% HP руїни' },
]

const UNIT_LIST = Object.entries(UNITS).map(([id, u]) => ({ id, ...u }))

const HERO_LIST = Object.entries(HERO_CLASSES).map(([id, c]) => ({ id, ...c }))

// XP_FOR_LEVEL = [0, 100, 250, 450, 700, 1000] (6 рівнів)
const XP_LEVELS = [
  { level: 1, xpNeeded: 0,    title: 'Новачок',    heroClass: 'Дозволяє найм юнітів від рів.2' },
  { level: 2, xpNeeded: 100,  title: 'Розвідник',  heroClass: 'Відкриває дисциплінарні будівлі' },
  { level: 3, xpNeeded: 250,  title: 'Командир',   heroClass: 'Відкриває Біолабораторію' },
  { level: 4, xpNeeded: 450,  title: 'Капітан',    heroClass: 'Збільшення бонусів класу' },
  { level: 5, xpNeeded: 700,  title: 'Генерал',    heroClass: 'Преміальна синергія' },
  { level: 6, xpNeeded: 1000, title: 'Маршал',     heroClass: 'Максимальний рівень сезону' },
]

// ─── Sections ────────────────────────────────────────────────

const SECTIONS = [
  { id: 'overview',    label: 'Огляд' },
  { id: 'resources',   label: 'Ресурси' },
  { id: 'heroes',      label: 'Герої' },
  { id: 'city',        label: 'Місто' },
  { id: 'nature',      label: 'Природничі' },
  { id: 'map',         label: 'Карта' },
  { id: 'army',        label: 'Армія' },
  { id: 'trade',       label: 'Торгівля' },
  { id: 'progression', label: 'Прогрес' },
  { id: 'tips',        label: 'Поради' },
]

// ─── Компонент ───────────────────────────────────────────────

export default function Wiki() {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState('overview')

  function scrollTo(id) {
    setActiveSection(id)
    document.getElementById(`wiki-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0a0a0f 0%, #0c0c18 100%)' }}>

      {/* ─── Шапка ─── */}
      <div className="sticky top-0 z-50 border-b border-[var(--border)]"
        style={{ background: 'rgba(10,10,15,0.95)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-3xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="text-xs text-[#555] hover:text-white transition-colors">← Назад</button>
            <span className="font-bebas text-xl tracking-widest text-[var(--neon)]">EDULAND ВІКІ</span>
          </div>
          <span className="text-[10px] text-[#333] font-mono">Season 1</span>
        </div>
        {/* Навігація */}
        <div className="max-w-3xl mx-auto px-4 pb-2 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`whitespace-nowrap text-[11px] font-mono px-2.5 py-1 rounded border transition-colors ${
                activeSection === s.id
                  ? 'border-[var(--neon)] text-[var(--neon)] bg-[rgba(0,255,136,0.08)]'
                  : 'border-[var(--border)] text-[#555] hover:border-[#444]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-24 space-y-12 pt-6">

        {/* ════════ ОГЛЯД ════════ */}
        <section id="wiki-overview">
          <SectionHeader id="overview" label="Огляд гри" icon="🌍" onView={setActiveSection} />

          <div className="prose-wiki">
            <p className="text-sm text-[#888] leading-relaxed mb-4">
              <strong className="text-white">Eduland</strong> — навчальна гра, де ти будуєш постапокаліптичне місто, відправляєш
              місії на карту і командуєш армією. Ресурси для гри ти отримуєш <strong className="text-[var(--neon)]">виконуючи реальні навчальні завдання</strong> — чим більше і краще виконуєш, тим швидше розвивається місто.
            </p>

            <InfoGrid>
              <InfoCard icon="🏙️" title="Місто" text="Будуй та прокачуй 5 будівель + замок. Призначай робітників для виробництва ресурсів." />
              <InfoCard icon="🗺️" title="Карта полів" text="31 поле: ресурсні, руїни та нейтральні. Відправляй місії для видобутку та штурму." />
              <InfoCard icon="⚔️" title="Армія" text="8 типів юнітів. Набирай, прокачуй, формуй загін і штурмуй руїни за XP." />
              <InfoCard icon="📋" title="Завдання" text="Вчитель публікує завдання, ти виконуєш і отримуєш ресурси після перевірки." />
            </InfoGrid>

            <h3 className="wiki-h3">Цикл гравця</h3>
            <ol className="wiki-ol">
              <li>Виконуй навчальні <strong className="text-[var(--accent)]">завдання</strong> → отримуй ресурси</li>
              <li>Витрачай ресурси на <strong className="text-[var(--neon)]">будівлі</strong> міста → пасивне виробництво</li>
              <li>Розподіляй <strong className="text-[#888]">робітників</strong> між будівлями для виробничого бонусу</li>
              <li>Відправляй <strong className="text-[#00aaff]">місії</strong> на карту → видобуток ресурсів або штурм руїн</li>
              <li>Набирай <strong className="text-[#ff6600]">армію</strong> → штурмуй руїни → XP для героя</li>
              <li>Прокачуй <strong className="text-[#ffd700]">замок</strong> → більша армія → складніші руїни</li>
            </ol>
          </div>
        </section>

        {/* ════════ РЕСУРСИ ════════ */}
        <section id="wiki-resources">
          <SectionHeader id="resources" label="Ресурси" icon="💰" onView={setActiveSection} />
          <p className="text-xs text-[#555] mb-4 font-mono">8 типів ресурсів — кожен потрібен для різних будівель та юнітів</p>
          <div className="overflow-x-auto">
            <table className="wiki-table">
              <thead>
                <tr>
                  <th>Ресурс</th>
                  <th>Іконка</th>
                  <th>Як отримати</th>
                </tr>
              </thead>
              <tbody>
                {RESOURCES.map(r => (
                  <tr key={r.id}>
                    <td className="font-semibold" style={{ color: r.color }}>{r.name}</td>
                    <td className="text-xl text-center">{r.icon}</td>
                    <td className="text-[#666] text-xs">{r.how}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Note>Золото — основна валюта. Решта ресурсів прив'язана до конкретних будівель і типів завдань.</Note>
        </section>

        {/* ════════ ГЕРОЇ ════════ */}
        <section id="wiki-heroes">
          <SectionHeader id="heroes" label="Герої та класи" icon="🦸" onView={setActiveSection} />
          <p className="text-xs text-[#555] mb-4 font-mono">Обирається при реєстрації, визначає бонуси до ресурсів і характеристики</p>

          <div className="grid grid-cols-2 gap-3 mb-6">
            {HERO_LIST.map(h => (
              <div key={h.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <GameImage
                    src={heroImg(h.id)}
                    fallback={h.icon}
                    alt={h.name}
                    className="w-10 h-10 object-contain rounded-lg"
                  />
                  <span className="font-bebas text-base text-white tracking-wider">{h.name}</span>
                </div>
                <p className="text-xs text-[#666] mb-2">{h.description}</p>
                <div className="space-y-0.5">
                  {Object.entries(h.resourceBonus).map(([res, pct]) => (
                    <div key={res} className="text-[11px] font-mono text-[var(--neon)]">
                      +{Math.round(pct * 100)}% бонус до {res === 'bits' ? '💾 Біти' : res === 'code' ? '🔐 Код' : '🪙 Золото'}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <h3 className="wiki-h3">Характеристики героя</h3>
          <div className="overflow-x-auto">
            <table className="wiki-table">
              <thead><tr><th>Характеристика</th><th>Вплив</th><th>Базова</th></tr></thead>
              <tbody>
                <tr><td>🧠 Інтелект</td><td className="text-[#666]">Підвищує ефективність досліджень</td><td className="text-center">5</td></tr>
                <tr><td>💪 Витривалість</td><td className="text-[#666]">Знижує витрати на армію</td><td className="text-center">5</td></tr>
                <tr><td>✨ Харизма</td><td className="text-[#666]">Бонус до торгівлі</td><td className="text-center">5</td></tr>
              </tbody>
            </table>
          </div>
          <Note>При створенні героя отримуєш 3 вільних очки — розподіли між характеристиками. Бонус класу додається автоматично.</Note>
        </section>

        {/* ════════ МІСТО ════════ */}
        <section id="wiki-city">
          <SectionHeader id="city" label="Місто та будівлі" icon="🏙️" onView={setActiveSection} />

          <p className="text-xs text-[#555] mb-4 font-mono">
            Місто — 7×7 сітка. Будівлі на фіксованих позиціях, замок у центрі (2×2).
            Кожна будівля має 3 рівні + слоти для робітників.
          </p>

          <h3 className="wiki-h3">Замок — рівні та вартість</h3>
          <div className="overflow-x-auto mb-4">
            <table className="wiki-table">
              <thead><tr><th>Рів.</th><th>Вартість</th><th>Армія</th><th>Відкриває</th></tr></thead>
              <tbody>
                {CITY_BUILDINGS[0].levels.map(l => (
                  <tr key={l.lvl}>
                    <td className="text-center font-mono text-[var(--gold)]">{l.lvl}</td>
                    <td className="text-xs font-mono text-[#666]">{l.cost}</td>
                    <td className="text-center font-mono text-xs text-[#ff6600]">
                      {[3,5,8,12,15][l.lvl-1]}
                    </td>
                    <td className="text-xs text-[#888]">{l.unlocks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="wiki-h3">Замок — назви по класу героя</h3>
          <div className="overflow-x-auto mb-6">
            <table className="wiki-table">
              <thead>
                <tr>
                  <th>Клас</th>
                  {[1,2,3,4,5].map(l => <th key={l}>Рів.{l}</th>)}
                </tr>
              </thead>
              <tbody>
                {Object.entries(CASTLE_CLASS_NAMES).map(([cls, names]) => {
                  const heroClass = HERO_LIST.find(h => h.id === cls)
                  return (
                    <tr key={cls}>
                      <td className="text-sm">{heroClass?.icon} {heroClass?.name}</td>
                      {[1,2,3,4,5].map(l => (
                        <td key={l} className="text-[10px] text-[#555] whitespace-nowrap">{names[l]}</td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <h3 className="wiki-h3">Виробничі будівлі міста</h3>
          <div className="space-y-3 mb-6">
            {CITY_BUILDINGS.slice(1).map(b => (
              <div key={b.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] bg-[var(--bg3)]">
                  <span className="text-xl">{b.icon}</span>
                  <span className="font-bebas tracking-wider text-white">{b.name}</span>
                  <span className="text-xs text-[#555] ml-auto">{b.description}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="wiki-table m-0 border-0">
                    <thead><tr><th>Рів.</th><th>Вартість</th><th>Виробництво/год</th></tr></thead>
                    <tbody>
                      {[1, 2, 3].map(lvl => (
                        <tr key={lvl}>
                          <td className="text-center font-mono text-[var(--gold)]">{lvl}</td>
                          <td className="text-xs font-mono text-[#666]">{b.cost[lvl]}</td>
                          <td className="text-xs font-mono text-[var(--neon)]">{b.production[lvl]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-3 py-1.5 text-[10px] font-mono text-[#555]">
                  ⚡ Синергія: {b.synergy}
                </div>
              </div>
            ))}
          </div>

          <h3 className="wiki-h3">Система робітників</h3>
          <div className="prose-wiki">
            <ul className="wiki-ul">
              <li>Кожна будівля має <strong className="text-white">слоти для робітників</strong> (1-3 залежно від рівня)</li>
              <li>Кожен призначений робітник = +50% виробництва від базового</li>
              <li>При 2+ робітниках активується <strong className="text-[var(--neon)]">синергійний бонус</strong></li>
              <li>Робітника можна переназначити будь-коли (без штрафу)</li>
            </ul>
          </div>

          <h3 className="wiki-h3">Лабораторні будівлі (для місій)</h3>
          <div className="space-y-3">
            {LAB_BUILDINGS_INFO.map(b => (
              <div key={b.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] bg-[var(--bg3)]">
                  <span className="text-lg">{b.icon}</span>
                  <span className="font-semibold text-white text-sm">{b.name}</span>
                  <span className="text-xs text-[#555] ml-auto">{b.purpose}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="wiki-table m-0 border-0">
                    <thead><tr><th>Рів.</th><th>Вартість</th><th>Ефект</th></tr></thead>
                    <tbody>
                      {[1, 2, 3].map(lvl => (
                        <tr key={lvl}>
                          <td className="text-center font-mono text-[var(--gold)]">{lvl}</td>
                          <td className="text-xs font-mono text-[#666]">{b.cost[lvl]}</td>
                          <td className="text-xs font-mono text-[var(--neon)]">{b.effect[lvl]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ════════ ПРИРОДНИЧІ НАУКИ ════════ */}
        <section id="wiki-nature">
          <SectionHeader id="nature" label="Природничі науки" icon="🔬" onView={setActiveSection} />
          <p className="text-xs text-[#555] mb-4 font-mono">
            Дисципліна «Природничі науки» — 4 унікальні будівлі, що виробляють Біоматерію, Енергію та Кристали.
            Відкриваються після досягнення відповідного рівня героя.
          </p>

          <div className="space-y-3 mb-4">
            {NATURE_BUILDINGS.map(b => (
              <div key={b.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] bg-[var(--bg3)]">
                  <span className="text-xl">{b.icon}</span>
                  <span className="font-bebas tracking-wider text-white">{b.name}</span>
                  <span className="text-[10px] font-mono text-[#555] ml-1">— {b.description}</span>
                  <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded border border-[rgba(255,170,0,0.3)] text-[#ffaa00]">
                    Герой рів.{b.unlockLevel}+
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="wiki-table m-0 border-0">
                    <thead><tr><th>Рів.</th><th>Вартість</th><th>Виробництво/год</th></tr></thead>
                    <tbody>
                      {[1, 2, 3].map(lvl => (
                        <tr key={lvl}>
                          <td className="text-center font-mono text-[var(--gold)]">{lvl}</td>
                          <td className="text-xs font-mono text-[#666]">{b.cost[lvl]}</td>
                          <td className="text-xs font-mono text-[var(--neon)]">{b.production[lvl]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-3 py-1.5 text-[10px] font-mono text-[#555]">
                  ⚡ Синергія: {b.synergy}
                </div>
              </div>
            ))}
          </div>
          <Note>Природничі будівлі виробляють ресурси (bio, energy, crystals), потрібні для апгрейду юнітів та лабораторних будівель.</Note>
        </section>

        {/* ════════ КАРТА ════════ */}
        <section id="wiki-map">
          <SectionHeader id="map" label="Карта полів" icon="🗺️" onView={setActiveSection} />
          <p className="text-xs text-[#555] mb-4 font-mono">
            31 поле на одній карті для всієї групи (рефреш кожні 48 годин)
          </p>

          <div className="overflow-x-auto mb-6">
            <table className="wiki-table">
              <thead><tr><th>Тип</th><th>Кількість</th><th>Дія</th><th>Нагорода</th></tr></thead>
              <tbody>
                {FIELDS_INFO.map(f => (
                  <tr key={f.type}>
                    <td>
                      <span className="text-base mr-1">{f.icon}</span>
                      <span className="font-semibold text-white text-sm">{f.name}</span>
                    </td>
                    <td className="text-center text-[#555] font-mono">
                      {f.type === 'resource' ? '12' : f.type === 'ruin' ? '7' : '12'}
                    </td>
                    <td className="text-xs text-[#666]">{f.action}</td>
                    <td className="text-xs text-[var(--neon)]">{f.yield}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="wiki-h3">Типи місій</h3>
          <div className="space-y-2 mb-6">
            {EXPEDITION_TYPES.map(e => (
              <div key={e.id} className="flex gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 items-start">
                <span className="text-2xl">{e.icon}</span>
                <div>
                  <div className="font-semibold text-white">{e.name}</div>
                  <div className="text-xs text-[#555] mt-0.5">Потрібно: {e.requires}</div>
                  <div className="text-xs text-[var(--neon)] mt-0.5">Нагорода: {e.reward}</div>
                </div>
              </div>
            ))}
          </div>

          <h3 className="wiki-h3">Тири полів</h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              { tier: 'T1', color: '#00ff88', mult: '×1.0', label: 'Легкий' },
              { tier: 'T2', color: '#ffd700', mult: '×2.0', label: 'Середній' },
              { tier: 'T3', color: '#ff4500', mult: '×3.5', label: 'Важкий' },
            ].map(t => (
              <div key={t.tier} className="rounded-lg border p-2 text-center"
                style={{ borderColor: `${t.color}44`, background: `${t.color}11` }}>
                <div className="font-bebas text-lg" style={{ color: t.color }}>{t.tier}</div>
                <div className="text-xs text-[#666]">{t.label}</div>
                <div className="font-mono text-sm text-white">{t.mult}</div>
              </div>
            ))}
          </div>
          <Note>Кожне поле доступне для всієї групи одночасно, але один гравець може відправити тільки одну місію на поле за раз.</Note>
        </section>

        {/* ════════ АРМІЯ ════════ */}
        <section id="wiki-army">
          <SectionHeader id="army" label="Армія та бій" icon="⚔️" onView={setActiveSection} />

          <p className="text-xs text-[#555] mb-4 font-mono">
            8 типів юнітів — Tank, DPS, Support. Максимальний розмір армії залежить від рівня замку.
          </p>

          <div className="overflow-x-auto mb-6">
            <table className="wiki-table">
              <thead>
                <tr>
                  <th>Юніт</th>
                  <th>Тип</th>
                  <th>HP</th><th>ATK</th><th>DEF</th>
                  <th>Спеціальна здатність</th>
                  <th>Вартість</th>
                </tr>
              </thead>
              <tbody>
                {UNIT_LIST.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <GameImage
                          src={unitImg(u.id)}
                          fallback={u.icon}
                          alt={u.name}
                          className="w-6 h-6 object-contain"
                        />
                        <span className="text-xs font-semibold text-white">{u.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`text-[10px] font-mono px-1 py-0.5 rounded ${
                        u.type === 'tank'    ? 'text-[#4488ff] bg-[rgba(68,136,255,0.1)]' :
                        u.type === 'dps'     ? 'text-[#ff4444] bg-[rgba(255,68,68,0.1)]' :
                                              'text-[#44ff88] bg-[rgba(68,255,136,0.1)]'
                      }`}>{u.type.toUpperCase()}</span>
                    </td>
                    <td className="text-center font-mono text-xs text-[#888]">{u.baseHP}</td>
                    <td className="text-center font-mono text-xs text-[#ff4444]">{u.baseATK}</td>
                    <td className="text-center font-mono text-xs text-[#4488ff]">{u.baseDEF}</td>
                    <td className="text-xs text-[#555] max-w-[160px]">{u.special}</td>
                    <td className="text-[10px] font-mono text-[#666]">
                      {Object.entries(u.cost).map(([r, v]) => `${v}${RESOURCES.find(x=>x.id===r)?.icon||r}`).join(' ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="wiki-h3">Вартість апгрейду юнітів</h3>
          <div className="overflow-x-auto mb-6">
            <table className="wiki-table">
              <thead><tr><th>Юніт</th><th>До рів.2</th><th>До рів.3</th><th>Бонус класу</th></tr></thead>
              <tbody>
                {UNIT_LIST.map(u => (
                  <tr key={u.id}>
                    <td className="text-xs font-semibold text-white">{u.icon} {u.name}</td>
                    <td className="text-[10px] font-mono text-[#666]">
                      {Object.entries(u.upgradeCost[2]).map(([r,v]) => `${v}${RESOURCES.find(x=>x.id===r)?.icon||r}`).join(' ')}
                    </td>
                    <td className="text-[10px] font-mono text-[#666]">
                      {Object.entries(u.upgradeCost[3]).map(([r,v]) => `${v}${RESOURCES.find(x=>x.id===r)?.icon||r}`).join(' ')}
                    </td>
                    <td className="text-[10px] text-[#555]">
                      {u.heroClassBonus
                        ? `+10% ATK для ${HERO_LIST.find(h=>h.id===u.heroClassBonus)?.name}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="wiki-h3">Бойова система</h3>
          <ul className="wiki-ul">
            <li><strong className="text-white">Формація</strong>: обери юнітів зі своєї армії у формацію (макс. залежить від рівня замку)</li>
            <li><strong className="text-white">Автобій</strong>: битва відбувається автоматично після місії-штурму (30 хв марш → бій)</li>
            <li><strong className="text-[#4488ff]">Tank</strong> — поглинає атаки, захищає команду</li>
            <li><strong className="text-[#ff4444]">DPS</strong> — наносить максимальну шкоду</li>
            <li><strong className="text-[#44ff88]">Support</strong> — лікує або підсилює команду</li>
            <li>Рівень юніта (1→3) підвищує характеристики: ×1.4 на рівні 2, ×1.9 на рівні 3</li>
          </ul>

          <h3 className="wiki-h3">Шанс перемоги</h3>
          <p className="text-xs text-[#666] mb-2">
            Розраховується як відношення рейтингу атаки до рейтингу оборони руїни через сигмоїдну функцію.
            Шанс 65%+ = зелений, 40-64% = жовтий, &lt;40% = червоний.
          </p>
          <Note>Осадний мех (🦾) отримує +50% ATK проти руїн — використовуй його для T3.</Note>
        </section>

        {/* ════════ ТОРГІВЛЯ ════════ */}
        <section id="wiki-trade">
          <SectionHeader id="trade" label="Торгівля" icon="🔄" onView={setActiveSection} />
          <p className="text-xs text-[#555] mb-4 font-mono">
            Торгівля між гравцями однієї групи. Вкладка «Торгівля» у нижній навігації.
          </p>

          <h3 className="wiki-h3">Як торгувати</h3>
          <ol className="wiki-ol">
            <li>Перейди на сторінку <strong className="text-white">Торгівля</strong> (нижня навігація)</li>
            <li>Вибери вкладку <strong className="text-[var(--neon)]">Надіслати</strong></li>
            <li>Обери гравця зі своєї групи зі списку</li>
            <li>Вкажи ресурс та кількість для відправки</li>
            <li>Вкажи що хочеш отримати взамін (або залиш порожнім для дарунку)</li>
            <li>Натисни <strong className="text-white">Надіслати запит</strong></li>
          </ol>

          <h3 className="wiki-h3">Статуси угоди</h3>
          <div className="overflow-x-auto mb-4">
            <table className="wiki-table">
              <thead><tr><th>Статус</th><th>Дія</th></tr></thead>
              <tbody>
                <tr>
                  <td className="font-mono text-[#ffaa00]">pending</td>
                  <td className="text-xs text-[#666]">Чекає на відповідь отримувача</td>
                </tr>
                <tr>
                  <td className="font-mono text-[var(--neon)]">accepted</td>
                  <td className="text-xs text-[#666]">Угода прийнята — ресурси переведені</td>
                </tr>
                <tr>
                  <td className="font-mono text-[#ff4444]">rejected</td>
                  <td className="text-xs text-[#666]">Угода відхилена — ресурси повернуті</td>
                </tr>
                <tr>
                  <td className="font-mono text-[#555]">cancelled</td>
                  <td className="text-xs text-[#666]">Відправник скасував пропозицію</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="wiki-h3">Бонуси торгівлі по класу</h3>
          <div className="overflow-x-auto mb-4">
            <table className="wiki-table">
              <thead><tr><th>Клас</th><th>Бонус</th><th>Слоти торгівлі (замок 3/4/5)</th></tr></thead>
              <tbody>
                <tr><td>🗺️ Координатор</td><td className="text-[var(--neon)] text-xs">+15% до золота при торгівлі</td><td className="text-center font-mono text-xs">2 / 3 / 4</td></tr>
                <tr><td>🛡️ Страж</td><td className="text-[#888] text-xs">Стандарт</td><td className="text-center font-mono text-xs">0 / 1 / 2</td></tr>
                <tr><td>📋 Архіваріус</td><td className="text-[#888] text-xs">Стандарт</td><td className="text-center font-mono text-xs">0 / 1 / 1</td></tr>
                <tr><td>🔍 Детектив</td><td className="text-[#888] text-xs">Стандарт</td><td className="text-center font-mono text-xs">0 / 1 / 1</td></tr>
              </tbody>
            </table>
          </div>
          <Note>Координатор (🗺️) — найкращий клас для торгівлі. При замку 5 рівня отримує 4 активних торгових слоти одночасно.</Note>
        </section>

        {/* ════════ ПРОГРЕС ════════ */}
        <section id="wiki-progression">
          <SectionHeader id="progression" label="Прогрес та нагороди" icon="📈" onView={setActiveSection} />

          <h3 className="wiki-h3">Рівні героя</h3>
          <div className="overflow-x-auto mb-6">
            <table className="wiki-table">
              <thead><tr><th>Рівень</th><th>XP від</th><th>Звання</th><th>Що відкриває</th></tr></thead>
              <tbody>
                {XP_LEVELS.map(l => (
                  <tr key={l.level}>
                    <td className="text-center font-mono text-[var(--gold)] font-bold">{l.level}</td>
                    <td className="text-center font-mono text-[#555]">{l.xpNeeded}</td>
                    <td className="text-white text-sm">{l.title}</td>
                    <td className="text-[#555] text-xs">{l.heroClass}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="wiki-h3">Як отримати XP</h3>
          <ul className="wiki-ul">
            <li>✅ Виконання навчальних завдань (основне джерело)</li>
            <li>⚔️ Перемога у штурмі руїни</li>
            <li>🔭 Завершення розвідки нового поля</li>
          </ul>

          <h3 className="wiki-h3">Нагороди за виконання завдань</h3>
          <p className="text-xs text-[#666] mb-3">
            Вчитель задає завдання та призначає нагороди у ресурсах. Після твого виконання і перевірки — ресурси зараховуються автоматично.
          </p>

          <h3 className="wiki-h3">Рейтинг групи</h3>
          <p className="text-xs text-[#666]">
            Рейтинг у WorldMap сортує гравців за загальним XP героя. Перші три місця відмічаються кольорами: 🥇 Золото / 🥈 Срібло / 🥉 Бронза.
          </p>
        </section>

        {/* ════════ ПОРАДИ ════════ */}
        <section id="wiki-tips">
          <SectionHeader id="tips" label="Поради початківцям" icon="💡" onView={setActiveSection} />

          <div className="space-y-3">
            {[
              { icon: '1️⃣', tip: 'Спершу побудуй Сервер і Лабораторію — вони дають Біти та Код, потрібні для більшості апгрейдів.' },
              { icon: '2️⃣', tip: 'Призначай робітників одразу — пасивне виробництво накопичується, навіть коли ти offline.' },
              { icon: '3️⃣', tip: 'Прокачай Геолаб до рівня 1 — розвідай поля перед видобутком, щоб знати що здобудеш.' },
              { icon: '4️⃣', tip: 'Для штурму руїн T1 достатньо рівня 1 Щитобота + Дрона-розвідника. Не витрачай все золото на армію — тобі ще треба будівлі.' },
              { icon: '5️⃣', tip: 'Ресурсні поля рефрешаться кожні 48 годин — плануй видобуток регулярно.' },
              { icon: '6️⃣', tip: 'Синергійний бонус активується при 2+ робітниках — розподіляй робітників між 2-3 будівлями, а не всіх в одну.' },
              { icon: '7️⃣', tip: 'Координатор (🗺️) — найкращий клас якщо хочеш торгувати з іншими гравцями групи.' },
              { icon: '8️⃣', tip: 'Регулярно перевіряй вкладку "Завдання" — нові завдання з ресурсами з\'являються протягом навчального тижня.' },
            ].map(t => (
              <div key={t.icon} className="flex gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
                <span className="text-xl shrink-0">{t.icon}</span>
                <p className="text-sm text-[#888]">{t.tip}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ════════ AI AGENT CONTEXT (структурований блок) ════════ */}
        <section id="wiki-ai-context">
          <div className="rounded-xl border border-[rgba(0,170,255,0.2)] bg-[rgba(0,170,255,0.04)] p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🤖</span>
              <span className="font-bebas tracking-widest text-[#00aaff]">КОНТЕКСТ ДЛЯ AI-АГЕНТІВ</span>
            </div>
            <p className="text-xs text-[#555] mb-3">
              Цей блок містить машинозчитувальний опис гри для AI-агентів та автоматизованих систем.
            </p>
            <pre className="text-[10px] font-mono text-[#444] overflow-x-auto leading-relaxed whitespace-pre-wrap">
{JSON.stringify({
  game: {
    name: 'Eduland',
    version: 'Season 1',
    genre: 'Educational gamification / City builder / Strategy',
    platform: 'Web (React + Firebase)',
    language: 'Ukrainian',
    description: 'Post-apocalyptic educational city-builder where students earn resources by completing academic tasks and use them to build/upgrade a city, send expeditions on a world map, and command a robot army.'
  },
  resources: RESOURCES.map(r => ({ id: r.id, name: r.name, icon: r.icon, source: r.how })),
  heroClasses: HERO_LIST.map(h => ({
    id: h.id, name: h.name,
    bonuses: h.resourceBonus,
    stats: h.statBonus,
  })),
  cityBuildings: CITY_BUILDINGS.map(b => ({ id: b.id, name: b.name, maxLevel: b.maxLevel, description: b.description })),
  natureBuildings: NATURE_BUILDINGS.map(b => ({ id: b.id, name: b.name, unlockHeroLevel: b.unlockLevel, production: b.production })),
  labBuildings: LAB_BUILDINGS_INFO.map(b => ({ id: b.id, name: b.name, purpose: b.purpose, effect: b.effect })),
  castleArmyLimits: { 1: 3, 2: 5, 3: 8, 4: 12, 5: 15 },
  castleUpgradeCosts: {
    2: '500 gold + 200 stone',
    3: '1200 gold + 500 stone + 50 crystals',
    4: '3000 gold + 1000 stone + 200 crystals + 100 code',
    5: '6000 gold + 2000 stone + 500 crystals + 500 bits + 300 code',
  },
  trading: { description: 'Peer-to-peer resource trading within same group. Coordinator class gets most trade slots.' },
  units: UNIT_LIST.map(u => ({ id: u.id, name: u.name, type: u.type, baseHP: u.baseHP, baseATK: u.baseATK, baseDEF: u.baseDEF, special: u.special })),
  worldMap: {
    totalFields: 31,
    resourceFields: 12,
    ruinFields: 7,
    neutralFields: 12,
    refreshHours: 48,
    expeditionTypes: ['scout', 'extract', 'attack'],
  },
  progression: {
    xpLevels: XP_LEVELS,
    xpSources: ['task completion', 'ruin assault victory', 'field scouting'],
  },
  gameLoop: [
    'complete academic tasks → receive resources',
    'build/upgrade city buildings → passive production',
    'assign workers → production + synergy bonus',
    'send expeditions → extract resources or gain XP',
    'recruit army units → assault ruins → hero XP',
    'upgrade castle → larger army → harder ruins',
  ],
}, null, 2)}
            </pre>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center py-4 border-t border-[var(--border)]">
          <p className="text-xs text-[#333] font-mono">Eduland Wiki · Season 1 · Всі питання — до вчителя</p>
          <button onClick={() => navigate('/')} className="mt-2 text-xs text-[#555] hover:text-[var(--neon)] transition-colors">
            ← На головну
          </button>
        </footer>

      </div>
    </div>
  )
}

// ─── Допоміжні компоненти ─────────────────────────────────────

function SectionHeader({ id, label, icon, onView }) {
  return (
    <div className="flex items-center gap-3 mb-4" id={`wiki-${id}`}>
      <span className="text-2xl">{icon}</span>
      <h2 className="font-bebas text-2xl tracking-widest text-white">{label}</h2>
      <div className="flex-1 h-px bg-[var(--border)]" />
    </div>
  )
}

function InfoGrid({ children }) {
  return <div className="grid grid-cols-2 gap-2 mb-4">{children}</div>
}

function InfoCard({ icon, title, text }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="font-bebas text-base tracking-wider text-white mb-1">{title}</div>
      <div className="text-xs text-[#666]">{text}</div>
    </div>
  )
}

function Note({ children }) {
  return (
    <div className="mt-3 rounded-lg border border-[rgba(0,255,136,0.15)] bg-[rgba(0,255,136,0.04)] px-3 py-2 text-xs text-[#555]">
      💡 {children}
    </div>
  )
}
