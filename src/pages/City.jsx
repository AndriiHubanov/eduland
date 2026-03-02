// ─── City Page (/city): Головна сторінка гри ───

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useGameStore, { HERO_CLASSES, RESOURCE_ICONS, getXPProgress, getHeroLevel } from '../store/gameStore'
import {
  subscribePlayer, getBuildings, updatePlayer,
  ensureResourceMap, startResearch, revealCell, buildMine, collectMine, upgradeMine,
  placeBuildingOnGrid, removeBuildingFromGrid,
} from '../firebase/service'
import { upgradeCastle, getCastleName, CASTLE_UPGRADE_LORE } from '../firebase/castleService'
import { recruitUnit, upgradeUnit, setFormation } from '../firebase/unitService'
import { LAB_BUILDINGS } from '../config/labs'
import {
  subscribePlayerMissions, initPlayerMissions, updateMissionProgress, claimMissionReward,
} from '../firebase/missionService'
import {
  startScience, completeScience, unlockScienceWithRP,
} from '../firebase/scienceService'
import TechTreePanel from '../components/TechTreePanel'
import {
  ResourceBar, XPBar, Spinner, ErrorMsg, SuccessMsg, Button, Card, BottomNav,
  LoreBanner, ResourceBadge, EmptyState,
} from '../components/UI'
import GameImage       from '../components/GameImage'
import { heroImg }    from '../config/assets'
import BuildingCard    from '../components/BuildingCard'
import CityGrid        from '../components/CityGrid'
import MiningGrid      from '../components/MiningGrid'
import CastlePanel     from '../components/CastlePanel'
import UnitsPanel      from '../components/UnitsPanel'
import MissionsPanel   from '../components/MissionsPanel'
import CompletionCard  from '../components/CompletionCard'
import {
  subscribeTasks, subscribePlayerSubmissions, submitOpenTask, submitTest,
  subscribeMessages, markMessageRead, markAllMessagesRead,
} from '../firebase/service'

const NAV_ITEMS = [
  { id: 'city',   icon: '🏙️', label: 'Місто'   },
  { id: 'map',    icon: '🗺️', label: 'Карта'   },
  { id: 'tasks',  icon: '⚔️', label: 'Завдання' },
  { id: 'inbox',  icon: '📬', label: 'Пошта'   },
  { id: 'trade',  icon: '🔄', label: 'Торгівля' },
]

const DEFAULT_OPEN = ['hero', 'production', 'labs', 'techtree', 'castle', 'army']
function loadOpenSections() {
  try {
    return new Set(JSON.parse(localStorage.getItem('city_sections') || JSON.stringify(DEFAULT_OPEN)))
  } catch {
    return new Set(DEFAULT_OPEN)
  }
}
function saveOpenSections(set) {
  localStorage.setItem('city_sections', JSON.stringify([...set]))
}

export default function City() {
  const navigate = useNavigate()
  const { player, playerId, setPlayer, unreadMessages, logout } = useGameStore()

  const [buildings, setBuildings]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [feedback, setFeedback]     = useState({ type: '', text: '' })
  const [showLogout, setShowLogout] = useState(false)
  const [levelUp, setLevelUp]       = useState(null)
  const [missions, setMissions]     = useState([])
  const [showMissions, setShowMissions] = useState(false)
  const [loreFeedback, setLoreFeedback] = useState(null) // { castleName, text }

  // ─── Таби та collapsible ────────────────────────────────────
  const [activeTab, setActiveTab]     = useState('city')
  const [openSections, setOpenSections] = useState(loadOpenSections)

  // ─── Tasks стейт ────────────────────────────────────────────
  const [tasks, setTasks]             = useState([])
  const [submissions, setSubmissions] = useState({})
  const [taskFilter, setTaskFilter]   = useState('all')
  const [activeTask, setActiveTask]   = useState(null)
  const [taskCompletion, setTaskCompletion] = useState(null)

  // ─── Inbox стейт ────────────────────────────────────────────
  const [messages, setMessages] = useState([])

  // Прапорець — виробництво нараховується тільки один раз за сесію
  const hasAccrued   = useRef(false)
  // Зберігаємо будівлі у ref щоб accrueProduce мав до них доступ без залежностей
  const buildingsRef = useRef([])
  // Відслідковуємо попередній рівень для детектування левел-апу
  const prevLevelRef = useRef(null)

  // ─── 1. Завантажуємо конфіг будівель ───────────────────────
  useEffect(() => {
    getBuildings().then(data => {
      setBuildings(data)
      buildingsRef.current = data
      setLoading(false)
    })
  }, [])

  // ─── 2. Підписка на гравця (без виробництва!) ──────────────
  useEffect(() => {
    if (!playerId) { navigate('/'); return }
    const unsub = subscribePlayer(playerId, (data) => {
      setPlayer(data)
      // Ініціалізуємо resourceMap для існуючих гравців (один раз)
      if (!data.resourceMap) ensureResourceMap(data.id)
    })
    return () => unsub()
  }, [playerId])

  // ─── 2b. Підписка на місії + ініціалізація ─────────────────
  useEffect(() => {
    if (!playerId) return
    const unsub = subscribePlayerMissions(playerId, (data) => {
      setMissions(data)
      // Якщо місій немає — ініціалізуємо (новий гравець)
      if (data.length === 0) {
        initPlayerMissions(playerId).catch(console.error)
      }
    })
    return () => unsub()
  }, [playerId])

  // ─── Tasks + Inbox підписки ─────────────────────────────────
  useEffect(() => {
    if (!player) return
    const u1 = subscribeTasks(player.group, (data) => { setTasks(data) })
    const u2 = subscribePlayerSubmissions(player.id, setSubmissions)
    return () => { u1(); u2() }
  }, [player?.group, player?.id])

  useEffect(() => {
    if (!playerId) return
    const unsub = subscribeMessages(playerId, setMessages)
    return () => unsub()
  }, [playerId])

  // ─── 3. Нараховуємо виробництво ОДИН РАЗ ──────────────────
  // Запускається тільки коли є і гравець, і будівлі
  useEffect(() => {
    if (!player || buildingsRef.current.length === 0) return
    if (hasAccrued.current) return

    hasAccrued.current = true
    accrueProduce(player, buildingsRef.current)
  }, [player?.id, loading]) // loading=false означає що будівлі завантажені

  // ─── 4. Детектуємо підвищення рівня ───────────────────────
  useEffect(() => {
    if (!player) return
    const newLevel = getHeroLevel(player.heroXP || 0)
    if (prevLevelRef.current !== null && newLevel > prevLevelRef.current) {
      setLevelUp({ level: newLevel })
    }
    prevLevelRef.current = newLevel
  }, [player?.heroXP])

  // ─── Виробництво ресурсів ───────────────────────────────────
  async function accrueProduce(playerData, bldgs) {
    const lastTime = playerData.lastActive?.toDate?.()
    if (!lastTime) return

    const hoursElapsed = (Date.now() - lastTime.getTime()) / 3600000

    // Менше хвилини — ігноруємо щоб не смітити транзакціями
    if (hoursElapsed < 1 / 60) return

    const produced = {}
    for (const [buildId, buildState] of Object.entries(playerData.buildings || {})) {
      if (!buildState.level || !buildState.workers) continue
      const bConfig   = bldgs.find(b => b.id === buildId)
      if (!bConfig) continue
      const lvlConfig = bConfig.levels?.[buildState.level - 1]
      if (!lvlConfig) continue

      const hasSynergy = buildState.workers >= (bConfig.synergyBonus?.minWorkers || 99)
      for (const [res, rate] of Object.entries(lvlConfig.production)) {
        const effectiveRate = rate + (hasSynergy ? (bConfig.synergyBonus?.bonus?.[res] || 0) : 0)
        produced[res] = (produced[res] || 0) + Math.floor(effectiveRate * hoursElapsed)
      }
    }

    const hasProduction = Object.values(produced).some(v => v > 0)
    if (!hasProduction) return

    const newResources = { ...playerData.resources }
    for (const [res, amount] of Object.entries(produced)) {
      if (amount > 0) newResources[res] = (newResources[res] || 0) + amount
    }

    // Оновлюємо ресурси — lastActive оновлюється в updatePlayer
    await updatePlayer(playerData.id, { resources: newResources })

    // Показуємо що зароблено
    const summary = Object.entries(produced)
      .filter(([, v]) => v > 0)
      .map(([res, v]) => `${RESOURCE_ICONS[res]?.icon || res} +${v}`)
      .join('  ')
    if (summary) showFeedback('success', `Зароблено за відсутності: ${summary}`)
  }

  // ─── Тогл робітника ─────────────────────────────────────────
  async function handleWorkerToggle(buildingId, action) {
    if (!player) return

    const currentWorkers = player.buildings[buildingId]?.workers || 0
    const totalPlaced    = player.workers?.placed || 0
    const totalWorkers   = player.workers?.total  || 5
    const bConfig        = buildingsRef.current.find(b => b.id === buildingId)
    const lvlData        = bConfig?.levels?.[(player.buildings[buildingId]?.level || 1) - 1]
    const maxSlots       = lvlData?.workerSlots || 0

    if (action === 'add') {
      if (totalPlaced >= totalWorkers) { showFeedback('error', 'Немає вільних робітників!'); return }
      if (currentWorkers >= maxSlots)  { showFeedback('error', 'Всі слоти заповнені!'); return }
    } else {
      if (currentWorkers <= 0) return
    }

    const delta = action === 'add' ? 1 : -1
    try {
      await updatePlayer(player.id, {
        [`buildings.${buildingId}.workers`]: currentWorkers + delta,
        'workers.placed': totalPlaced + delta,
      })
    } catch {
      showFeedback('error', 'Помилка оновлення')
    }
  }

  // ─── Апгрейд / Будова ───────────────────────────────────────
  async function handleUpgrade(buildingId) {
    if (!player) return
    const bConfig      = buildingsRef.current.find(b => b.id === buildingId)
    const currentLevel = player.buildings[buildingId]?.level || 0
    const nextLvl      = bConfig?.levels?.[currentLevel]

    if (!nextLvl) { showFeedback('error', 'Максимальний рівень!'); return }

    for (const [res, cost] of Object.entries(nextLvl.cost)) {
      if ((player.resources[res] || 0) < cost) {
        const info = RESOURCE_ICONS[res]
        showFeedback('error', `Не вистачає: ${info?.icon || ''} ${cost} ${info?.name || res}`)
        return
      }
    }

    const newResources = { ...player.resources }
    for (const [res, cost] of Object.entries(nextLvl.cost)) {
      newResources[res] -= cost
    }

    try {
      await updatePlayer(player.id, {
        [`buildings.${buildingId}.level`]: currentLevel + 1,
        resources: newResources,
      })
      showFeedback('success', `${bConfig.name} → Рівень ${currentLevel + 1} ✓`)
      // Прогрес місій: будівля / сюжетні
      updateMissionProgress(player.id, 'upgrade_building', {
        target: buildingId,
        level: currentLevel + 1,
      }).catch(console.error)
    } catch {
      showFeedback('error', 'Помилка апгрейду')
    }
  }

  // ─── Апгрейд лабораторій ─────────────────────────────────────
  async function handleLabUpgrade(labId) {
    if (!player) return
    const labConfig    = LAB_BUILDINGS[labId]
    const currentLevel = player.buildings?.[labId]?.level || 0
    const nextLvl      = labConfig?.levels?.[currentLevel]

    if (!nextLvl) { showFeedback('error', 'Максимальний рівень!'); return }

    for (const [res, cost] of Object.entries(nextLvl.cost)) {
      if ((player.resources?.[res] || 0) < cost) {
        const info = RESOURCE_ICONS[res]
        showFeedback('error', `Не вистачає: ${info?.icon || ''} ${cost} ${info?.name || res}`)
        return
      }
    }

    const newResources = { ...player.resources }
    for (const [res, cost] of Object.entries(nextLvl.cost)) {
      newResources[res] = (newResources[res] || 0) - cost
    }

    try {
      await updatePlayer(player.id, {
        [`buildings.${labId}.level`]: currentLevel + 1,
        resources: newResources,
      })
      showFeedback('success', `${labConfig.name} → Рівень ${currentLevel + 1} ✓`)
    } catch {
      showFeedback('error', 'Помилка апгрейду лабораторії')
    }
  }

  // ─── Tech Tree ──────────────────────────────────────────────
  async function handleScienceUnlockRP(scienceId) {
    try {
      await unlockScienceWithRP(player.id, scienceId)
      showFeedback('success', 'Науку відкрито за RP!')
    } catch (err) {
      showFeedback('error', err.message)
    }
  }

  async function handleScienceStart(scienceId) {
    try {
      await startScience(player.id, scienceId)
      showFeedback('success', 'Дослідження розпочато!')
      updateMissionProgress(player.id, 'start_research').catch(console.error)
    } catch (err) {
      showFeedback('error', err.message)
    }
  }

  // ─── Перерозподіл робітників ────────────────────────────────
  async function handleWorkerReset() {
    if (!player) return
    const now            = Date.now()
    const lastReset      = player.lastWorkerReset?.toDate?.()?.getTime() || 0
    const minsSinceReset = (now - lastReset) / 60000
    const COOLDOWN_MINS  = 45

    if (minsSinceReset < COOLDOWN_MINS) {
      const remaining = Math.ceil(COOLDOWN_MINS - minsSinceReset)
      showFeedback('error', `Ще ${remaining} хв до наступного перерозподілу`)
      return
    }

    const newBuildings = {}
    for (const [id, data] of Object.entries(player.buildings)) {
      newBuildings[id] = { ...data, workers: 0 }
    }

    try {
      await updatePlayer(player.id, {
        buildings: newBuildings,
        'workers.placed': 0,
        lastWorkerReset: new Date(),
      })
      showFeedback('success', 'Робітники вільні — розміщуй знову!')
    } catch {
      showFeedback('error', 'Помилка перерозподілу')
    }
  }

  // ─── Дослідження та копальні ────────────────────────────────
  async function handleStartResearch(cellIndex) {
    try {
      await startResearch(player.id, cellIndex)
      showFeedback('success', 'Лабораторія вирушила досліджувати ділянку!')
      updateMissionProgress(player.id, 'start_research').catch(console.error)
    } catch (err) {
      showFeedback('error', err.message)
    }
  }

  async function handleRevealCell(cellIndex) {
    try {
      await revealCell(player.id, cellIndex)
      showFeedback('success', 'Ділянку розкрито! Перевір що знайшла лабораторія.')
    } catch (err) {
      showFeedback('error', err.message)
    }
  }

  async function handleBuildMine(cellIndex) {
    try {
      await buildMine(player.id, cellIndex)
      showFeedback('success', 'Копальню побудовано! Вона вже починає видобуток.')
      updateMissionProgress(player.id, 'build_mine').catch(console.error)
    } catch (err) {
      showFeedback('error', err.message)
    }
  }

  async function handleCollectMine(cellIndex) {
    try {
      const { resource, amount } = await collectMine(player.id, cellIndex)
      const info = RESOURCE_ICONS[resource]
      showFeedback('success', `Зібрано: ${info?.icon || ''} +${amount} ${info?.name || resource}`)
      updateMissionProgress(player.id, 'collect_mine').catch(console.error)
    } catch (err) {
      showFeedback('error', err.message)
    }
  }

  async function handleUpgradeMine(cellIndex) {
    try {
      await upgradeMine(player.id, cellIndex)
      showFeedback('success', 'Копальню покращено!')
    } catch (err) {
      showFeedback('error', err.message)
    }
  }

  async function handlePlaceBuilding(buildingId, cellIndex) {
    try {
      await placeBuildingOnGrid(player.id, buildingId, cellIndex)
      showFeedback('success', 'Будівлю розміщено на полі!')
    } catch (err) {
      showFeedback('error', err.message)
    }
  }

  async function handleRemoveBuilding(buildingId) {
    try {
      await removeBuildingFromGrid(player.id, buildingId)
      showFeedback('success', 'Будівлю знято з поля.')
    } catch (err) {
      showFeedback('error', err.message)
    }
  }

  // ─── Замок ──────────────────────────────────────────────────
  async function handleCastleUpgrade() {
    try {
      const currentLevel = player.castle?.level || 1
      await upgradeCastle(player.id)
      const newLevel = currentLevel + 1
      const castleName = getCastleName(player.heroClass, newLevel)
      const loreText = CASTLE_UPGRADE_LORE[player.heroClass]?.[newLevel]
      showFeedback('success', `Замок → ${castleName} ✓`)
      if (loreText) setLoreFeedback({ castleName, text: loreText })
      updateMissionProgress(player.id, 'upgrade_castle', { level: newLevel }).catch(console.error)
    } catch (err) {
      showFeedback('error', err.message)
    }
  }

  // ─── Юніти ──────────────────────────────────────────────────
  async function handleRecruitUnit(unitId) {
    try {
      await recruitUnit(player.id, unitId)
      showFeedback('success', 'Юніта найнято!')
      updateMissionProgress(player.id, 'recruit_unit').catch(console.error)
    } catch (err) {
      showFeedback('error', err.message)
    }
  }

  async function handleUpgradeUnit(unitId) {
    try {
      await upgradeUnit(player.id, unitId)
      showFeedback('success', 'Юніта покращено!')
    } catch (err) {
      showFeedback('error', err.message)
    }
  }

  async function handleSetFormation(formation) {
    try {
      await setFormation(player.id, formation)
      showFeedback('success', 'Формацію збережено!')
    } catch (err) {
      showFeedback('error', err.message)
    }
  }

  function handleLogout() {
    logout()
    navigate('/')
  }

  function toggleSection(id) {
    setOpenSections(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      saveOpenSections(next)
      return next
    })
  }

  async function handleOpenSubmit(task) {
    const result = await submitOpenTask({ player, task })
    if (result?.error) return
    setTaskCompletion({ task, player })
  }

  function showFeedback(type, text) {
    setFeedback({ type, text })
    setTimeout(() => setFeedback({ type: '', text: '' }), 4000)
  }

  // ─── Рендер ─────────────────────────────────────────────────
  if (!player || loading) return <Spinner text="Завантаження міста..." />

  const heroClass  = HERO_CLASSES[player.heroClass] || HERO_CLASSES.guardian
  const xpProgress = getXPProgress(player.heroXP || 0)
  const navItems   = NAV_ITEMS.map(item => ({
    ...item,
    badge: item.id === 'inbox' ? unreadMessages : 0,
  }))

  const missionReadyCount = missions.filter(m => m.status === 'completed').length

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">

      {/* ─── Шапка ─── */}
      <header className="sticky top-0 z-40 bg-[var(--bg2)] border-b border-[var(--border)] p-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <GameImage
              src={heroImg(player.heroClass)}
              fallback={heroClass.icon}
              alt={heroClass.name}
              className="w-10 h-10 object-contain rounded-lg border border-[var(--border)] shrink-0"
            />
            <div>
              <div className="font-semibold text-white text-sm leading-tight">{player.heroName}</div>
              <div className="text-[11px] text-[#666]">{heroClass.name} · Рів.{xpProgress.level} · {player.group}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Місії */}
            <button
              onClick={() => setShowMissions(true)}
              className="relative flex items-center text-xs bg-[rgba(0,255,136,0.1)] border border-[rgba(0,255,136,0.25)] text-[var(--neon)] rounded px-2 py-1 font-mono hover:bg-[rgba(0,255,136,0.2)] transition-colors"
            >
              📋
              {missionReadyCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[var(--accent)] text-white text-[9px] flex items-center justify-center font-bold">
                  {missionReadyCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowLogout(true)}
              className="text-[10px] uppercase tracking-wider text-[#333] hover:text-[var(--accent)] transition-colors"
            >
              вийти
            </button>
          </div>
        </div>
        <ResourceBar resources={player.resources} diamonds={player.diamonds} />
      </header>

      {/* ─── Топ-таби ─── */}
      <div className="sticky top-[calc(var(--header-h,72px))] z-30 bg-[var(--bg2)] border-b border-[var(--border)] flex">
        {[
          { id: 'city',  label: '🏙️ Місто' },
          { id: 'tasks', label: `⚔️ Завдання` },
          { id: 'inbox', label: '📬 Пошта', badge: unreadMessages },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`relative flex-1 py-2.5 text-xs font-mono tracking-wider transition-all
              ${activeTab === t.id
                ? 'border-b-2 border-[var(--accent)] text-white'
                : 'text-[#555] hover:text-[#888]'
              }`}
          >
            {t.label}
            {t.badge > 0 && (
              <span className="absolute top-1.5 right-2 w-4 h-4 rounded-full bg-[var(--accent)] text-white text-[9px] flex items-center justify-center font-bold">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── Модалка виходу ─── */}
      {showLogout && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowLogout(false)}
        >
          <div
            className="w-full max-w-xs bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 flex flex-col gap-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-bebas text-xl tracking-wider text-white">ВИЙТИ З АКАУНТУ?</h3>
            <p className="text-sm text-[#888]">Твоє місто та ресурси збережені.</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleLogout} className="btn btn-accent text-sm">ВИЙТИ</button>
              <button onClick={() => setShowLogout(false)} className="btn btn-ghost text-sm">СКАСУВАТИ</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Контент ─── */}
      <main className="flex-1 pb-20 max-w-2xl mx-auto w-full">
        {feedback.text && (
          <div className="px-4 pt-3">
            {feedback.type === 'error'   && <ErrorMsg text={feedback.text} />}
            {feedback.type === 'success' && <SuccessMsg text={feedback.text} />}
          </div>
        )}

        {activeTab === 'city' && (
          <div className="p-4">
            <CityTab
              player={player}
              buildings={buildings}
              xpProgress={xpProgress}
              heroClass={heroClass}
              openSections={openSections}
              toggleSection={toggleSection}
              onWorkerToggle={handleWorkerToggle}
              onUpgrade={handleUpgrade}
              onWorkerReset={handleWorkerReset}
              onStartResearch={handleStartResearch}
              onRevealCell={handleRevealCell}
              onBuildMine={handleBuildMine}
              onCollectMine={handleCollectMine}
              onUpgradeMine={handleUpgradeMine}
              onPlaceBuilding={handlePlaceBuilding}
              onRemoveBuilding={handleRemoveBuilding}
              onCastleUpgrade={handleCastleUpgrade}
              onRecruitUnit={handleRecruitUnit}
              onUpgradeUnit={handleUpgradeUnit}
              onSetFormation={handleSetFormation}
              onLabUpgrade={handleLabUpgrade}
              onScienceUnlockRP={handleScienceUnlockRP}
              onScienceStart={handleScienceStart}
            />
          </div>
        )}

        {activeTab === 'tasks' && (
          <TasksTabContent
            player={player}
            tasks={tasks}
            submissions={submissions}
            taskFilter={taskFilter}
            setTaskFilter={setTaskFilter}
            activeTask={activeTask}
            setActiveTask={setActiveTask}
            onOpenSubmit={handleOpenSubmit}
            navigate={navigate}
          />
        )}

        {activeTab === 'inbox' && (
          <InboxTabContent
            player={player}
            messages={messages}
          />
        )}
      </main>

      {/* ─── Модалки ─── */}
      {levelUp && (
        <LevelUpModal
          level={levelUp.level}
          heroClass={heroClass}
          heroName={player.heroName}
          onClose={() => setLevelUp(null)}
        />
      )}

      {/* ─── Lore popup (castle upgrade) ─── */}
      {loreFeedback && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          onClick={() => setLoreFeedback(null)}
        >
          <div
            className="max-w-sm w-full bg-[var(--card)] border border-[rgba(255,215,0,0.3)] rounded-2xl p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-[10px] font-mono text-[var(--gold)] tracking-widest uppercase mb-2">
              // Повідомлення Nova Academy
            </div>
            <h3 className="font-bebas text-2xl tracking-widest text-[var(--gold)] mb-3">
              {loreFeedback.castleName}
            </h3>
            <p className="text-sm text-[#888] leading-relaxed italic mb-5">
              {loreFeedback.text}
            </p>
            <button
              onClick={() => setLoreFeedback(null)}
              className="w-full py-2 bg-[rgba(255,215,0,0.08)] border border-[rgba(255,215,0,0.3)] text-[var(--gold)] font-mono text-xs rounded-lg hover:bg-[rgba(255,215,0,0.18)] transition-colors"
            >
              [ ПРОДОВЖИТИ ]
            </button>
          </div>
        </div>
      )}

      {showMissions && (
        <MissionsPanel
          missions={missions}
          onClaim={async (docId) => {
            try {
              await claimMissionReward(playerId, docId)
              showFeedback('success', 'Нагороду отримано!')
            } catch (err) {
              showFeedback('error', err.message)
            }
          }}
          onClose={() => setShowMissions(false)}
        />
      )}

      {activeTask?.type === 'test' && (
        <TestModal
          task={activeTask}
          player={player}
          existingSub={submissions[activeTask.id]}
          onClose={() => setActiveTask(null)}
        />
      )}

      {taskCompletion && (
        <CompletionCard
          task={taskCompletion.task}
          player={taskCompletion.player}
          onClose={() => setTaskCompletion(null)}
        />
      )}

      <BottomNav
        items={NAV_ITEMS.map(item => ({ ...item, badge: item.id === 'inbox' ? unreadMessages : 0 }))}
        active={activeTab === 'city' ? 'city' : activeTab}
        onChange={id => {
          if (id === 'map')   navigate('/map')
          if (id === 'trade') navigate('/trade')
          if (id === 'city' || id === 'tasks' || id === 'inbox') setActiveTab(id)
        }}
      />
    </div>
  )
}

// ─── Розраховуємо загальне виробництво/год ────────────────────
function calcTotalProduction(player, buildings) {
  const total = {}
  for (const [buildId, buildState] of Object.entries(player.buildings || {})) {
    if (!buildState.level || !buildState.workers) continue
    const bConfig   = buildings.find(b => b.id === buildId)
    if (!bConfig) continue
    const lvlConfig = bConfig.levels?.[buildState.level - 1]
    if (!lvlConfig) continue
    const hasSynergy = buildState.workers >= (bConfig.synergyBonus?.minWorkers || 99)
    for (const [res, rate] of Object.entries(lvlConfig.production)) {
      const effective = rate + (hasSynergy ? (bConfig.synergyBonus?.bonus?.[res] || 0) : 0)
      total[res] = (total[res] || 0) + effective
    }
  }
  return total
}

// ─── Таймер кулдауну перерозподілу ────────────────────────────
function WorkerResetTimer({ lastWorkerReset }) {
  const [remaining, setRemaining] = useState(0)
  const COOLDOWN_MINS = 45

  useEffect(() => {
    function calc() {
      const lastReset = lastWorkerReset?.toDate?.()?.getTime() || 0
      const elapsed   = (Date.now() - lastReset) / 60000
      setRemaining(Math.max(0, Math.ceil(COOLDOWN_MINS - elapsed)))
    }
    calc()
    const id = setInterval(calc, 30000) // оновлюємо кожні 30 сек
    return () => clearInterval(id)
  }, [lastWorkerReset])

  if (remaining === 0) return null
  return (
    <span className="text-xs text-[#555] font-mono">
      (доступно через {remaining} хв)
    </span>
  )
}

// ─── Collapsible секція ───────────────────────────────────────
function CollapsibleSection({ id, title, open, onToggle, badge, children }) {
  return (
    <section>
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between mb-2 group"
      >
        <div className="flex items-center gap-2">
          <div className="h-0.5 w-3 bg-[var(--accent)]" />
          <h2 className="font-bebas text-base tracking-widest text-[#888] group-hover:text-white transition-colors">
            {title}
          </h2>
          {badge != null && badge > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent)] text-white font-bold">
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="h-0.5 flex-1 bg-[var(--border)]" style={{ width: 40 }} />
          <span
            className="text-[#444] text-xs transition-transform duration-200"
            style={{ display: 'inline-block', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          >
            ▼
          </span>
        </div>
      </button>
      {open && <div className="mb-1">{children}</div>}
    </section>
  )
}

// ─── Вкладка МІСТО ────────────────────────────────────────────
function CityTab({
  player, buildings, xpProgress, heroClass,
  openSections, toggleSection,
  onWorkerToggle, onUpgrade, onWorkerReset,
  onStartResearch, onRevealCell, onBuildMine, onCollectMine, onUpgradeMine,
  onPlaceBuilding, onRemoveBuilding,
  onCastleUpgrade, onRecruitUnit, onUpgradeUnit, onSetFormation,
  onLabUpgrade, onScienceUnlockRP, onScienceStart,
}) {
  const totalPlaced  = player.workers?.placed || 0
  const totalWorkers = player.workers?.total  || 5
  const totalProd    = calcTotalProduction(player, buildings)
  const hasProd      = Object.values(totalProd).some(v => v > 0)

  return (
    <div className="flex flex-col gap-4">

      {/* ─── ГЕРОЙ ─── */}
      <CollapsibleSection id="hero" title="ГЕРОЙ" open={openSections.has('hero')} onToggle={toggleSection}>
        <Card>
          <div className="flex items-center gap-3 mb-3">
            <GameImage
              src={heroImg(player.heroClass)}
              fallback={heroClass.icon}
              alt={heroClass.name}
              className="w-16 h-20 object-contain rounded-lg border border-[var(--border)] shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="font-bebas text-base tracking-wider text-white mb-1">{player.heroName}</div>
              <XPBar {...xpProgress} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-3">
            {[
              { label: 'Інтелект',     value: player.heroStats?.intellect  || 5, icon: '🧠' },
              { label: 'Витривалість', value: player.heroStats?.endurance  || 5, icon: '💪' },
              { label: 'Харизма',      value: player.heroStats?.charisma   || 5, icon: '✨' },
              { label: 'RP',           value: player.researchPoints || 0,       icon: '🧪' },
            ].map(stat => (
              <div key={stat.label} className="text-center bg-[var(--bg3)] rounded p-2">
                <div className="text-base">{stat.icon}</div>
                <div className="font-mono text-lg" style={{ color: stat.label === 'RP' ? '#b9f2ff' : 'var(--gold)' }}>
                  {stat.value}
                </div>
                <div className="text-[10px] text-[#555] uppercase">{stat.label}</div>
              </div>
            ))}
          </div>
        </Card>
      </CollapsibleSection>

      {/* ─── ВИРОБНИЦТВО ─── */}
      {hasProd && (
        <CollapsibleSection id="production" title="ВИРОБНИЦТВО/ГОД" open={openSections.has('production')} onToggle={toggleSection}>
          <Card className="py-3">
            <div className="flex flex-wrap gap-3">
              {Object.entries(totalProd).map(([res, rate]) => {
                if (rate <= 0) return null
                const info = RESOURCE_ICONS[res]
                if (!info) return null
                return (
                  <div key={res} className="flex items-center gap-1.5">
                    <span className="text-lg">{info.icon}</span>
                    <div>
                      <div className="font-mono text-sm font-bold" style={{ color: info.color }}>+{rate}/год</div>
                      <div className="text-[10px] text-[#555]">{info.name}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </CollapsibleSection>
      )}

      {/* ─── РОБІТНИКИ ─── */}
      <CollapsibleSection id="workers" title="РОБІТНИКИ" open={openSections.has('workers')} onToggle={toggleSection}>
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">👥</span>
              <div>
                <div className="font-semibold text-white">{totalPlaced}/{totalWorkers} розміщено</div>
                <div className="text-xs text-[#555]">{totalWorkers - totalPlaced} вільних</div>
              </div>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: totalWorkers }).map((_, i) => (
                <div key={i} className={`w-3 h-6 rounded-sm transition-colors ${i < totalPlaced ? 'bg-[var(--neon)]' : 'bg-[var(--border)]'}`} />
              ))}
            </div>
          </div>
          <Button variant="ghost" className="w-full text-sm" onClick={onWorkerReset}>
            🔄 ПЕРЕРОЗПОДІЛИТИ
          </Button>
          <div className="text-center mt-1"><WorkerResetTimer lastWorkerReset={player.lastWorkerReset} /></div>
        </Card>
      </CollapsibleSection>

      {/* ─── ПОЛЕ МІСТА (візуальна сітка) ─── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="h-0.5 w-3 bg-[var(--accent)]" />
          <h2 className="font-bebas text-base tracking-widest text-[#888]">ПОЛЕ МІСТА</h2>
          <div className="flex-1 h-0.5 bg-[var(--border)]" />
        </div>
        <CityGrid
          player={player}
          buildings={buildings}
          onWorkerToggle={onWorkerToggle}
          onUpgrade={onUpgrade}
        />
      </div>

      {/* ─── ЛАБОРАТОРІЇ ─── */}
      <CollapsibleSection id="labs" title="🔭 ЛАБОРАТОРІЇ" open={openSections.has('labs')} onToggle={toggleSection}>
        <LabsPanel player={player} onLabUpgrade={onLabUpgrade} />
      </CollapsibleSection>

      {/* ─── TECH TREE ─── */}
      <CollapsibleSection id="techtree" title="🔬 ПРИРОДНИЧІ НАУКИ" open={openSections.has('techtree')} onToggle={toggleSection}>
        <TechTreePanel
          player={player}
          onUnlockRP={onScienceUnlockRP}
          onStartResearch={onScienceStart}
        />
      </CollapsibleSection>


      {/* ─── ЗАМОК ─── */}
      <CollapsibleSection id="castle" title="ЗАМОК" open={openSections.has('castle')} onToggle={toggleSection}>
        <CastlePanel player={player} onUpgrade={onCastleUpgrade} />
      </CollapsibleSection>

      {/* ─── АРМІЯ ─── */}
      <CollapsibleSection id="army" title="АРМІЯ" open={openSections.has('army')} onToggle={toggleSection}>
        <UnitsPanel
          player={player}
          onRecruit={onRecruitUnit}
          onUpgrade={onUpgradeUnit}
          onSetFormation={onSetFormation}
        />
      </CollapsibleSection>
    </div>
  )
}

// ─── Панель Лабораторій ───────────────────────────────────────
function LabsPanel({ player, onLabUpgrade }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {Object.values(LAB_BUILDINGS).map(lab => {
        const currentLevel = player?.buildings?.[lab.id]?.level || 0
        const nextLvl      = lab.levels[currentLevel]
        const maxed        = currentLevel >= lab.maxLevel

        const canAfford = nextLvl
          ? Object.entries(nextLvl.cost).every(([res, cost]) => (player?.resources?.[res] || 0) >= cost)
          : false

        const currentCfg = currentLevel > 0 ? lab.levels[currentLevel - 1] : null

        return (
          <div key={lab.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg2)] p-3 flex flex-col gap-2">
            {/* Заголовок */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{lab.icon}</span>
                <div>
                  <div className="font-semibold text-sm text-white">{lab.name}</div>
                  <div className="text-[10px] text-[#444] font-mono">
                    {maxed ? 'МАКС' : `Рів. ${currentLevel}/${lab.maxLevel}`}
                  </div>
                </div>
              </div>
              {/* Рівень badge */}
              <span className={`text-xs font-mono px-2 py-0.5 rounded border ${
                currentLevel === 0
                  ? 'text-[#444] border-[var(--border)]'
                  : 'text-[var(--neon)] border-[var(--neon)] bg-[rgba(0,255,136,0.08)]'
              }`}>
                {currentLevel === 0 ? 'не збудовано' : `рів.${currentLevel}`}
              </span>
            </div>

            {/* Опис */}
            <p className="text-[11px] text-[#555] leading-snug">{lab.description}</p>

            {/* Поточні характеристики */}
            {currentCfg && (
              <div className="text-[10px] font-mono text-[#666] flex flex-wrap gap-2">
                {currentCfg.scoutTime   && <span>🔭 {Math.round(currentCfg.scoutTime / 60)} хв (x1)</span>}
                {currentCfg.extractTime && <span>⚗️ {Math.round(currentCfg.extractTime / 60)} хв</span>}
                {currentCfg.bonus       !== undefined && <span>+{currentCfg.bonus}% видобуток</span>}
                {currentCfg.marchTime   && <span>🚀 марш {Math.round(currentCfg.marchTime / 60)} хв</span>}
                {currentCfg.dailyRefreshes && <span>📡 {currentCfg.dailyRefreshes}×/день</span>}
              </div>
            )}

            {/* Наступний рівень */}
            {nextLvl && (
              <div>
                <p className="text-[9px] text-[#444] uppercase tracking-wider mb-1">
                  Рів.{currentLevel + 1}:
                  {nextLvl.scoutTime   && ` 🔭 ${Math.round(nextLvl.scoutTime / 60)}хв`}
                  {nextLvl.extractTime && ` ⚗️ ${Math.round(nextLvl.extractTime / 60)}хв`}
                  {nextLvl.bonus       !== undefined && nextLvl.bonus > 0 && ` +${nextLvl.bonus}%`}
                  {nextLvl.marchTime   && ` 🚀 ${Math.round(nextLvl.marchTime / 60)}хв`}
                  {nextLvl.dailyRefreshes && ` 📡 ${nextLvl.dailyRefreshes}×/д`}
                </p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {Object.entries(nextLvl.cost).map(([res, cost]) => {
                    const icons = { gold: '🪙', bits: '💾', code: '🔐', bio: '🧬', energy: '⚡', crystals: '💎', stone: '🪨' }
                    const have  = player?.resources?.[res] || 0
                    return (
                      <span key={res} className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                        have >= cost ? 'text-[var(--neon)] border-[rgba(0,255,136,0.25)]' : 'text-[var(--accent)] border-[rgba(255,69,0,0.25)]'
                      }`}>
                        {icons[res]} {cost}
                      </span>
                    )
                  })}
                </div>
                <button
                  className={`w-full text-xs font-semibold py-1.5 rounded border transition-all ${
                    canAfford
                      ? 'border-[var(--neon)] text-[var(--neon)] hover:bg-[rgba(0,255,136,0.08)]'
                      : 'border-[var(--border)] text-[#444] cursor-not-allowed'
                  }`}
                  disabled={!canAfford}
                  onClick={() => onLabUpgrade(lab.id)}
                >
                  {currentLevel === 0 ? `ЗБУДУВАТИ` : `ПОКРАЩИТИ → рів.${currentLevel + 1}`}
                </button>
              </div>
            )}

            {maxed && (
              <div className="text-center text-[10px] text-[var(--neon)] font-mono">✓ МАКСИМАЛЬНИЙ РІВЕНЬ</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Вкладка ЗАВДАННЯ ─────────────────────────────────────────
const MSG_ICONS = { trade: '🔄', task: '⚔️', admin: '📢', system: '⚙️' }

function TasksTabContent({ player, tasks, submissions, taskFilter, setTaskFilter, activeTask, setActiveTask, onOpenSubmit, navigate }) {
  const filtered = tasks.filter(t => {
    if (taskFilter === 'open') return t.type === 'open' || !t.type
    if (taskFilter === 'test') return t.type === 'test'
    return true
  })
  const sorted = [...filtered].sort((a, b) => {
    const doneA = submissions[a.id]?.status === 'approved' ? 1 : 0
    const doneB = submissions[b.id]?.status === 'approved' ? 1 : 0
    return doneA - doneB
  })
  const doneCount    = tasks.filter(t => submissions[t.id]?.status === 'approved').length
  const pendingCount = tasks.filter(t => submissions[t.id]?.status === 'pending').length
  const openCount    = tasks.filter(t => t.type === 'open' || !t.type).length
  const testCount    = tasks.filter(t => t.type === 'test').length

  return (
    <div className="p-4 flex flex-col gap-3">
      {/* Статистика */}
      <div className="flex items-center gap-3 text-xs">
        {doneCount > 0 && <span className="text-[var(--neon)]">✓ {doneCount} виконано</span>}
        {pendingCount > 0 && <span className="text-[var(--gold)]">⏳ {pendingCount} перевіряється</span>}
      </div>

      {/* Опитування banner */}
      <button
        onClick={() => navigate('/surveys')}
        className="w-full flex items-center gap-3 p-3 rounded-lg border border-[rgba(0,255,136,0.25)] bg-[rgba(0,255,136,0.05)] hover:bg-[rgba(0,255,136,0.1)] transition-colors text-left"
      >
        <span className="text-xl">🧠</span>
        <div className="flex-1">
          <div className="text-sm font-semibold text-[var(--neon)]">Опитування</div>
          <div className="text-xs text-[#555]">Відповідай та отримуй ресурси</div>
        </div>
        <span className="text-[#555]">→</span>
      </button>

      {/* Фільтр */}
      <div className="flex gap-1 bg-[var(--bg3)] rounded-lg p-1">
        {[
          { id: 'all',  label: `Всі (${tasks.length})` },
          { id: 'open', label: `Відкриті (${openCount})` },
          { id: 'test', label: `Тести (${testCount})` },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setTaskFilter(f.id)}
            className={`flex-1 py-1.5 text-xs font-mono rounded transition-all ${
              taskFilter === f.id ? 'bg-[var(--card)] text-white' : 'text-[#555] hover:text-[#888]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Список */}
      {sorted.length === 0 ? (
        <EmptyState icon="⚔️" text="Немає активних завдань" />
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map(task => (
            <InlineTaskCard
              key={task.id}
              task={task}
              submission={submissions[task.id]}
              onSubmitOpen={() => onOpenSubmit(task)}
              onStartTest={() => setActiveTask(task)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function InlineTaskCard({ task, submission, onSubmitOpen, onStartTest }) {
  const isPending  = submission?.status === 'pending'
  const isApproved = submission?.status === 'approved'
  const isRejected = submission?.status === 'rejected'

  return (
    <Card className={isApproved ? 'opacity-70' : ''}>
      {task.storyText && <LoreBanner text={task.storyText} />}
      <div className={`flex flex-col gap-3 ${task.storyText ? 'mt-3' : ''}`}>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${task.type === 'test' ? 'bg-[rgba(0,170,255,0.15)] text-[var(--info)] border border-[rgba(0,170,255,0.3)]' : 'bg-[rgba(255,69,0,0.15)] text-[var(--accent)] border border-[rgba(255,69,0,0.3)]'}`}>
            {task.type === 'test' ? '📝 ТЕСТ' : '📋 ВІДКРИТЕ'}
          </span>
          {task.type === 'test' && task.questions?.length > 0 && (
            <span className="text-xs text-[#555]">{task.questions.length} питань</span>
          )}
        </div>
        <div>
          <h3 className="font-semibold text-white text-base">{task.title}</h3>
          {task.description && <p className="text-sm text-[#888] mt-1 leading-relaxed">{task.description}</p>}
        </div>
        {task.reward && Object.values(task.reward).some(v => v > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[#555]">Нагорода:</span>
            {Object.entries(task.reward).map(([res, amount]) =>
              amount > 0 ? <ResourceBadge key={res} resource={res} amount={amount} showName /> : null
            )}
          </div>
        )}
        {isApproved && (
          <div className="flex items-center gap-2 p-2 bg-[rgba(0,255,136,0.07)] border border-[rgba(0,255,136,0.2)] rounded">
            <span>✅</span>
            <div>
              <div className="text-sm font-semibold text-[var(--neon)]">Виконано та підтверджено</div>
              {submission.testScore != null && <div className="text-xs text-[#888]">Результат: {submission.testScore}/{submission.testTotal}</div>}
            </div>
          </div>
        )}
        {isPending && (
          <div className="flex items-center gap-2 p-2 bg-[rgba(255,215,0,0.07)] border border-[rgba(255,215,0,0.2)] rounded">
            <span>⏳</span>
            <div className="text-sm font-semibold text-[var(--gold)]">Очікує підтвердження</div>
          </div>
        )}
        {isRejected && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 p-2 bg-[rgba(255,69,0,0.07)] border border-[rgba(255,69,0,0.2)] rounded">
              <span>❌</span>
              <div className="text-sm font-semibold text-[var(--accent)]">Не зараховано — спробуй ще раз</div>
            </div>
            {task.type === 'open' && <Button variant="ghost" className="w-full text-sm" onClick={onSubmitOpen}>ЗДАТИ ЗНОВУ ✓</Button>}
            {task.type === 'test' && <Button variant="ghost" className="w-full text-sm" onClick={onStartTest}>ПРОЙТИ ТЕСТ ЗНОВУ</Button>}
          </div>
        )}
        {!submission && task.type === 'open' && <Button variant="accent" className="w-full" onClick={onSubmitOpen}>ВИКОНАВ ✓</Button>}
        {!submission && task.type === 'test' && <Button variant="neon" className="w-full" onClick={onStartTest}>РОЗПОЧАТИ ТЕСТ →</Button>}
      </div>
    </Card>
  )
}

// ─── Вкладка ПОШТА ────────────────────────────────────────────
function InboxTabContent({ player, messages }) {
  const unread = messages.filter(m => !m.read)
  const read   = messages.filter(m => m.read)

  return (
    <div className="p-4">
      {/* Шапка */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-bebas text-lg tracking-widest text-white">ПОШТА</h2>
          {unread.length > 0 && <p className="text-xs text-[var(--accent)]">{unread.length} непрочитаних</p>}
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

      {messages.length === 0 ? (
        <EmptyState icon="📬" text="Немає повідомлень" />
      ) : (
        <div className="flex flex-col gap-2">
          {unread.map(msg => <InlineMessageItem key={msg.id} msg={msg} onRead={() => markMessageRead(msg.id)} />)}
          {read.length > 0 && unread.length > 0 && (
            <div className="text-xs text-[#555] text-center py-2 uppercase tracking-wider">— прочитані —</div>
          )}
          {read.map(msg => <InlineMessageItem key={msg.id} msg={msg} onRead={() => {}} />)}
        </div>
      )}
    </div>
  )
}

function InlineMessageItem({ msg, onRead }) {
  const icon = MSG_ICONS[msg.type] || '📩'
  const timeStr = msg.createdAt?.toDate
    ? msg.createdAt.toDate().toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : ''
  return (
    <button
      onClick={onRead}
      className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${msg.read ? 'bg-[var(--bg2)] border-[var(--border)] opacity-60' : 'bg-[var(--card)] border-[var(--border)] hover:border-[#333]'}`}
    >
      <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
        <span className="text-lg">{icon}</span>
        {!msg.read && <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-xs font-semibold ${msg.read ? 'text-[#555]' : 'text-[#888]'}`}>{msg.fromName}</span>
          <span className="text-[10px] text-[#444] shrink-0">{timeStr}</span>
        </div>
        <p className={`text-sm mt-0.5 ${msg.read ? 'text-[#555]' : 'text-[var(--text)]'}`}>{msg.text}</p>
      </div>
    </button>
  )
}

// ─── Тест-модалка (вбудована в City) ─────────────────────────
function TestModal({ task, player, existingSub, onClose }) {
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers]   = useState({})
  const [result, setResult]     = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const questions = task.questions || []
  const totalQ    = questions.length
  const answered  = Object.keys(answers).length

  if (existingSub?.status === 'approved') {
    return (
      <TestOverlay onClose={onClose}>
        <div className="flex flex-col items-center gap-4 py-8 px-4">
          <span className="text-5xl">🏆</span>
          <div className="font-bebas text-4xl text-[var(--neon)]">{existingSub.testScore}/{existingSub.testTotal}</div>
          <p className="text-[#888] text-sm text-center">Тест вже пройдено та підтверджено</p>
          <Button variant="ghost" className="w-full" onClick={onClose}>ЗАКРИТИ</Button>
        </div>
      </TestOverlay>
    )
  }

  async function handleSubmit() {
    if (answered < totalQ) { setError(`Дай відповідь на всі ${totalQ} питань`); return }
    setLoading(true); setError('')
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
    if (currentQ < totalQ - 1) setTimeout(() => setCurrentQ(q => q + 1), 300)
  }

  return (
    <TestOverlay onClose={onClose}>
      <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--border)] p-4 z-10">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bebas text-lg tracking-wide text-white truncate pr-2">{task.title}</h3>
          <button onClick={onClose} className="text-[#555] hover:text-white shrink-0 w-7 h-7 flex items-center justify-center">✕</button>
        </div>
        {!result && (
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs text-[#555]">
              <span>Питання {currentQ + 1} з {totalQ}</span>
              <span>{answered}/{totalQ}</span>
            </div>
            <div className="h-1 bg-[var(--border)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--accent)] rounded-full transition-all" style={{ width: `${(answered / totalQ) * 100}%` }} />
            </div>
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col gap-5">
        {result ? (
          <TestResultScreen result={result} task={task} answers={answers} onClose={onClose} />
        ) : (
          <>
            <div className="flex gap-1.5 flex-wrap">
              {questions.map((q, idx) => (
                <button key={q.id} onClick={() => setCurrentQ(idx)}
                  className={`w-8 h-8 rounded text-xs font-mono font-bold transition-all ${answers[q.id] ? 'bg-[var(--accent)] text-white' : idx === currentQ ? 'border-2 border-[var(--accent)] text-[var(--accent)]' : 'bg-[var(--border)] text-[#555]'}`}
                >{idx + 1}</button>
              ))}
            </div>
            {questions[currentQ] && (
              <TestQuestion
                question={questions[currentQ]}
                questionNum={currentQ + 1}
                totalNum={totalQ}
                selectedAnswer={answers[questions[currentQ].id]}
                onSelect={(opt) => selectAnswer(questions[currentQ].id, opt)}
              />
            )}
            {error && <ErrorMsg text={error} />}
            <div className="flex gap-2">
              {currentQ > 0 && <Button variant="ghost" className="flex-1 text-sm" onClick={() => setCurrentQ(q => q - 1)}>← Назад</Button>}
              {currentQ < totalQ - 1
                ? <Button variant="ghost" className="flex-1 text-sm" onClick={() => setCurrentQ(q => q + 1)}>Далі →</Button>
                : <Button variant="accent" className="flex-1" onClick={handleSubmit} disabled={loading || answered < totalQ}>
                    {loading ? 'Перевіряю...' : answered < totalQ ? `Ще ${totalQ - answered}` : 'ВІДПРАВИТИ ✓'}
                  </Button>
              }
            </div>
          </>
        )}
      </div>
    </TestOverlay>
  )
}

function TestQuestion({ question, questionNum, selectedAnswer, onSelect }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-semibold text-white leading-snug">
        <span className="text-[var(--accent)] font-mono mr-1">{questionNum}.</span>
        {question.text}
      </p>
      <div className="flex flex-col gap-2">
        {Object.entries(question.options).map(([opt, text]) => (
          <button key={opt} onClick={() => onSelect(opt)}
            className={`flex items-start gap-3 p-3 rounded-lg border text-left text-sm transition-all ${selectedAnswer === opt ? 'border-[var(--accent)] bg-[rgba(255,69,0,0.12)] text-white' : 'border-[var(--border)] bg-[var(--bg2)] text-[#888] hover:border-[#333]'}`}
          >
            <span className={`font-mono font-bold shrink-0 w-5 h-5 rounded flex items-center justify-center text-xs ${selectedAnswer === opt ? 'bg-[var(--accent)] text-white' : 'text-[#555]'}`}>{opt}</span>
            <span>{text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function TestResultScreen({ result, task, answers, onClose }) {
  const isPerfect = result.correct === result.total
  const percent   = Math.round((result.correct / result.total) * 100)
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="text-5xl">{isPerfect ? '🏆' : result.correct >= result.total / 2 ? '📊' : '📉'}</div>
        <div className="font-bebas text-5xl text-white">{result.correct}<span className="text-[#555] text-3xl">/{result.total}</span></div>
        <div className={`text-lg font-semibold ${isPerfect ? 'text-[var(--gold)]' : 'text-[#888]'}`}>
          {isPerfect ? '🌟 Ідеально!' : `${percent}% правильних`}
        </div>
        {result.xpGain > 0 && <div className="text-xs text-[var(--neon)]">+{result.xpGain} XP</div>}
        {Object.values(result.reward).some(v => v > 0) && (
          <div className="flex flex-wrap gap-2 justify-center">
            {Object.entries(result.reward).map(([res, amount]) =>
              amount > 0 ? <ResourceBadge key={res} resource={res} amount={amount} showName /> : null
            )}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs text-[#555] uppercase tracking-wider">Розбір відповідей</p>
        {(task.questions || []).map(q => {
          const isCorrect = answers[q.id] === q.correct
          return (
            <div key={q.id} className={`p-3 rounded-lg border text-sm ${isCorrect ? 'border-[rgba(0,255,136,0.3)] bg-[rgba(0,255,136,0.05)]' : 'border-[rgba(255,69,0,0.3)] bg-[rgba(255,69,0,0.05)]'}`}>
              <div className="flex items-start gap-2 mb-1">
                <span>{isCorrect ? '✅' : '❌'}</span>
                <span className="text-white font-medium">{q.text}</span>
              </div>
              {!isCorrect && (
                <div className="ml-6 text-xs space-y-0.5">
                  <div className="text-[var(--accent)]">Твоя відповідь: <b>{answers[q.id]}</b> — {q.options[answers[q.id]]}</div>
                  <div className="text-[var(--neon)]">Правильно: <b>{q.correct}</b> — {q.options[q.correct]}</div>
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

function TestOverlay({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-lg bg-[var(--card)] border border-[var(--border)] rounded-t-2xl sm:rounded-xl flex flex-col overflow-hidden" style={{ maxHeight: '92vh' }}>
        <div className="overflow-y-auto flex-1 flex flex-col">{children}</div>
      </div>
    </div>
  )
}

// ─── Модалка підвищення рівня ─────────────────────────────────
function LevelUpModal({ level, heroClass, heroName, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs flex flex-col items-center gap-5 p-6 rounded-2xl border-2 text-center animate-slide-up"
        style={{
          background: 'rgba(12,12,22,0.98)',
          borderColor: 'var(--gold)',
          boxShadow: '0 0 60px rgba(255,215,0,0.25)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Спалах */}
        <div className="text-5xl animate-bounce">{heroClass.icon}</div>

        <div>
          <p className="text-xs tracking-[0.3em] font-mono text-[var(--gold)] uppercase mb-1">
            Рівень підвищено!
          </p>
          <div
            className="font-bebas text-8xl leading-none"
            style={{ color: 'var(--gold)', textShadow: '0 0 30px rgba(255,215,0,0.6)' }}
          >
            {level}
          </div>
          <p className="text-sm text-[#888] mt-1">{heroName}</p>
        </div>

        {level === 2 ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-sm text-[var(--neon)] font-semibold">🔓 Армія розблокована!</p>
            <p className="text-xs text-[#555] font-mono leading-relaxed">
              Тепер ти можеш найняти юнітів і сформувати бойову армію.<br />
              Nova Academy чекає на своїх захисників.
            </p>
          </div>
        ) : (
          <p className="text-xs text-[#555] font-mono leading-relaxed">
            Ти досяг нового рівня.<br />Продовжуй навчатись та будувати своє місто.
          </p>
        )}

        <button
          onClick={onClose}
          className="w-full btn border border-[var(--gold)] text-[var(--gold)] hover:bg-[rgba(255,215,0,0.1)] text-sm py-2.5 tracking-wider"
        >
          [ ПРОДОВЖИТИ ]
        </button>
      </div>
    </div>
  )
}

