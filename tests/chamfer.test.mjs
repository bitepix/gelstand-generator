// node --test    (встроенный раннер, зависимостей не требует)
import test from 'node:test'
import assert from 'node:assert/strict'

import { offsetContour, chamferRing } from '../src/geometry/chamfer.js'

const close = (a, b) => Math.abs(a - b) < 1e-9
const same = (got, want) =>
  got.length === want.length && got.every((p, i) => close(p[0], want[i][0]) && close(p[1], want[i][1]))

test('offsetContour сжимает контур внутрь', () => {
  const square = [[0, 0], [10, 0], [10, 10], [0, 10]]
  assert.ok(same(offsetContour(square, 1), [[1, 1], [9, 1], [9, 9], [1, 9]]))
})

test('отрицательный delta расширяет', () => {
  const square = [[0, 0], [10, 0], [10, 10], [0, 10]]
  assert.ok(same(offsetContour(square, -0.5), [[-0.5, -0.5], [10.5, -0.5], [10.5, 10.5], [-0.5, 10.5]]))
})

test('вогнутая вершина едет против биссектрисы', () => {
  // Уголок стойки: при сжатии на 0,25 вырез расширяется, вершина (1,5; 1,5)
  // уходит в материал, а не в вырез.
  const l = [[0, 0], [5, 0], [5, 1.5], [1.5, 1.5], [1.5, 7], [0, 7]]
  const out = offsetContour(l, 0.25)
  assert.ok(same(out, [
    [0.25, 0.25], [4.75, 0.25], [4.75, 1.25], [1.25, 1.25], [1.25, 6.75], [0.25, 6.75],
  ]))
})

test('отверстие по часовой сжимается вместе с материалом', () => {
  // Проём: сжатие материала на 0,5 расширяет отверстие.
  const hole = [[0, 0], [0, 10], [10, 10], [10, 0]]
  const out = offsetContour(hole, 0.5)
  assert.ok(same(out, [[-0.5, -0.5], [-0.5, 10.5], [10.5, 10.5], [10.5, -0.5]]))
})

test('chamferRing даёт замкнутую поверхность', () => {
  const mesh = chamferRing([[[0, 0], [10, 0], [10, 10], [0, 10]]], 14.5, 15, 0.5)

  assert.equal(mesh.numProp, 3)
  assert.equal(mesh.vertProperties.length / 3, 12) // три ряда по четыре вершины
  assert.equal(mesh.triVerts.length / 3, 24) // шесть треугольников на сегмент

  // Каждое ненаправленное ребро ровно дважды — поверхность замкнута.
  const edges = new Map()
  for (let i = 0; i < mesh.triVerts.length; i += 3) {
    const tri = [mesh.triVerts[i], mesh.triVerts[i + 1], mesh.triVerts[i + 2]]
    for (let e = 0; e < 3; e += 1) {
      const a = tri[e]
      const b = tri[(e + 1) % 3]
      const key = a < b ? `${a}-${b}` : `${b}-${a}`
      edges.set(key, (edges.get(key) ?? 0) + 1)
    }
  }
  assert.deepEqual([...edges.values()].filter((n) => n !== 2), [])
})
