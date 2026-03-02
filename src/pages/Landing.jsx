// ─── Landing Page (/): Вхід за нікнеймом ───

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import useGameStore from '../store/gameStore'
import { findPlayerByNickname } from '../firebase/service'
import { Button, Input, Spinner, ErrorMsg } from '../components/UI'

export default function Landing() {
  const navigate = useNavigate()
  const { setPlayer } = useGameStore()

  const [nickname, setNickname] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [pending, setPending]   = useState(false) // акаунт очікує підтвердження

  async function handleEnter() {
    const nick = nickname.trim()
    if (!nick) {
      setError('Введи свій нікнейм')
      return
    }

    setLoading(true)
    setError('')
    setPending(false)

    try {
      const player = await findPlayerByNickname(nick)

      if (!player) {
        // Гравець не знайдений — реєстрація
        sessionStorage.setItem('pendingNickname', nick.toLowerCase())
        navigate('/create')
      } else if (!player.status || player.status === 'active') {
        // Активний гравець — вхід
        setPlayer(player)
        navigate('/city')
      } else if (player.status === 'pending') {
        // Очікує підтвердження
        setPending(true)
      } else {
        setError('Акаунт відхилено адміністратором')
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

        {/* ─── Повідомлення про очікування ─── */}
        {pending && (
          <div className="w-full p-4 rounded-lg bg-[rgba(255,215,0,0.06)] border border-[rgba(255,215,0,0.2)] text-center">
            <p className="text-sm text-[var(--gold)] font-semibold mb-1">⏳ Очікуємо підтвердження</p>
            <p className="text-xs text-[#555]">
              Твій акаунт зареєстровано. Адміністратор підтвердить його найближчим часом.
            </p>
          </div>
        )}

        {/* ─── Форма входу ─── */}
        {!pending && (
          <div className="w-full flex flex-col gap-4">
            <Input
              label="Нікнейм"
              placeholder="твій_нікнейм"
              value={nickname}
              onChange={e => { setNickname(e.target.value); setError('') }}
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
