// ─── City Page (/city): Головна сторінка гри ───

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useGameStore, { HERO_CLASSES, RESOURCE_ICONS, getXPProgress, getHeroLevel } from '../store/gameStore'
import {
  subscribePlayer, getBuildings, updatePlayer,
  ensureResourceMap, startResearch, revealCell, buildMine, collectMine, upgradeMine,
  placeBuildingOnGrid, removeBuildingFromGrid,
} from '../firebase/service'
import { upgradeCastle } from '../firebase/castleService'
import { recruitUnit, upgradeUnit, setFormation } from '../firebase/unitService'
import {
  ResourceBar, XPBar, Spinner, ErrorMsg, SuccessMsg, Button, Card, BottomNav
} from '../components/UI'
import BuildingCard from '../components/BuildingCard'
import MiningGrid   from '../components/MiningGrid'
import CastlePanel  from '../components/CastlePanel'
import UnitsPanel   from '../components/UnitsPanel'

const NAV_ITEMS = [
  { id: 'city',   icon: '🏙️', label: 'Місто'   },
  { id: 'map',    icon: '🗺️', label: 'Карта'   },
  { id: 'tasks',  icon: '⚔️', label: 'Завдання' },
  { id: 'inbox',  icon: '📬', label: 'Пошта'   },
  { id: 'trade',  icon: '🔄', label: 'Торгівля' },
]

export default function City() {
  const navigate = useNavigate()
  const { player, playerId, setPlayer, unreadMessages, logout } = useGameStore()

  const [buildings, setBuildings]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [feedback, setFeedback]     = useState({ type: '', text: '' })
  const [showLogout, setShowLogout] = useState(false)
  const [levelUp, setLevelUp]       = useState(null) // { level } або null

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
    } catch {
      showFeedback('error', 'Помилка апгрейду')
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
    } catch (err) {
      showFeedback('error', err.message)
    }
  }

  async function handleCollectMine(cellIndex) {
    try {
      const { resource, amount } = await collectMine(player.id, cellIndex)
      const info = RESOURCE_ICONS[resource]
      showFeedback('success', `Зібрано: ${info?.icon || ''} +${amount} ${info?.name || resource}`)
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
      await upgradeCastle(player.id)
      showFeedback('success', 'Замок покращено!')
    } catch (err) {
      showFeedback('error', err.message)
    }
  }

  // ─── Юніти ──────────────────────────────────────────────────
  async function handleRecruitUnit(unitId) {
    try {
      await recruitUnit(player.id, unitId)
      showFeedback('success', 'Юніта найнято!')
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

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">

      {/* ─── Шапка ─── */}
      <header className="sticky top-0 z-40 bg-[var(--bg2)] border-b border-[var(--border)] p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{heroClass.icon}</span>
            <div>
              <div className="font-semibold text-white leading-tight">{player.name}</div>
              <div className="text-xs text-[#666]">
                {player.heroName} · {heroClass.name} · Рівень {xpProgress.level}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="text-xs text-[#555]">{player.group}</div>
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
            <p className="text-sm text-[#888]">
              Твоє місто та ресурси збережені. Увійдеш знову через Landing.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleLogout} className="btn btn-accent text-sm">ВИЙТИ</button>
              <button onClick={() => setShowLogout(false)} className="btn btn-ghost text-sm">СКАСУВАТИ</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Контент ─── */}
      <main className="flex-1 p-4 pb-20 max-w-2xl mx-auto w-full">
        {feedback.text && (
          <div className="mb-4">
            {feedback.type === 'error'   && <ErrorMsg text={feedback.text} />}
            {feedback.type === 'success' && <SuccessMsg text={feedback.text} />}
          </div>
        )}

        <CityTab
          player={player}
          buildings={buildings}
          xpProgress={xpProgress}
          heroClass={heroClass}
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
        />
      </main>

      {/* ─── Левел-ап модалка ─── */}
      {levelUp && (
        <LevelUpModal
          level={levelUp.level}
          heroClass={heroClass}
          heroName={player.heroName}
          onClose={() => setLevelUp(null)}
        />
      )}

      <BottomNav items={navItems} active="city" onChange={id => {
        if (id === 'map')   navigate('/map')
        if (id === 'tasks') navigate('/tasks')
        if (id === 'inbox') navigate('/inbox')
        if (id === 'trade') navigate('/trade')
      }} />
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

// ─── Вкладка МІСТО ────────────────────────────────────────────
function CityTab({
  player, buildings, xpProgress, heroClass,
  onWorkerToggle, onUpgrade, onWorkerReset,
  onStartResearch, onRevealCell, onBuildMine, onCollectMine, onUpgradeMine,
  onPlaceBuilding, onRemoveBuilding,
  onCastleUpgrade, onRecruitUnit, onUpgradeUnit, onSetFormation,
}) {
  const totalPlaced  = player.workers?.placed || 0
  const totalWorkers = player.workers?.total  || 5
  const totalProd    = calcTotalProduction(player, buildings)
  const hasProd      = Object.values(totalProd).some(v => v > 0)

  return (
    <div className="flex flex-col gap-5">

      {/* ─── ГЕРОЙ ─── */}
      <section>
        <SectionTitle>ГЕРОЙ</SectionTitle>
        <Card>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-lg bg-[var(--bg3)] flex items-center justify-center text-2xl">
              {heroClass.icon}
            </div>
            <div className="flex-1">
              <div className="font-bebas text-xl text-white tracking-wide">{player.heroName}</div>
              <div className="text-sm text-[#888]">{heroClass.name} · {player.group}</div>
            </div>
          </div>
          <XPBar {...xpProgress} />
          <div className="grid grid-cols-3 gap-2 mt-3">
            {[
              { label: 'Інтелект',     value: player.heroStats?.intellect  || 5, icon: '🧠' },
              { label: 'Витривалість', value: player.heroStats?.endurance  || 5, icon: '💪' },
              { label: 'Харизма',      value: player.heroStats?.charisma   || 5, icon: '✨' },
            ].map(stat => (
              <div key={stat.label} className="text-center bg-[var(--bg3)] rounded p-2">
                <div className="text-base">{stat.icon}</div>
                <div className="font-mono text-lg text-[var(--gold)]">{stat.value}</div>
                <div className="text-[10px] text-[#555] uppercase">{stat.label}</div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* ─── ВИРОБНИЦТВО ─── */}
      {hasProd && (
        <section>
          <SectionTitle>ВИРОБНИЦТВО/ГОД</SectionTitle>
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
                      <div className="font-mono text-sm font-bold" style={{ color: info.color }}>
                        +{rate}/год
                      </div>
                      <div className="text-[10px] text-[#555]">{info.name}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </section>
      )}

      {/* ─── РОБІТНИКИ ─── */}
      <section>
        <SectionTitle>РОБІТНИКИ</SectionTitle>
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">👥</span>
              <div>
                <div className="font-semibold text-white">
                  {totalPlaced}/{totalWorkers} розміщено
                </div>
                <div className="text-xs text-[#555]">{totalWorkers - totalPlaced} вільних</div>
              </div>
            </div>
            {/* Смужки робітників */}
            <div className="flex gap-1">
              {Array.from({ length: totalWorkers }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-6 rounded-sm transition-colors ${
                    i < totalPlaced ? 'bg-[var(--neon)]' : 'bg-[var(--border)]'
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Button variant="ghost" className="w-full text-sm" onClick={onWorkerReset}>
              🔄 ПЕРЕРОЗПОДІЛИТИ
            </Button>
            <div className="text-center">
              <WorkerResetTimer lastWorkerReset={player.lastWorkerReset} />
            </div>
          </div>
        </Card>
      </section>

      {/* ─── БУДІВЛІ ─── */}
      <section>
        <SectionTitle>БУДІВЛІ</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {buildings.map(building => {
            const pb      = player.buildings[building.id] || { level: 0, workers: 0 }
            const nextLvl = building.levels?.[pb.level]
            const canUpgrade = nextLvl
              ? Object.entries(nextLvl.cost).every(([res, cost]) => (player.resources[res] || 0) >= cost)
              : false

            return (
              <BuildingCard
                key={building.id}
                building={building}
                playerBuilding={pb}
                workers={player.workers || { total: 5, placed: totalPlaced }}
                onWorkerToggle={onWorkerToggle}
                onUpgrade={onUpgrade}
                canUpgrade={canUpgrade}
                upgradeDisabled={!canUpgrade}
              />
            )
          })}
        </div>
      </section>

      {/* ─── ПОЛЕ МІСТА ─── */}
      {player.resourceMap && (
        <section>
          <SectionTitle>ПОЛЕ МІСТА</SectionTitle>
          <Card className="p-3">
            <p className="text-xs text-[#555] mb-3 leading-relaxed">
              Тисни на клітинку щоб розмістити будівлю або дослідити ділянку (💾 50 Бітів, ⏱ 6 год).
              На «?» клітинках є поклади ресурсів — знайди та добувай!
            </p>
            <MiningGrid
              player={player}
              buildings={buildings}
              onStartResearch={onStartResearch}
              onRevealCell={onRevealCell}
              onBuildMine={onBuildMine}
              onCollectMine={onCollectMine}
              onUpgradeMine={onUpgradeMine}
              onPlaceBuilding={onPlaceBuilding}
              onRemoveBuilding={onRemoveBuilding}
              onWorkerToggle={onWorkerToggle}
              onUpgrade={onUpgrade}
            />
          </Card>
        </section>
      )}

      {/* ─── ЗАМОК ─── */}
      <section>
        <SectionTitle>ЗАМОК</SectionTitle>
        <CastlePanel player={player} onUpgrade={onCastleUpgrade} />
      </section>

      {/* ─── АРМІЯ ─── */}
      <section>
        <SectionTitle>АРМІЯ</SectionTitle>
        <UnitsPanel
          player={player}
          onRecruit={onRecruitUnit}
          onUpgrade={onUpgradeUnit}
          onSetFormation={onSetFormation}
        />
      </section>
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

        <p className="text-xs text-[#555] font-mono leading-relaxed">
          Ти досяг нового рівня.<br />Продовжуй навчатись та будувати своє місто.
        </p>

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

function SectionTitle({ children }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="h-0.5 w-3 bg-[var(--accent)]" />
      <h2 className="font-bebas text-lg tracking-widest text-[#888]">{children}</h2>
      <div className="h-0.5 flex-1 bg-[var(--border)]" />
    </div>
  )
}
