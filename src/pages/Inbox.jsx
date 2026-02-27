// ─── Inbox Page (/inbox): Повідомлення ───

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useGameStore from '../store/gameStore'
import { subscribeMessages, markMessageRead, markAllMessagesRead } from '../firebase/service'
import { Spinner, EmptyState, BottomNav } from '../components/UI'

const NAV_ITEMS = [
  { id: 'city',   icon: '🏙️', label: 'Місто'   },
  { id: 'map',    icon: '🗺️', label: 'Карта'   },
  { id: 'tasks',  icon: '⚔️', label: 'Завдання' },
  { id: 'inbox',  icon: '📬', label: 'Пошта'   },
  { id: 'trade',  icon: '🔄', label: 'Торгівля' },
]

const MSG_ICONS = {
  trade:  '🔄',
  task:   '⚔️',
  admin:  '📢',
  system: '⚙️',
}

export default function Inbox() {
  const navigate = useNavigate()
  const { player, unreadMessages } = useGameStore()

  const [messages, setMessages] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!player) { navigate('/'); return }

    const unsub = subscribeMessages(player.id, (msgs) => {
      setMessages(msgs)
      setLoading(false)
    })
    return () => unsub()
  }, [player])

  function handleNavChange(tabId) {
    if (tabId === 'city')  navigate('/city')
    if (tabId === 'map')   navigate('/map')
    if (tabId === 'tasks') navigate('/tasks')
    if (tabId === 'trade') navigate('/trade')
  }

  async function handleRead(msgId) {
    await markMessageRead(msgId)
  }

  if (loading) return <Spinner text="Завантаження пошти..." />

  const unread = messages.filter(m => !m.read)
  const read   = messages.filter(m => m.read)

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <header className="sticky top-0 z-40 bg-[var(--bg2)] border-b border-[var(--border)] p-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bebas text-2xl tracking-widest text-white">ПОШТА</h1>
            {unread.length > 0 && (
              <p className="text-xs text-[var(--accent)]">{unread.length} непрочитаних</p>
            )}
          </div>
          {unread.length > 0 && (
            <button
              onClick={() => markAllMessagesRead(player.id)}
              className="text-xs text-[#555] hover:text-[var(--neon)] transition-colors"
            >
              Прочитати всі
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 p-4 pb-20 max-w-2xl mx-auto w-full">
        {messages.length === 0 ? (
          <EmptyState icon="📬" text="Немає повідомлень" />
        ) : (
          <div className="flex flex-col gap-2">
            {/* Непрочитані */}
            {unread.map(msg => (
              <MessageItem key={msg.id} msg={msg} onRead={() => handleRead(msg.id)} />
            ))}
            {/* Прочитані */}
            {read.length > 0 && unread.length > 0 && (
              <div className="text-xs text-[#555] text-center py-2 uppercase tracking-wider">— прочитані —</div>
            )}
            {read.map(msg => (
              <MessageItem key={msg.id} msg={msg} onRead={() => {}} />
            ))}
          </div>
        )}
      </main>

      <BottomNav
        items={NAV_ITEMS.map(item => ({ ...item, badge: item.id === 'inbox' ? unreadMessages : 0 }))}
        active="inbox"
        onChange={handleNavChange}
      />
    </div>
  )
}

function MessageItem({ msg, onRead }) {
  const icon = MSG_ICONS[msg.type] || '📩'
  const timeStr = msg.createdAt?.toDate
    ? msg.createdAt.toDate().toLocaleString('uk-UA', {
        day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit'
      })
    : ''

  return (
    <button
      onClick={onRead}
      className={`
        w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all
        ${msg.read
          ? 'bg-[var(--bg2)] border-[var(--border)] opacity-60'
          : 'bg-[var(--card)] border-[var(--border)] hover:border-[#333]'
        }
      `}
    >
      {/* Крапка непрочитаного */}
      <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
        <span className="text-lg">{icon}</span>
        {!msg.read && <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-xs font-semibold ${msg.read ? 'text-[#555]' : 'text-[#888]'}`}>
            {msg.fromName}
          </span>
          <span className="text-[10px] text-[#444] shrink-0">{timeStr}</span>
        </div>
        <p className={`text-sm mt-0.5 ${msg.read ? 'text-[#555]' : 'text-[var(--text)]'}`}>
          {msg.text}
        </p>
      </div>
    </button>
  )
}
