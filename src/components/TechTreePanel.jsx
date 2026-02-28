// ─── TechTreePanel (Phase 11) ───
// Tech Tree для 4 природничих дисциплін: Biology / Chemistry / Physics / Geography
// Кожна дисципліна має 3 вузли (рівні 1→2→3)
// Розблокування або через RP (миттєво) або через час + ресурси

import { useState } from 'react'
import { NATURAL_DISCIPLINES, SCIENCE_BRANCHES, getDisciplineNodes } from '../firebase/scienceService'

// Іконки ресурсів
const RES_ICONS = {
  bio:      { icon: '🧬', color: '#00ff88' },
  energy:   { icon: '⚡', color: '#ffaa00' },
  code:     { icon: '🔐', color: '#8888ff' },
  crystals: { icon: '💎', color: '#00ffff' },
  gold:     { icon: '🪙', color: '#ffd700' },
  bits:     { icon: '💾', color: '#00aaff' },
  stone:    { icon: '🪨', color: '#888888' },
}

function formatTime(seconds) {
  if (seconds < 3600) return `${Math.round(seconds / 60)} хв`
  return `${Math.round(seconds / 3600)} год`
}

export default function TechTreePanel({ player, onUnlockRP, onStartResearch }) {
  const [activeDiscipline, setActiveDiscipline] = useState(NATURAL_DISCIPLINES[0])

  const sciences = player?.sciences || {}
  const rp = player?.researchPoints || 0

  const nodes = getDisciplineNodes(activeDiscipline)
  const branch = SCIENCE_BRANCHES[activeDiscipline]

  return (
    <div className="flex flex-col gap-3">
      {/* RP display */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-[#555] font-mono uppercase tracking-wider">Очки досліджень</span>
        <span className="font-mono text-sm font-bold" style={{ color: '#b9f2ff' }}>
          🧪 {rp} RP
        </span>
      </div>

      {/* Discipline tabs */}
      <div className="grid grid-cols-4 gap-1 bg-[var(--bg3)] rounded-lg p-1">
        {NATURAL_DISCIPLINES.map(disc => {
          const b = SCIENCE_BRANCHES[disc]
          const discNodes = getDisciplineNodes(disc)
          const completedCount = discNodes.filter(n => sciences[n.id]?.status === 'completed').length
          const isActive = disc === activeDiscipline
          return (
            <button
              key={disc}
              onClick={() => setActiveDiscipline(disc)}
              className={`flex flex-col items-center gap-0.5 py-2 rounded transition-all ${
                isActive
                  ? 'bg-[var(--card)] text-white'
                  : 'text-[#555] hover:text-[#888]'
              }`}
            >
              <span className="text-base">{b.icon}</span>
              <span className="text-[8px] font-mono uppercase tracking-wider"
                style={{ color: isActive ? b.color : undefined }}>
                {b.name.split(' ')[0]}
              </span>
              {completedCount > 0 && (
                <span className="text-[8px] font-mono"
                  style={{ color: b.color }}>
                  {completedCount}/{discNodes.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Nodes */}
      <div className="flex flex-col gap-2 relative">
        {nodes.map((node, idx) => {
          const state = sciences[node.id]
          const isCompleted  = state?.status === 'completed'
          const isResearching = state?.status === 'researching'

          // Перевірка prerequisites
          const prereqsMet = node.requires.every(r => sciences[r]?.status === 'completed')
          const isAvailable = !isCompleted && !isResearching && prereqsMet
          const isLocked    = !isCompleted && !isResearching && !prereqsMet

          const canAffordRP = rp >= (node.rpCost || 999)
          const canAffordRes = node.cost
            ? Object.entries(node.cost).every(([r, c]) => (player?.resources?.[r] || 0) >= c)
            : false

          // Timer for researching
          let timeLeft = null
          if (isResearching && state?.endsAt) {
            const ends = state.endsAt?.toDate ? state.endsAt.toDate() : new Date(state.endsAt)
            const ms = ends - Date.now()
            timeLeft = ms > 0 ? formatTime(ms / 1000) : 'Готово!'
          }

          return (
            <div key={node.id}>
              {/* Connector */}
              {idx > 0 && (
                <div className="flex justify-center my-0.5">
                  <div className="w-0.5 h-4"
                    style={{ background: isCompleted ? branch.color : 'var(--border)' }} />
                </div>
              )}

              {/* Node card */}
              <div className={`rounded-xl border p-3 flex flex-col gap-2 transition-all ${
                isCompleted
                  ? 'border-[rgba(0,255,136,0.4)] bg-[rgba(0,255,136,0.05)]'
                  : isResearching
                    ? 'border-[rgba(255,215,0,0.4)] bg-[rgba(255,215,0,0.04)]'
                    : isAvailable
                      ? 'border-[var(--border)] bg-[var(--bg2)]'
                      : 'border-[var(--border)] bg-[var(--bg3)] opacity-60'
              }`}>

                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{node.icon}</span>
                    <div>
                      <div className={`font-semibold text-sm ${isCompleted ? 'text-[var(--neon)]' : isLocked ? 'text-[#444]' : 'text-white'}`}>
                        {node.name}
                      </div>
                      <div className="text-[10px] text-[#444] font-mono">
                        T{node.level} · {branch.name}
                      </div>
                    </div>
                  </div>

                  {/* State badge */}
                  {isCompleted && (
                    <span className="text-[var(--neon)] text-sm">✓</span>
                  )}
                  {isLocked && (
                    <span className="text-[#444] text-sm">🔒</span>
                  )}
                  {isResearching && (
                    <span className="text-[var(--gold)] text-xs font-mono">⏳ {timeLeft}</span>
                  )}
                </div>

                {/* Description */}
                <p className={`text-[11px] leading-snug ${isLocked ? 'text-[#444]' : 'text-[#777]'}`}>
                  {node.description}
                </p>

                {/* Prerequisites warning */}
                {isLocked && node.requires.length > 0 && (
                  <p className="text-[10px] text-[#555] font-mono">
                    Потрібно: {node.requires.join(', ')}
                  </p>
                )}

                {/* Action area */}
                {isAvailable && (
                  <div className="flex flex-col gap-2">
                    {/* RP unlock */}
                    {node.rpCost != null && (
                      <button
                        className={`w-full text-xs font-semibold py-1.5 rounded border transition-all ${
                          canAffordRP
                            ? 'border-[#b9f2ff] text-[#b9f2ff] hover:bg-[rgba(185,242,255,0.08)]'
                            : 'border-[var(--border)] text-[#444] cursor-not-allowed'
                        }`}
                        disabled={!canAffordRP}
                        onClick={() => onUnlockRP(node.id)}
                      >
                        🧪 МИТТЄВО ({node.rpCost} RP)
                        {!canAffordRP && ` — не вистачає ${node.rpCost - rp} RP`}
                      </button>
                    )}

                    {/* Standard research (time + resources) */}
                    {onStartResearch && (
                      <div>
                        <div className="flex flex-wrap gap-1 mb-1">
                          {Object.entries(node.cost || {}).map(([res, cost]) => {
                            const ri = RES_ICONS[res]
                            const have = player?.resources?.[res] || 0
                            return (
                              <span key={res}
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                                  have >= cost
                                    ? 'text-[var(--neon)] border-[rgba(0,255,136,0.25)]'
                                    : 'text-[var(--accent)] border-[rgba(255,69,0,0.25)]'
                                }`}>
                                {ri?.icon} {cost}
                              </span>
                            )
                          })}
                          {node.researchTime && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border text-[#555] border-[var(--border)]">
                              ⏱ {formatTime(node.researchTime)}
                            </span>
                          )}
                        </div>
                        <button
                          className={`w-full text-xs font-semibold py-1.5 rounded border transition-all ${
                            canAffordRes
                              ? 'border-[var(--neon)] text-[var(--neon)] hover:bg-[rgba(0,255,136,0.08)]'
                              : 'border-[var(--border)] text-[#444] cursor-not-allowed'
                          }`}
                          disabled={!canAffordRes}
                          onClick={() => onStartResearch(node.id)}
                        >
                          ДОСЛІДЖУВАТИ ({formatTime(node.researchTime || 0)})
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
