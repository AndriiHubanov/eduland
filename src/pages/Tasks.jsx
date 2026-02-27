// ─── Tasks Page (/tasks): Завдання ───

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useGameStore, { RESOURCE_ICONS } from '../store/gameStore'
import { subscribeTasks, subscribePlayerSubmissions, submitOpenTask, submitTest } from '../firebase/service'
import {
  Spinner, Card, LoreBanner, Button, ResourceBadge, EmptyState, ErrorMsg, BottomNav, Tabs
} from '../components/UI'
import CompletionCard from '../components/CompletionCard'

const NAV_ITEMS = [
  { id: 'city',   icon: '🏙️', label: 'Місто'   },
  { id: 'map',    icon: '🗺️', label: 'Карта'   },
  { id: 'tasks',  icon: '⚔️', label: 'Завдання' },
  { id: 'inbox',  icon: '📬', label: 'Пошта'   },
  { id: 'trade',  icon: '🔄', label: 'Торгівля' },
]

export default function Tasks() {
  const navigate   = useNavigate()
  const { player, unreadMessages } = useGameStore()

  const [tasks, setTasks]             = useState([])
  const [submissions, setSubmissions] = useState({})
  const [loading, setLoading]         = useState(true)
  const [activeTask, setActiveTask]   = useState(null)
  const [completion, setCompletion]   = useState(null)
  const [filter, setFilter]           = useState('all') // 'all' | 'open' | 'test'

  useEffect(() => {
    if (!player) { navigate('/'); return }
    const unsubTasks = subscribeTasks(player.group, (data) => {
      setTasks(data)
      setLoading(false)
    })
    const unsubSubs = subscribePlayerSubmissions(player.id, setSubmissions)
    return () => { unsubTasks(); unsubSubs() }
  }, [player])

  function handleNavChange(tabId) {
    if (tabId === 'city')  navigate('/city')
    if (tabId === 'map')   navigate('/map')
    if (tabId === 'inbox') navigate('/inbox')
    if (tabId === 'trade') navigate('/trade')
  }

  async function handleOpenSubmit(task) {
    const result = await submitOpenTask({ player, task })
    if (result.error) return // вже здано — кнопка не відображається в такому стані
    setCompletion({ task, player })
  }

  if (loading) return <Spinner text="Завантаження завдань..." />

  // Фільтр по типу
  const filtered = tasks.filter(t => {
    if (filter === 'open') return t.type === 'open' || !t.type
    if (filter === 'test') return t.type === 'test'
    return true
  })

  // Сортуємо: невиконані спочатку
  const sorted = [...filtered].sort((a, b) => {
    const subA = submissions[a.id]
    const subB = submissions[b.id]
    const doneA = subA?.status === 'approved' ? 1 : 0
    const doneB = subB?.status === 'approved' ? 1 : 0
    return doneA - doneB
  })

  const doneCount    = tasks.filter(t => submissions[t.id]?.status === 'approved').length
  const pendingCount = tasks.filter(t => submissions[t.id]?.status === 'pending').length
  const openCount    = tasks.filter(t => t.type === 'open' || !t.type).length
  const testCount    = tasks.filter(t => t.type === 'test').length

  const filterTabs = [
    { id: 'all',  label: `Всі (${tasks.length})` },
    { id: 'open', label: `Відкриті (${openCount})` },
    { id: 'test', label: `Тести (${testCount})` },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <header className="sticky top-0 z-40 bg-[var(--bg2)] border-b border-[var(--border)]">
        <div className="p-3 pb-0">
          <h1 className="font-bebas text-2xl tracking-widest text-white">ЗАВДАННЯ</h1>
          <div className="flex items-center gap-3 text-xs mt-0.5 mb-2">
            <span className="text-[#555]">{player?.group}</span>
            {doneCount > 0 && <span className="text-[var(--neon)]">✓ {doneCount} виконано</span>}
            {pendingCount > 0 && <span className="text-[var(--gold)]">⏳ {pendingCount} на перевірці</span>}
          </div>
        </div>
        <Tabs tabs={filterTabs} active={filter} onChange={setFilter} />
      </header>

      <main className="flex-1 p-4 pb-20 max-w-2xl mx-auto w-full">
        {sorted.length === 0 ? (
          <EmptyState icon="⚔️" text="Немає активних завдань. Зачекайте наступної пари." />
        ) : (
          <div className="flex flex-col gap-4">
            {sorted.map(task => {
              const sub = submissions[task.id]
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  submission={sub}
                  onSubmitOpen={() => handleOpenSubmit(task)}
                  onStartTest={() => setActiveTask(task)}
                />
              )
            })}
          </div>
        )}
      </main>

      {/* Тест */}
      {activeTask?.type === 'test' && (
        <TestModal
          task={activeTask}
          player={player}
          existingSub={submissions[activeTask.id]}
          onClose={() => setActiveTask(null)}
        />
      )}

      {/* Картка підтвердження для викладача */}
      {completion && (
        <CompletionCard
          task={completion.task}
          player={completion.player}
          onClose={() => setCompletion(null)}
        />
      )}

      <BottomNav
        items={NAV_ITEMS.map(item => ({ ...item, badge: item.id === 'inbox' ? unreadMessages : 0 }))}
        active="tasks"
        onChange={handleNavChange}
      />
    </div>
  )
}

// ─── Картка завдання ──────────────────────────────────────────
function TaskCard({ task, submission, onSubmitOpen, onStartTest }) {
  const isPending  = submission?.status === 'pending'
  const isApproved = submission?.status === 'approved'
  const isRejected = submission?.status === 'rejected'

  return (
    <Card className={isApproved ? 'opacity-70' : ''}>
      {/* Лор-банер */}
      {task.storyText && <LoreBanner text={task.storyText} />}

      <div className={`flex flex-col gap-3 ${task.storyText ? 'mt-3' : ''}`}>

        {/* Тип + дисципліна */}
        <div className="flex items-center gap-2">
          <span className={`
            text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider
            ${task.type === 'test'
              ? 'bg-[rgba(0,170,255,0.15)] text-[var(--info)] border border-[rgba(0,170,255,0.3)]'
              : 'bg-[rgba(255,69,0,0.15)] text-[var(--accent)] border border-[rgba(255,69,0,0.3)]'
            }
          `}>
            {task.type === 'test' ? '📝 ТЕСТ' : '📋 ВІДКРИТЕ'}
          </span>
          {task.type === 'test' && task.questions?.length > 0 && (
            <span className="text-xs text-[#555]">{task.questions.length} питань</span>
          )}
        </div>

        {/* Назва та опис */}
        <div>
          <h3 className="font-semibold text-white text-base">{task.title}</h3>
          {task.description && (
            <p className="text-sm text-[#888] mt-1 leading-relaxed">{task.description}</p>
          )}
        </div>

        {/* Нагорода */}
        {task.reward && Object.values(task.reward).some(v => v > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[#555]">Нагорода:</span>
            {Object.entries(task.reward).map(([res, amount]) =>
              amount > 0
                ? <ResourceBadge key={res} resource={res} amount={amount} showName />
                : null
            )}
          </div>
        )}

        {/* ─── Статус і дія ─── */}

        {isApproved && (
          <div className="flex items-center gap-2 p-2 bg-[rgba(0,255,136,0.07)] border border-[rgba(0,255,136,0.2)] rounded">
            <span className="text-lg">✅</span>
            <div>
              <div className="text-sm font-semibold text-[var(--neon)]">Виконано та підтверджено</div>
              {submission.testScore != null && (
                <div className="text-xs text-[#888]">
                  Результат: {submission.testScore}/{submission.testTotal}
                  {submission.testScore === submission.testTotal && ' 🌟'}
                </div>
              )}
            </div>
          </div>
        )}

        {isPending && (
          <div className="flex items-center gap-2 p-2 bg-[rgba(255,215,0,0.07)] border border-[rgba(255,215,0,0.2)] rounded">
            <span className="text-lg">⏳</span>
            <div className="text-sm font-semibold text-[var(--gold)]">
              Очікує підтвердження викладача
            </div>
          </div>
        )}

        {isRejected && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 p-2 bg-[rgba(255,69,0,0.07)] border border-[rgba(255,69,0,0.2)] rounded">
              <span className="text-lg">❌</span>
              <div className="text-sm font-semibold text-[var(--accent)]">
                Не зараховано — спробуй ще раз
              </div>
            </div>
            {task.type === 'open' && (
              <Button variant="ghost" className="w-full text-sm" onClick={onSubmitOpen}>
                ЗДАТИ ЗНОВУ ✓
              </Button>
            )}
            {task.type === 'test' && (
              <Button variant="ghost" className="w-full text-sm" onClick={onStartTest}>
                ПРОЙТИ ТЕСТ ЗНОВУ
              </Button>
            )}
          </div>
        )}

        {!submission && task.type === 'open' && (
          <Button variant="accent" className="w-full" onClick={onSubmitOpen}>
            ВИКОНАВ ✓
          </Button>
        )}

        {!submission && task.type === 'test' && (
          <Button variant="neon" className="w-full" onClick={onStartTest}>
            РОЗПОЧАТИ ТЕСТ →
          </Button>
        )}
      </div>
    </Card>
  )
}

// ─── Тест модалка ─────────────────────────────────────────────
function TestModal({ task, player, existingSub, onClose }) {
  const [currentQ, setCurrentQ] = useState(0) // поточне питання
  const [answers, setAnswers]   = useState({})
  const [result, setResult]     = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const questions = task.questions || []
  const totalQ    = questions.length
  const answered  = Object.keys(answers).length

  // Якщо вже схвалено — показуємо результат
  if (existingSub?.status === 'approved') {
    return (
      <TestOverlay onClose={onClose}>
        <div className="flex flex-col items-center gap-4 py-8 px-4">
          <span className="text-5xl">🏆</span>
          <div className="font-bebas text-4xl text-[var(--neon)]">
            {existingSub.testScore}/{existingSub.testTotal}
          </div>
          <p className="text-[#888] text-sm text-center">Тест вже пройдено та підтверджено</p>
          <Button variant="ghost" className="w-full" onClick={onClose}>ЗАКРИТИ</Button>
        </div>
      </TestOverlay>
    )
  }

  async function handleSubmit() {
    if (answered < totalQ) {
      setError(`Дай відповідь на всі ${totalQ} питань`)
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await submitTest({ player, task, answers })
      setResult(res)
    } catch {
      setError('Помилка надсилання. Спробуй ще раз.')
    } finally {
      setLoading(false)
    }
  }

  function selectAnswer(qId, opt) {
    setAnswers(prev => ({ ...prev, [qId]: opt }))
    setError('')
    // Автоматично переходимо до наступного питання
    if (currentQ < totalQ - 1) {
      setTimeout(() => setCurrentQ(q => q + 1), 300)
    }
  }

  return (
    <TestOverlay onClose={onClose}>
      {/* Шапка зі прогресом */}
      <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--border)] p-4 z-10">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bebas text-lg tracking-wide text-white truncate pr-2">{task.title}</h3>
          <button onClick={onClose} className="text-[#555] hover:text-white shrink-0 w-7 h-7 flex items-center justify-center">✕</button>
        </div>

        {/* Прогрес-бар відповідей */}
        {!result && (
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs text-[#555]">
              <span>Питання {currentQ + 1} з {totalQ}</span>
              <span>{answered}/{totalQ} відповідей</span>
            </div>
            <div className="h-1 bg-[var(--border)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] rounded-full transition-all duration-300"
                style={{ width: `${(answered / totalQ) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Контент */}
      <div className="p-4 flex flex-col gap-5">
        {result ? (
          // ─── Результат ───
          <ResultScreen result={result} task={task} answers={answers} onClose={onClose} />
        ) : (
          // ─── Питання ───
          <>
            {/* Навігація по питаннях */}
            <div className="flex gap-1.5 flex-wrap">
              {questions.map((q, idx) => (
                <button
                  key={q.id}
                  onClick={() => setCurrentQ(idx)}
                  className={`
                    w-8 h-8 rounded text-xs font-mono font-bold transition-all
                    ${answers[q.id]
                      ? 'bg-[var(--accent)] text-white'
                      : idx === currentQ
                        ? 'border-2 border-[var(--accent)] text-[var(--accent)]'
                        : 'bg-[var(--border)] text-[#555]'
                    }
                  `}
                >
                  {idx + 1}
                </button>
              ))}
            </div>

            {/* Поточне питання */}
            {questions[currentQ] && (
              <QuestionBlock
                question={questions[currentQ]}
                questionNum={currentQ + 1}
                totalNum={totalQ}
                selectedAnswer={answers[questions[currentQ].id]}
                onSelect={(opt) => selectAnswer(questions[currentQ].id, opt)}
              />
            )}

            {error && <ErrorMsg text={error} />}

            <div className="flex gap-2">
              {/* Назад / Вперед */}
              {currentQ > 0 && (
                <Button variant="ghost" className="flex-1 text-sm" onClick={() => setCurrentQ(q => q - 1)}>
                  ← Назад
                </Button>
              )}
              {currentQ < totalQ - 1 ? (
                <Button variant="ghost" className="flex-1 text-sm" onClick={() => setCurrentQ(q => q + 1)}>
                  Далі →
                </Button>
              ) : (
                <Button
                  variant="accent"
                  className="flex-1"
                  onClick={handleSubmit}
                  disabled={loading || answered < totalQ}
                >
                  {loading ? 'Перевіряю...' : answered < totalQ ? `Ще ${totalQ - answered} відповідей` : 'ВІДПРАВИТИ ✓'}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </TestOverlay>
  )
}

// ─── Одне питання тесту ──────────────────────────────────────
function QuestionBlock({ question, questionNum, totalNum, selectedAnswer, onSelect }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-semibold text-white leading-snug">
        <span className="text-[var(--accent)] font-mono mr-1">{questionNum}.</span>
        {question.text}
      </p>
      <div className="flex flex-col gap-2">
        {Object.entries(question.options).map(([opt, text]) => (
          <button
            key={opt}
            onClick={() => onSelect(opt)}
            className={`
              flex items-start gap-3 p-3 rounded-lg border text-left text-sm transition-all
              ${selectedAnswer === opt
                ? 'border-[var(--accent)] bg-[rgba(255,69,0,0.12)] text-white'
                : 'border-[var(--border)] bg-[var(--bg2)] text-[#888] hover:border-[#333] hover:text-[var(--text)]'
              }
            `}
          >
            <span className={`
              font-mono font-bold shrink-0 w-5 h-5 rounded flex items-center justify-center text-xs
              ${selectedAnswer === opt ? 'bg-[var(--accent)] text-white' : 'text-[#555]'}
            `}>
              {opt}
            </span>
            <span>{text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Екран результату ─────────────────────────────────────────
function ResultScreen({ result, task, answers, onClose }) {
  const isPerfect = result.correct === result.total
  const percent   = Math.round((result.correct / result.total) * 100)

  return (
    <div className="flex flex-col gap-5">
      {/* Рахунок */}
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="text-5xl">
          {isPerfect ? '🏆' : result.correct >= result.total / 2 ? '📊' : '📉'}
        </div>
        <div className="font-bebas text-5xl text-white">
          {result.correct}
          <span className="text-[#555] text-3xl">/{result.total}</span>
        </div>
        <div className={`text-lg font-semibold ${isPerfect ? 'text-[var(--gold)]' : 'text-[#888]'}`}>
          {isPerfect ? '🌟 Ідеальний результат!' : `${percent}% правильних`}
        </div>

        {/* XP */}
        {result.xpGain > 0 && (
          <div className="text-xs text-[var(--neon)]">+{result.xpGain} XP</div>
        )}

        {/* Нагорода */}
        {Object.values(result.reward).some(v => v > 0) && (
          <div className="flex flex-wrap gap-2 justify-center">
            {Object.entries(result.reward).map(([res, amount]) =>
              amount > 0
                ? <ResourceBadge key={res} resource={res} amount={amount} showName />
                : null
            )}
          </div>
        )}
      </div>

      {/* Розбір відповідей */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-[#555] uppercase tracking-wider">Розбір відповідей</p>
        {(task.questions || []).map((q, idx) => {
          const userAns    = answers[q.id]
          const isCorrect  = userAns === q.correct
          return (
            <div
              key={q.id}
              className={`p-3 rounded-lg border text-sm ${
                isCorrect
                  ? 'border-[rgba(0,255,136,0.3)] bg-[rgba(0,255,136,0.05)]'
                  : 'border-[rgba(255,69,0,0.3)] bg-[rgba(255,69,0,0.05)]'
              }`}
            >
              <div className="flex items-start gap-2 mb-1">
                <span>{isCorrect ? '✅' : '❌'}</span>
                <span className="text-white font-medium">{q.text}</span>
              </div>
              {!isCorrect && (
                <div className="ml-6 text-xs space-y-0.5">
                  <div className="text-[var(--accent)]">
                    Твоя відповідь: <b>{userAns}</b> — {q.options[userAns]}
                  </div>
                  <div className="text-[var(--neon)]">
                    Правильно: <b>{q.correct}</b> — {q.options[q.correct]}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <Button variant="ghost" className="w-full" onClick={onClose}>ЗАКРИТИ</Button>
    </div>
  )
}

// ─── Обгортка модалки тесту ───────────────────────────────────
function TestOverlay({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center">
      <div
        className="w-full sm:max-w-lg bg-[var(--card)] border border-[var(--border)] rounded-t-2xl sm:rounded-xl flex flex-col overflow-hidden"
        style={{ maxHeight: '92vh' }}
      >
        <div className="overflow-y-auto flex-1 flex flex-col">
          {children}
        </div>
      </div>
    </div>
  )
}
