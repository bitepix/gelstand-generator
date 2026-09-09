// Проверка экспорта. Зависимостей нет: node scripts/check-export.mjs
//
// Пишет оба файла в tmp/ и вскрывает 3MF штатным unzip. Файлы остаются
// на диске: 3MF нужно открыть в слайсере и убедиться, что габарит
// совпадает с напечатанным ниже (ТЗ, инженерная приёмка, пункт 21).

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { exportSTL } from '../src/export/stl.js'
import { export3MF } from '../src/export/threemf.js'
import { fileName } from '../src/export/fileName.js'
import { HEIGHT, PITCH_EXTRA } from '../src/constants.js'

// Тестовый меш: плитка одной ячейки исходной модели, 22,6 × 40 × 15 мм
// (ТЗ 22). Габарит узнаваемый — в слайсере видно сразу, верен ли масштаб.
const PARAMS = { width: '19,6', depth: '37', nx: '1', ny: '1' }
const X = 19.6 + PITCH_EXTRA
const Y = 37 + PITCH_EXTRA
const Z = HEIGHT

function box(x, y, z) {
  const positions = new Float32Array([
    0, 0, 0, x, 0, 0, x, y, 0, 0, y, 0,
    0, 0, z, x, 0, z, x, y, z, 0, y, z,
  ])
  const indices = new Uint32Array([
    0, 2, 1, 0, 3, 2, // низ, нормаль −Z
    4, 5, 6, 4, 6, 7, // верх, +Z
    0, 1, 5, 0, 5, 4, // перед, −Y
    2, 3, 7, 2, 7, 6, // зад, +Y
    0, 4, 7, 0, 7, 3, // лево, −X
    1, 2, 6, 1, 6, 5, // право, +X
  ])
  return { positions, indices, bbox: { x, y, z } }
}

const mesh = box(X, Y, Z)
const out = resolve(import.meta.dirname, '..', 'tmp')
mkdirSync(out, { recursive: true })

const bytes = async (blob) => Buffer.from(await blob.arrayBuffer())

// --- имя файла, ТЗ 15.2 ---------------------------------------------------

assert.equal(fileName(PARAMS, '3mf'), 'Nail_Modernism_Gelstand_19.6x37mm_1x1.3mf')
assert.equal(fileName(PARAMS, 'stl'), 'Nail_Modernism_Gelstand_19.6x37mm_1x1.stl')
assert.equal(
  fileName({ width: '19,6', depth: '37', nx: '3', ny: '3' }, '3mf'),
  'Nail_Modernism_Gelstand_19.6x37mm_3x3.3mf',
)

// --- STL ------------------------------------------------------------------

const stl = await bytes(exportSTL(mesh))
const stlPath = resolve(out, fileName(PARAMS, 'stl'))
writeFileSync(stlPath, stl)

const triangles = mesh.indices.length / 3
assert.equal(stl.length, 84 + triangles * 50, 'длина бинарного STL')
assert.equal(stl.readUInt32LE(80), triangles, 'число треугольников в заголовке')
assert.notEqual(stl.subarray(0, 5).toString('ascii'), 'solid', 'заголовок не должен читаться как ASCII STL')

// Нормали: по две на грань, в порядке −Z, +Z, −Y, +Y, −X, +X.
const expected = [
  [0, 0, -1], [0, 0, -1], [0, 0, 1], [0, 0, 1],
  [0, -1, 0], [0, -1, 0], [0, 1, 0], [0, 1, 0],
  [-1, 0, 0], [-1, 0, 0], [1, 0, 0], [1, 0, 0],
]
for (let i = 0; i < triangles; i++) {
  const at = 84 + i * 50
  // + 0 приводит −0 к 0: знак нуля здесь ничего не значит.
  const n = [stl.readFloatLE(at), stl.readFloatLE(at + 4), stl.readFloatLE(at + 8)]
    .map((v) => v + 0)
  assert.deepEqual(n, expected[i], `нормаль треугольника ${i} смотрит наружу`)
}

// Вершины первого треугольника — три угла нижней грани.
assert.deepEqual(
  [stl.readFloatLE(96), stl.readFloatLE(100), stl.readFloatLE(104)],
  [0, 0, 0],
  'модель начинается в нуле',
)

// --- 3MF ------------------------------------------------------------------

const mf = await bytes(export3MF(mesh))
const mfPath = resolve(out, fileName(PARAMS, '3mf'))
writeFileSync(mfPath, mf)

// Вскрываем штатным zip-ридером, а не своим кодом: смысл проверки в том,
// что пакет читает посторонняя программа.
const listing = execFileSync('unzip', ['-l', mfPath], { encoding: 'utf8' })
for (const part of ['[Content_Types].xml', '_rels/.rels', '3D/3dmodel.model']) {
  assert.ok(listing.includes(part), `в пакете есть ${part}`)
}
execFileSync('unzip', ['-tq', mfPath])

const model = execFileSync('unzip', ['-p', mfPath, '3D/3dmodel.model'], { encoding: 'utf8' })
assert.ok(model.includes('unit="millimeter"'), 'единицы — миллиметры')
assert.equal((model.match(/<vertex /g) ?? []).length, mesh.positions.length / 3, 'число вершин')
assert.equal((model.match(/<triangle /g) ?? []).length, triangles, 'число треугольников')
assert.ok(model.includes(`x="${X}"`), `габарит по X = ${X} записан без погрешности float32`)
assert.ok(model.includes(`y="${Y}"`), `габарит по Y = ${Y}`)
assert.ok(model.includes(`z="${Z}"`), `габарит по Z = ${Z}`)

console.log('export: ok')
console.log(`габарит тестового меша: ${X} × ${Y} × ${Z} мм`)
console.log(stlPath)
console.log(mfPath)
console.log('Откройте 3MF в слайсере и сверьте габарит.')
