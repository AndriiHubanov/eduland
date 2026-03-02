// ─── App: Роутинг і ініціалізація ───

import React, { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useGameStore from './store/gameStore'
import { initializeFirebaseData, getPlayer, subscribeUnreadCount } from './firebase/service'
import { initGroupFields } from './firebase/fieldService'
import { Spinner } from './components/UI'

// Eager (критичний шлях)
import Landing   from './pages/Landing'
import HeroCreate from './pages/HeroCreate'

// Lazy (завантажуються тільки при переході)
const City      = lazy(() => import('./pages/City'))
const WorldMap  = lazy(() => import('./pages/WorldMap'))
const Tasks     = lazy(() => import('./pages/Tasks'))
const Inbox     = lazy(() => import('./pages/Inbox'))
const Trade     = lazy(() => import('./pages/Trade'))
const Admin     = lazy(() => import('./pages/Admin'))
const SurveyPage = lazy(() => import('./pages/SurveyPage'))
const Wiki       = lazy(() => import('./pages/Wiki'))

// ErrorBoundary — ловить помилки рендеру замість чорного екрану
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{ background: '#0a0a0f', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '32px', textAlign: 'center' }}
        >
          <div style={{ fontSize: '3rem' }}>⚠️</div>
          <p style={{ color: '#ff4500', fontFamily: 'monospace', fontSize: '1.25rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            Помилка завантаження
          </p>
          <p style={{ color: '#555', fontFamily: 'monospace', fontSize: '0.75rem', maxWidth: '320px' }}>
            {this.state.error?.message || 'Невідома помилка'}
          </p>
          <button
            onClick={() => window.location.href = import.meta.env.BASE_URL || '/'}
            style={{ color: '#00ff88', border: '1px solid #00ff88', padding: '8px 16px', borderRadius: '6px', background: 'transparent', cursor: 'pointer', fontSize: '0.75rem' }}
          >
            ← На головну
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// Захищений маршрут — перевіряє авторизацію
function PrivateRoute({ children }) {
  const { playerId } = useGameStore()
  if (!playerId) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { playerId, setPlayer, setUnreadMessages } = useGameStore()

  // Ініціалізація Firebase при першому запуску
  useEffect(() => {
    initializeFirebaseData()
  }, [])

  // Відновлення сесії + ініціалізація полів групи
  useEffect(() => {
    if (playerId) {
      getPlayer(playerId).then(player => {
        if (player) {
          setPlayer(player)
          // Ініціалізуємо 31 поле якщо ще не існують для цієї групи
          if (player.group) initGroupFields(player.group).catch(console.error)
        }
      }).catch(console.error)
    }
  }, [playerId])

  // Глобальна підписка на кількість непрочитаних повідомлень
  useEffect(() => {
    if (!playerId) { setUnreadMessages(0); return }
    const unsub = subscribeUnreadCount(playerId, setUnreadMessages)
    return () => unsub()
  }, [playerId])

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ErrorBoundary>
        <Suspense fallback={<Spinner text="Завантаження..." />}>
          <Routes>
            {/* Публічні маршрути */}
            <Route path="/"       element={<Landing />} />
            <Route path="/create" element={<HeroCreate />} />
            <Route path="/admin"  element={<Admin />} />
            <Route path="/wiki"   element={<Wiki />} />

            {/* Захищені маршрути (потрібен гравець) */}
            <Route path="/city"    element={<PrivateRoute><City /></PrivateRoute>} />
            <Route path="/map"     element={<PrivateRoute><WorldMap /></PrivateRoute>} />
            <Route path="/tasks"   element={<PrivateRoute><Tasks /></PrivateRoute>} />
            <Route path="/inbox"   element={<PrivateRoute><Inbox /></PrivateRoute>} />
            <Route path="/trade"   element={<PrivateRoute><Trade /></PrivateRoute>} />
            <Route path="/surveys" element={<PrivateRoute><SurveyPage /></PrivateRoute>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
