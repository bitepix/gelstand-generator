// Построение модели на B-Rep-ядре. Геометрия сверена с reference/ta2-1.step,
// разбор — в reference/README.md.
//
// Форма описывается плоскими профилями (profile.js), но отдать их ядру как
// есть нельзя: там перекрывающиеся прямоугольники — уголок стойки это два
// налезающих друг на друга прямоугольника, а уголки четырёх соседних плиток
// складываются в крест. Мешевый движок разбирал такое сам по правилу заливки,
// OCCT требует корректных контуров. Поэтому сначала 2D-булевы операции.
//
// Скругления ставит ядро, в 2D и настоящими дугами: радиус нужен свой на
// каждый угол, а по рёбрам ядро на таком наборе падает.
//
// Фаска подошвы собирается юбкой, а не операцией chamfer: на стыке стойки с
// основанием сходятся плоскость и цилиндр вертикального скругления, и на
// такой касательной цепочке chamfer падает при любом радиусе.

import * as B from 'brepjs'
import { init, draw, drawingFuse, drawingCut, drawingFillet, unwrap, fuse, chamfer, edgeFinder, getBounds, mesh } from 'brepjs'
import { fuse2D, cut2D } from 'brepjs/2d'

import { BASE, HEIGHT, CHAMFER_FOOT, CHAMFER_TOP, FILLET_CONVEX, FILLET_CONCAVE, FILLET_HOLE } from '../constants.js'
import { profiles } from './profile.js'

/** Ядро инициализируется один раз. Вызов начинается заранее — см. warmUp. */
let ready = null

export function warmUp() {
  if (ready === null) ready = init()
  return ready
}

// --- контуры -----------------------------------------------------------

/** Площадь со знаком: против часовой — материал, по часовой — отверстие. */
function area(contour) {
  let sum = 0
  for (let i = 0; i < contour.length; i += 1) {
    const [x0, y0] = contour[i]
    const [x1, y1] = contour[(i + 1) % contour.length]
    sum += x0 * y1 - x1 * y0
  }
  return sum / 2
}

function outline(points) {
  let pen = draw([points[0][0], points[0][1]])
  for (let i = 1; i < points.length; i += 1) pen = pen.lineTo([points[i][0], points[i][1]])
  return pen.close()
}

const blueprintOf = (contour) => {
  const drawing = outline(contour)
  return drawing.blueprint ?? drawing
}

const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-9

/** Дубли и точки на прямой: булевы операции их оставляют, а скруглению нужен угол. */
function tidy(contour) {
  const out = contour.filter((p, i) => i === 0 || !near(p, contour[i - 1]))
  while (out.length > 1 && near(out[0], out[out.length - 1])) out.pop()
  const n = out.length
  return out.filter((p, i) => {
    const a = out[(i + n - 1) % n]
    const b = out[(i + 1) % n]
    return Math.abs((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])) > 1e-9
  })
}

function contoursOf(shape) {
  const out = []
  for (const item of shape.blueprints ?? [shape]) {
    for (const b of item.blueprints ?? [item]) {
      if (!b.curves) continue
      const points = b.curves.map((c) => c.firstPoint).filter(Boolean).map((p) => [p[0], p[1]])
      if (points.length >= 3) out.push(tidy(points))
    }
  }
  return out
}

/** Перекрывающиеся прямоугольники профиля → корректные контуры. */
function clean(rects) {
  const solid = rects.filter((c) => area(c) > 0)
  const holes = rects.filter((c) => area(c) < 0)
  let acc = blueprintOf(solid[0])
  for (const c of solid.slice(1)) acc = fuse2D(acc, blueprintOf(c))
  for (const h of holes) acc = cut2D(acc, blueprintOf(h))
  return contoursOf(acc)
}

function drawingOf(contours) {
  const solid = contours.filter((c) => area(c) > 0)
  const holes = contours.filter((c) => area(c) < 0)
  let d = outline(solid[0])
  for (const c of solid.slice(1)) d = drawingFuse(d, outline(c))
  for (const h of holes) d = drawingCut(d, outline(h))
  return d
}

// --- граница сетки -----------------------------------------------------
//
// Внешние грани детали плоские: ни скруглений, ни фасок. Поэтому всё, что
// лежит на габаритном прямоугольнике, не скругляется и не двигается.

const onLine = (v, hi) => Math.abs(v) < 1e-6 || Math.abs(v - hi) < 1e-6
const onBorder = (p, size) => onLine(p[0], size.x) || onLine(p[1], size.y)

/** Контур, раздвинутый на d наружу от материала; рёбра на границе стоят. */
function widen(contour, d, size) {
  const n = contour.length
  const lines = contour.map((p, i) => {
    const q = contour[(i + 1) % n]
    const dx = Math.sign(q[0] - p[0])
    const dy = Math.sign(q[1] - p[1])
    const fixed = dy === 0 ? onLine(p[1], size.y) : onLine(p[0], size.x)
    const k = fixed ? 0 : d
    return { horiz: dy === 0, x: p[0] + dy * k, y: p[1] - dx * k }
  })
  return lines.map((l, i) => {
    const prev = lines[(i + n - 1) % n]
    return l.horiz ? [prev.x, l.y] : [l.x, prev.y]
  })
}

// --- скругления --------------------------------------------------------

const cross = (c) => {
  const t1 = c.firstCurve.tangentAt(1)
  const t2 = c.secondCurve.tangentAt(0)
  return t1[0] * t2[1] - t1[1] * t2[0]
}
const key = (p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`

/** Скругления по одному радиусу за проход: ядро берёт только одно число. */
function round2D(drawing, size, convex, concave) {
  const radii = new Map()
  drawingFillet(drawing, convex || 1, (f) => f.when((c) => {
    radii.set(key(c.point), onBorder(c.point, size) ? 0 : (cross(c) > 0 ? convex : concave))
    return false
  }))
  let out = drawing
  for (const r of [...new Set(radii.values())].filter((v) => v > 0).sort((a, b) => b - a))
    out = drawingFillet(out, r, (f) => f.when((c) => radii.get(key(c.point)) === r))
  return out
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
  return meshOf(solidOf(params))
}

export function solidOf(params) {
  const { base, posts, size } = profiles(params)
  const postC = clean(posts)

  const baseD = round2D(drawingOf(clean(base)), size, FILLET_HOLE, FILLET_HOLE)
  const postD = round2D(drawingOf(postC), size, FILLET_CONVEX, FILLET_CONCAVE)
  // Юбка подошвы: тот же контур, раздвинутый на 0,5, выдавленный до 1,7 и
  // срезанный сверху. Вогнутый радиус на её уровне вырождается в ноль —
  // так же, как в оригинале.
  const wideD = round2D(
    drawingOf(postC.map((c) => widen(c, CHAMFER_FOOT, size))),
    size,
    FILLET_CONVEX + CHAMFER_FOOT,
    Math.max(FILLET_CONCAVE - CHAMFER_FOOT, 0),
  )

  const skirt = unwrap(chamfer(
    wideD.sketchOnPlane('XY').extrude(BASE + CHAMFER_FOOT),
    atLevel(BASE + CHAMFER_FOOT),
    CHAMFER_FOOT,
  ))
  const slab = baseD.clone().sketchOnPlane('XY').extrude(BASE)
  const post = postD.clone().sketchOnPlane('XY').extrude(HEIGHT)

  // simplify склеивает соосные грани: без него стенка стойки разрезана
  // пополам на уровне 1,7, там где к ней пристаёт юбка.
  const body = unwrap(fuse(unwrap(fuse(slab, post, { simplify: true })), skirt, { simplify: true }))
  return unwrap(chamfer(body, atLevel(HEIGHT), CHAMFER_TOP))
}

function meshOf(body) {
  const geometry = unwrap(mesh(body, { tolerance: 0.01, angularTolerance: 0.3 }))
  const box = getBounds(body)
  return {
    positions: new Float32Array(geometry.vertices),
    indices: new Uint32Array(geometry.triangles),
    bbox: { x: mm(box.xMax - box.xMin), y: mm(box.yMax - box.yMin), z: mm(box.zMax - box.zMin) },
  }
}
