// node --test    (встроенный раннер, зависимостей не требует)
//
// Проверяются плоские профили: они считаются без WASM. Сборку и выдавливание
// проверяет scripts/check-geometry.mjs — ему нужен установленный manifold-3d.
import test from 'node:test'
import assert from 'node:assert/strict'

import { profiles, tileSize } from '../src/geometry/profile.js'
import { WALL, ARM_X, ARM_Y, HEIGHT } from '../src/constants.js'

/** Площадь контура со знаком: против часовой — плюс, по часовой — минус. */
const area = (contour) => {
  let sum = 0
  for (let i = 0; i < contour.length; i += 1) {
    const [x0, y0] = contour[i]
    const [x1, y1] = contour[(i + 1) % contour.length]
    sum += x0 * y1 - x1 * y0
  }
  return sum / 2
}

/** Контур прямоугольника как [x0, y0, x1, y1], без учёта порядка обхода. */
const bounds = (contour) => [
  Math.min(...contour.map((p) => p[0])),
  Math.min(...contour.map((p) => p[1])),
  Math.max(...contour.map((p) => p[0])),
  Math.max(...contour.map((p) => p[1])),
]

const has = (list, box) => list.some((c) => bounds(c).every((v, i) => Math.abs(v - box[i]) < 1e-9))

const close = (actual, expected) => assert.ok(
  Math.abs(actual - expected) < 1e-9,
  `${actual} ≈ ${expected}`,
)

test('шаг сетки: W = w + 3, D = d + 3', () => {
  const { W, D } = tileSize(19.6, 37)
  close(W, 22.6)
  close(D, 40)
})

test('габарит сетки — критерий 21 ТЗ: 67,8 × 120,0 × 15,0', () => {
  const { size } = profiles({ width: 19.6, depth: 37, nx: 3, ny: 3 })
  close(size.x, 67.8)
  close(size.y, 120)
  assert.equal(HEIGHT, 15)
})

test('основание: один общий прямоугольник и по проёму на ячейку', () => {
  const { base } = profiles({ width: 19.6, depth: 37, nx: 3, ny: 3 })
  assert.equal(base.length, 1 + 9)

  // Внешний контур против часовой, проёмы — по часовой.
  assert.ok(area(base[0]) > 0)
  for (const contour of base.slice(1)) assert.ok(area(contour) < 0)

  // Проём первой плитки и последней: от плеча до плеча.
  assert.ok(has(base, [ARM_X, ARM_Y, 22.6 - ARM_X, 40 - ARM_Y]))
  assert.ok(has(base, [2 * 22.6 + ARM_X, 2 * 40 + ARM_Y, 3 * 22.6 - ARM_X, 3 * 40 - ARM_Y]))
})

test('полка под баночку: 3,5 вдоль X и 5,5 вдоль Y', () => {
  close(ARM_X - WALL, 3.5)
  close(ARM_Y - WALL, 5.5)
})

test('стойки: по два прямоугольника на каждый из четырёх углов плитки', () => {
  const { posts } = profiles({ width: 19.6, depth: 37, nx: 3, ny: 3 })
  assert.equal(posts.length, 8 * 9)
  for (const contour of posts) assert.ok(area(contour) > 0)

  // Уголок в начале координат: ARM_X × WALL и WALL × ARM_Y.
  assert.ok(has(posts, [0, 0, ARM_X, WALL]))
  assert.ok(has(posts, [0, 0, WALL, ARM_Y]))

  // Дальний угол сетки — зеркально, внутрь габарита.
  const [X, Y] = [3 * 22.6, 3 * 40]
  assert.ok(has(posts, [X - ARM_X, Y - WALL, X, Y]))
  assert.ok(has(posts, [X - WALL, Y - ARM_Y, X, Y]))
})

test('уголки соседних плиток стыкуются в узле сетки', () => {
  const { posts } = profiles({ width: 19.6, depth: 37, nx: 2, ny: 1 })
  // Плечи слева и справа от узла x = 22,6 лежат встык, шириной 2 × ARM_X.
  assert.ok(has(posts, [22.6 - ARM_X, 0, 22.6, WALL]))
  assert.ok(has(posts, [22.6, 0, 22.6 + ARM_X, WALL]))
})

test('одна плитка — частный случай сетки 1 × 1', () => {
  const { base, posts, size } = profiles({ width: 19.6, depth: 37, nx: 1, ny: 1 })
  assert.equal(base.length, 2)
  assert.equal(posts.length, 8)
  close(size.x, 22.6)
  close(size.y, 40)
})

test('малая ячейка: проёма нет, основание сплошное', () => {
  // При depth = 10 плечи стоек сходятся: D − ARM_Y = 6 меньше ARM_Y = 7.
  const { base } = profiles({ width: 19.6, depth: 10, nx: 1, ny: 1 })
  assert.equal(base.length, 1)
})

test('негодные параметры отвергаются', () => {
  assert.throws(() => profiles({ width: 0, depth: 37, nx: 1, ny: 1 }), TypeError)
  assert.throws(() => profiles({ width: 19.6, depth: NaN, nx: 1, ny: 1 }), TypeError)
  assert.throws(() => profiles({ width: 19.6, depth: 37, nx: 0, ny: 1 }), TypeError)
  assert.throws(() => profiles({ width: 19.6, depth: 37, nx: 1, ny: 2.5 }), TypeError)
})
