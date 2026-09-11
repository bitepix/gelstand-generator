// node --test    (встроенный раннер, зависимостей не требует)
//
// Проверяются плоские профили: они считаются без WASM. Сборку и выдавливание
// проверяет scripts/check-geometry.mjs — ему нужен установленный manifold-3d.
import test from 'node:test'
import assert from 'node:assert/strict'

import { profiles, tileSize } from '../src/geometry/profile.js'
import { WALL, ARM_X, ARM_Y, LEDGE, HEIGHT } from '../src/constants.js'

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

test('основание: общий прямоугольник и по два прямоугольника проёма на ячейку', () => {
  const { base } = profiles({ width: 19.6, depth: 37, nx: 3, ny: 3 })
  assert.equal(base.length, 1 + 2 * 9)

  // Внешний контур против часовой, проёмы — по часовой.
  assert.ok(area(base[0]) > 0)
  for (const contour of base.slice(1)) assert.ok(area(contour) < 0)

  // Проём — крест: открытая зона ячейки, ужатая на LEDGE (reference/README.md).
  // Для 19,6 × 37 это 3,25…19,35 × 8,75…31,25 и 6,75…15,85 × 3,25…36,75.
  assert.ok(has(base, [3.25, 8.75, 19.35, 31.25]))
  assert.ok(has(base, [6.75, 3.25, 15.85, 36.75]))

  // Последняя ячейка — тот же крест, сдвинутый на два шага.
  assert.ok(has(base, [2 * 22.6 + 3.25, 2 * 40 + 8.75, 3 * 22.6 - 3.25, 3 * 40 - 8.75]))
})

test('полка под баночку — LEDGE 1,75 со всех сторон', () => {
  const { base } = profiles({ width: 19.6, depth: 37, nx: 1, ny: 1 })
  const wide = base.slice(1).find((c) => bounds(c)[2] - bounds(c)[0] > 16)
  close(bounds(wide)[0], WALL + LEDGE)
  close(bounds(wide)[1], ARM_Y + LEDGE)
})

test('стойки: по две планки на каждый узел сетки', () => {
  const { posts } = profiles({ width: 19.6, depth: 37, nx: 3, ny: 3 })
  assert.equal(posts.length, 2 * 4 * 4)
  for (const contour of posts) assert.ok(area(contour) > 0)

  // Узел в начале координат — угловой: плечи только внутрь.
  assert.ok(has(posts, [0, 0, ARM_X, WALL]))
  assert.ok(has(posts, [0, 0, WALL, ARM_Y]))

  // Дальний угол сетки — зеркально.
  const [X, Y] = [3 * 22.6, 3 * 40]
  assert.ok(has(posts, [X - ARM_X, Y - WALL, X, Y]))
  assert.ok(has(posts, [X - WALL, Y - ARM_Y, X, Y]))
})

test('узел внутри сетки — крест, а не два касающихся уголка', () => {
  // Планки строятся целиком и перекрываются: касающиеся рёбрами прямоугольники
  // 2D-объединение в ядре теряет, и стенка на стыке пропадала.
  const { posts } = profiles({ width: 19.6, depth: 37, nx: 2, ny: 2 })
  assert.ok(has(posts, [22.6 - ARM_X, 40 - WALL, 22.6 + ARM_X, 40 + WALL]))
  assert.ok(has(posts, [22.6 - WALL, 40 - ARM_Y, 22.6 + WALL, 40 + ARM_Y]))
})

test('одна плитка — частный случай сетки 1 × 1', () => {
  const { base, posts, size } = profiles({ width: 19.6, depth: 37, nx: 1, ny: 1 })
  assert.equal(base.length, 3)
  assert.equal(posts.length, 8)
  close(size.x, 22.6)
  close(size.y, 40)
})

test('малая ячейка: от проёма остаётся одна полоса', () => {
  // При depth = 10 плечи стоек сходятся по Y: D − ARM_Y = 6 меньше ARM_Y = 7,
  // и стенка идёт на всю глубину. Открыт только промежуток между торцами
  // вдоль X, значит и проём остаётся один.
  const { base } = profiles({ width: 19.6, depth: 10, nx: 1, ny: 1 })
  assert.equal(base.length, 2)
  assert.ok(has(base, [ARM_X + LEDGE, WALL + LEDGE, 22.6 - ARM_X - LEDGE, 13 - WALL - LEDGE]))
})

test('негодные параметры отвергаются', () => {
  assert.throws(() => profiles({ width: 0, depth: 37, nx: 1, ny: 1 }), TypeError)
  assert.throws(() => profiles({ width: 19.6, depth: NaN, nx: 1, ny: 1 }), TypeError)
  assert.throws(() => profiles({ width: 19.6, depth: 37, nx: 0, ny: 1 }), TypeError)
  assert.throws(() => profiles({ width: 19.6, depth: 37, nx: 1, ny: 2.5 }), TypeError)
})
