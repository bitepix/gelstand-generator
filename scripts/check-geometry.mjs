// Проверка геометрии: node scripts/check-geometry.mjs
//
// Единственный скрипт в проекте, которому нужна установленная зависимость
// (manifold-3d с его WASM). Считает модель критерия 21 из раздела 20 ТЗ и
// проверяет требования 12.5: замкнутый манифолд, положительный октант,
// нижняя грань на Z = 0, габарит 67,8 × 120,0 × 15,0.

import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { export3MF } from '../src/export/threemf.js'
import { exportSTL } from '../src/export/stl.js'
import { fileName } from '../src/export/fileName.js'

import { BASE, HEIGHT, CHAMFER_FOOT, CHAMFER_TOP, PITCH_EXTRA } from '../src/constants.js'
import { hexSize } from '../src/geometry/hexCell.js'

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

// Положительный октант, нижняя грань на нуле. ТЗ 12.5. Превью ставит модель
// по габариту, считая её лежащей в этом октанте, — иначе она съезжает со стола.
function checkOrigin(positions, what) {
  for (let axis = 0; axis < 3; axis += 1) {
    let min = Infinity
    for (let v = axis; v < positions.length; v += 3) min = Math.min(min, positions[v])
    assert.ok(Math.abs(min) < 1e-4, `${what}: по оси ${'XYZ'[axis]} модель начинается с ${min}, а не с нуля`)
  }
}
checkOrigin(mesh.positions, 'прямоугольная 3 × 3')

checkClosed(mesh.indices)

// Уровни Z — критерий 21а: они же в reference/ta2-1.step.
const levels = new Set()
for (let v = 2; v < mesh.positions.length; v += 3) {
  levels.add(Math.round(mesh.positions[v] * 1000) / 1000)
}
assert.deepEqual(
  [...levels].sort((a, b) => a - b),
  [0, BASE, BASE + CHAMFER_FOOT, HEIGHT - CHAMFER_TOP, HEIGHT],
)

// Одна плитка — тот же путь, сетка 1 × 1.
const tile = await build({ ...CASE, nx: 1, ny: 1 })
assert.deepEqual(tile.bbox, {
  x: 19.6 + PITCH_EXTRA,
  y: 37 + PITCH_EXTRA,
  z: HEIGHT,
})
checkClosed(tile.indices)

// Сверка с эталоном: объём одной плитки против reference/ta2-1.stl.
// Расхождение допускается только на триангуляцию дуг — доли процента.
const volumeOf = (positions, indices) => {
  let v = 0
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = [indices[i] * 3, indices[i + 1] * 3, indices[i + 2] * 3]
    v += positions[a] * (positions[b + 1] * positions[c + 2] - positions[c + 1] * positions[b + 2])
      - positions[a + 1] * (positions[b] * positions[c + 2] - positions[c] * positions[b + 2])
      + positions[a + 2] * (positions[b] * positions[c + 1] - positions[c] * positions[b + 1])
  }
  return Math.abs(v / 6)
}

const stl = readFileSync(resolve(import.meta.dirname, '../reference/ta2-1.stl'))
const facets = stl.readUInt32LE(80)
const refPositions = new Float32Array(facets * 9)
const refIndices = new Uint32Array(facets * 3)
for (let f = 0; f < facets; f += 1) {
  const at = 84 + f * 50 + 12
  for (let k = 0; k < 9; k += 1) refPositions[f * 9 + k] = stl.readFloatLE(at + k * 4)
  for (let k = 0; k < 3; k += 1) refIndices[f * 3 + k] = f * 3 + k
}

const mine = volumeOf(tile.positions, tile.indices)
const reference = volumeOf(refPositions, refIndices)
const drift = Math.abs(mine - reference) / reference
assert.ok(drift < 0.005, `объём плитки ${mine.toFixed(2)} против эталона ${reference.toFixed(2)} мм³`)

console.log(`Сетка 3 × 3 (19,6 × 37,0): ${mesh.bbox.x} × ${mesh.bbox.y} × ${mesh.bbox.z} мм`)
console.log(`Треугольников ${triangles}, вершин ${vertices}, построение ${elapsed.toFixed(1)} мс`)
console.log(`Одна плитка: ${tile.bbox.x} × ${tile.bbox.y} × ${tile.bbox.z} мм`)
console.log(`Уровни Z: ${[...levels].sort((a, b) => a - b).join(' / ')}`)
console.log(`Объём плитки ${mine.toFixed(2)} мм³, эталон ${reference.toFixed(2)} — расхождение ${(drift * 100).toFixed(2)} %`)
// Круглая ячейка: гексагональная сетка строится от центра первой ячейки и
// без сдвига уходит в минус по X и Y.
const hex = await build({ shape: 'round', diameter: 30, nx: 3, ny: 3 })
checkOrigin(hex.positions, 'круглая 3 × 3')
checkClosed(hex.indices)
const hexExpected = hexSize(30, 3, 3)
assert.ok(
  Math.abs(hex.bbox.x - hexExpected.x) < 1e-3 && Math.abs(hex.bbox.y - hexExpected.y) < 1e-3,
  `габарит круглой ${hex.bbox.x} × ${hex.bbox.y} против расчётного ${hexExpected.x} × ${hexExpected.y}`,
)

console.log(`Круглая 3 × 3 (⌀30): ${hex.bbox.x} × ${hex.bbox.y} × ${hex.bbox.z} мм`)
console.log('Замкнутый манифолд, положительный октант — критерии 21 и 21а пройдены.')

// Модель кладётся на диск: часть приёмки видна только в слайсере.
const out = resolve(import.meta.dirname, '..', 'tmp')
mkdirSync(out, { recursive: true })
const params = { width: '19,6', depth: '37', nx: '3', ny: '3' }
for (const [ext, blob] of [['3mf', export3MF(mesh)], ['stl', exportSTL(mesh)]]) {
  const path = resolve(out, fileName(params, ext))
  writeFileSync(path, Buffer.from(await blob.arrayBuffer()))
  console.log(path)
}
