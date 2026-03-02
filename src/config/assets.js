// ─── Asset paths — Phase 18 ───
// Централізований реєстр шляхів до зображень.
// Використовує import.meta.env.BASE_URL для коректної роботи на GitHub Pages (/eduland/).
// Якщо файл відсутній — GameImage автоматично показує emoji-fallback.

const BASE = import.meta.env.BASE_URL  // '/eduland/' в продакшн, '/' локально

/** Зображення будівлі по id та рівню */
export function buildingImg(id, level = 1) {
  const disciplineBuildings = ['greenhouse', 'reactor', 'biolab', 'solar_array']
  const labBuildings = ['geolab', 'extraction_station', 'assault_base', 'signal_tower']

  if (disciplineBuildings.includes(id)) return `${BASE}assets/buildings/discipline/${id}_${level}.png`
  if (labBuildings.includes(id))       return `${BASE}assets/buildings/labs/${id}_${level}.png`
  return `${BASE}assets/buildings/${id}_${level}.png`
}

/** Зображення юніта */
export function unitImg(id) {
  return `${BASE}assets/units/${id}.png`
}

/** Портрет класу героя */
export function heroImg(heroClass) {
  return `${BASE}assets/heroes/hero_${heroClass}.png`
}

/** Маркер поля на карті */
export function fieldImg(type, tier = null) {
  if (type === 'ruin')    return `${BASE}assets/fields/field_ruin_t${tier}.png`
  if (type === 'neutral') return `${BASE}assets/fields/field_neutral.png`
  return `${BASE}assets/fields/field_${type}.png`
}

/** Декоративний елемент */
export function decorImg(name) {
  return `${BASE}assets/decor/decor_${name}.png`
}
