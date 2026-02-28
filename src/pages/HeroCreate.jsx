// ─── HeroCreate Page (/create): Створення героя ───

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { HERO_CLASSES } from '../store/gameStore'
import useGameStore from '../store/gameStore'
import { createPlayer } from '../firebase/service'
import { Button, Input, Spinner, ErrorMsg, Card } from '../components/UI'
import GameImage from '../components/GameImage'
import { heroImg } from '../config/assets'

const FREE_POINTS = 3

export default function HeroCreate() {
  const navigate = useNavigate()
  const { setPlayer, setSelectedGroup } = useGameStore()

  // Дані з sessionStorage (встановлені на Landing)
  const pendingName  = sessionStorage.getItem('pendingName') || ''
  const pendingGroup = sessionStorage.getItem('pendingGroup') || ''

  const [selectedClass, setSelectedClass] = useState(null)
  const [heroName, setHeroName] = useState('')
  const [gender, setGender] = useState(null) // 'male' | 'female'
  const [bonusStats, setBonusStats] = useState({ intellect: 0, endurance: 0, charisma: 0 })
  const [freePoints, setFreePoints] = useState(FREE_POINTS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Якщо немає даних — повернути на Landing (через useEffect, не під час рендеру)
  useEffect(() => {
    if (!pendingName || !pendingGroup) navigate('/')
  }, [])

  // Скидаємо бонуси при зміні класу
  useEffect(() => {
    setBonusStats({ intellect: 0, endurance: 0, charisma: 0 })
    setFreePoints(FREE_POINTS)
  }, [selectedClass])

  if (!pendingName || !pendingGroup) return null

  function addStatPoint(stat) {
    if (freePoints <= 0) return
    setBonusStats(prev => ({ ...prev, [stat]: prev[stat] + 1 }))
    setFreePoints(prev => prev - 1)
  }

  function removeStatPoint(stat) {
    if (bonusStats[stat] <= 0) return
    setBonusStats(prev => ({ ...prev, [stat]: prev[stat] - 1 }))
    setFreePoints(prev => prev + 1)
  }

  async function handleCreate() {
    if (!selectedClass) { setError('Оберіть клас героя'); return }
    if (!heroName.trim()) { setError('Введіть позивний героя'); return }
    if (!gender) { setError('Оберіть стать'); return }

    setLoading(true)
    setError('')

    try {
      const classData = HERO_CLASSES[selectedClass]

      // Базові характеристики + бонус класу + вільні очки
      const heroStats = {
        intellect:  5 + (classData.statBonus.intellect  || 0) + bonusStats.intellect,
        endurance:  5 + (classData.statBonus.endurance  || 0) + bonusStats.endurance,
        charisma:   5 + (classData.statBonus.charisma   || 0) + bonusStats.charisma,
      }

      const player = await createPlayer({
        name:      pendingName,
        group:     pendingGroup,
        heroName:  heroName.trim(),
        heroClass: selectedClass,
        heroStats,
        gender,
      })

      // Очищаємо sessionStorage
      sessionStorage.removeItem('pendingName')
      sessionStorage.removeItem('pendingGroup')

      setPlayer(player)
      setSelectedGroup(pendingGroup)
      navigate('/city')
    } catch (err) {
      console.error(err)
      if (err?.message?.includes('offline') || err?.code === 'unavailable') {
        setError('Немає з\'єднання з сервером. Перевір інтернет і спробуй ще раз.')
      } else {
        setError('Помилка створення героя. Спробуй ще раз.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col"
         style={{ background: 'linear-gradient(180deg, #0a0a0f 0%, #0f0f1a 100%)' }}>

      {/* Шапка */}
      <div className="p-4 border-b border-[var(--border)]">
        <button onClick={() => navigate('/')} className="text-xs text-[#555] hover:text-[var(--text)]">
          ← Назад
        </button>
        <h1 className="font-bebas text-3xl tracking-wider text-white mt-1">СТВОРЕННЯ ГЕРОЯ</h1>
        <p className="text-sm text-[#888]">
          {pendingName} · <span className="text-[var(--accent)]">{pendingGroup}</span>
        </p>
      </div>

      <div className="flex-1 p-4 pb-24 flex flex-col gap-6 max-w-lg mx-auto w-full">

        {/* ─── Клас героя ─── */}
        <section>
          <p className="text-xs uppercase tracking-widest text-[#555] font-semibold mb-3">
            Оберіть клас
          </p>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(HERO_CLASSES).map(([key, cls]) => (
              <button
                key={key}
                onClick={() => { setSelectedClass(key); setError('') }}
                className={`
                  flex flex-col items-start p-4 rounded-lg border transition-all duration-200
                  ${selectedClass === key
                    ? 'border-[var(--accent)] bg-[rgba(255,69,0,0.1)] glow-accent'
                    : 'border-[var(--border)] bg-[var(--card)] hover:border-[#333]'
                  }
                `}
              >
                <GameImage
                  src={heroImg(key)}
                  fallback={cls.icon}
                  alt={cls.name}
                  className="w-16 h-16 object-contain mb-2 rounded-lg"
                />
                <div className="font-bebas text-lg tracking-wider text-white">{cls.name}</div>
                <div className="text-xs text-[#888] leading-snug mt-1">{cls.description}</div>
                {selectedClass === key && (
                  <div className="mt-2 pt-2 border-t border-[var(--border)] w-full">
                    {Object.entries(cls.resourceBonus).map(([res, bonus]) => (
                      <div key={res} className="text-xs text-[var(--neon)]">
                        +{Math.round(bonus * 100)}% {res === 'bits' ? 'Біти' : res === 'code' ? 'Код' : 'Золото'}
                      </div>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* ─── Позивний героя ─── */}
        <section>
          <Input
            label="Позивний / Ім'я героя"
            placeholder="Тінь, Вогонь, Кобра..."
            value={heroName}
            onChange={e => { setHeroName(e.target.value); setError('') }}
            maxLength={20}
          />
        </section>

        {/* ─── Стать ─── */}
        <section>
          <p className="text-xs uppercase tracking-widest text-[#555] font-semibold mb-2">
            Стать
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'male',   label: 'Чоловік', icon: '⚔️' },
              { id: 'female', label: 'Жінка',   icon: '🌙' },
            ].map(g => (
              <button
                key={g.id}
                onClick={() => { setGender(g.id); setError('') }}
                className={`
                  flex items-center justify-center gap-2 p-3 rounded-lg border transition-all
                  ${gender === g.id
                    ? 'border-[var(--accent)] bg-[rgba(255,69,0,0.1)]'
                    : 'border-[var(--border)] bg-[var(--card)] hover:border-[#333]'
                  }
                `}
              >
                <span className="text-xl">{g.icon}</span>
                <span className="font-semibold">{g.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Попередній перегляд + розподіл очок */}
        {selectedClass && (
          <Card className="border-[var(--neon)] bg-[rgba(0,255,136,0.05)]">
            {/* Заголовок */}
            {heroName && gender && (
              <>
                <p className="text-xs text-[#555] uppercase tracking-wider mb-2">Твій герой</p>
                <div className="flex items-center gap-3 mb-3">
                  <GameImage
                    src={heroImg(selectedClass)}
                    fallback={HERO_CLASSES[selectedClass].icon}
                    alt={HERO_CLASSES[selectedClass].name}
                    className="w-14 h-14 object-contain rounded-lg"
                  />
                  <div>
                    <div className="font-bebas text-xl text-white">{heroName}</div>
                    <div className="text-sm text-[#888]">{HERO_CLASSES[selectedClass].name} · {pendingGroup}</div>
                  </div>
                </div>
              </>
            )}

            {/* Розподіл вільних очок */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-[#555] uppercase tracking-wider">Характеристики</p>
                {freePoints > 0 && (
                  <span className="text-xs font-semibold text-[var(--gold)] font-mono">
                    +{freePoints} вільних очок
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'intellect',  label: 'Інтелект',     icon: '🧠', base: 5 + (HERO_CLASSES[selectedClass].statBonus.intellect  || 0) },
                  { key: 'endurance',  label: 'Витривалість', icon: '💪', base: 5 + (HERO_CLASSES[selectedClass].statBonus.endurance  || 0) },
                  { key: 'charisma',   label: 'Харизма',      icon: '✨', base: 5 + (HERO_CLASSES[selectedClass].statBonus.charisma   || 0) },
                ].map(stat => {
                  const total = stat.base + bonusStats[stat.key]
                  return (
                    <div key={stat.key} className="bg-[var(--bg3)] rounded p-2 flex flex-col items-center gap-1">
                      <span className="text-base">{stat.icon}</span>
                      <div className="font-mono text-lg text-[var(--gold)]">{total}</div>
                      <div className="text-[10px] text-[#555]">{stat.label}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <button
                          onClick={() => removeStatPoint(stat.key)}
                          disabled={bonusStats[stat.key] <= 0}
                          className="w-5 h-5 rounded bg-[var(--border)] text-[#888] disabled:opacity-30 hover:enabled:bg-[var(--accent)] hover:enabled:text-white text-xs transition-colors"
                        >−</button>
                        <button
                          onClick={() => addStatPoint(stat.key)}
                          disabled={freePoints <= 0}
                          className="w-5 h-5 rounded bg-[var(--border)] text-[#888] disabled:opacity-30 hover:enabled:bg-[var(--neon)] hover:enabled:text-black text-xs transition-colors"
                        >+</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </Card>
        )}

        {error && <ErrorMsg text={error} />}

        {/* Кнопка */}
        {loading ? (
          <Spinner text="Засновую місто..." />
        ) : (
          <Button
            variant="accent"
            className="w-full text-xl py-4 font-bebas tracking-wider"
            onClick={handleCreate}
          >
            ЗАСНУВАТИ МІСТО
          </Button>
        )}
      </div>
    </div>
  )
}
