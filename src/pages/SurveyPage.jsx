// ─── SurveyPage (/surveys): Психологічні опитування ───

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useGameStore, { RESOURCE_ICONS } from '../store/gameStore'
import {
  subscribeSurveys, subscribePlayerSurveyResponses,
  canTakeSurvey, submitSurvey,
} from '../firebase/surveyService'
import { Spinner, Button, Card, BottomNav, ErrorMsg, SuccessMsg } from '../components/UI'

const NAV_ITEMS = [
  { id: 'city',    icon: '🏙️', label: 'Місто'    },
  { id: 'map',     icon: '🗺️', label: 'Карта'    },
  { id: 'tasks',   icon: '⚔️', label: 'Завдання'  },
  { id: 'inbox',   icon: '📬', label: 'Пошта'    },
  { id: 'trade',   icon: '🔄', label: 'Торгівля'  },
]

export default function SurveyPage() {
  const navigate = useNavigate()
  const { player, playerId, unreadMessages } = useGameStore()

  const [surveys, setSurveys]     = useState([])
  const [responses, setResponses] = useState({})
  const [loading, setLoading]     = useState(true)
  const [active, setActive]       = useState(null)  // { survey } — активне опитування
  const [feedback, setFeedback]   = useState({ type: '', text: '' })

  useEffect(() => {
    if (!player) { navigate('/'); return }

    const unsub1 = subscribeSurveys(player.group, (data) => {
      setSurveys(data)
      setLoading(false)
    })
    const unsub2 = subscribePlayerSurveyResponses(playerId, setResponses)

    return () => { unsub1(); unsub2() }
  }, [player?.group, playerId])

  function showFeedback(type, text) {
    setFeedback({ type, text })
    setTimeout(() => setFeedback({ type: '', text: '' }), 4000)
  }

  async function handleSubmit(surveyId, answers) {
    try {
      const { reward } = await submitSurvey(
        playerId, player.name, player.group, surveyId, answers
      )
      setActive(null)
      const parts = Object.entries(reward).map(([res, amt]) => {
        const info = RESOURCE_ICONS[res]
        return `${info?.icon || res} +${amt}`
      })
      showFeedback('success', `Дякуємо! Нагорода: ${parts.join(', ')}`)
    } catch (err) {
      showFeedback('error', err.message)
    }
  }

  const navItems = NAV_ITEMS.map(item => ({
    ...item,
    badge: item.id === 'inbox' ? unreadMessages : 0,
  }))

  if (loading) return <Spinner text="Завантаження опитувань..." />

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      {/* Шапка */}
      <header className="sticky top-0 z-40 bg-[var(--bg2)] border-b border-[var(--border)] px-4 py-3">
        <h1 className="font-bebas text-xl tracking-widest text-white">🧠 ОПИТУВАННЯ</h1>
        <p className="text-xs text-[#555]">Відповідай та отримуй нагороди</p>
      </header>

      <main className="flex-1 p-4 pb-24 max-w-2xl mx-auto w-full flex flex-col gap-4">
        {feedback.text && (
          feedback.type === 'error'
            ? <ErrorMsg text={feedback.text} />
            : <SuccessMsg text={feedback.text} />
        )}

        {surveys.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="text-5xl opacity-30">🧠</span>
            <p className="text-sm text-[#555]">Активних опитувань немає.<br/>Зайди пізніше!</p>
          </div>
        ) : (
          surveys.map(survey => {
            const response  = responses[survey.id]
            const available = canTakeSurvey(survey, response)
            return (
              <SurveyCard
                key={survey.id}
                survey={survey}
                response={response}
                available={available}
                isOpen={active?.id === survey.id}
                onOpen={() => setActive(survey)}
                onClose={() => setActive(null)}
                onSubmit={(answers) => handleSubmit(survey.id, answers)}
              />
            )
          })
        )}
      </main>

      <BottomNav
        items={navItems}
        active="tasks"
        onChange={id => {
          if (id === 'city')  navigate('/city')
          if (id === 'map')   navigate('/map')
          if (id === 'tasks') navigate('/tasks')
          if (id === 'inbox') navigate('/inbox')
          if (id === 'trade') navigate('/trade')
        }}
      />
    </div>
  )
}

// ─── Картка опитування ────────────────────────────────────────
function SurveyCard({ survey, response, available, isOpen, onOpen, onClose, onSubmit }) {
  const [answers, setAnswers] = useState({})
  const [submitting, setSubmitting] = useState(false)

  // Скидаємо відповіді при відкритті
  useEffect(() => {
    if (isOpen) setAnswers({})
  }, [isOpen])

  const allAnswered = survey.questions?.every(q => {
    const a = answers[q.id]
    if (q.type === 'scale') return a !== undefined
    if (q.type === 'choice') return a !== undefined
    if (q.type === 'text') return a && a.trim().length > 0
    return true
  })

  async function handleSubmit() {
    if (!allAnswered || submitting) return
    setSubmitting(true)
    try {
      await onSubmit(answers)
    } finally {
      setSubmitting(false)
    }
  }

  // Кулдаун до наступного доступу
  function cooldownText() {
    if (!response?.completedAt || !survey.cooldownDays) return null
    const completed = response.completedAt?.toDate?.() || new Date(response.completedAt)
    const next = new Date(completed.getTime() + survey.cooldownDays * 86400000)
    const daysLeft = Math.ceil((next.getTime() - Date.now()) / 86400000)
    return `Доступно через ${daysLeft} дн.`
  }

  const cooldown = cooldownText()

  return (
    <Card className={`transition-all ${isOpen ? 'glow-neon' : ''}`}>
      {/* Заголовок картки */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1">
          <h3 className="font-semibold text-white text-sm leading-tight">{survey.title}</h3>
          {survey.description && (
            <p className="text-xs text-[#666] mt-0.5">{survey.description}</p>
          )}
        </div>
        {/* Статус */}
        {response && !available ? (
          <span className="shrink-0 text-xs font-mono text-[var(--gold)] bg-[rgba(255,215,0,0.1)] px-2 py-0.5 rounded">
            ✓ Пройдено
          </span>
        ) : (
          <span className="shrink-0 text-xs font-mono text-[var(--neon)] bg-[rgba(0,255,136,0.1)] px-2 py-0.5 rounded">
            Нове
          </span>
        )}
      </div>

      {/* Нагорода */}
      {Object.keys(survey.reward || {}).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {Object.entries(survey.reward).map(([res, amt]) => {
            const info = RESOURCE_ICONS[res]
            return (
              <span key={res} className="text-xs font-mono text-[var(--neon)] bg-[rgba(0,255,136,0.08)] px-2 py-0.5 rounded">
                {info?.icon || res} +{amt}
              </span>
            )
          })}
        </div>
      )}

      {/* Кнопка відкрити / кулдаун */}
      {!isOpen && (
        available ? (
          <Button variant="neon" className="w-full text-sm" onClick={onOpen}>
            ПРОЙТИ ОПИТУВАННЯ
          </Button>
        ) : (
          <div className="text-center text-xs text-[#555] font-mono py-1">
            {cooldown || '✓ Завершено'}
          </div>
        )
      )}

      {/* Форма */}
      {isOpen && (
        <div className="mt-3 flex flex-col gap-4">
          {survey.questions?.map((q, qi) => (
            <QuestionBlock
              key={q.id}
              question={q}
              index={qi}
              value={answers[q.id]}
              onChange={val => setAnswers(prev => ({ ...prev, [q.id]: val }))}
            />
          ))}

          <div className="flex gap-2 mt-1">
            <Button
              variant="ghost"
              className="flex-1 text-sm"
              onClick={onClose}
              disabled={submitting}
            >
              Скасувати
            </Button>
            <Button
              variant="neon"
              className="flex-1 text-sm"
              disabled={!allAnswered || submitting}
              onClick={handleSubmit}
            >
              {submitting ? '...' : '✓ ВІДПРАВИТИ'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── Один блок питання ───────────────────────────────────────
function QuestionBlock({ question: q, index, value, onChange }) {
  return (
    <div>
      <p className="text-sm text-[#ccc] mb-2">
        <span className="text-[var(--accent)] font-mono mr-1">{index + 1}.</span>
        {q.text}
      </p>

      {/* Шкала 1–5 */}
      {q.type === 'scale' && (
        <div className="flex gap-2 justify-between">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => onChange(n)}
              className={`flex-1 py-2 rounded-lg border text-sm font-mono transition-all ${
                value === n
                  ? 'border-[var(--neon)] bg-[rgba(0,255,136,0.15)] text-[var(--neon)]'
                  : 'border-[var(--border)] bg-[var(--bg3)] text-[#555] hover:border-[#444]'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {/* Вибір варіанту */}
      {q.type === 'choice' && (
        <div className="flex flex-col gap-1.5">
          {q.options?.map((opt, i) => (
            <button
              key={i}
              onClick={() => onChange(opt)}
              className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                value === opt
                  ? 'border-[var(--neon)] bg-[rgba(0,255,136,0.1)] text-white'
                  : 'border-[var(--border)] bg-[var(--bg3)] text-[#888] hover:border-[#444]'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* Текстова відповідь */}
      {q.type === 'text' && (
        <textarea
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder="Введи відповідь..."
          rows={3}
          className="w-full bg-[var(--bg3)] border border-[var(--border)] rounded-lg p-3 text-sm text-white placeholder-[#444] resize-none focus:outline-none focus:border-[var(--neon)] transition-colors"
        />
      )}
    </div>
  )
}
