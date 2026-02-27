// ─── CompletionCard: Повноекранна картка для показу викладачу ───

import { ResourceBadge } from './UI'
import { HERO_CLASSES } from '../store/gameStore'

export default function CompletionCard({ task, player, onClose }) {
  // Форматування дати і часу
  const now = new Date()
  const time = now.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
  const date = now.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const heroClass = HERO_CLASSES[player.heroClass] || HERO_CLASSES.guardian

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-[var(--card)] rounded-2xl overflow-hidden"
        style={{ border: '2px solid var(--neon)', boxShadow: '0 0 40px rgba(0,255,136,0.3)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="bg-[rgba(0,255,136,0.1)] p-5 text-center border-b border-[var(--neon)]">
          <div className="text-4xl mb-2">✅</div>
          <h2
            className="font-bebas text-2xl tracking-widest"
            style={{ color: 'var(--neon)', textShadow: '0 0 20px rgba(0,255,136,0.5)' }}
          >
            ЗАВДАННЯ ВИКОНАНО
          </h2>
        </div>

        {/* Тіло */}
        <div className="p-5 flex flex-col gap-4">
          {/* Гравець */}
          <div className="text-center">
            <div className="font-bebas text-3xl text-white tracking-wide">{player.name}</div>
            <div className="text-[var(--text)] text-sm mt-1">
              <span className="text-[#888]">[ {player.heroName} ]</span>
              {' · '}
              {heroClass.icon} {heroClass.name}
            </div>
            <div className="text-xs text-[#555] mt-0.5">Група: {player.group}</div>
          </div>

          <div className="h-px bg-[var(--border)]" />

          {/* Завдання */}
          <div>
            <div className="text-xs text-[#555] uppercase tracking-wider mb-1">Завдання</div>
            <div className="font-semibold text-white text-lg leading-snug">{task.title}</div>
          </div>

          {/* Час */}
          <div className="font-mono text-sm text-[#888]">
            {time} · {date}
          </div>

          <div className="h-px bg-[var(--border)]" />

          {/* Нагорода */}
          {task.reward && (
            <div>
              <div className="text-xs text-[#555] uppercase tracking-wider mb-2">Нагорода</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(task.reward).map(([res, amount]) =>
                  amount > 0 ? (
                    <ResourceBadge key={res} resource={res} amount={amount} showName />
                  ) : null
                )}
              </div>
            </div>
          )}
        </div>

        {/* Кнопка закрити */}
        <div className="p-4 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="w-full btn btn-ghost text-[var(--neon)] border-[var(--neon)] hover:bg-[rgba(0,255,136,0.1)]"
          >
            [ ЗАКРИТИ ]
          </button>
        </div>
      </div>
    </div>
  )
}
