// ─── useHaptic: Вібрація + Звуковий фідбек ───

import { useRef } from 'react'

export function useHaptic() {
  const ctxRef = useRef(null)

  function getCtx() {
    if (!ctxRef.current) {
      try {
        ctxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      } catch {}
    }
    return ctxRef.current
  }

  function tone(freq = 880, dur = 0.06, vol = 0.05, type = 'sine') {
    const ctx = getCtx()
    if (!ctx) return
    try {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = type
      gain.gain.setValueAtTime(vol, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + dur + 0.01)
    } catch {}
  }

  function vibe(pattern = [8]) {
    try { navigator.vibrate?.(pattern) } catch {}
  }

  return {
    // Звичайне натискання кнопки
    click:   () => { vibe([6]);          tone(1000, 0.04, 0.04) },
    // Успішна дія (підтвердження, збір нагороди)
    success: () => { vibe([10, 30, 10]); tone(660, 0.08, 0.05); setTimeout(() => tone(880, 0.1, 0.04), 80) },
    // Помилка / відмова
    error:   () => { vibe([20, 40, 20]); tone(200, 0.15, 0.06, 'square') },
    // Знайдено предмет спорядження
    loot:    () => { vibe([10, 20, 15, 20, 25]); tone(660, 0.1, 0.05); setTimeout(() => tone(880, 0.08, 0.04), 100); setTimeout(() => tone(1100, 0.12, 0.05), 200) },
    // Купівля / торгівля
    trade:   () => { vibe([8, 20, 8]);   tone(440, 0.06, 0.04); setTimeout(() => tone(550, 0.08, 0.04), 70) },
  }
}
