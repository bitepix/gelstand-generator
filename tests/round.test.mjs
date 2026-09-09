// node --test    (встроенный раннер, зависимостей не требует)
import test from 'node:test'
import assert from 'node:assert/strict'

import { roundCorners } from '../src/geometry/round.js'

const area = (c) => {
  let sum = 0
  for (let i = 0; i < c.length; i += 1) {
    const [x0, y0] = c[i]
    const [x1, y1] = c[(i + 1) % c.length]
    sum += x0 * y1 - x1 * y0
  }
  return sum / 2
}

const bbox = (c) => [
  Math.min(...c.map((p) => p[0])),
  Math.min(...c.map((p) => p[1])),
  Math.max(...c.map((p) => p[0])),
  Math.max(...c.map((p) => p[1])),
]

/** Расстояние от точки до ближайшего угла квадрата — для проверки радиуса. */
const near = (a, b) => Math.abs(a - b) < 1e-9

test('квадрат против часовой: скругляются выпуклые углы, габарит не меняется', () => {
  const square = [[0, 0], [10, 0], [10, 10], [0, 10]]
  const [out] = roundCorners([square], 1, 0.5)

  assert.deepEqual(bbox(out), [0, 0, 10, 10])
  // Площадь меньше исходной, но больше квадрата со срезанными углами:
  // 100 − 4·(1 − π/4) ≈ 99,14 для точной дуги, полигональная чуть меньше.
  assert.ok(area(out) < 100 && area(out) > 99, `площадь ${area(out)}`)
  // Ни одна точка не совпадает с прежним углом.
  assert.ok(!out.some((p) => near(p[0], 0) && near(p[1], 0)))
})

test('отверстие по часовой: углы считаются вогнутыми, радиус меньше', () => {
  const hole = [[0, 0], [0, 10], [10, 10], [10, 0]]
  const [out] = roundCorners([hole], 1, 0.5)

  assert.deepEqual(bbox(out), [0, 0, 10, 10])
  // Радиус 0,5 срезает вчетверо меньше площади, чем радиус 1,0.
  const cutHole = 100 - Math.abs(area(out))
  const [outer] = roundCorners([[[0, 0], [10, 0], [10, 10], [0, 10]]], 1, 0.5)
  const cutOuter = 100 - area(outer)
  assert.ok(cutHole * 3 < cutOuter, `срез отверстия ${cutHole} против ${cutOuter}`)
})

test('радиус урезается до половины кратчайшего ребра', () => {
  // Полоса шириной 1,5: R 1,0 не влезает, углы получают R 0,75 — полукруг.
  const strip = [[0, 0], [5, 0], [5, 1.5], [0, 1.5]]
  const [out] = roundCorners([strip], 1, 0.5)

  assert.deepEqual(bbox(out), [0, 0, 5, 1.5])
  // Торец превращается в полукруг: точка x = 5 остаётся ровно одна, на y = 0,75.
  const rightmost = out.filter((p) => near(p[0], 5))
  assert.equal(rightmost.length, 1)
  assert.ok(near(rightmost[0][1], 0.75))
})

test('L-образный контур: выпуклые и вогнутый угол скруглены разным радиусом', () => {
  // Уголок стойки: 5,0 × 1,5 и 1,5 × 7,0.
  const l = [[0, 0], [5, 0], [5, 1.5], [1.5, 1.5], [1.5, 7], [0, 7]]
  const [out] = roundCorners([l], 1, 0.5)

  assert.deepEqual(bbox(out), [0, 0, 5, 7])
  // Вогнутая вершина (1,5; 1,5) исчезла, вместо неё дуга радиуса 0,5.
  assert.ok(!out.some((p) => near(p[0], 1.5) && near(p[1], 1.5)))
  const arc = out.filter((p) => p[0] > 1.5 && p[0] < 2.1 && p[1] > 1.5 && p[1] < 2.1)
  assert.ok(arc.length > 0, 'дуга вогнутого угла на месте')
})

test('коллинеарные точки и вырожденные контуры не ломают обход', () => {
  const line = [[0, 0], [5, 0], [10, 0], [10, 5], [0, 5]]
  const [out] = roundCorners([line], 1, 0.5)
  assert.deepEqual(bbox(out), [0, 0, 10, 5])
  assert.deepEqual(roundCorners([[[0, 0], [1, 1]]])[0], [[0, 0], [1, 1]])
})
