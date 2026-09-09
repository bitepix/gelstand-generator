// Проверка геометрии: node scripts/check-geometry.mjs
//
// Единственный скрипт в проекте, которому нужна установленная зависимость
// (manifold-3d с его WASM). Считает модель критерия 21 из раздела 20 ТЗ и
// проверяет требования 12.5: замкнутый манифолд, положительный октант,
// нижняя грань на Z = 0, габарит 67,8 × 120,0 × 15,0.

import assert from 'node:assert/strict'

import { BASE, HEIGHT, PITCH_EXTRA } from '../src/constants.js'

let build
try {
  ({ build } = await import('../src/geometry/build.js'))
} catch (error) {
  if (error.code === 'ERR_MODULE_NOT_FOUND') {
    console.error('Нет зависимости manifold-3d. Установить: npm install')
    process.exit(1)
  }
  throw error
}

const CASE = { width: 19.6, depth: 37, nx: 3, ny: 3 }
const EXPECTED = { x: 67.8, y: 120, z: 15 }

/**
 * Замкнутость и ориентируемость по мешу: у замкнутой поверхности каждое
 * направленное ребро встречается ровно один раз, а каждое ненаправленное —
 * ровно два. Проверка не зависит от библиотеки, которая меш построила.
 */
function checkClosed(indices) {
  const directed = new Set()
  const undirected = new Map()

  for (let i = 0; i < indices.length; i += 3) {
    const tri = [indices[i], indices[i + 1], indices[i + 2]]
    for (let e = 0; e < 3; e += 1) {
      const a = tri[e]
      const b = tri[(e + 1) % 3]

      const forward = `${a}>${b}`
      assert.ok(!directed.has(forward), `ребро ${forward} встречается дважды — поверхность не ориентируема`)
      directed.add(forward)

      const key = a < b ? `${a}-${b}` : `${b}-${a}`
      undirected.set(key, (undirected.get(key) ?? 0) + 1)
    }
  }

  const open = [...undirected].filter(([, count]) => count !== 2)
  assert.equal(open.length, 0, `${open.length} рёбер не имеют пары — поверхность не замкнута`)
}

const started = performance.now()
const mesh = await build(CASE)
const elapsed = performance.now() - started

const triangles = mesh.indices.length / 3
const vertices = mesh.positions.length / 3

assert.equal(mesh.positions.constructor, Float32Array)
assert.equal(mesh.indices.constructor, Uint32Array)
assert.equal(mesh.indices.length % 3, 0)
assert.ok(triangles > 0, 'меш пуст')

assert.deepEqual(mesh.bbox, EXPECTED)

// Положительный октант, нижняя грань на нуле. ТЗ 12.5.
for (let axis = 0; axis < 3; axis += 1) {
  let min = Infinity
  for (let v = axis; v < mesh.positions.length; v += 3) min = Math.min(min, mesh.positions[v])
  assert.ok(Math.abs(min) < 1e-4, `по оси ${'XYZ'[axis]} модель начинается не с нуля, а с ${min}`)
}

checkClosed(mesh.indices)

// Уровни Z. Приёмка B2: без фасок горизонтальные грани только на трёх уровнях
// — низ, верх основания и верх стоек (ТЗ 22, примечание про альфу).
const levels = new Set()
for (let v = 2; v < mesh.positions.length; v += 3) {
  levels.add(Math.round(mesh.positions[v] * 1000) / 1000)
}
assert.deepEqual([...levels].sort((a, b) => a - b), [0, BASE, HEIGHT])

// Одна плитка — тот же путь, сетка 1 × 1.
const tile = await build({ ...CASE, nx: 1, ny: 1 })
assert.deepEqual(tile.bbox, {
  x: 19.6 + PITCH_EXTRA,
  y: 37 + PITCH_EXTRA,
  z: HEIGHT,
})
checkClosed(tile.indices)

console.log(`Сетка 3 × 3 (19,6 × 37,0): ${mesh.bbox.x} × ${mesh.bbox.y} × ${mesh.bbox.z} мм`)
console.log(`Треугольников ${triangles}, вершин ${vertices}, построение ${elapsed.toFixed(1)} мс`)
console.log(`Одна плитка: ${tile.bbox.x} × ${tile.bbox.y} × ${tile.bbox.z} мм`)
console.log(`Уровни Z: ${[...levels].sort((a, b) => a - b).join(' / ')}`)
console.log('Замкнутый манифолд, положительный октант — критерий 21 пройден.')
