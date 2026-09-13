// Подбор сетки из количества баночек. ТЗ v4, раздел 6.3.
//
// Квадратной должна быть подставка, а не сетка: ячейка 22,6 × 40 сильно
// вытянута, и 9 × 9 дало бы плиту 203 × 360. Поэтому мерой служит разница
// сторон готовой подставки, а не сетки.
//
// Второе условие — не тратить места впустую: из пары не должно вычёркиваться
// ни строки, ни столбца. Без него подбор выбирает сетки с большим запасом
// только потому, что они чуть ровнее: на девять баночек вышло бы 5 × 3, где
// шесть мест пустуют, вместо 5 × 2 с одним.
//
// Форма ячейки сюда не проникает: подбор получает функцию габарита. У
// прямоугольной он линеен по обеим осям, у гексагональной — нет, там ряды
// нечётных колонок сдвинуты и к высоте добавляется апофема.

import { PITCH_EXTRA } from '../constants.js'
import { printField } from '../printers.js'
import { toNumber } from '../validation/normalize.js'
import { hexSize } from '../geometry/hexCell.js'

const FUZZ = 1e-9

/** Габарит прямоугольной подставки. */
export const rectSize = (step) => (nx, ny) => ({ x: nx * step.x, y: ny * step.y })

/** Габарит гексагональной подставки. */
export const roundSize = (diameter) => (nx, ny) => hexSize(diameter, nx, ny)

/**
 * @param {number} count    сколько баночек
 * @param {(nx: number, ny: number) => { x: number, y: number }} sizeOf габарит подставки
 * @param {{ x: number, y: number }} field  полезное поле печати, мм
 * @returns {{ nx: number, ny: number, parts: number, spare: number } | null}
 *   parts — сколько одинаковых подставок печатать;
 *   spare — сколько мест останется пустыми;
 *   null — ячейка не помещается на стол даже одна.
 */
export function fit(count, sizeOf, field) {
  if (!Number.isFinite(count) || count < 1) return null

  const fits = (nx, ny) => {
    const s = sizeOf(nx, ny)
    return s.x <= field.x + FUZZ && s.y <= field.y + FUZZ
  }
  if (!fits(1, 1)) return null

  const maxX = span((n) => fits(n, 1))
  const maxY = span((n) => fits(1, n))

  let capacity = 0
  for (let nx = 1; nx <= maxX; nx += 1) {
    for (let ny = 1; ny <= maxY; ny += 1) {
      if (fits(nx, ny)) capacity = Math.max(capacity, nx * ny)
    }
  }

  // Одна подставка, если влезает; иначе делим на равные части и берём
  // наименьшее число подставок, при котором сетка помещается.
  for (let parts = 1; parts <= count; parts += 1) {
    const need = Math.ceil(count / parts)
    if (need > capacity) continue
    const grid = bestGrid(need, sizeOf, fits, maxX, maxY)
    if (grid) return { ...grid, parts, spare: grid.nx * grid.ny * parts - count }
  }
  return null
}

/** Сколько подряд идущих значений от 1 проходят проверку. */
function span(ok) {
  let n = 0
  while (ok(n + 1)) n += 1
  return n
}

/** Самая квадратная сетка без лишних строк и столбцов. */
function bestGrid(need, sizeOf, fits, maxX, maxY) {
  let best = null
  for (let nx = 1; nx <= maxX; nx += 1) {
    for (let ny = 1; ny <= maxY; ny += 1) {
      if (nx * ny < need || !fits(nx, ny)) continue
      // Лишняя строка или столбец: без них тоже хватает.
      if (nx > 1 && (nx - 1) * ny >= need) continue
      if (ny > 1 && nx * (ny - 1) >= need) continue

      const size = sizeOf(nx, ny)
      const skew = Math.abs(size.x - size.y)
      const spare = nx * ny - need
      const better = best === null
        || skew < best.skew - FUZZ
        || (Math.abs(skew - best.skew) < FUZZ && spare < best.spare)
      if (better) best = { nx, ny, skew, spare }
    }
  }
  return best === null ? null : { nx: best.nx, ny: best.ny }
}

/**
 * То же по состоянию приложения: габарит берётся из формы и размеров ячейки,
 * поле — из выбранного принтера. null, если параметров ещё не хватает.
 */
export function planFor(state) {
  const jars = toNumber(state.fields.jars)
  if (Number.isNaN(jars)) return null

  if (state.shape === 'round') {
    const diameter = toNumber(state.fields.diameter)
    if (Number.isNaN(diameter)) return null
    return fit(jars, roundSize(diameter), printField(state))
  }

  const width = toNumber(state.fields.width)
  const depth = toNumber(state.fields.depth)
  if (Number.isNaN(width) || Number.isNaN(depth)) return null
  return fit(jars, rectSize({ x: width + PITCH_EXTRA, y: depth + PITCH_EXTRA }), printField(state))
}
