// node --test
//
// Числа сверены с reference/hex/hexStand1.step — разбор в
// reference/hex/README.md. Эталон построен на диаметре 50.
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  hexMetrics, hexPitch, hexLayout, hexSize,
  postContour, postContours, baseHole, hexOutline,
  HEX_WALL, HEX_LEDGE,
} from '../src/geometry/hexCell.js'
import { CHAMFER_FOOT, CHAMFER_TOP, FILLET_CONVEX } from '../src/constants.js'

const D = 50
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`)
const has = (contour, p) =>
  assert.ok(
    contour.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-3),
    `${JSON.stringify(p)} есть в контуре`,
  )
const radii = (c) => c.map(([x, y]) => Math.hypot(x, y))

test('метрики эталона', () => {
  const m = hexMetrics(D)
  near(m.cavity, 25)
  near(m.apothem, 27) // 25 + outerOffset
  near(m.side, (2 * 27) / Math.sqrt(3))
  near(m.holeOuter, 21) // апофема − innerOffset1, а не полость − 6
  near(m.holeInner, 21 - 50 / 7) // 97/7 — ровно то, что лежит в STEP
})

test('полка под баночку не зависит от диаметра', () => {
  for (const d of [20, 26, 50, 80]) {
    const m = hexMetrics(d)
    near(m.cavity - m.holeOuter, HEX_LEDGE - HEX_WALL)
  }
})

test('шаг и раскладка', () => {
  const p = hexPitch(D)
  near(p.x, 1.5 * hexMetrics(D).side)
  near(p.y, 54)
  near(p.offset, 27)
  // замер по эталону: пара 93,531 × 54, то есть два шага по X
  near(2 * p.x, 93.53074360871938)

  // нечётные колонки сдвинуты на апофему
  const cells = hexLayout(D, 2, 2)
  assert.deepEqual(cells.map(([, y]) => y), [0, 54, 27, 81])
})

test('габарит сетки', () => {
  const one = hexSize(D, 1, 1)
  near(one.x, 62.35382907247958)
  near(one.y, 54)
  // сетка 2 × 2 пар из эталона — это 4 × 2 ячейки, замер 202,650 × 135
  const grid = hexSize(D, 4, 2)
  near(grid.x, 6.5 * hexMetrics(D).side)
  assert.equal(grid.x.toFixed(3), '202.650')
  near(grid.y, 135)
})

test('углы стойки лежат там же, где в эталоне', () => {
  const post = postContour(D, 0, 0)
  has(post, [31.176914536239792, 0]) // вершина шестиугольника
  has(post, [23.383, 13.5]) // середина верхней грани
  has(post, [23.383, -13.5]) // середина нижней
  assert.equal(Math.max(...radii(post)).toFixed(3), '31.177')
  assert.equal(Math.min(...radii(post)).toFixed(3), '25.000') // дуга полости
})

test('фаска: полость сужается, скругление растёт, грани не двигаются', () => {
  const foot = postContour(D, CHAMFER_FOOT, 0)
  const top = postContour(D, -CHAMFER_TOP, 0)
  near(Math.min(...radii(foot)), 25 - CHAMFER_FOOT, 1e-3)
  near(Math.min(...radii(top)), 25 + CHAMFER_TOP, 1e-3)
  // вершина шестиугольника на месте на всех уровнях: внешние грани плоские
  for (const c of [foot, top]) has(c, [31.176914536239792, 0])
})

test('три уровня стойки совпадают по числу вершин', () => {
  const counts = [CHAMFER_FOOT, 0, -CHAMFER_TOP].map((d) => postContour(D, d, 0).length)
  assert.equal(new Set(counts).size, 1)
})

test('три стойки у вершин 0, 120, 240', () => {
  const posts = postContours(D, 0)
  assert.equal(posts.length, 3)
  const vertex = (c) => c.reduce((best, p) => (Math.hypot(...p) > Math.hypot(...best) ? p : best))
  const angles = posts.map((c) => Math.round((Math.atan2(...vertex(c).reverse()) * 180) / Math.PI))
  assert.deepEqual(angles.sort((a, b) => a - b), [-120, 0, 120])
})

test('проём в основании: дуги от holeInner до holeOuter', () => {
  const m = hexMetrics(D)
  const r = radii(baseHole(D))
  near(Math.min(...r), m.holeInner, 1e-6)
  near(Math.max(...r), m.holeOuter, 1e-6)
})

test('проём — отверстие, шестиугольник — материал', () => {
  const area = (c) => {
    let s = 0
    for (let i = 0; i < c.length; i += 1) {
      const [x0, y0] = c[i]
      const [x1, y1] = c[(i + 1) % c.length]
      s += x0 * y1 - x1 * y0
    }
    return s / 2
  }
  assert.ok(area(hexOutline(D)) > 0)
  assert.ok(area(baseHole(D)) < 0)
})

test('стойка на минимальном диаметре строится', () => {
  const m = hexMetrics(20)
  assert.equal(postContour(20, CHAMFER_FOOT, 0).length, postContour(20, 0, 0).length)
  assert.ok(FILLET_CONVEX + CHAMFER_FOOT < m.cavity)
})

test('проём говорит понятно, когда лучи не достают', () => {
  // При сдвиге лучей 2 мм проём вырождается ниже Ø 16,8 — вершина клина
  // (2 × сдвиг) уходит за внутренний радиус. На Ø 20 запас всего 1,14 мм,
  // поэтому сдвиг почти наверняка зависит от диаметра, см. reference/hex.
  assert.throws(() => baseHole(20), /луч/)
})
