// ─── Landing Page (/): Вибір групи та вхід у гру ───

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GROUPS } from '../store/gameStore'
import useGameStore from '../store/gameStore'
import { findPlayer, normalizeName } from '../firebase/service'
import { Button, Input, Spinner, ErrorMsg } from '../components/UI'

export default function Landing() {
  const navigate = useNavigate()
  const { setSelectedGroup, setPlayer } = useGameStore()

  const [step, setStep] = useState('group') // 'group' | 'name'
  const [selectedGroup, setGroup] = useState(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Список груп у потрібному порядку
  const groupKeys = Object.keys(GROUPS)

  // Крок 1: вибір групи
  function handleGroupSelect(groupKey) {
    setGroup(groupKey)
    setSelectedGroup(groupKey)
    setStep('name')
    setError('')
  }

  // Крок 2: вхід
  async function handleEnter() {
    if (!name.trim()) {
      setError("Введи своє ім'я та прізвище")
      return
    }
    if (!selectedGroup) {
      setError('Оберіть групу')
      return
    }

    setLoading(true)
    setError('')

    try {
      const player = await findPlayer(name, selectedGroup)

      if (player) {
        // Гравець знайдений — входимо в місто
        setPlayer(player)
        navigate('/city')
      } else {
        // Гравець не знайдений — створюємо героя
        // Зберігаємо ім'я для HeroCreate
        sessionStorage.setItem('pendingName', name.trim())
        sessionStorage.setItem('pendingGroup', selectedGroup)
        navigate('/create')
      }
    } catch (err) {
      console.error(err)
      setError('Помилка підключення до сервера. Перевір інтернет.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-4 py-8"
         style={{ background: 'linear-gradient(180deg, #0a0a0f 0%, #0f0f1a 100%)' }}>

      {/* ─── Верхня частина: Лого + Лор ─── */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm gap-6">

        {/* Декоративна лінія */}
        <div className="w-16 h-0.5 bg-[var(--accent)]" />

        {/* Логотип */}
        <div className="text-center">
          <h1
            className="font-bebas text-7xl sm:text-8xl leading-none tracking-widest"
            style={{ color: 'var(--accent)', textShadow: '0 0 30px rgba(255,69,0,0.5)' }}
          >
            EDULAND
          </h1>
          <p className="font-mono text-sm text-[var(--neon)] tracking-[0.3em] mt-1 animate-flicker">
            ВІДБУДУЙ ЦИВІЛІЗАЦІЮ
          </p>
        </div>

        {/* Лор */}
        <div className="w-full text-center px-4">
          <p className="text-sm italic text-[#555] leading-relaxed">
            Після Великого Колапсу залишились руїни.<br />
            Тільки знання можуть відродити світ.<br />
            <span className="text-[#888]">Побудуй своє місто. Навчайся. Перемагай.</span>
          </p>
        </div>

        {/* ─── Крок 1: Вибір групи ─── */}
        {step === 'group' && (
          <div className="w-full flex flex-col gap-3">
            <p className="text-center text-xs uppercase tracking-widest text-[#555] font-semibold">
              Оберіть свою групу
            </p>

            {/* Сітка груп: 2+2+1 */}
            <div className="grid grid-cols-2 gap-3">
              {groupKeys.slice(0, 4).map(key => (
                <GroupButton key={key} groupKey={key} group={GROUPS[key]} onSelect={handleGroupSelect} />
              ))}
            </div>
            {groupKeys.length > 4 && (
              <div className="flex justify-center">
                <GroupButton
                  groupKey={groupKeys[4]}
                  group={GROUPS[groupKeys[4]]}
                  onSelect={handleGroupSelect}
                  className="w-1/2"
                />
              </div>
            )}
          </div>
        )}

        {/* ─── Крок 2: Ввід імені ─── */}
        {step === 'name' && (
          <div className="w-full flex flex-col gap-4">
            <button
              onClick={() => { setStep('group'); setError('') }}
              className="text-xs text-[#555] hover:text-[var(--text)] flex items-center gap-1 w-fit"
            >
              ← Змінити групу
            </button>

            {/* Показуємо вибрану групу */}
            <div className="flex items-center justify-center gap-2 p-3 bg-[var(--bg3)] border border-[var(--border)] rounded">
              <span className="text-[var(--accent)] font-bebas text-lg tracking-wider">
                {GROUPS[selectedGroup]?.label}
              </span>
              <span className="text-[#555] text-sm">·</span>
              <span className="text-[#888] text-sm">{GROUPS[selectedGroup]?.name}</span>
            </div>

            <Input
              label="Ім'я та Прізвище"
              placeholder="Іван Петренко"
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleEnter()}
              autoFocus
            />

            {error && <ErrorMsg text={error} />}

            {loading ? (
              <Spinner text="Шукаю в базі даних..." />
            ) : (
              <Button
                variant="accent"
                className="w-full text-lg py-3"
                onClick={handleEnter}
              >
                УВІЙТИ В МІСТО
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ─── Нижня частина ─── */}
      <div className="flex flex-col items-center gap-3 mt-6">
        <div className="w-8 h-0.5 bg-[var(--border)]" />
        <a
          href="/admin"
          className="font-mono text-xs text-[#333] hover:text-[#555] tracking-widest transition-colors"
        >
          [ АДМІН ]
        </a>
      </div>
    </div>
  )
}

// Кнопка групи
function GroupButton({ groupKey, group, onSelect, className = '' }) {
  return (
    <button
      onClick={() => onSelect(groupKey)}
      className={`
        flex flex-col items-center justify-center gap-1
        min-h-[72px] p-3
        bg-[var(--card)] border border-[var(--border)] rounded-lg
        hover:border-[var(--accent)] hover:bg-[#1a1a2a]
        transition-all duration-200
        ${className}
      `}
    >
      <span className="font-bebas text-2xl tracking-wider text-white">{group.label}</span>
      <span className="text-xs text-[#555]">{group.name}</span>
    </button>
  )
}
