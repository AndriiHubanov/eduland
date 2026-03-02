// ─── Landing Page (/): Вибір групи та вхід у гру ───

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
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
        <div className="w-full px-2">
          <div className="border border-[rgba(255,69,0,0.15)] rounded-xl bg-[rgba(10,10,15,0.8)] p-4 text-xs text-[#555] leading-relaxed space-y-2">
            <p className="text-[var(--neon)] font-mono tracking-wider text-[10px] uppercase">
              // Журнал. 2047. День 2920 після Колапсу
            </p>
            <p>
              У <span className="text-[#888]">2039</span> році електромагнітний каскад знищив більшість
              цифрових мереж. Уряди впали за 72 години. Те, що залишилось від цивілізації, ховалось
              у бункерах.
            </p>
            <p>
              Сьогодні — <span className="text-[var(--gold)]">2047</span>. Перші паростки нового
              світу. <span className="text-white font-semibold">Nova Academy</span> — острів знань
              серед руїн. Тут навчають єдиній зброї, що вижила:{' '}
              <span className="text-[var(--neon)]">розуму</span>.
            </p>
            <p className="text-[#444] italic border-t border-[var(--border)] pt-2">
              «Твоє місто — не просто будівлі. Це маніфест того, що людство не здалося.»
            </p>
          </div>
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
        <div className="flex gap-4">
          <Link
            to="/wiki"
            className="font-mono text-xs text-[#444] hover:text-[var(--neon)] tracking-widest transition-colors"
          >
            [ ВІКІ ]
          </Link>
          <Link
            to="/admin"
            className="font-mono text-xs text-[#333] hover:text-[#555] tracking-widest transition-colors"
          >
            [ АДМІН ]
          </Link>
        </div>
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
