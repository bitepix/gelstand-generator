// Прототип F1: геометрия на brepjs + occt-wasm.
// Запуск: node prototype/tile.mjs
//
// Цель — не код для проекта, а ответ на три вопроса: получается ли геометрия,
// совпадает ли она с ta2-1.step и сколько это стоит по времени.

import {
  init,
  draw,
  drawingCut,
  drawingFuse,
  unwrap,
  fuse,
  chamfer,
  edgeFinder,
  getBounds,
  measureVolume,
} from 'brepjs'

import { profiles } from '../src/geometry/profile.js'
import { roundCorners } from '../src/geometry/round.js'
import { BASE, HEIGHT, CHAMFER_FOOT, CHAMFER_TOP } from '../src/constants.js'

const tInit = performance.now()
await init()
const initMs = performance.now() - tInit

/** Контур точка за точкой. Первая точка — начало пера, дальше отрезки. */
function outline(points) {
  let pen = draw([points[0][0], points[0][1]])
  for (let i = 1; i < points.length; i += 1) pen = pen.lineTo([points[i][0], points[i][1]])
  return pen.close()
}

/** Набор контуров: положительные складываются, отрицательные вычитаются. */
function region(contours) {
  const area = (c) => {
    let sum = 0
    for (let i = 0; i < c.length; i += 1) {
      const [x0, y0] = c[i]
      const [x1, y1] = c[(i + 1) % c.length]
      sum += x0 * y1 - x1 * y0
    }
    return sum / 2
  }

  const solid = contours.filter((c) => area(c) > 0)
  const holes = contours.filter((c) => area(c) < 0)

  let shape = outline(solid[0])
  for (const c of solid.slice(1)) shape = drawingFuse(shape, outline(c))
  for (const c of holes) shape = drawingCut(shape, outline(c))
  return shape
}

/** Рёбра, целиком лежащие на заданной высоте. */
const atLevel = (z) =>
  edgeFinder().when((edge) => {
    const b = getBounds(edge)
    return Math.abs(b.zMin - z) < 1e-6 && Math.abs(b.zMax - z) < 1e-6
  })

function build(params) {
  const { base, posts } = profiles(params)

  // Скругления вертикальных рёбер остаются своими: радиусы разные — 1,0 на
  // выпуклых, 0,5 на вогнутых, — и на торце стойки шириной 1,5 мм радиус
  // приходится урезать. Ядро на таком наборе рёбер падает целиком.
  const baseShape = region(roundCorners(base))
  const postShape = region(roundCorners(posts))

  const slab = baseShape.sketchOnPlane('XY').extrude(BASE)
  const shaft = postShape.sketchOnPlane('XY').extrude(HEIGHT)
  let body = unwrap(fuse(slab, shaft))

  body = unwrap(chamfer(body, atLevel(HEIGHT), CHAMFER_TOP))
  body = unwrap(chamfer(body, atLevel(BASE), CHAMFER_FOOT))
  return body
}

console.log(`инициализация ядра: ${initMs.toFixed(0)} мс\n`)

const CASES = [
  ['эталон 3 × 3', { width: 19.6, depth: 37, nx: 3, ny: 3 }],
  ['типичная 5 × 10', { width: 19.6, depth: 37, nx: 5, ny: 10 }],
  ['полный стол 8 × 4', { width: 19.6, depth: 37, nx: 8, ny: 4 }],
  ['мелкая 10 × 10', { width: 10, depth: 12, nx: 10, ny: 10 }],
]

for (const [name, params] of CASES) {
  const t = performance.now()
  try {
    const body = build(params)
    const ms = performance.now() - t
    const b = getBounds(body)
    const size = [b.xMax - b.xMin, b.yMax - b.yMin, b.zMax - b.zMin]
      .map((v) => Math.round(v * 1000) / 1000)
      .join(' × ')
    const vol = measureVolume(body)
    console.log(`${name}: ${ms.toFixed(0)} мс, ${size} мм, объём ${vol.ok ? vol.value.toFixed(1) : '—'}`)
  } catch (error) {
    console.log(`${name}: ошибка — ${error.message}`)
  }
}
