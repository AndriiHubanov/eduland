// ─── Trade Page (/trade): Торгівля ───

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useGameStore, { RESOURCE_ICONS } from '../store/gameStore'
import {
  subscribeGroupPlayers, subscribeIncomingTrades, subscribeOutgoingTrades,
  sendTradeRequest, acceptTrade, rejectTrade, cancelTrade
} from '../firebase/service'
import {
  Spinner, Card, Button, Tabs, EmptyState, ErrorMsg, SuccessMsg, ResourceBadge, Modal, BottomNav
} from '../components/UI'

const NAV_ITEMS = [
  { id: 'city',   icon: '🏙️', label: 'Місто'   },
  { id: 'map',    icon: '🗺️', label: 'Карта'   },
  { id: 'tasks',  icon: '⚔️', label: 'Завдання' },
  { id: 'inbox',  icon: '📬', label: 'Пошта'   },
  { id: 'trade',  icon: '🔄', label: 'Торгівля' },
]

export default function Trade() {
  const navigate    = useNavigate()
  const { player, unreadMessages } = useGameStore()

  const [activeTab, setActiveTab]       = useState('send')
  const [groupPlayers, setGroupPlayers] = useState([])
  const [incoming, setIncoming]         = useState([])
  const [outgoing, setOutgoing]         = useState([])
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    if (!player) { navigate('/'); return }

    const unsubPlayers = subscribeGroupPlayers(player.group, (players) => {
      setGroupPlayers(players.filter(p => p.id !== player.id))
      setLoading(false)
    })
    const unsubIn  = subscribeIncomingTrades(player.id, setIncoming)
    const unsubOut = subscribeOutgoingTrades(player.id, setOutgoing)

    return () => { unsubPlayers(); unsubIn(); unsubOut() }
  }, [player])

  function handleNavChange(tabId) {
    if (tabId === 'city')  navigate('/city')
    if (tabId === 'map')   navigate('/map')
    if (tabId === 'tasks') navigate('/tasks')
    if (tabId === 'inbox') navigate('/inbox')
  }

  if (loading) return <Spinner text="Завантаження торгівлі..." />

  const tabs = [
    { id: 'send',    label: 'Надіслати' },
    { id: 'incoming', label: `Вхідні${incoming.length > 0 ? ` (${incoming.length})` : ''}` },
    { id: 'outgoing', label: 'Мої запити' },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <header className="sticky top-0 z-40 bg-[var(--bg2)] border-b border-[var(--border)] p-3">
        <h1 className="font-bebas text-2xl tracking-widest text-white">ТОРГІВЛЯ</h1>
      </header>

      <div className="sticky top-[57px] z-30 bg-[var(--bg2)] border-b border-[var(--border)]">
        <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
      </div>

      <main className="flex-1 p-4 pb-20 max-w-2xl mx-auto w-full">
        {activeTab === 'send' && (
          <SendTab player={player} groupPlayers={groupPlayers} />
        )}
        {activeTab === 'incoming' && (
          <IncomingTab trades={incoming} />
        )}
        {activeTab === 'outgoing' && (
          <OutgoingTab trades={outgoing} />
        )}
      </main>

      <BottomNav
        items={NAV_ITEMS.map(item => ({ ...item, badge: item.id === 'inbox' ? unreadMessages : 0 }))}
        active="trade"
        onChange={handleNavChange}
      />
    </div>
  )
}

// ─── Вкладка "Надіслати" ──────────────────────────────────────
function SendTab({ player, groupPlayers }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [offerRes, setOfferRes]   = useState('')
  const [offerAmt, setOfferAmt]   = useState('')
  const [requestRes, setRequestRes] = useState('')
  const [requestAmt, setRequestAmt] = useState('')
  const [message, setMessage]       = useState('')
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState('')
  const [loading, setLoading]       = useState(false)

  const resources = Object.entries(RESOURCE_ICONS)

  async function handleSend() {
    if (!selectedPlayer) { setError('Оберіть гравця'); return }
    if (!offerRes || !offerAmt || !requestRes || !requestAmt) {
      setError('Заповніть всі поля'); return
    }
    const offerAmount   = parseInt(offerAmt)
    const requestAmount = parseInt(requestAmt)
    if (isNaN(offerAmount) || offerAmount <= 0) { setError('Неправильна кількість для пропозиції'); return }
    if (isNaN(requestAmount) || requestAmount <= 0) { setError('Неправильна кількість для запиту'); return }
    if ((player.resources[offerRes] || 0) < offerAmount) {
      setError('Недостатньо ресурсів'); return
    }

    setLoading(true)
    setError('')
    try {
      const result = await sendTradeRequest({
        fromPlayer: player,
        toPlayer: selectedPlayer,
        offer: {
          resource: offerRes,
          resourceName: RESOURCE_ICONS[offerRes]?.name,
          resourceIcon: RESOURCE_ICONS[offerRes]?.icon,
          amount: offerAmount,
        },
        request: {
          resource: requestRes,
          resourceName: RESOURCE_ICONS[requestRes]?.name,
          resourceIcon: RESOURCE_ICONS[requestRes]?.icon,
          amount: requestAmount,
        },
        message,
      })

      if (result.error) { setError(result.error); return }

      setSuccess('Торговий запит надіслано!')
      setOfferRes(''); setOfferAmt(''); setRequestRes(''); setRequestAmt(''); setMessage('')
      setSelectedPlayer(null)
    } catch (err) {
      setError('Помилка надсилання')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Вибір гравця */}
      <div>
        <p className="text-xs text-[#555] uppercase tracking-wider mb-2">Торгувати з</p>
        {groupPlayers.length === 0 ? (
          <p className="text-sm text-[#555]">Немає інших гравців у групі</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {groupPlayers.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPlayer(p)}
                className={`
                  p-3 rounded-lg border text-left transition-all
                  ${selectedPlayer?.id === p.id
                    ? 'border-[var(--neon)] bg-[rgba(0,255,136,0.05)]'
                    : 'border-[var(--border)] bg-[var(--card)] hover:border-[#333]'
                  }
                `}
              >
                <div className="font-semibold text-sm text-white truncate">{p.name}</div>
                <div className="text-xs text-[#555]">{p.heroName}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Пропозиція */}
      <Card>
        <p className="text-xs text-[#555] uppercase tracking-wider mb-3">Я пропоную</p>
        <div className="grid grid-cols-2 gap-2">
          <select
            className="input"
            value={offerRes}
            onChange={e => setOfferRes(e.target.value)}
          >
            <option value="">Ресурс...</option>
            {resources.map(([key, info]) => (
              <option key={key} value={key}>
                {info.icon} {info.name} ({player.resources[key] || 0})
              </option>
            ))}
          </select>
          <input
            type="number"
            className="input"
            placeholder="Кількість"
            value={offerAmt}
            onChange={e => setOfferAmt(e.target.value)}
            min="1"
          />
        </div>
      </Card>

      {/* Запит */}
      <Card>
        <p className="text-xs text-[#555] uppercase tracking-wider mb-3">Я хочу отримати</p>
        <div className="grid grid-cols-2 gap-2">
          <select
            className="input"
            value={requestRes}
            onChange={e => setRequestRes(e.target.value)}
          >
            <option value="">Ресурс...</option>
            {resources.map(([key, info]) => (
              <option key={key} value={key}>
                {info.icon} {info.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            className="input"
            placeholder="Кількість"
            value={requestAmt}
            onChange={e => setRequestAmt(e.target.value)}
            min="1"
          />
        </div>
      </Card>

      {/* Повідомлення */}
      <input
        className="input"
        placeholder="Повідомлення (опційно)"
        value={message}
        onChange={e => setMessage(e.target.value)}
        maxLength={100}
      />

      {error && <ErrorMsg text={error} />}
      {success && <SuccessMsg text={success} />}

      <Button
        variant="neon"
        className="w-full"
        onClick={handleSend}
        disabled={loading}
      >
        {loading ? 'Надсилаю...' : '🔄 НАДІСЛАТИ ЗАПИТ'}
      </Button>
    </div>
  )
}

// ─── Вхідні запити ────────────────────────────────────────────
function IncomingTab({ trades }) {
  const [processing, setProcessing] = useState(null) // id картки що обробляється
  const [error, setError] = useState('')

  if (trades.length === 0) {
    return <EmptyState icon="📭" text="Немає вхідних торгових запитів" />
  }

  async function handleAccept(tradeId) {
    if (processing) return
    setError('')
    setProcessing(tradeId)
    try {
      await acceptTrade(tradeId)
    } catch (err) {
      setError(err.message || 'Помилка прийняття')
    } finally {
      setProcessing(null)
    }
  }

  async function handleReject(tradeId) {
    if (processing) return
    setProcessing(tradeId)
    try {
      await rejectTrade(tradeId)
    } catch (err) {
      setError('Помилка відхилення')
    } finally {
      setProcessing(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <ErrorMsg text={error} />}
      {trades.map(trade => {
        const isProc = processing === trade.id
        return (
          <Card key={trade.id} className={isProc ? 'opacity-60 pointer-events-none' : ''}>
            <div className="flex items-baseline justify-between mb-2">
              <span className="font-semibold text-white">{trade.fromPlayerName}</span>
              <span className="text-xs text-[#555]">
                {trade.createdAt?.toDate?.().toLocaleString('uk-UA', {
                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                })}
              </span>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <ResourceBadge resource={trade.offer.resource} amount={trade.offer.amount} showName />
              <span className="text-[#555]">→</span>
              <ResourceBadge resource={trade.request.resource} amount={trade.request.amount} showName />
            </div>

            {trade.message && (
              <p className="text-sm text-[#888] italic mb-3">"{trade.message}"</p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="neon"
                className="text-sm py-2"
                disabled={!!processing}
                onClick={() => handleAccept(trade.id)}
              >
                {isProc ? '...' : '✓ ПРИЙНЯТИ'}
              </Button>
              <Button
                variant="ghost"
                className="text-sm py-2"
                disabled={!!processing}
                onClick={() => handleReject(trade.id)}
              >
                ✕ ВІДХИЛИТИ
              </Button>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// ─── Мої запити ───────────────────────────────────────────────
function OutgoingTab({ trades }) {
  const [cancelling, setCancelling] = useState(null)
  const [error, setError] = useState('')

  if (trades.length === 0) {
    return <EmptyState icon="📤" text="Немає надісланих запитів" />
  }

  const statusLabels = {
    pending:   { text: '⏳ Очікує',    color: 'text-[var(--gold)]' },
    accepted:  { text: '✅ Прийнято',  color: 'text-[var(--neon)]' },
    rejected:  { text: '❌ Відхилено', color: 'text-[var(--accent)]' },
    cancelled: { text: '↩ Скасовано', color: 'text-[#555]' },
  }

  async function handleCancel(tradeId) {
    if (cancelling) return
    setCancelling(tradeId)
    setError('')
    try {
      await cancelTrade(tradeId)
    } catch (err) {
      setError(err.message || 'Помилка скасування')
    } finally {
      setCancelling(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <ErrorMsg text={error} />}
      {trades.map(trade => {
        const status  = statusLabels[trade.status] || statusLabels.pending
        const isCanc  = cancelling === trade.id
        const canCancel = trade.status === 'pending'
        return (
          <Card key={trade.id} className={isCanc ? 'opacity-60 pointer-events-none' : ''}>
            <div className="flex items-baseline justify-between mb-2">
              <span className="font-semibold text-white">→ {trade.toPlayerName}</span>
              <span className={`text-xs font-semibold ${status.color}`}>{status.text}</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <ResourceBadge resource={trade.offer.resource} amount={trade.offer.amount} showName />
              <span className="text-[#555]">→</span>
              <ResourceBadge resource={trade.request.resource} amount={trade.request.amount} showName />
            </div>
            {canCancel && (
              <button
                onClick={() => handleCancel(trade.id)}
                disabled={!!cancelling}
                className="text-xs text-[#555] hover:text-[var(--accent)] transition-colors"
              >
                {isCanc ? 'Скасовую...' : '↩ Скасувати запит'}
              </button>
            )}
          </Card>
        )
      })}
    </div>
  )
}
