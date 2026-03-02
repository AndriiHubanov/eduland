// ─── Admin Page (/admin): Адміністративна панель ───

import { useState, useEffect } from 'react'
import {
  getDisciplines, getBuildings, getAllPlayers,
  subscribePendingSubmissions, approveSubmission, rejectSubmission,
  createTask, deactivateTask, subscribeAllActiveTasks, getAllTasks,
  sendAdminMessage, addDiscipline, addBuilding,
  subscribePendingPlayers, approvePlayer, rejectPlayer,
} from '../firebase/service'
import {
  Button, Card, Input, Tabs, Spinner, EmptyState,
  ErrorMsg, SuccessMsg, ResourceBadge
} from '../components/UI'
import { GROUPS as GROUPS_CONFIG, getHeroLevel, RESOURCE_ICONS } from '../store/gameStore'
import {
  createSurvey, deactivateSurvey, getSurveyResponses,
  subscribeSurveys,
} from '../firebase/surveyService'

const ADMIN_PASSWORD = 'nova2047'

const GROUP_KEYS = Object.keys(GROUPS_CONFIG)

const HERO_CLASSES_MAP = { guardian: 'Страж', archivist: 'Архіваріус', detective: 'Детектив', coordinator: 'Координатор' }

export default function Admin() {
  const [auth, setAuth]     = useState(false)
  const [password, setPass] = useState('')
  const [passError, setPassError] = useState('')
  const [activeTab, setActiveTab] = useState('registrations')

  function handleLogin() {
    if (password === ADMIN_PASSWORD) {
      setAuth(true)
    } else {
      setPassError('Невірний пароль')
    }
  }

  // ─── Екран входу ───
  if (!auth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-4">
        <div className="w-full max-w-xs flex flex-col gap-4">
          <h1 className="font-bebas text-3xl tracking-widest text-white text-center">АДМІН ПАНЕЛЬ</h1>
          <p className="text-xs text-[#555] text-center font-mono">NOVA SYSTEM v2.0</p>

          <Input
            label="Пароль"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => { setPass(e.target.value); setPassError('') }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            autoFocus
          />
          {passError && <ErrorMsg text={passError} />}
          <Button variant="accent" className="w-full" onClick={handleLogin}>
            УВІЙТИ
          </Button>
          <a href="/" className="text-xs text-[#333] text-center hover:text-[#555]">← На головну</a>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'registrations', label: '👤 Заявки' },
    { id: 'approvals',   label: '✓ Підтвердження' },
    { id: 'tasks',       label: 'Завдання' },
    { id: 'tests',       label: 'Тести' },
    { id: 'surveys',     label: '🧠 Опитування' },
    { id: 'players',     label: 'Гравці' },
    { id: 'stats',       label: '📊 Статистика' },
    { id: 'disciplines', label: 'Дисципліни' },
    { id: 'buildings',   label: 'Будівлі' },
    { id: 'mail',        label: 'Пошта' },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <header className="sticky top-0 z-40 bg-[var(--bg2)] border-b border-[var(--border)] p-3">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="font-bebas text-2xl tracking-widest text-white">АДМІН ПАНЕЛЬ</h1>
            <p className="text-xs text-[var(--accent)] font-mono">NOVA SYSTEM</p>
          </div>
          <button
            onClick={() => setAuth(false)}
            className="text-xs text-[#555] hover:text-[var(--accent)]"
          >
            ВИЙТИ
          </button>
        </div>
      </header>

      {/* Вкладки (горизонтальний скрол) */}
      <div className="sticky top-[57px] z-30 bg-[var(--bg2)] border-b border-[var(--border)]">
        <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
      </div>

      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
        {activeTab === 'registrations' && <RegistrationsTab />}
        {activeTab === 'approvals'   && <ApprovalsTab />}
        {activeTab === 'tasks'       && <TasksTab type="open" />}
        {activeTab === 'tests'       && <TasksTab type="test" />}
        {activeTab === 'surveys'     && <SurveysTab />}
        {activeTab === 'players'     && <PlayersTab />}
        {activeTab === 'stats'       && <StatsTab />}
        {activeTab === 'disciplines' && <DisciplinesTab />}
        {activeTab === 'buildings'   && <BuildingsTab />}
        {activeTab === 'mail'        && <MailTab />}
      </main>
    </div>
  )
}

// ─── РЕЄСТРАЦІЇ ───────────────────────────────────────────────
function RegistrationsTab() {
  const [pending, setPending]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [processing, setProcessing] = useState(null)
  const [error, setError]         = useState('')

  useEffect(() => {
    const unsub = subscribePendingPlayers((data) => {
      setPending(data)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  async function handleApprove(p) {
    setProcessing(p.id)
    try { await approvePlayer(p.id) } catch { setError('Помилка підтвердження') }
    finally { setProcessing(null) }
  }

  async function handleReject(p) {
    setProcessing(p.id)
    try { await rejectPlayer(p.id) } catch { setError('Помилка відхилення') }
    finally { setProcessing(null) }
  }

  if (loading) return <Spinner text="Завантаження..." />

  return (
    <div className="flex flex-col gap-3 py-3">
      {error && <ErrorMsg text={error} />}
      {pending.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-[#888]">
          <div className="w-2 h-2 rounded-full bg-[var(--gold)] animate-pulse" />
          {pending.length} нових заявок
        </div>
      )}
      {pending.length === 0 ? (
        <EmptyState icon="✅" text="Нових заявок немає" />
      ) : (
        pending.map(p => (
          <Card key={p.id} className={processing === p.id ? 'opacity-50 pointer-events-none' : ''}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <div className="font-semibold text-white">{p.firstName} {p.lastName}</div>
                <div className="text-xs text-[#888] font-mono">@{p.nickname}</div>
              </div>
              <div className="text-right text-xs text-[#555]">
                <div>{GROUPS_CONFIG[p.group]?.label || p.group}</div>
                <div>{HERO_CLASSES_MAP[p.heroClass] || p.heroClass}</div>
              </div>
            </div>
            {p.heroName && (
              <div className="text-xs text-[#555] mb-2">
                Позивний: <span className="text-[var(--neon)]">{p.heroName}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="neon"
                className="text-sm py-2"
                disabled={processing === p.id}
                onClick={() => handleApprove(p)}
              >
                ✓ Прийняти
              </Button>
              <Button
                variant="ghost"
                className="text-sm py-2"
                disabled={processing === p.id}
                onClick={() => handleReject(p)}
              >
                ✗ Відхилити
              </Button>
            </div>
          </Card>
        ))
      )}
    </div>
  )
}

// ─── ПІДТВЕРДЖЕННЯ ────────────────────────────────────────────
function ApprovalsTab() {
  const [subs, setSubs]       = useState([])
  const [taskMap, setTaskMap] = useState({}) // id → task
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [processing, setProcessing] = useState(null) // id що обробляється

  useEffect(() => {
    // Завантажуємо всі завдання один раз (getDocs)
    getAllTasks().then(tasks => {
      const map = {}
      tasks.forEach(t => { map[t.id] = t })
      setTaskMap(map)
    }).catch(() => {}) // помилка не критична — taskMap просто буде порожнім

    // Підписка на pending здачі (реальний час)
    const unsub = subscribePendingSubmissions(
      (data) => { setSubs(data); setLoading(false) },
      (err)  => { setError(err.message || 'Помилка Firebase'); setLoading(false) }
    )
    return () => unsub()
  }, [])

  async function handleApprove(sub) {
    setError('')
    setProcessing(sub.id)
    // Беремо reward з taskMap або порожнє
    const task = taskMap[sub.taskId] || { id: sub.taskId, title: sub.taskTitle, reward: {} }
    try {
      await approveSubmission(sub.id, sub.playerId, task)
    } catch (err) {
      setError(err.message || 'Помилка підтвердження')
    } finally {
      setProcessing(null)
    }
  }

  async function handleReject(sub) {
    setProcessing(sub.id)
    try {
      await rejectSubmission(sub.id, sub.playerId, sub.taskTitle)
    } catch {
      setError('Помилка відхилення')
    } finally {
      setProcessing(null)
    }
  }

  if (loading) return <Spinner text="Завантаження..." />

  return (
    <div className="flex flex-col gap-3 py-3">
      {error && <ErrorMsg text={error} />}

      {/* Лічильник */}
      {subs.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-[#888]">
          <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
          {subs.length} очікують підтвердження
        </div>
      )}

      {subs.length === 0 ? (
        <EmptyState icon="✅" text="Немає завдань на підтвердження" />
      ) : (
        subs.map(sub => {
          const task    = taskMap[sub.taskId]
          const isProc  = processing === sub.id
          const timeStr = sub.submittedAt?.toDate?.().toLocaleTimeString('uk-UA', {
            hour: '2-digit', minute: '2-digit'
          }) || ''

          return (
            <Card key={sub.id} className={isProc ? 'opacity-50 pointer-events-none' : ''}>
              {/* Шапка */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="font-semibold text-white">{sub.playerName}</div>
                  <div className="text-xs text-[#888]">
                    {sub.playerHeroName} · {GROUPS_CONFIG[sub.group]?.label || sub.group}
                  </div>
                </div>
                <span className="text-xs text-[#555] font-mono shrink-0">{timeStr}</span>
              </div>

              {/* Завдання */}
              <div className="flex items-center gap-2 mb-3 p-2 bg-[var(--bg3)] rounded">
                <span className={`
                  text-[10px] font-bold uppercase px-1.5 py-0.5 rounded
                  ${sub.type === 'test'
                    ? 'bg-[rgba(0,170,255,0.2)] text-[var(--info)]'
                    : 'bg-[rgba(255,69,0,0.2)] text-[var(--accent)]'
                  }
                `}>
                  {sub.type === 'test' ? 'ТЕСТ' : 'ВІДКРИТЕ'}
                </span>
                <span className="text-sm text-white flex-1">{sub.taskTitle}</span>
              </div>

              {/* Нагорода (якщо завдання знайдено) */}
              {task?.reward && Object.values(task.reward).some(v => v > 0) && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span className="text-xs text-[#555]">Нагорода:</span>
                  {Object.entries(task.reward).map(([res, amt]) =>
                    amt > 0 ? <ResourceBadge key={res} resource={res} amount={amt} /> : null
                  )}
                </div>
              )}

              {/* Кнопки */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="neon"
                  className="text-sm py-2"
                  disabled={isProc}
                  onClick={() => handleApprove(sub)}
                >
                  {isProc ? '...' : '✓ ПІДТВЕРДИТИ'}
                </Button>
                <Button
                  variant="ghost"
                  className="text-sm py-2"
                  disabled={isProc}
                  onClick={() => handleReject(sub)}
                >
                  ✕ ВІДХИЛИТИ
                </Button>
              </div>
            </Card>
          )
        })
      )}
    </div>
  )
}

// ─── ЗАВДАННЯ / ТЕСТИ ─────────────────────────────────────────
function TasksTab({ type }) {
  const [disciplines, setDisciplines] = useState([])
  const [tasks, setTasks]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [feedback, setFeedback]       = useState({ type: '', text: '' })

  // Форма
  const [title, setTitle]         = useState('')
  const [desc, setDesc]           = useState('')
  const [story, setStory]         = useState('')
  const [discId, setDiscId]       = useState('')
  const [groups, setGroups]       = useState([])
  const [reward, setReward]       = useState({ gold: '', crystals: '' })
  // Питання для тесту
  const [questions, setQuestions] = useState(
    Array.from({ length: 5 }, (_, i) => ({
      id: i + 1, text: '', options: { A: '', B: '', C: '', D: '' }, correct: 'A'
    }))
  )

  useEffect(() => {
    getDisciplines()
      .then(setDisciplines)
      .catch(() => {})

    // Підписка на всі активні завдання (один запит)
    const unsub = subscribeAllActiveTasks(
      (all) => {
        const filtered = all.filter(t =>
          type === 'test'
            ? t.type === 'test'
            : t.type === 'open' || !t.type
        )
        filtered.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
        setTasks(filtered)
        setLoading(false)
      },
      (err) => {
        setFeedback({ type: 'error', text: err.message || 'Помилка Firebase' })
        setLoading(false)
      }
    )
    return () => unsub()
  }, [type])

  // Дисципліна і її ресурси
  const selectedDisc = disciplines.find(d => d.id === discId)
  const discResources = selectedDisc?.resources || []

  function handleGroupToggle(group) {
    setGroups(prev => prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group])
  }

  function updateQuestion(idx, field, value) {
    setQuestions(prev => {
      const next = [...prev]
      if (field.startsWith('opt_')) {
        const opt = field.replace('opt_', '')
        next[idx] = { ...next[idx], options: { ...next[idx].options, [opt]: value } }
      } else {
        next[idx] = { ...next[idx], [field]: value }
      }
      return next
    })
  }

  async function handleCreate() {
    if (!title || !discId || groups.length === 0) {
      setFeedback({ type: 'error', text: 'Заповніть назву, дисципліну та групи' })
      return
    }
    if (type === 'test') {
      const incomplete = questions.some(q => !q.text || Object.values(q.options).some(o => !o))
      if (incomplete) {
        setFeedback({ type: 'error', text: 'Заповніть всі питання та варіанти відповідей' })
        return
      }
    }

    // Формуємо нагороду
    const taskReward = { gold: parseInt(reward.gold) || 0, crystals: parseInt(reward.crystals) || 0 }
    discResources.forEach(r => {
      taskReward[r.id] = parseInt(reward[r.id]) || 0
    })

    try {
      await createTask({
        title, description: desc, storyText: story,
        disciplineId: discId, type, groups, reward: taskReward,
        ...(type === 'test' ? { questions } : {}),
      })
      setFeedback({ type: 'success', text: 'Завдання опубліковано!' })
      setShowForm(false)
      setTitle(''); setDesc(''); setStory(''); setDiscId(''); setGroups([]); setReward({ gold: '', crystals: '' })
    } catch (err) {
      setFeedback({ type: 'error', text: 'Помилка створення' })
    }
    setTimeout(() => setFeedback({ type: '', text: '' }), 3000)
  }

  if (loading) return <Spinner />

  return (
    <div className="flex flex-col gap-4 py-3">
      {feedback.text && (feedback.type === 'error' ? <ErrorMsg text={feedback.text} /> : <SuccessMsg text={feedback.text} />)}

      <Button variant="accent" onClick={() => setShowForm(!showForm)}>
        {showForm ? '✕ ЗАКРИТИ ФОРМУ' : `+ НОВЕ ${type === 'test' ? 'ТЕСТ-ЗАВДАННЯ' : 'ЗАВДАННЯ'}`}
      </Button>

      {/* ─── Форма ─── */}
      {showForm && (
        <Card>
          <div className="flex flex-col gap-3">
            <Input label="Назва завдання" value={title} onChange={e => setTitle(e.target.value)} />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#888]">Опис</label>
              <textarea
                className="input h-20 resize-none"
                placeholder="Детальний опис завдання..."
                value={desc}
                onChange={e => setDesc(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#888]">Сюжетна вставка (лор)</label>
              <textarea
                className="input h-16 resize-none"
                placeholder="Командир бункеру передав..."
                value={story}
                onChange={e => setStory(e.target.value)}
              />
            </div>

            {/* Дисципліна */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#888]">Дисципліна</label>
              <select className="input" value={discId} onChange={e => setDiscId(e.target.value)}>
                <option value="">Оберіть дисципліну...</option>
                {disciplines.map(d => (
                  <option key={d.id} value={d.id}>{d.icon} {d.name}</option>
                ))}
              </select>
            </div>

            {/* Нагорода */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[#888] block mb-2">Нагорода</label>
              <div className="grid grid-cols-2 gap-2">
                <Input label="🪙 Золото" type="number" value={reward.gold}
                  onChange={e => setReward(p => ({ ...p, gold: e.target.value }))} />
                <Input label="💎 Кристали" type="number" value={reward.crystals}
                  onChange={e => setReward(p => ({ ...p, crystals: e.target.value }))} />
                {discResources.map(r => (
                  <Input key={r.id} label={`${r.icon} ${r.name}`} type="number"
                    value={reward[r.id] || ''}
                    onChange={e => setReward(p => ({ ...p, [r.id]: e.target.value }))} />
                ))}
              </div>
            </div>

            {/* Групи */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[#888] block mb-2">Групи</label>
              <div className="flex flex-wrap gap-2">
                {GROUP_KEYS.map(g => (
                  <button
                    key={g}
                    onClick={() => handleGroupToggle(g)}
                    className={`
                      px-3 py-1.5 rounded border text-sm font-semibold transition-all
                      ${groups.includes(g)
                        ? 'border-[var(--accent)] bg-[rgba(255,69,0,0.1)] text-[var(--accent)]'
                        : 'border-[var(--border)] text-[#555] hover:border-[#333]'
                      }
                    `}
                  >
                    {GROUPS_CONFIG[g].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Питання для тесту */}
            {type === 'test' && (
              <div className="flex flex-col gap-4 pt-2 border-t border-[var(--border)]">
                <p className="text-xs text-[#555] uppercase tracking-wider">Питання тесту (5 питань)</p>
                {questions.map((q, idx) => (
                  <div key={q.id} className="flex flex-col gap-2 p-3 bg-[var(--bg3)] rounded">
                    <textarea
                      className="input h-14 resize-none text-sm"
                      placeholder={`Питання ${idx + 1}`}
                      value={q.text}
                      onChange={e => updateQuestion(idx, 'text', e.target.value)}
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                      {['A', 'B', 'C', 'D'].map(opt => (
                        <div key={opt} className="flex items-center gap-1">
                          <span className="font-mono text-xs text-[var(--accent)] w-4">{opt}.</span>
                          <input
                            className="input text-sm py-1"
                            placeholder={`Варіант ${opt}`}
                            value={q.options[opt]}
                            onChange={e => updateQuestion(idx, `opt_${opt}`, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#555]">Правильна відповідь:</span>
                      {['A', 'B', 'C', 'D'].map(opt => (
                        <button
                          key={opt}
                          onClick={() => updateQuestion(idx, 'correct', opt)}
                          className={`
                            w-8 h-8 rounded font-mono text-sm font-bold transition-all
                            ${q.correct === opt
                              ? 'bg-[var(--neon)] text-black'
                              : 'bg-[var(--border)] text-[#555] hover:bg-[#2a2a3a]'
                            }
                          `}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button variant="accent" className="w-full" onClick={handleCreate}>
              ОПУБЛІКУВАТИ
            </Button>
          </div>
        </Card>
      )}

      {/* Список завдань */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-[#555] uppercase tracking-wider">
          Активних: {tasks.length}
        </p>
        {tasks.length === 0 && !showForm && (
          <EmptyState icon={type === 'test' ? '📝' : '📋'} text="Немає активних завдань" />
        )}
        {tasks.map(task => (
          <Card key={task.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white truncate">{task.title}</div>
                <div className="text-xs text-[#555] mt-0.5">
                  {task.groups?.map(g => GROUPS_CONFIG[g]?.label || g).join(', ')}
                  {type === 'test' && task.questions?.length > 0 && (
                    <span className="ml-2 text-[var(--info)]">{task.questions.length} питань</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => deactivateTask(task.id)}
                className="text-[10px] text-[#444] hover:text-[var(--accent)] uppercase tracking-wider shrink-0 transition-colors"
              >
                деакт.
              </button>
            </div>
            {task.reward && Object.values(task.reward).some(v => v > 0) && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {Object.entries(task.reward).map(([res, amt]) =>
                  amt > 0 ? <ResourceBadge key={res} resource={res} amount={amt} /> : null
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}

// ─── СТАТИСТИКА ───────────────────────────────────────────────
function StatsTab() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllPlayers()
      .then(data => { setPlayers(data); setLoading(false) })
      .catch(err => { console.error(err); setLoading(false) })
  }, [])

  if (loading) return <Spinner />

  const total = players.length

  // По групах
  const byGroup = GROUP_KEYS.map(g => {
    const gPlayers = players.filter(p => p.group === g)
    const avgXP = gPlayers.length
      ? Math.round(gPlayers.reduce((s, p) => s + (p.heroXP || 0), 0) / gPlayers.length)
      : 0
    return { g, count: gPlayers.length, avgXP }
  })

  // Топ-10 за XP
  const top10 = [...players]
    .sort((a, b) => (b.heroXP || 0) - (a.heroXP || 0))
    .slice(0, 10)

  // Ресурси в грі (сума по всіх)
  const totalResources = players.reduce((acc, p) => {
    for (const [res, amt] of Object.entries(p.resources || {})) {
      acc[res] = (acc[res] || 0) + amt
    }
    return acc
  }, {})

  const rankBadge = ['🥇', '🥈', '🥉']

  return (
    <div className="flex flex-col gap-5 py-3">

      {/* Загальна статистика */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center py-4">
          <div className="font-bebas text-4xl text-[var(--accent)]">{total}</div>
          <div className="text-xs text-[#555] mt-0.5">Гравців загалом</div>
        </Card>
        <Card className="text-center py-4">
          <div className="font-bebas text-4xl text-[var(--neon)]">
            {players.length ? Math.round(players.reduce((s, p) => s + (p.heroXP || 0), 0) / players.length) : 0}
          </div>
          <div className="text-xs text-[#555] mt-0.5">Середній XP</div>
        </Card>
      </div>

      {/* Гравці по групах */}
      <section>
        <p className="text-xs text-[#555] uppercase tracking-wider mb-2">По групах</p>
        <div className="flex flex-col gap-2">
          {byGroup.map(({ g, count, avgXP }) => (
            <div key={g} className="flex items-center gap-3 p-3 card">
              <div className="font-bebas text-lg text-[var(--accent)] w-14">{GROUPS_CONFIG[g].label}</div>
              <div className="flex-1">
                <div className="h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] rounded-full transition-all"
                    style={{ width: total > 0 ? `${(count / total) * 100}%` : '0%' }}
                  />
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-semibold text-white">{count} грав.</div>
                <div className="text-xs text-[#555] font-mono">{avgXP} XP avg</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Топ-10 гравців */}
      <section>
        <p className="text-xs text-[#555] uppercase tracking-wider mb-2">Топ гравці</p>
        <div className="flex flex-col divide-y divide-[var(--border)] border border-[var(--border)] rounded-lg overflow-hidden">
          {top10.map((p, i) => {
            const level = getHeroLevel(p.heroXP || 0)
            return (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2 bg-[var(--card)]">
                <span className="text-base w-7 text-center">
                  {rankBadge[i] || <span className="text-xs text-[#444] font-mono">{i + 1}</span>}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{p.name}</div>
                  <div className="text-xs text-[#555]">{GROUPS_CONFIG[p.group]?.label || p.group} · {p.heroName}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-sm text-[var(--gold)]">Рів. {level}</div>
                  <div className="text-xs text-[#444] font-mono">{p.heroXP || 0} XP</div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Ресурси в грі */}
      <section>
        <p className="text-xs text-[#555] uppercase tracking-wider mb-2">Ресурси в грі (всього)</p>
        <Card>
          <div className="flex flex-wrap gap-3">
            {Object.entries(totalResources).map(([res, amt]) => {
              const info = RESOURCE_ICONS[res]
              if (!info || !amt) return null
              return (
                <div key={res} className="flex items-center gap-1.5">
                  <span className="text-lg">{info.icon}</span>
                  <div>
                    <div className="font-mono text-sm font-bold" style={{ color: info.color }}>
                      {amt.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-[#555]">{info.name}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </section>
    </div>
  )
}

// ─── ГРАВЦІ ───────────────────────────────────────────────────
// Список ключових будівель для таблиці прогресу
const PROGRESS_BUILDINGS = [
  { id: 'server',    icon: '🖥️', label: 'Сервер'    },
  { id: 'lab',       icon: '🧪', label: 'Лаб'       },
  { id: 'tower',     icon: '📡', label: 'Вежа'      },
  { id: 'archive',   icon: '🗄️', label: 'Архів'     },
  { id: 'firewall',  icon: '🛡️', label: 'Файрвол'   },
  { id: 'castle',    icon: '🏰', label: 'Замок'      },
]

function exportPlayersCSV(players) {
  const headers = ['Імʼя', 'Герой', 'Рівень', 'Клас', 'XP', 'Золото', 'Bits', 'Energy', 'Bio',
    'Сервер', 'Лаб', 'Вежа', 'Архів', 'Файрвол', 'Замок', 'Остання активність']
  const rows = players.map(p => [
    p.name || '',
    p.heroName || '',
    p.heroLevel || 1,
    p.heroClass || '',
    p.heroXP || 0,
    p.resources?.gold || 0,
    p.resources?.bits || 0,
    p.resources?.energy || 0,
    p.resources?.bio || 0,
    p.buildings?.server?.level || 0,
    p.buildings?.lab?.level || 0,
    p.buildings?.tower?.level || 0,
    p.buildings?.archive?.level || 0,
    p.buildings?.firewall?.level || 0,
    p.buildings?.castle?.level || 0,
    p.lastActive?.toDate?.().toLocaleDateString('uk-UA') || '',
  ])
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `players_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function PlayersTab() {
  const [players, setPlayers]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [activeGroup, setGroup]   = useState('PD11')
  const [search, setSearch]       = useState('')
  const [tableView, setTableView] = useState(false)

  useEffect(() => {
    getAllPlayers()
      .then(data => { setPlayers(data); setLoading(false) })
      .catch(err => { console.error(err); setLoading(false) })
  }, [])

  if (loading) return <Spinner />

  const groupTabs = GROUP_KEYS.map(g => ({ id: g, label: GROUPS_CONFIG[g].label }))
  const filtered = players
    .filter(p => p.group === activeGroup)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (b.heroXP || 0) - (a.heroXP || 0))

  return (
    <div className="flex flex-col gap-3 py-3">
      <Tabs tabs={groupTabs} active={activeGroup} onChange={setGroup} />

      <div className="flex gap-2">
        <input
          className="input text-sm flex-1"
          placeholder="Пошук за іменем..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button
          className="text-xs font-mono px-2 py-1 rounded border border-[var(--border)] text-[#555] hover:border-[var(--neon)] hover:text-[var(--neon)] transition-colors whitespace-nowrap"
          onClick={() => setTableView(v => !v)}
        >
          {tableView ? '🃏 Картки' : '📊 Таблиця'}
        </button>
        <button
          className="text-xs font-mono px-2 py-1 rounded border border-[var(--border)] text-[#555] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors whitespace-nowrap"
          onClick={() => exportPlayersCSV(filtered)}
          title="Завантажити CSV"
        >
          📥 CSV
        </button>
      </div>

      <p className="text-xs text-[#555]">{filtered.length} гравців (сортування по XP)</p>

      {filtered.length === 0 ? (
        <EmptyState icon="👥" text="Гравців не знайдено" />
      ) : tableView ? (
        /* ── Табличний вигляд ── */
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full text-[11px] font-mono">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg3)]">
                <th className="text-left px-2 py-1.5 text-[#555]">#</th>
                <th className="text-left px-2 py-1.5 text-[#555]">Імʼя</th>
                <th className="text-left px-2 py-1.5 text-[#555]">Герой / Рів.</th>
                <th className="text-left px-2 py-1.5 text-[#555]">XP</th>
                {PROGRESS_BUILDINGS.map(b => (
                  <th key={b.id} className="text-center px-1.5 py-1.5 text-[#555]" title={b.label}>{b.icon}</th>
                ))}
                <th className="text-left px-2 py-1.5 text-[#555]">🪙</th>
                <th className="text-left px-2 py-1.5 text-[#555]">Активність</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.id} className="border-b border-[var(--border)] hover:bg-[var(--bg3)] transition-colors">
                  <td className="px-2 py-1.5 text-[#444]">{i + 1}</td>
                  <td className="px-2 py-1.5 text-white font-semibold">{p.name}</td>
                  <td className="px-2 py-1.5 text-[#888]">{p.heroName} · {p.heroLevel || 1}</td>
                  <td className="px-2 py-1.5 text-[var(--gold)]">{p.heroXP || 0}</td>
                  {PROGRESS_BUILDINGS.map(b => {
                    const lvl = p.buildings?.[b.id]?.level || 0
                    return (
                      <td key={b.id} className="text-center px-1.5 py-1.5">
                        <span style={{ color: lvl > 0 ? 'var(--neon)' : '#333' }}>{lvl > 0 ? lvl : '—'}</span>
                      </td>
                    )
                  })}
                  <td className="px-2 py-1.5 text-[#ffaa00]">{p.resources?.gold || 0}</td>
                  <td className="px-2 py-1.5 text-[#444]">
                    {p.lastActive?.toDate?.().toLocaleDateString('uk-UA') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── Картковий вигляд ── */
        filtered.map((p, i) => (
          <Card key={p.id}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-[#444]">#{i + 1}</span>
                  <div className="font-semibold text-white">{p.name}</div>
                </div>
                <div className="text-xs text-[#888]">{p.heroName} · Рівень {p.heroLevel || 1} · {p.heroXP || 0} XP</div>
              </div>
              <div className="text-xs text-[#555]">
                {p.lastActive?.toDate?.().toLocaleDateString('uk-UA')}
              </div>
            </div>
            {/* Прогрес будівель */}
            <div className="flex gap-1 mb-2 flex-wrap">
              {PROGRESS_BUILDINGS.map(b => {
                const lvl = p.buildings?.[b.id]?.level || 0
                return (
                  <span key={b.id} className="text-[9px] font-mono px-1 py-0.5 rounded"
                    style={{
                      color:      lvl > 0 ? 'var(--neon)' : '#333',
                      background: lvl > 0 ? 'rgba(0,255,136,0.08)' : 'var(--bg3)',
                      border:     `1px solid ${lvl > 0 ? 'rgba(0,255,136,0.2)' : 'var(--border)'}`,
                    }}
                    title={b.label}
                  >
                    {b.icon} {lvl > 0 ? lvl : '—'}
                  </span>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(p.resources || {}).map(([res, amount]) =>
                amount > 0 ? <ResourceBadge key={res} resource={res} amount={amount} /> : null
              )}
            </div>
          </Card>
        ))
      )}
    </div>
  )
}

// ─── ДИСЦИПЛІНИ ───────────────────────────────────────────────
function DisciplinesTab() {
  const [disciplines, setDisciplines] = useState([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [feedback, setFeedback]       = useState({ type: '', text: '' })

  // Форма нової дисципліни
  const [name, setName]         = useState('')
  const [icon, setIcon]         = useState('')
  const [color, setColor]       = useState('#00aaff')
  const [discId, setDiscId]     = useState('')
  const [resources, setResources] = useState([
    { id: '', name: '', icon: '', description: '' },
    { id: '', name: '', icon: '', description: '' },
  ])

  useEffect(() => {
    getDisciplines()
      .then(data => { setDisciplines(data); setLoading(false) })
      .catch(err => { setFeedback({ type: 'error', text: err.message || 'Помилка Firebase' }); setLoading(false) })
  }, [])

  function updateResource(idx, field, value) {
    setResources(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })
  }

  function addResource() {
    setResources(prev => [...prev, { id: '', name: '', icon: '', description: '' }])
  }

  async function handleCreate() {
    if (!name || !discId || !icon) {
      setFeedback({ type: 'error', text: 'Заповніть назву, ID та іконку' })
      return
    }
    const validRes = resources.filter(r => r.id && r.name)
    if (validRes.length < 1) {
      setFeedback({ type: 'error', text: 'Додайте мінімум 1 ресурс' })
      return
    }

    try {
      await addDiscipline({ id: discId, name, icon, color, active: true, resources: validRes })
      setDisciplines(prev => [...prev, { id: discId, name, icon, color, active: true, resources: validRes }])
      setFeedback({ type: 'success', text: 'Дисципліну додано!' })
      setShowForm(false)
      setName(''); setIcon(''); setDiscId(''); setColor('#00aaff')
      setResources([{ id: '', name: '', icon: '', description: '' }, { id: '', name: '', icon: '', description: '' }])
    } catch (err) {
      setFeedback({ type: 'error', text: 'Помилка збереження' })
    }
    setTimeout(() => setFeedback({ type: '', text: '' }), 3000)
  }

  if (loading) return <Spinner />

  return (
    <div className="flex flex-col gap-4 py-3">
      {feedback.text && (feedback.type === 'error' ? <ErrorMsg text={feedback.text} /> : <SuccessMsg text={feedback.text} />)}

      {/* Список існуючих */}
      <div className="flex flex-col gap-2">
        {disciplines.map(d => (
          <Card key={d.id}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{d.icon}</span>
              <div>
                <div className="font-semibold text-white">{d.name}</div>
                <div className="text-xs text-[#555] font-mono">{d.id}</div>
              </div>
              <div className="ml-auto w-4 h-4 rounded-full" style={{ background: d.color }} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {d.resources?.map(r => (
                <span key={r.id} className="resource-badge text-xs">{r.icon} {r.name}</span>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Button variant="accent" onClick={() => setShowForm(!showForm)}>
        {showForm ? '✕ ЗАКРИТИ' : '+ НОВА ДИСЦИПЛІНА'}
      </Button>

      {showForm && (
        <Card>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2">
              <Input label="ID (eng)" placeholder="math" value={discId} onChange={e => setDiscId(e.target.value)} />
              <Input label="Назва" placeholder="Математика" value={name} onChange={e => setName(e.target.value)} />
              <Input label="Іконка" placeholder="📐" value={icon} onChange={e => setIcon(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#888]">Колір</label>
              <input type="color" value={color} onChange={e => setColor(e.target.value)}
                className="h-10 w-full rounded border border-[var(--border)] bg-[var(--bg2)] cursor-pointer" />
            </div>

            {/* Ресурси */}
            <div className="flex flex-col gap-3 pt-2 border-t border-[var(--border)]">
              <p className="text-xs text-[#555] uppercase tracking-wider">Ресурси дисципліни</p>
              {resources.map((r, idx) => (
                <div key={idx} className="grid grid-cols-2 gap-2 p-2 bg-[var(--bg3)] rounded">
                  <Input label="ID" placeholder="formula" value={r.id} onChange={e => updateResource(idx, 'id', e.target.value)} />
                  <Input label="Назва" placeholder="Формули" value={r.name} onChange={e => updateResource(idx, 'name', e.target.value)} />
                  <Input label="Іконка" placeholder="📊" value={r.icon} onChange={e => updateResource(idx, 'icon', e.target.value)} />
                  <Input label="Опис" placeholder="За задачі" value={r.description} onChange={e => updateResource(idx, 'description', e.target.value)} />
                </div>
              ))}
              <Button variant="ghost" className="text-sm" onClick={addResource}>+ Додати ресурс</Button>
            </div>

            <Button variant="accent" className="w-full" onClick={handleCreate}>ЗБЕРЕГТИ ДИСЦИПЛІНУ</Button>
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── БУДІВЛІ ──────────────────────────────────────────────────
function BuildingsTab() {
  const [disciplines, setDisciplines]   = useState([])
  const [buildings, setBuildingsList]   = useState([])
  const [selDisc, setSelDisc]           = useState('')
  const [loading, setLoading]           = useState(true)
  const [showForm, setShowForm]         = useState(false)
  const [feedback, setFeedback]         = useState({ type: '', text: '' })

  // Форма будівлі
  const [bId, setBId]     = useState('')
  const [bName, setBName] = useState('')
  const [bIcon, setBIcon] = useState('')
  const [bDesc, setBDesc] = useState('')
  const [levels, setLevels] = useState([
    { level: 1, cost: { gold: '' }, production: {}, workerSlots: 1 },
    { level: 2, cost: { gold: '' }, production: {}, workerSlots: 2 },
    { level: 3, cost: { gold: '' }, production: {}, workerSlots: 3 },
  ])

  useEffect(() => {
    Promise.all([getDisciplines(), getBuildings()])
      .then(([discs, builds]) => {
        setDisciplines(discs)
        setBuildingsList(builds)
        if (discs.length > 0 && !selDisc) setSelDisc(discs[0].id)
      })
      .catch(err => { setFeedback({ type: 'error', text: err.message || 'Помилка Firebase' }) })
      .finally(() => setLoading(false))
  }, [])

  const filteredBuildings = buildings.filter(b => b.disciplineId === selDisc)

  async function handleCreate() {
    if (!bId || !bName || !selDisc) {
      setFeedback({ type: 'error', text: 'Заповніть ID, назву та оберіть дисципліну' })
      return
    }
    try {
      const buildingData = {
        id: bId, name: bName, icon: bIcon, description: bDesc,
        disciplineId: selDisc, unlockHeroLevel: 1, levels,
        synergyBonus: { minWorkers: 2, bonus: {} },
      }
      await addBuilding(buildingData)
      setBuildingsList(prev => [...prev, buildingData])
      setFeedback({ type: 'success', text: 'Будівлю додано!' })
      setShowForm(false)
      setBId(''); setBName(''); setBIcon(''); setBDesc('')
    } catch (err) {
      setFeedback({ type: 'error', text: 'Помилка збереження' })
    }
    setTimeout(() => setFeedback({ type: '', text: '' }), 3000)
  }

  if (loading) return <Spinner />

  const discTabs = disciplines.map(d => ({ id: d.id, label: `${d.icon} ${d.name}` }))

  return (
    <div className="flex flex-col gap-4 py-3">
      {feedback.text && (feedback.type === 'error' ? <ErrorMsg text={feedback.text} /> : <SuccessMsg text={feedback.text} />)}

      <Tabs tabs={discTabs} active={selDisc} onChange={setSelDisc} />

      <div className="flex flex-col gap-2">
        {filteredBuildings.map(b => (
          <div key={b.id} className="card flex items-center gap-3">
            <span className="text-2xl">{b.icon}</span>
            <div>
              <div className="font-semibold text-white">{b.name}</div>
              <div className="text-xs text-[#555]">{b.description}</div>
            </div>
          </div>
        ))}
      </div>

      <Button variant="accent" onClick={() => setShowForm(!showForm)}>
        {showForm ? '✕ ЗАКРИТИ' : '+ НОВА БУДІВЛЯ'}
      </Button>

      {showForm && (
        <Card>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2">
              <Input label="ID" placeholder="library" value={bId} onChange={e => setBId(e.target.value)} />
              <Input label="Назва" placeholder="Бібліотека" value={bName} onChange={e => setBName(e.target.value)} />
              <Input label="Іконка" placeholder="📚" value={bIcon} onChange={e => setBIcon(e.target.value)} />
            </div>
            <Input label="Опис" placeholder="Що виробляє..." value={bDesc} onChange={e => setBDesc(e.target.value)} />

            <p className="text-xs text-[#555] uppercase tracking-wider pt-2 border-t border-[var(--border)]">
              Рівні (спрощено — тільки золото за вартість)
            </p>
            {levels.map((lvl, idx) => (
              <div key={idx} className="grid grid-cols-3 gap-2 items-center">
                <div className="text-xs text-[#888]">Рівень {idx + 1}</div>
                <Input label="Вартість (🪙)" type="number"
                  value={lvl.cost.gold}
                  onChange={e => setLevels(prev => {
                    const next = [...prev]
                    next[idx] = { ...next[idx], cost: { gold: parseInt(e.target.value) || 0 } }
                    return next
                  })}
                />
                <Input label="Слоти" type="number"
                  value={lvl.workerSlots}
                  onChange={e => setLevels(prev => {
                    const next = [...prev]
                    next[idx] = { ...next[idx], workerSlots: parseInt(e.target.value) || 1 }
                    return next
                  })}
                />
              </div>
            ))}

            <Button variant="accent" className="w-full" onClick={handleCreate}>ЗБЕРЕГТИ БУДІВЛЮ</Button>
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── ПОШТА ────────────────────────────────────────────────────
function MailTab() {
  const [players, setPlayers]   = useState([])
  const [target, setTarget]     = useState('group') // 'group' | 'player'
  const [selGroup, setSelGroup] = useState('PD11')
  const [selPlayer, setSelPlayer] = useState('')
  const [text, setText]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [feedback, setFeedback] = useState({ type: '', text: '' })

  useEffect(() => {
    getAllPlayers()
      .then(setPlayers)
      .catch(err => console.error(err))
  }, [])

  async function handleSend() {
    if (!text.trim()) { setFeedback({ type: 'error', text: 'Введіть текст повідомлення' }); return }
    if (target === 'player' && !selPlayer) { setFeedback({ type: 'error', text: 'Оберіть гравця' }); return }

    setLoading(true)
    try {
      await sendAdminMessage({
        toGroup: target === 'group' ? selGroup : null,
        toPlayerId: target === 'player' ? selPlayer : null,
        text: text.trim(),
      })
      setFeedback({ type: 'success', text: 'Повідомлення надіслано!' })
      setText('')
    } catch (err) {
      setFeedback({ type: 'error', text: 'Помилка надсилання' })
    } finally {
      setLoading(false)
      setTimeout(() => setFeedback({ type: '', text: '' }), 3000)
    }
  }

  return (
    <div className="flex flex-col gap-4 py-3">
      {feedback.text && (feedback.type === 'error' ? <ErrorMsg text={feedback.text} /> : <SuccessMsg text={feedback.text} />)}

      <Card>
        <div className="flex flex-col gap-3">
          {/* Отримувач */}
          <div className="flex gap-2">
            <button
              onClick={() => setTarget('group')}
              className={`flex-1 btn text-sm ${target === 'group' ? 'btn-accent' : 'btn-ghost'}`}
            >
              Вся група
            </button>
            <button
              onClick={() => setTarget('player')}
              className={`flex-1 btn text-sm ${target === 'player' ? 'btn-accent' : 'btn-ghost'}`}
            >
              Гравець
            </button>
          </div>

          {target === 'group' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#888]">Група</label>
              <select className="input" value={selGroup} onChange={e => setSelGroup(e.target.value)}>
                {GROUP_KEYS.map(g => <option key={g} value={g}>{GROUPS_CONFIG[g].label}</option>)}
              </select>
            </div>
          )}

          {target === 'player' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#888]">Гравець</label>
              <select className="input" value={selPlayer} onChange={e => setSelPlayer(e.target.value)}>
                <option value="">Оберіть гравця...</option>
                {players.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.group})</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#888]">Повідомлення</label>
            <textarea
              className="input h-24 resize-none"
              placeholder="Текст повідомлення для гравців..."
              value={text}
              onChange={e => setText(e.target.value)}
            />
          </div>

          <Button variant="accent" className="w-full" onClick={handleSend} disabled={loading}>
            {loading ? 'Надсилаю...' : '📢 НАДІСЛАТИ'}
          </Button>
        </div>
      </Card>
    </div>
  )
}

// ─── ОПИТУВАННЯ ───────────────────────────────────────────────
function SurveysTab() {
  const [surveys, setSurveys]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null) // surveyId для перегляду відповідей
  const [responses, setResponses] = useState([])
  const [respLoading, setRespLoading] = useState(false)
  const [feedback, setFeedback] = useState({ type: '', text: '' })

  // Форма нового опитування
  const [form, setForm] = useState({
    title: '', description: '',
    groups: [],
    cooldownDays: '',
    reward: { gold: '', bits: '' },
    questions: [{ id: 'q1', text: '', type: 'scale', options: [] }],
  })

  const GROUP_KEYS = Object.keys(GROUPS_CONFIG)

  useEffect(() => {
    const unsub = subscribeSurveys(
      GROUP_KEYS[0],
      (data) => { setSurveys(data); setLoading(false) },
      (err)  => { showMsg('error', err.message || 'Помилка Firebase'); setLoading(false) }
    )
    return () => unsub()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function showMsg(type, text) {
    setFeedback({ type, text })
    setTimeout(() => setFeedback({ type: '', text: '' }), 4000)
  }

  async function handleCreate() {
    const questions = form.questions.filter(q => q.text.trim())
    if (!form.title.trim() || questions.length === 0) {
      showMsg('error', 'Вкажи назву і хоча б одне питання')
      return
    }

    const reward = {}
    for (const [res, val] of Object.entries(form.reward)) {
      const n = parseInt(val)
      if (n > 0) reward[res] = n
    }

    try {
      await createSurvey({
        title: form.title.trim(),
        description: form.description.trim(),
        questions,
        reward,
        groups: form.groups.length > 0 ? form.groups : GROUP_KEYS,
        cooldownDays: parseInt(form.cooldownDays) || null,
      })
      showMsg('success', 'Опитування створено!')
      setShowForm(false)
      setForm({
        title: '', description: '', groups: [], cooldownDays: '',
        reward: { gold: '', bits: '' },
        questions: [{ id: 'q1', text: '', type: 'scale', options: [] }],
      })
    } catch (err) {
      showMsg('error', err.message)
    }
  }

  async function handleDeactivate(id) {
    try {
      await deactivateSurvey(id)
      showMsg('success', 'Опитування деактивовано')
    } catch (err) {
      showMsg('error', err.message)
    }
  }

  async function loadResponses(surveyId) {
    setSelected(surveyId)
    setRespLoading(true)
    try {
      const data = await getSurveyResponses(surveyId)
      setResponses(data)
    } finally {
      setRespLoading(false)
    }
  }

  function addQuestion() {
    setForm(f => ({
      ...f,
      questions: [
        ...f.questions,
        { id: `q${f.questions.length + 1}`, text: '', type: 'scale', options: [] },
      ],
    }))
  }

  function updateQuestion(idx, field, val) {
    setForm(f => {
      const qs = [...f.questions]
      qs[idx] = { ...qs[idx], [field]: val }
      return { ...f, questions: qs }
    })
  }

  function removeQuestion(idx) {
    setForm(f => ({ ...f, questions: f.questions.filter((_, i) => i !== idx) }))
  }

  if (loading) return <Spinner text="Завантаження..." />

  return (
    <div className="flex flex-col gap-4">
      {feedback.text && (
        feedback.type === 'error'
          ? <ErrorMsg text={feedback.text} />
          : <SuccessMsg text={feedback.text} />
      )}

      <Button variant="neon" className="w-full" onClick={() => setShowForm(s => !s)}>
        {showForm ? '✕ Закрити форму' : '+ НОВЕ ОПИТУВАННЯ'}
      </Button>

      {/* Форма */}
      {showForm && (
        <Card>
          <h3 className="font-bebas text-lg text-white mb-3 tracking-wider">НОВЕ ОПИТУВАННЯ</h3>
          <div className="flex flex-col gap-3">
            <Input
              label="Назва"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Наприклад: Самооцінка тижня"
            />
            <Input
              label="Опис (необов'язково)"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Короткий опис"
            />

            {/* Нагорода */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#888] mb-1.5">Нагорода</p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="🪙 Золото"
                  type="number"
                  value={form.reward.gold}
                  onChange={e => setForm(f => ({ ...f, reward: { ...f.reward, gold: e.target.value } }))}
                  placeholder="0"
                />
                <Input
                  label="💾 Біти"
                  type="number"
                  value={form.reward.bits}
                  onChange={e => setForm(f => ({ ...f, reward: { ...f.reward, bits: e.target.value } }))}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Кулдаун */}
            <Input
              label="Кулдаун (днів, 0 = одноразово)"
              type="number"
              value={form.cooldownDays}
              onChange={e => setForm(f => ({ ...f, cooldownDays: e.target.value }))}
              placeholder="7"
            />

            {/* Питання */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#888] mb-2">Питання</p>
              <div className="flex flex-col gap-3">
                {form.questions.map((q, i) => (
                  <div key={i} className="bg-[var(--bg3)] rounded-lg p-3 flex flex-col gap-2">
                    <div className="flex gap-2 items-start">
                      <span className="text-xs text-[var(--accent)] font-mono mt-2">{i + 1}.</span>
                      <textarea
                        value={q.text}
                        onChange={e => updateQuestion(i, 'text', e.target.value)}
                        placeholder="Текст питання"
                        rows={2}
                        className="flex-1 input resize-none text-sm"
                      />
                      {form.questions.length > 1 && (
                        <button
                          onClick={() => removeQuestion(i)}
                          className="text-[#555] hover:text-[var(--accent)] text-xs mt-2"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {['scale', 'choice', 'text'].map(t => (
                        <button
                          key={t}
                          onClick={() => updateQuestion(i, 'type', t)}
                          className={`text-xs px-2 py-1 rounded border transition-all ${
                            q.type === t
                              ? 'border-[var(--neon)] text-[var(--neon)] bg-[rgba(0,255,136,0.08)]'
                              : 'border-[var(--border)] text-[#555] hover:border-[#444]'
                          }`}
                        >
                          {t === 'scale' ? '1–5' : t === 'choice' ? 'Вибір' : 'Текст'}
                        </button>
                      ))}
                    </div>
                    {q.type === 'choice' && (
                      <textarea
                        value={(q.options || []).join('\n')}
                        onChange={e => updateQuestion(i, 'options', e.target.value.split('\n').filter(Boolean))}
                        placeholder="Варіанти відповідей (кожен з нового рядка)"
                        rows={3}
                        className="input resize-none text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
              <Button variant="ghost" className="w-full mt-2 text-xs" onClick={addQuestion}>
                + Додати питання
              </Button>
            </div>

            <Button variant="neon" className="w-full" onClick={handleCreate}>
              СТВОРИТИ ОПИТУВАННЯ
            </Button>
          </div>
        </Card>
      )}

      {/* Список опитувань */}
      {surveys.length === 0 ? (
        <EmptyState icon="🧠" text="Немає активних опитувань" />
      ) : (
        surveys.map(survey => (
          <Card key={survey.id}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <div className="font-semibold text-white text-sm">{survey.title}</div>
                <div className="text-xs text-[#555] mt-0.5">
                  {survey.questions?.length || 0} питань
                  {survey.cooldownDays ? ` · кулдаун ${survey.cooldownDays} дн.` : ' · одноразово'}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button
                  variant="ghost"
                  className="text-xs px-2 py-1"
                  onClick={() => selected === survey.id ? setSelected(null) : loadResponses(survey.id)}
                >
                  {selected === survey.id ? 'Сховати' : '👁 Відповіді'}
                </Button>
                <Button
                  variant="ghost"
                  className="text-xs px-2 py-1 text-[var(--accent)] hover:text-[var(--accent)]"
                  onClick={() => handleDeactivate(survey.id)}
                >
                  Закрити
                </Button>
              </div>
            </div>

            {/* Відповіді */}
            {selected === survey.id && (
              <div className="mt-2 border-t border-[var(--border)] pt-2">
                {respLoading ? (
                  <Spinner text="Завантаження відповідей..." />
                ) : responses.length === 0 ? (
                  <p className="text-xs text-[#555] py-2 text-center">Відповідей ще немає</p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                    {responses.map(r => (
                      <div key={r.id} className="bg-[var(--bg3)] rounded p-2">
                        <div className="text-xs font-semibold text-white">{r.playerName}</div>
                        <div className="text-[10px] text-[#555] mb-1">{r.group}</div>
                        {Object.entries(r.answers || {}).map(([qId, ans]) => {
                          const q = survey.questions?.find(q => q.id === qId)
                          return (
                            <div key={qId} className="text-xs">
                              <span className="text-[#666]">{q?.text || qId}: </span>
                              <span className="text-white">{String(ans)}</span>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  )
}
