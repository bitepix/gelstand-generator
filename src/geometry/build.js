// Построение модели на B-Rep-ядре. ТЗ v4, разделы 12.3–12.5, контракт 14.2.
//
// Форма описывается плоскими профилями (profile.js), но отдать их ядру как
// есть нельзя: там перекрывающиеся прямоугольники — уголок стойки это два
// налезающих друг на друга прямоугольника, а уголки четырёх соседних плиток
// складываются в крест. Мешевый движок разбирал такое сам по правилу заливки,
// OCCT требует корректных контуров и отвечает «wire might be non planar».
// Поэтому прямоугольники сначала объединяются 2D-булевыми операциями.
//
// Скругления вертикальных рёбер остаются своими, в 2D. Ядро умеет fillet по
// рёбрам, но радиусы у нас разные — 1,0 на выпуклых, 0,5 на вогнутых, — и на
// торце стойки шириной 1,5 мм радиус приходится урезать. На таком наборе
// рёбер ядро валит операцию целиком.
//
// Фаски, наоборот, ставит ядро: это горизонтальные рёбра на уровнях 1,2 и
// 15,0, и они адресуются по высоте.

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
  mesh,
} from 'brepjs'
import { fuse2D, cut2D } from 'brepjs/2d'

import { BASE, HEIGHT, CHAMFER_FOOT, CHAMFER_TOP } from '../constants.js'
import { profiles } from './profile.js'
import { roundCorners } from './round.js'

/** Ядро инициализируется один раз. Вызов начинается заранее — см. warmUp. */
let ready = null

export function warmUp() {
  if (ready === null) ready = init()
  return ready
}

/** Площадь контура со знаком: против часовой — материал, по часовой — отверстие. */
function area(contour) {
  let sum = 0
  for (let i = 0; i < contour.length; i += 1) {
    const [x0, y0] = contour[i]
    const [x1, y1] = contour[(i + 1) % contour.length]
    sum += x0 * y1 - x1 * y0
  }
  return sum / 2
}

/** Контур точка за точкой. */
function outline(points) {
  let pen = draw([points[0][0], points[0][1]])
  for (let i = 1; i < points.length; i += 1) pen = pen.lineTo([points[i][0], points[i][1]])
  return pen.close()
}

const blueprintOf = (contour) => {
  const drawing = outline(contour)
  return drawing.blueprint ?? drawing
}

/** Совпадающие соседние точки и замыкающий дубль ломают построение грани. */
function dedupe(contour) {
  const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-9
  const out = contour.filter((p, i) => i === 0 || !near(p, contour[i - 1]))
  while (out.length > 1 && near(out[0], out[out.length - 1])) out.pop()
  return out
}

/** Точки всех контуров результата 2D-булевой операции. */
function contoursOf(shape) {
  const out = []
  for (const item of shape.blueprints ?? [shape]) {
    for (const b of item.blueprints ?? [item]) {
      if (!b.curves) continue
      const points = b.curves.map((c) => c.firstPoint).filter(Boolean).map((p) => [p[0], p[1]])
      if (points.length >= 3) out.push(dedupe(points))
    }
  }
  return out
}

/** Объединение перекрывающихся прямоугольников в корректные контуры. */
function unite(rects) {
  let acc = blueprintOf(rects[0])
  for (let i = 1; i < rects.length; i += 1) acc = fuse2D(acc, blueprintOf(rects[i]))
  return contoursOf(acc)
}

/** Внешний контур минус отверстия. */
function punch(rects) {
  const solid = rects.filter((c) => area(c) > 0)
  const holes = rects.filter((c) => area(c) < 0)
  let acc = blueprintOf(solid[0])
  for (const c of solid.slice(1)) acc = fuse2D(acc, blueprintOf(c))
  for (const h of holes) acc = cut2D(acc, blueprintOf(h))
  return contoursOf(acc)
}

/**
 * Чертёж из набора контуров: положительные складываются, отрицательные
 * вычитаются. Здесь контуры уже не пересекаются — их развело объединение, —
 * поэтому хватает операций над чертежами.
 */
function region(contours) {
  const solid = contours.filter((c) => area(c) > 0)
  const holes = contours.filter((c) => area(c) < 0)

  let acc = outline(solid[0])
  for (const c of solid.slice(1)) acc = drawingFuse(acc, outline(c))
  for (const h of holes) acc = drawingCut(acc, outline(h))
  return acc
}

/** Рёбра, целиком лежащие на заданной высоте. */
const atLevel = (z) =>
  edgeFinder().when((edge) => {
    const b = getBounds(edge)
    return Math.abs(b.zMin - z) < 1e-6 && Math.abs(b.zMax - z) < 1e-6
  })

/** Меш приходит во float32: 22,6 в нём хранится как 22,600000381. */
const mm = (value) => Math.round(value * 1000) / 1000

/**
 * @param {{ width: number, depth: number, nx: number, ny: number }} params
 * @returns {Promise<{ positions: Float32Array, indices: Uint32Array, bbox: { x: number, y: number, z: number } }>}
 */
export async function build(params) {
  await warmUp()

  const { base, posts } = profiles(params)

  // Скругления ставятся после объединения: до него углов креста ещё нет,
  // они появляются на стыке плиток.
  const slabShape = region(roundCorners(punch(base)))
  const postShape = region(roundCorners(unite(posts)))

  const slab = slabShape.sketchOnPlane('XY').extrude(BASE)
  const shaft = postShape.sketchOnPlane('XY').extrude(HEIGHT)

  let body = unwrap(fuse(slab, shaft))
  body = unwrap(chamfer(body, atLevel(HEIGHT), CHAMFER_TOP))
  body = unwrap(chamfer(body, atLevel(BASE), CHAMFER_FOOT))

  const geometry = unwrap(mesh(body, { tolerance: 0.01, angularTolerance: 0.3 }))
  const box = getBounds(body)

  return {
    positions: new Float32Array(geometry.vertices),
    indices: new Uint32Array(geometry.triangles),
    bbox: {
      x: mm(box.xMax - box.xMin),
      y: mm(box.yMax - box.yMin),
      z: mm(box.zMax - box.zMin),
    },
  }
}
