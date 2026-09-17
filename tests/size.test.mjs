// node --test
//
// Габарит подставки. Подбор сетки из количества баночек удалён вместе с полем
// «Сколько у вас баночек», поэтому здесь остались только формулы размера —
// на них держатся и предел печати (ТЗ 7), и строка под превью (ТЗ 11.4).

import test from 'node:test'
import assert from 'node:assert/strict'

import { rectSize, roundSize } from '../src/grid/size.js'

test('прямоугольный габарит линеен по обеим осям', () => {
  const size = rectSize({ x: 22.6, y: 40 })
  assert.ok(Math.abs(size(3, 3).x - 67.8) < 1e-9)
  assert.equal(size(3, 3).y, 120)
  assert.deepEqual(size(1, 1), { x: 22.6, y: 40 })
})

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

test('на A1 (поле 226) помещается 7 × 6 баночек Ø 30', () => {
  // По X: 29,445 × (nx − 1) + 39,26 ≤ 226 → nx ≤ 7.
  // По Y при nx ≥ 2: 34 × ny + 17 ≤ 226 → ny ≤ 6.
  const size = roundSize(30)
  assert.ok(size(7, 6).x <= 226 && size(7, 6).y <= 226)
  assert.ok(size(8, 6).x > 226)
  assert.ok(size(7, 7).y > 226)
})
