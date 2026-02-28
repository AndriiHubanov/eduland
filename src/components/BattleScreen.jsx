// ─── BattleScreen ───
// Модальний бій з руїною: анімований лог раундів + результат

import { useState, useEffect, useRef } from 'react'
import { Button } from './UI'
import { UNITS } from '../firebase/unitService'

const RESULT_CONFIG = {
  win:  { label: 'ПЕРЕМОГА!',  color: 'var(--neon)',   icon: '🏆' },
  lose: { label: 'ПОРАЗКА',    color: 'var(--accent)', icon: '💀' },
  draw: { label: 'НІЧИЯ',      color: 'var(--gold)',   icon: '⚔️' },
}

export default function BattleScreen({ ruin, battleData, onClose }) {
  // battleData: { result, rounds, loot, xpGain, casualties, survivingAttackers }
  const [phase, setPhase]       = useState('rounds')  // 'rounds' | 'result'
  const [visibleRounds, setVis] = useState([])
  const [roundIdx, setRoundIdx] = useState(0)
  const logRef = useRef(null)

  // Покроково показуємо раунди
  useEffect(() => {
    if (phase !== 'rounds' || !battleData?.rounds?.length) {
      setPhase('result')
      return
    }

    if (roundIdx >= battleData.rounds.length) {
      // Показали всі раунди — через 600ms переходимо до результату
      const t = setTimeout(() => setPhase('result'), 600)
      return () => clearTimeout(t)
    }

    const delay = roundIdx === 0 ? 200 : 800
    const t = setTimeout(() => {
      setVis(prev => [...prev, battleData.rounds[roundIdx]])
      setRoundIdx(i => i + 1)
    }, delay)
    return () => clearTimeout(t)
  }, [roundIdx, phase, battleData])

  // Автоскрол вниз
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [visibleRounds])

  if (!battleData) return null
  const res = RESULT_CONFIG[battleData.result] || RESULT_CONFIG.win

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => e.stopPropagation()}
    >
      {/* Фон */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Панель */}
      <div className="relative w-full sm:max-w-md bg-[var(--card)] border border-[var(--border)] rounded-t-2xl sm:rounded-xl z-10 flex flex-col max-h-[92vh]">

        {/* Заголовок */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">{ruin?.icon || '🏚️'}</span>
            <div>
              <div className="font-bebas text-lg text-white tracking-wider leading-tight">{ruin?.name || 'Руїна'}</div>
              <div className="text-xs text-[#555]">Тір {ruin?.tier} · бойовий лог</div>
            </div>
          </div>
          {phase === 'result' && (
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-[#555] hover:text-white">✕</button>
          )}
        </div>

        {phase === 'rounds' ? (
          <>
            {/* Лог */}
            <div
              ref={logRef}
              className="flex-1 overflow-y-auto p-3 flex flex-col gap-2"
            >
              {visibleRounds.map((round) => (
                <RoundBlock key={round.round} round={round} />
              ))}
              {roundIdx < (battleData.rounds?.length || 0) && (
                <div className="flex justify-center py-2">
                  <div className="w-5 h-5 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div className="p-3 border-t border-[var(--border)] shrink-0">
              <Button
                variant="ghost"
                className="w-full text-xs"
                onClick={() => {
                  setVis(battleData.rounds || [])
                  setRoundIdx((battleData.rounds?.length || 0) + 1)
                  setPhase('result')
                }}
              >
                ⏩ ПРОПУСТИТИ
              </Button>
            </div>
          </>
        ) : (
          <ResultPanel
            ruin={ruin}
            battleData={battleData}
            res={res}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  )
}

// ─── Один раунд ──────────────────────────────────────────────
function RoundBlock({ round }) {
  return (
    <div className="rounded-lg border border-[var(--border)] overflow-hidden animate-fade-in">
      {/* Шапка раунду */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--bg3)]">
        <span className="text-xs font-mono text-[#666] uppercase tracking-wider">Раунд {round.round}</span>
        <div className="flex gap-3 text-[10px] font-mono">
          <span className="text-[var(--neon)]">🗡️ {round.attackerHP} HP</span>
          <span className="text-[var(--accent)]">💀 {round.defenderHP} HP</span>
        </div>
      </div>

      {/* Події */}
      <div className="divide-y divide-[var(--border)]">
        {round.events.map((ev, i) => (
          <EventLine key={i} ev={ev} />
        ))}
      </div>
    </div>
  )
}

function EventLine({ ev }) {
  const isHeal   = ev.damage < 0
  const isMiss   = ev.damage === 0
  const isSpecial = !!ev.special

  let dmgText, dmgColor
  if (isHeal) {
    dmgText  = `+${Math.abs(ev.damage)} HP`
    dmgColor = 'var(--neon)'
  } else if (isMiss) {
    dmgText  = '—'
    dmgColor = '#555'
  } else {
    dmgText  = `-${ev.damage}`
    dmgColor = 'var(--accent)'
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-[11px]">
      <span className="text-[#888] truncate flex-1 min-w-0">
        <span className="text-white">{ev.actorName}</span>
        {' → '}
        <span className="text-[#aaa]">{ev.targetName}</span>
        {isSpecial && <span className="ml-1 text-[var(--gold)] italic"> · {ev.special}</span>}
      </span>
      <span className="font-mono shrink-0" style={{ color: dmgColor }}>{dmgText}</span>
    </div>
  )
}

// ─── Результат бою ────────────────────────────────────────────
function ResultPanel({ ruin, battleData, res, onClose }) {
  const hasCasualties = battleData.casualties && Object.keys(battleData.casualties).length > 0
  const hasLoot       = battleData.loot && Object.keys(battleData.loot).length > 0

  const RESOURCE_LABEL = {
    gold: '🪙', wood: '🪵', stone: '🪨', crystals: '💎',
    bits: '💾', code: '🔐', bio: '🧬', energy: '⚡', diamonds: '💠',
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
      {/* Результат */}
      <div className="flex flex-col items-center gap-2 py-4">
        <span className="text-5xl">{res.icon}</span>
        <span className="font-bebas text-3xl tracking-widest" style={{ color: res.color }}>
          {res.label}
        </span>
        <span className="text-xs text-[#555]">
          {battleData.survivingAttackers} юнітів вижило
        </span>
      </div>

      {/* Лут */}
      {hasLoot && (
        <div className="bg-[var(--bg3)] rounded-lg p-3">
          <p className="text-xs text-[#555] uppercase tracking-wider mb-2">Здобуток</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {Object.entries(battleData.loot).map(([res, amt]) => (
              <span key={res} className="text-sm font-mono text-[var(--neon)]">
                {RESOURCE_LABEL[res] || res} +{amt}
              </span>
            ))}
          </div>
          {battleData.xpGain > 0 && (
            <div className="mt-1.5 text-sm font-mono text-[var(--gold)]">⭐ +{battleData.xpGain} XP</div>
          )}
        </div>
      )}

      {/* Втрати */}
      {hasCasualties && (
        <div className="bg-[rgba(255,69,0,0.07)] rounded-lg p-3 border border-[rgba(255,69,0,0.2)]">
          <p className="text-xs text-[#555] uppercase tracking-wider mb-2">Втрати</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {Object.entries(battleData.casualties).map(([unitId, count]) => {
              const unit = UNITS[unitId]
              return (
                <span key={unitId} className="text-sm font-mono text-[var(--accent)]">
                  {unit?.icon || '❓'} {unit?.name || unitId} ×{count}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Кулдаун */}
      {battleData.result === 'win' && ruin?.cooldownHours && (
        <p className="text-xs text-[#555] text-center">
          Руїна знову доступна через {ruin.cooldownHours} год.
        </p>
      )}

      <Button variant="accent" className="w-full" onClick={onClose}>
        ЗАКРИТИ
      </Button>
    </div>
  )
}
