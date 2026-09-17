// Проверка параметров. ТЗ v5, разделы 5.2, 5.3, 16.
//
// Чистая функция: один и тот же результат и по blur, и перед каждым запуском
// генерации.
//
// Предела габарита здесь больше нет. Подставка крупнее стола — не ошибка, а
// предупреждение: контур стола в превью краснеет (ТЗ 7). Печатать по частям,
// резать модель в слайсере или просто смотреть, что получилось, человеку
// никто не запрещает.

import { SIZE_MAX } from '../constants.js'
import { toNumber } from './normalize.js'

const NO_ERRORS = { width: false, depth: false, diameter: false, nx: false, ny: false }

/** Размерные поля формы: у круглой один диаметр вместо ширины и глубины. */
function sizesOf(state) {
  const { width, depth, diameter } = state.fields
  if (state.shape === 'round') return { diameter: toNumber(diameter) }
  return { width: toNumber(width), depth: toNumber(depth) }
}

/**
 * @param {object} state
 * @returns {{ errors: string[], fields: Record<string, boolean> }}
 *   errors — коды в порядке ERR-01 … ERR-04;
 *   fields — какие поля показать в состоянии Error.
 */
export function validate(state) {
  const { nx, ny } = state.fields
  const errors = []
  const fields = { ...NO_ERRORS }
  const sizes = sizesOf(state)

  // ERR-01 — пустое поле размера. Один код на все размерные поля, ТЗ 16.
  const empty = Object.keys(sizes).filter((f) => Number.isNaN(sizes[f]))
  if (empty.length > 0) {
    errors.push('ERR-01')
    for (const f of empty) fields[f] = true
  }

  // ERR-02 — размер больше 100 мм. Значение не правится автоматически.
  const tooBig = Object.keys(sizes).filter((f) => !Number.isNaN(sizes[f]) && sizes[f] > SIZE_MAX)
  if (tooBig.length > 0) {
    errors.push('ERR-02')
    for (const f of tooBig) fields[f] = true
  }

  // ERR-03, ERR-04 — пустое количество.
  if (Number.isNaN(toNumber(nx))) {
    errors.push('ERR-03')
    fields.nx = true
  }
  if (Number.isNaN(toNumber(ny))) {
    errors.push('ERR-04')
    fields.ny = true
  }

  return { errors, fields }
}

/** Параметры годятся для генерации. */
export function isValid(state) {
  return validate(state).errors.length === 0
}
