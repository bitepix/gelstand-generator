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
// Зависимостей нет.

import { PITCH_EXTRA } from '../constants.js'
import { printField } from '../printers.js'
import { toNumber } from '../validation/normalize.js'

/**
 * @param {number} count    сколько баночек
 * @param {{ x: number, y: number }} step   шаг сетки, мм (размер ячейки + 3)
 * @param {{ x: number, y: number }} field  полезное поле печати, мм
 * @returns {{ nx: number, ny: number, parts: number, spare: number } | null}
 *   parts — сколько одинаковых подставок печатать;
 *   spare — сколько мест останется пустыми;
 *   null — ячейка не помещается на стол даже одна.
 */
export function fit(count, step, field) {
  const maxX = Math.floor(field.x / step.x)
  const maxY = Math.floor(field.y / step.y)
  if (maxX < 1 || maxY < 1 || !Number.isFinite(count) || count < 1) return null

  const capacity = maxX * maxY

  // Одна подставка, если влезает; иначе делим на равные части и берём
  // наименьшее число подставок, при котором сетка помещается.
  for (let parts = 1; parts <= count; parts += 1) {
    const need = Math.ceil(count / parts)
    if (need > capacity) continue
    const grid = bestGrid(need, step, maxX, maxY)
    if (grid) return { ...grid, parts, spare: grid.nx * grid.ny * parts - count }
  }
  return null
}

/** Самая квадратная сетка без лишних строк и столбцов. */
function bestGrid(need, step, maxX, maxY) {
  let best = null
  for (let nx = 1; nx <= maxX; nx += 1) {
    for (let ny = 1; ny <= maxY; ny += 1) {
      if (nx * ny < need) continue
      // Лишняя строка или столбец: без них тоже хватает.
      if (nx > 1 && (nx - 1) * ny >= need) continue
      if (ny > 1 && nx * (ny - 1) >= need) continue

      const skew = Math.abs(nx * step.x - ny * step.y)
      const spare = nx * ny - need
      const better = best === null
        || skew < best.skew - 1e-9
        || (Math.abs(skew - best.skew) < 1e-9 && spare < best.spare)
      if (better) best = { nx, ny, skew, spare }
    }
  }
  return best === null ? null : { nx: best.nx, ny: best.ny }
}

/**
 * То же по состоянию приложения: шаг берётся из размеров ячейки, поле — из
 * выбранного принтера. null, если параметров ещё не хватает.
 */
export function planFor(state) {
  const jars = toNumber(state.fields.jars)
  const width = toNumber(state.fields.width)
  const depth = toNumber(state.fields.depth)
  if (Number.isNaN(jars) || Number.isNaN(width) || Number.isNaN(depth)) return null
  return fit(jars, { x: width + PITCH_EXTRA, y: depth + PITCH_EXTRA }, printField(state))
}
