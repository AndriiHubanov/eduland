// ─── Asset paths — Phase 16 ───
// Централізований реєстр шляхів до зображень.
// Якщо файл відсутній — GameImage автоматично показує emoji-fallback.

/** Зображення будівлі по id та рівню */
export function buildingImg(id, level = 1) {
  const disciplineBuildings = ['greenhouse', 'reactor', 'biolab', 'solar_array']
  const labBuildings = ['geolab', 'extraction_station', 'assault_base', 'signal_tower']

  if (disciplineBuildings.includes(id)) return `/assets/buildings/discipline/${id}_${level}.png`
  if (labBuildings.includes(id))       return `/assets/buildings/labs/${id}_${level}.png`
  return `/assets/buildings/${id}_${level}.png`
}

/** Зображення юніта */
export function unitImg(id) {
  return `/assets/units/${id}.png`
}

/** Портрет класу героя */
export function heroImg(heroClass) {
  return `/assets/heroes/hero_${heroClass}.png`
}

/** Маркер поля на карті */
export function fieldImg(type, tier = null) {
  if (type === 'ruin')    return `/assets/fields/field_ruin_t${tier}.png`
  if (type === 'neutral') return `/assets/fields/field_neutral.png`
  return `/assets/fields/field_${type}.png`
}

/** Декоративний елемент */
export function decorImg(name) {
  return `/assets/decor/decor_${name}.png`
}
