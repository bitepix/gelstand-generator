// node --test
//
// Проверяются плоские контуры: они считаются без WASM. Числа сверены с
// reference/ta2-1.step — разбор в reference/README.md.
import test from 'node:test'
import assert from 'node:assert/strict'

import { outlines, tidy, widen, turnAt } from '../src/geometry/outline.js'
import { FILLET_CONVEX, FILLET_CONCAVE, CHAMFER_FOOT } from '../src/constants.js'

const SIZE = { x: 22.6, y: 40 }
/** Уголок стойки в начале координат: три вершины на габарите, три внутри. */
const BRACKET = [[0, 0], [5, 0], [5, 1.5], [1.5, 1.5], [1.5, 7], [0, 7]]

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`)
const hasPoint = (contour, p) =>
  assert.ok(
    contour.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-9),
    `${JSON.stringify(p)} есть в контуре`,
  )

test('точки на прямой выбрасываются, углы остаются', () => {
  const withExtra = [[0, 0], [2, 0], [5, 0], [5, 1.5], [0, 1.5]]
  assert.equal(tidy(withExtra).length, 4)
  assert.equal(tidy(BRACKET).length, 6)
})

test('раздвижка: рёбра на габарите стоят, остальные уходят наружу', () => {
  const wide = widen(BRACKET, CHAMFER_FOOT, SIZE)
  assert.equal(wide.length, BRACKET.length)
  hasPoint(wide, [0, 0])
  hasPoint(wide, [5.5, 0]) // торец плеча ушёл, грань y = 0 осталась
  hasPoint(wide, [0, 7.5])
  hasPoint(wide, [2, 2]) // локоть сдвинулся по диагонали
})

test('выпуклый угол даёт левый поворот, вогнутый правый', () => {
  assert.ok(turnAt(BRACKET, 2) > 0) // (5, 1.5) — торец плеча
  assert.ok(turnAt(BRACKET, 3) < 0) // (1.5, 1.5) — локоть
})

test('углы на габарите остаются острыми', () => {
  const { post } = outlines({ base: [], posts: [BRACKET] }, SIZE)
  for (const p of [[0, 0], [5, 0], [0, 7]]) hasPoint(post[0], p)
})

test('радиусы стойки: 1,0 выпуклый, 0,5 вогнутый', () => {
  const { post } = outlines({ base: [], posts: [BRACKET] }, SIZE)
  // Дуга у торца плеча начинается там, где кончается прямой участок.
  hasPoint(post[0], [5, 1.5 - FILLET_CONVEX])
  hasPoint(post[0], [1.5 + FILLET_CONCAVE, 1.5])
})

test('три контура стойки совпадают по числу вершин', () => {
  const { foot, post, top } = outlines({ base: [], posts: [BRACKET] }, SIZE)
  assert.equal(foot[0].length, post[0].length)
  assert.equal(top[0].length, post[0].length)
})

test('скос меняет радиус вместе с контуром', () => {
  const { foot, top } = outlines({ base: [], posts: [BRACKET] }, SIZE)
  // Подошва: торец плеча на 5,5, угол на 2,0, радиус 1,5 — дуга с (5,5; 0,5).
  hasPoint(foot[0], [5.5, 2 - (FILLET_CONVEX + CHAMFER_FOOT)])
  // Верх: торец на 4,5, угол на 1,0, выпуклый радиус 0,5, вогнутый 1,0.
  hasPoint(top[0], [4.5, 1 - (FILLET_CONVEX - CHAMFER_FOOT)])
  hasPoint(top[0], [1 + FILLET_CONCAVE + CHAMFER_FOOT, 1])
})

test('вершины трёх контуров отвечают друг другу по порядку', () => {
  const { foot, post, top } = outlines({ base: [], posts: [BRACKET] }, SIZE)
  // Первая вершина — острый угол детали, он не двигается ни на одном уровне.
  for (const c of [foot, post, top]) {
    near(c[0][0][0], 0)
    near(c[0][0][1], 0)
  }
})

test('общий сдвиг совпадает с прежним осевым на прямоугольных контурах', () => {
  // Прежняя формула: горизонтальное ребро двигать по Y, вертикальное по X.
  const axial = (contour, d, size) => {
    const n = contour.length
    const lines = contour.map((p, i) => {
      const q = contour[(i + 1) % n]
      const dx = Math.sign(q[0] - p[0])
      const dy = Math.sign(q[1] - p[1])
      const fixed = dy === 0 ? Math.abs(p[1]) < 1e-3 || Math.abs(p[1] - size.y) < 1e-3
        : Math.abs(p[0]) < 1e-3 || Math.abs(p[0] - size.x) < 1e-3
      const k = fixed ? 0 : d
      return { horiz: dy === 0, x: p[0] + dy * k, y: p[1] - dx * k }
    })
    return lines.map((l, i) => {
      const prev = lines[(i + n - 1) % n]
      return l.horiz ? [prev.x, l.y] : [l.x, prev.y]
    })
  }

  const cases = [
    BRACKET,
    [[100, 100], [105, 100], [105, 101.5], [101.5, 101.5], [101.5, 107], [100, 107]],
    [[0, 0], [22.6, 0], [22.6, 40], [0, 40]],
    [[3.25, 31.25], [19.35, 31.25], [19.35, 8.75], [3.25, 8.75]],
  ]
  for (const c of cases) {
    for (const d of [0.5, -0.5]) {
      // `|| 0` убирает минус-ноль: общая формула даёт −0 там, где осевая 0
      const mine = widen(c, d, SIZE).map((p) => p.map((v) => Math.round(v * 1e9) || 0))
      const was = axial(c, d, SIZE).map((p) => p.map((v) => Math.round(v * 1e9) || 0))
      assert.deepEqual(mine, was, `сдвиг ${d} на ${JSON.stringify(c)}`)
    }
  }
})

test('сдвиг работает на наклонных рёбрах', () => {
  // Правильный шестиугольник со стороной 10: апофема растёт на d.
  const hex = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i
    return [10 * Math.cos(a), 10 * Math.sin(a)]
  })
  const wide = widen(hex, 0.5, { x: 1e6, y: 1e6 })
  assert.equal(wide.length, 6)
  const radius = Math.hypot(...wide[0])
  // описанный радиус растёт на d / cos30
  near(radius, 10 + 0.5 / Math.cos(Math.PI / 6))
})
