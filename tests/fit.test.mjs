// node --test
import test from 'node:test'
import assert from 'node:assert/strict'

import { fit, planFor } from '../src/grid/fit.js'
import { printField } from '../src/printers.js'
import { makeInitialState } from '../src/state/initial.js'

/** Шаг реальной ячейки 19,6 × 37. */
const STEP = { x: 22.6, y: 40 }
const A1 = printField({ printer: 'a1', noPrinter: false }) // 196 × 196
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
  // На A1 помещается 8 × 4 = 32. Сто баночек — четыре подставки по 28.
  const r = fit(100, STEP, A1)
  assert.equal(r.parts, 4)
  assert.ok(r.nx * r.ny * r.parts >= 100)
  assert.equal(r.spare, r.nx * r.ny * r.parts - 100)
})

test('делится ровно настолько, насколько нужно', () => {
  // 33 баночки на A1: вместимость 32, значит две подставки, а не три.
  assert.equal(fit(33, STEP, A1).parts, 2)
  assert.equal(fit(32, STEP, A1).parts, 1)
})

test('ячейка больше стола — подбора нет', () => {
  assert.equal(fit(1, { x: 400, y: 40 }, A1), null)
  assert.equal(fit(0, STEP, A1), null)
})

test('planFor берёт шаг из размеров, поле из принтера', () => {
  const state = { ...makeInitialState(), printer: 'a1' }
  assert.deepEqual(planFor(state), fit(9, STEP, A1))
  assert.equal(planFor({ ...state, fields: { ...state.fields, jars: '' } }), null)
})
