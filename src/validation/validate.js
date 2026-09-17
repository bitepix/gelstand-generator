// Проверка параметров. ТЗ v4, разделы 4.2, 5.2, 5.3, 7, 16.
//
// Чистая функция: один и тот же результат во всех трёх точках вызова —
// по blur, по кнопке продолжения и перед каждым запуском генерации.
//
// Форма ячейки меняет только набор размерных полей и формулу габарита. Сам
// габарит считается той же функцией, что и в геометрии (grid/size.js),
// чтобы предел и построение не разъехались.

import { SIZE_MAX, PITCH_EXTRA } from '../constants.js'
import { printField } from '../printers.js'
import { rectSize, roundSize } from '../grid/size.js'
import { toNumber } from './normalize.js'

const NO_ERRORS = { width: false, depth: false, diameter: false, nx: false, ny: false }

/**
 * Размерные поля формы, функция габарита и то, какое поле подсвечивать при
 * превышении по оси. У круглой ячейки диаметр отвечает за обе оси сразу.
 */
function shapeOf(state) {
  const { width, depth, diameter } = state.fields
  if (state.shape === 'round') {
    const d = toNumber(diameter)
    return { sizes: { diameter: d }, size: roundSize(d), axis: { x: 'diameter', y: 'diameter' } }
  }
  const w = toNumber(width)
  const p = toNumber(depth)
  return {
    sizes: { width: w, depth: p },
    size: rectSize({ x: w + PITCH_EXTRA, y: p + PITCH_EXTRA }),
    axis: { x: 'width', y: 'depth' },
  }
}

/**
 * @param {object} state
 * @returns {{ errors: string[], fields: Record<string, boolean> }}
 *   errors — коды в порядке ERR-01 … ERR-06;
 *   fields — какие поля показать в состоянии Error.
 */
export function validate(state) {
  const { nx, ny } = state.fields
  const errors = []
  const fields = { ...NO_ERRORS }

  const { sizes, size, axis } = shapeOf(state)
  const cx = toNumber(nx)
  const cy = toNumber(ny)

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
  if (Number.isNaN(cx)) {
    errors.push('ERR-03')
    fields.nx = true
  }
  if (Number.isNaN(cy)) {
    errors.push('ERR-04')
    fields.ny = true
  }

  // ERR-05, ERR-06 — габарит против полезного поля принтера (ТЗ 7).
  // Считается, только если размеры и количества уже прошли проверки: иначе
  // к пустому полю добавился бы шум про габарит.
  if (empty.length === 0 && tooBig.length === 0 && !Number.isNaN(cx) && !Number.isNaN(cy)) {
    const overall = size(cx, cy)
    const field = printField(state)
    if (overall.x > field.x) {
      errors.push('ERR-05')
      fields[axis.x] = true
      fields.nx = true
    }
    if (overall.y > field.y) {
      // Обе оси разом — это ERR-07 из таблицы 16: два сообщения в одном блоке.
      errors.push('ERR-06')
      fields[axis.y] = true
      fields.ny = true
    }
  }

  return { errors, fields }
}

/** Параметры годятся для генерации. */
export function isValid(state) {
  return validate(state).errors.length === 0
}

/**
 * Реальный габарит модели, мм. ТЗ 7 и 11.4 — показывается под превью.
 * Считается только для валидных параметров.
 */
export function overall(state) {
  const { nx, ny } = state.fields
  return shapeOf(state).size(toNumber(nx), toNumber(ny))
}
