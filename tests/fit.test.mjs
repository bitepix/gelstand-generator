// node --test
import test from 'node:test'
import assert from 'node:assert/strict'

import { fit, planFor, rectSize, roundSize } from '../src/grid/fit.js'
import { printField } from '../src/printers.js'
import { makeInitialState } from '../src/state/initial.js'

/** Шаг реальной ячейки 19,6 × 37. */
const STEP = rectSize({ x: 22.6, y: 40 })
const A1 = printField({ printer: 'a1', noPrinter: false }) // 226 × 226
const BIG = printField({ printer: null, noPrinter: false }) // 350 × 320

test('подставка, а не сетка: 9 баночек дают 5 × 2, а не 3 × 3', () => {
  // 5 × 2 — это 113 × 80 мм, 3 × 3 было бы 67,8 × 120.
  assert.deepEqual(fit(9, STEP, A1), { nx: 5, ny: 2, parts: 1, spare: 1 })
})

test('без лишних строк и столбцов', () => {
  // 5 × 3 ровнее по сторонам, но шесть мест пустовали бы.
  const r = fit(9, STEP, BIG)
  assert.ok(r.nx * r.ny - 9 <= 2, `лишних мест ${r.nx * r.ny - 9}`)
})

test('ровное число заполняется без запаса', () => {
  assert.deepEqual(fit(24, STEP, A1), { nx: 6, ny: 4, parts: 1, spare: 0 })
})

test('79 на большом поле — 12 × 7', () => {
  assert.deepEqual(fit(79, STEP, BIG), { nx: 12, ny: 7, parts: 1, spare: 5 })
})

test('не помещается — делится на равные подставки', () => {
  // На A1 помещается 10 × 5 = 50. Сто баночек — две подставки по 50.
  const r = fit(100, STEP, A1)
  assert.equal(r.parts, 2)
  assert.ok(r.nx * r.ny * r.parts >= 100)
  assert.equal(r.spare, r.nx * r.ny * r.parts - 100)
})

test('делится ровно настолько, насколько нужно', () => {
  // 51 баночка на A1: вместимость 50, значит две подставки, а не три.
  assert.equal(fit(51, STEP, A1).parts, 2)
  assert.equal(fit(50, STEP, A1).parts, 1)
})

test('ячейка больше стола — подбора нет', () => {
  assert.equal(fit(1, rectSize({ x: 400, y: 40 }), A1), null)
  assert.equal(fit(0, STEP, A1), null)
})

test('planFor берёт шаг из размеров, поле из принтера', () => {
  const state = { ...makeInitialState(), printer: 'a1' }
  assert.deepEqual(planFor(state), fit(9, STEP, A1))
  assert.equal(planFor({ ...state, fields: { ...state.fields, jars: '' } }), null)
})

// --- гексагональная сетка ---

test('гексагональный габарит нелинеен по X', () => {
  // Первая колонка занимает 2 стороны, каждая следующая — полторы.
  const size = roundSize(30)
  const side = (2 * 17) / Math.sqrt(3)
  assert.ok(Math.abs(size(1, 1).x - 2 * side) < 1e-9)
  assert.ok(Math.abs(size(2, 1).x - 3.5 * side) < 1e-9)
  assert.ok(Math.abs(size(3, 1).x - 5 * side) < 1e-9)
})

test('вторая колонка добавляет апофему к высоте, а не ряд', () => {
  const size = roundSize(30)
  assert.equal(size(1, 2).y, 68) // 2 × 34
  assert.equal(size(2, 2).y, 85) // + апофема: нечётная колонка сдвинута
  assert.equal(size(3, 2).y, 85) // третья колонка ничего не добавляет
})

test('на A1 помещается 7 × 6 баночек Ø 30', () => {
  // Поле 226. По X: 29,445 × (nx − 1) + 39,26 ≤ 226 → nx ≤ 7.
  // По Y при nx ≥ 2: 34 × ny + 17 ≤ 226 → ny ≤ 6.
  const size = roundSize(30)
  assert.ok(size(7, 6).x <= 226 && size(7, 6).y <= 226)
  assert.ok(size(8, 6).x > 226)
  assert.ok(size(7, 7).y > 226)

  const r = fit(42, size, A1)
  assert.equal(r.parts, 1)
  assert.equal(r.nx * r.ny, 42)
})

test('гексагональная упаковка плотнее квадратной на том же столе', () => {
  // Ø 30 в прямоугольной ячейке — это 30 × 30, шаг 33 × 33: на A1 влезает
  // 6 × 6 = 36. Гексагональная берёт 7 × 6 = 42 на том же поле.
  const square = rectSize({ x: 33, y: 33 })
  const hexa = roundSize(30)
  assert.equal(fit(36, square, A1).parts, 1)
  assert.equal(fit(37, square, A1).parts, 2) // 36 — предел квадратной
  assert.equal(fit(42, hexa, A1).parts, 1)
  assert.equal(fit(43, hexa, A1).parts, 2) // 42 — предел гексагональной

  // Выигрыш именно во вместимости: подбор под конкретное число баночек
  // по-прежнему выбирает самую квадратную сетку, а не самую полную.
  assert.equal(fit(100, hexa, A1).nx * fit(100, hexa, A1).ny, 35)
})

test('подбор гексагональной сетки держит квадратность подставки', () => {
  const size = roundSize(30)
  const r = fit(12, size, printField({ printer: null, noPrinter: false }))
  const s = size(r.nx, r.ny)
  // сетка 4 × 3 даёт 127,6 × 119 — почти квадрат
  assert.equal(r.parts, 1)
  assert.ok(Math.abs(s.x - s.y) < 0.2 * Math.max(s.x, s.y), `${s.x} × ${s.y}`)
})

test('planFor выбирает формулу по форме ячейки', () => {
  const base = { ...makeInitialState(), printer: 'a1' }
  const round = {
    ...base,
    shape: 'round',
    fields: { ...base.fields, diameter: '30', jars: '30' },
  }
  assert.deepEqual(planFor(round), fit(30, roundSize(30), A1))
  assert.equal(planFor({ ...round, fields: { ...round.fields, diameter: '' } }), null)
})
