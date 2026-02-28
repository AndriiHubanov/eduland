// ─── App: Роутинг і ініціалізація ───

import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useGameStore from './store/gameStore'
import { initializeFirebaseData, getPlayer, subscribeUnreadCount } from './firebase/service'

// Сторінки
import Landing   from './pages/Landing'
import HeroCreate from './pages/HeroCreate'
import City      from './pages/City'
import WorldMap  from './pages/WorldMap'
import Tasks     from './pages/Tasks'
import Inbox     from './pages/Inbox'
import Trade     from './pages/Trade'
import Admin      from './pages/Admin'
import SurveyPage from './pages/SurveyPage'

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

  // Відновлення сесії з localStorage
  useEffect(() => {
    if (playerId) {
      getPlayer(playerId).then(player => {
        if (player) setPlayer(player)
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
    <BrowserRouter>
      <Routes>
        {/* Публічні маршрути */}
        <Route path="/"       element={<Landing />} />
        <Route path="/create" element={<HeroCreate />} />
        <Route path="/admin"  element={<Admin />} />

        {/* Захищені маршрути (потрібен гравець) */}
        <Route path="/city"  element={<PrivateRoute><City /></PrivateRoute>} />
        <Route path="/map"   element={<PrivateRoute><WorldMap /></PrivateRoute>} />
        <Route path="/tasks" element={<PrivateRoute><Tasks /></PrivateRoute>} />
        <Route path="/inbox" element={<PrivateRoute><Inbox /></PrivateRoute>} />
        <Route path="/trade"   element={<PrivateRoute><Trade /></PrivateRoute>} />
        <Route path="/surveys" element={<PrivateRoute><SurveyPage /></PrivateRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
