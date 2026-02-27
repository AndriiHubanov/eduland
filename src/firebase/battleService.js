// ─── Battle Service ───
// Симуляція бою MyLands-стиль: раундова, з логом

import {
  doc, addDoc, collection, runTransaction, serverTimestamp,
} from 'firebase/firestore'
import { db } from './config'
import { UNITS, getUnitStats, UNIT_LEVEL_MULTIPLIER } from './unitService'

// ─── Утиліти ─────────────────────────────────────────────────

function rand(min, max) {
  return Math.random() * (max - min) + min
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val))
}

// ─── Підготовка армії до бою ─────────────────────────────────

function prepareArmy(armyData, heroClass) {
  // armyData: [{ unitId, count, level }]
  const soldiers = []
  for (const slot of armyData) {
    const unit = UNITS[slot.unitId]
    if (!unit) continue
    const stats = getUnitStats(slot.unitId, slot.level, heroClass)
    for (let i = 0; i < slot.count; i++) {
      soldiers.push({
        id: `${slot.unitId}_${i}`,
        unitId: slot.unitId,
        name: unit.name,
        icon: unit.icon,
        type: unit.type,
        hp: stats.hp,
        maxHP: stats.hp,
        atk: stats.atk,
        def: stats.def,
        special: unit.special,
        alive: true,
        // Спеціальні властивості
        firstStrike: slot.unitId === 'scout_drone',
        ignoreDef: slot.unitId === 'hack_spider' ? 0.5 : 0,
        healPerRound: slot.unitId === 'medic_unit' ? 20 * (UNIT_LEVEL_MULTIPLIER[slot.level] || 1) : 0,
        tauntRounds: slot.unitId === 'guardian_core' ? 2 : 0,
        evasionChance: slot.unitId === 'code_phantom' ? 0.3 : 0,
        atkAura: slot.unitId === 'relay_tower' ? 0.15 : 0,
        shieldBlock: slot.unitId === 'shield_bot' ? 1 : 0, // blocks remaining
        siegeBonus: slot.unitId === 'siege_mech' ? 0.5 : 0,
      })
    }
  }
  return soldiers
}

// ─── Симуляція бою ───────────────────────────────────────────

/**
 * simulateBattle — головна функція
 * @param {Array} attackerArmy - [{ unitId, count, level }]
 * @param {Array} defenderArmy - [{ unitId, count, level }]
 * @param {string} attackerClass - heroClass атакуючого
 * @param {string|null} defenderClass - heroClass захисника (null для руїн)
 * @param {boolean} isRuin - чи бій проти руїни
 * @returns {{ rounds, result, attackerLosses, defenderLosses, survivingAttackers, survivingDefenders }}
 */
export function simulateBattle(attackerArmy, defenderArmy, attackerClass, defenderClass = null, isRuin = false) {
  const attackers = prepareArmy(attackerArmy, attackerClass)
  const defenders = prepareArmy(defenderArmy, defenderClass)

  if (attackers.length === 0) return { rounds: [], result: 'lose', attackerLosses: {}, defenderLosses: {} }
  if (defenders.length === 0) return { rounds: [], result: 'win', attackerLosses: {}, defenderLosses: {} }

  // Обчислюємо ауру ATK
  const attackerAura = attackers.reduce((sum, s) => sum + s.atkAura, 0)
  const defenderAura = defenders.reduce((sum, s) => sum + s.atkAura, 0)
  attackers.forEach(s => { s.atk = Math.floor(s.atk * (1 + attackerAura)) })
  defenders.forEach(s => { s.atk = Math.floor(s.atk * (1 + defenderAura)) })

  // Siege bonus для руїн
  if (isRuin) {
    attackers.forEach(s => {
      if (s.siegeBonus > 0) s.atk = Math.floor(s.atk * (1 + s.siegeBonus))
    })
  }

  const rounds = []
  const MAX_ROUNDS = 10

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const events = []

    // Фаза 0: First strike (scout_drone)
    if (round === 1) {
      const firstStrikers = attackers.filter(s => s.alive && s.firstStrike)
      for (const attacker of firstStrikers) {
        const target = pickTarget(defenders, round)
        if (!target) break
        const dmg = calcDamage(attacker, target)
        events.push({
          actor: attacker.id,
          actorName: attacker.name,
          target: target.id,
          targetName: target.name,
          damage: dmg,
          special: 'Перший удар!',
        })
        target.hp -= dmg
        if (target.hp <= 0) { target.alive = false; target.hp = 0 }
      }
    }

    // Фаза 1: Збираємо всіх живих і сортуємо за initiative
    const allSoldiers = [
      ...attackers.filter(s => s.alive).map(s => ({ ...s, side: 'attacker', ref: s })),
      ...defenders.filter(s => s.alive).map(s => ({ ...s, side: 'defender', ref: s })),
    ]

    allSoldiers.sort((a, b) => {
      const initA = a.atk * 0.3 + a.def * 0.1 + rand(0, 10)
      const initB = b.atk * 0.3 + b.def * 0.1 + rand(0, 10)
      return initB - initA
    })

    // Фаза 2: Ходи
    for (const soldier of allSoldiers) {
      const s = soldier.ref
      if (!s.alive) continue

      // Support: лікує замість атаки
      if (s.healPerRound > 0) {
        const allies = soldier.side === 'attacker' ? attackers : defenders
        const wounded = allies.filter(a => a.alive && a.hp < a.maxHP).sort((a, b) => a.hp - b.hp)
        if (wounded.length > 0) {
          const healTarget = wounded[0]
          const healAmount = Math.min(Math.floor(s.healPerRound), healTarget.maxHP - healTarget.hp)
          if (healAmount > 0) {
            healTarget.hp += healAmount
            events.push({
              actor: s.id, actorName: s.name,
              target: healTarget.id, targetName: healTarget.name,
              damage: -healAmount,
              special: 'Лікування',
            })
          }
        }
        continue
      }

      // ATK = 0 (relay_tower) — пропускає хід
      if (s.atk <= 0) continue

      const enemies = soldier.side === 'attacker' ? defenders : attackers
      const target = pickTarget(enemies, round)
      if (!target) continue

      // Evasion check
      if (target.evasionChance > 0 && Math.random() < target.evasionChance) {
        events.push({
          actor: s.id, actorName: s.name,
          target: target.id, targetName: target.name,
          damage: 0,
          special: 'Промах — ціль ухилилась!',
        })
        continue
      }

      // Shield block check
      if (target.shieldBlock > 0) {
        target.shieldBlock--
        events.push({
          actor: s.id, actorName: s.name,
          target: target.id, targetName: target.name,
          damage: 0,
          special: 'Заблоковано щитом!',
        })
        continue
      }

      const dmg = calcDamage(s, target)
      events.push({
        actor: s.id, actorName: s.name,
        target: target.id, targetName: target.name,
        damage: dmg,
        special: null,
      })

      target.hp -= dmg
      if (target.hp <= 0) { target.alive = false; target.hp = 0 }
    }

    // Підсумок раунду
    const attackerHP = attackers.filter(s => s.alive).reduce((sum, s) => sum + s.hp, 0)
    const defenderHP = defenders.filter(s => s.alive).reduce((sum, s) => sum + s.hp, 0)

    rounds.push({ round, events, attackerHP, defenderHP })

    // Перевірка кінця бою
    if (!defenders.some(s => s.alive)) break
    if (!attackers.some(s => s.alive)) break
  }

  // Результат
  const attackersAlive = attackers.some(s => s.alive)
  const defendersAlive = defenders.some(s => s.alive)
  let result = 'draw'
  if (attackersAlive && !defendersAlive) result = 'win'
  else if (!attackersAlive && defendersAlive) result = 'lose'

  // Рахуємо втрати
  const attackerLosses = {}
  const defenderLosses = {}
  for (const s of attackers) {
    if (!s.alive) {
      attackerLosses[s.unitId] = (attackerLosses[s.unitId] || 0) + 1
    }
  }
  for (const s of defenders) {
    if (!s.alive) {
      defenderLosses[s.unitId] = (defenderLosses[s.unitId] || 0) + 1
    }
  }

  return {
    rounds,
    result,
    attackerLosses,
    defenderLosses,
    survivingAttackers: attackers.filter(s => s.alive).length,
    survivingDefenders: defenders.filter(s => s.alive).length,
  }
}

// ─── Вибір цілі ─────────────────────────────────────────────

function pickTarget(enemies, round) {
  const alive = enemies.filter(s => s.alive)
  if (alive.length === 0) return null

  // Таунт — перші N раундів атакуємо тільки танта
  const taunters = alive.filter(s => s.tauntRounds >= round)
  if (taunters.length > 0) return taunters[Math.floor(Math.random() * taunters.length)]

  // Пріоритет: support > dps > tank
  const supports = alive.filter(s => s.type === 'support')
  if (supports.length > 0 && Math.random() < 0.4) return supports[Math.floor(Math.random() * supports.length)]

  return alive[Math.floor(Math.random() * alive.length)]
}

// ─── Розрахунок шкоди ────────────────────────────────────────

function calcDamage(attacker, target) {
  const defReduction = attacker.ignoreDef > 0
    ? target.def * (1 - attacker.ignoreDef)
    : target.def

  const raw = attacker.atk * rand(0.85, 1.15) - defReduction * 0.5
  return Math.max(1, Math.floor(raw))
}

// ─── Збереження бою в Firebase ───────────────────────────────

export async function saveBattleResult({
  type, attackerId, defenderId, ruinId, ruinTier,
  attackerArmy, defenderArmy,
  battleResult, loot, xpGain, casualties,
}) {
  const ref = await addDoc(collection(db, 'battles'), {
    type,
    attackerId,
    defenderId: defenderId || null,
    ruinId: ruinId || null,
    ruinTier: ruinTier || null,
    attackerArmy,
    defenderArmy,
    rounds: battleResult.rounds,
    result: battleResult.result,
    loot: loot || null,
    xpGain: xpGain || 0,
    casualties: casualties || {},
    createdAt: serverTimestamp(),
  })
  return ref.id
}

// ─── Застосування втрат юнітів ───────────────────────────────

export async function applyCasualties(playerId, losses) {
  if (!losses || Object.keys(losses).length === 0) return

  await runTransaction(db, async (tx) => {
    const playerRef = doc(db, 'players', playerId)
    const snap = await tx.get(playerRef)
    if (!snap.exists()) return

    const player = snap.data()
    const updates = { lastActive: serverTimestamp() }

    for (const [unitId, lostCount] of Object.entries(losses)) {
      const current = player.units?.[unitId]?.count || 0
      updates[`units.${unitId}.count`] = Math.max(0, current - lostCount)
    }

    tx.update(playerRef, updates)
  })
}
