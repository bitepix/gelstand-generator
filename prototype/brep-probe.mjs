// Разведка F2: во что упирается построение на B-Rep-ядре (brepjs + occt-wasm).
// Запуск: node prototype/brep-probe.mjs
//
// Итог короткий: одна плитка строится полностью и правильно, сетка — нет.
// Подробности в PROGRESS.md.

import * as B from 'brepjs'
import { init, draw, drawingFuse, drawingCut, drawingFillet, unwrap, fuse, chamfer, edgeFinder, getBounds, getFaces } from 'brepjs'
import { fuse2D, cut2D } from 'brepjs/2d'

import { profiles } from '../src/geometry/profile.js'
import { BASE, HEIGHT, CHAMFER_FOOT, CHAMFER_TOP, FILLET_CONVEX, FILLET_CONCAVE } from '../src/constants.js'

await init()

// --- контуры -----------------------------------------------------------

const area = (c) => { let s = 0; for (let i = 0; i < c.length; i++) { const [x0, y0] = c[i], [x1, y1] = c[(i + 1) % c.length]; s += x0 * y1 - x1 * y0 } return s / 2 }
const outline = (pts) => { let p = draw([pts[0][0], pts[0][1]]); for (let i = 1; i < pts.length; i++) p = p.lineTo([pts[i][0], pts[i][1]]); return p.close() }
const bpOf = (c) => { const d = outline(c); return d.blueprint ?? d }
const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-9

/** Убрать дубли и точки на прямой: скруглению нужен настоящий угол. */
function tidy(c) {
  const o = c.filter((p, i) => i === 0 || !near(p, c[i - 1]))
  while (o.length > 1 && near(o[0], o[o.length - 1])) o.pop()
  const n = o.length
  return o.filter((p, i) => {
    const a = o[(i + n - 1) % n], b = o[(i + 1) % n]
    return Math.abs((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])) > 1e-9
  })
}

function contoursOf(shape) {
  const out = []
  for (const item of shape.blueprints ?? [shape]) for (const b of item.blueprints ?? [item]) {
    if (!b.curves) continue
    const pts = b.curves.map((c) => c.firstPoint).filter(Boolean).map((p) => [p[0], p[1]])
    if (pts.length >= 3) out.push(tidy(pts))
  }
  return out
}

/** Перекрывающиеся прямоугольники профиля → корректные непересекающиеся контуры. */
function clean(rects) {
  const solid = rects.filter((c) => area(c) > 0)
  const holes = rects.filter((c) => area(c) < 0)
  let acc = bpOf(solid[0])
  for (const c of solid.slice(1)) acc = fuse2D(acc, bpOf(c))
  for (const h of holes) acc = cut2D(acc, bpOf(h))
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

/** Прямоугольный контур, раздвинутый на d наружу от материала. */
function widen(contour, d) {
  const n = contour.length
  const lines = contour.map((p, i) => {
    const q = contour[(i + 1) % n]
    const dx = Math.sign(q[0] - p[0]), dy = Math.sign(q[1] - p[1])
    return { horiz: dy === 0, x: p[0] + dy * d, y: p[1] - dx * d }
  })
  return lines.map((l, i) => {
    const prev = lines[(i + n - 1) % n]
    return l.horiz ? [prev.x, l.y] : [l.x, prev.y]
  })
}

// --- скругления --------------------------------------------------------

const cross = (c) => { const t1 = c.firstCurve.tangentAt(1), t2 = c.secondCurve.tangentAt(0); return t1[0] * t2[1] - t1[1] * t2[0] }
const chord = (c) => Math.hypot(c.lastPoint[0] - c.firstPoint[0], c.lastPoint[1] - c.firstPoint[1])
const key = (p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`

/**
 * Скругления ставит ядро, в 2D и настоящими дугами. Радиус свой на каждый
 * угол: выпуклый 1,0, вогнутый 0,5, но не больше 0,45 короткого ребра —
 * иначе две дуги смыкаются, между ними остаётся ребро нулевой длины, и
 * фаска потом падает.
 */
function round2D(drawing, RC = FILLET_CONVEX, RV = FILLET_CONCAVE) {
  const radii = new Map()
  drawingFillet(drawing, RC, (f) => f.when((c) => {
    const target = cross(c) > 0 ? RC : RV
    const limit = Math.floor(Math.min(chord(c.firstCurve), chord(c.secondCurve)) * 45) / 100
    radii.set(key(c.point), Math.min(target, limit))
    return false
  }))
  let out = drawing
  for (const r of [...new Set(radii.values())].filter((v) => v > 0).sort((a, b) => b - a))
    out = drawingFillet(out, r, (f) => f.when((c) => radii.get(key(c.point)) === r))
  return out
}

const topOf = (z) => edgeFinder().when((e) => {
  const b = getBounds(e)
  return Math.abs(b.zMin - z) < 1e-6 && Math.abs(b.zMax - z) < 1e-6
})

const ms = (f) => { const t = performance.now(); const v = f(); return [v, +(performance.now() - t).toFixed(0)] }

// --- построение --------------------------------------------------------

function build(params) {
  const { base, posts } = profiles(params)
  const postC = clean(posts)
  const baseD = round2D(drawingOf(clean(base)))
  const postD = round2D(drawingOf(postC))
  // Юбка подошвы: контур стоек, раздвинутый на 0,5, выдавлен до 1,7 и срезан
  // сверху на 0,5. Фаску по стыку ядро поставить не может — на стыке сходятся
  // плоскость и цилиндр скругления, chamfer на таком сочетании падает всегда.
  const wideD = round2D(drawingOf(postC.map((c) => widen(c, CHAMFER_FOOT))), FILLET_CONVEX + CHAMFER_FOOT, 0)

  const skirt = unwrap(chamfer(wideD.sketchOnPlane('XY').extrude(BASE + CHAMFER_FOOT), topOf(BASE + CHAMFER_FOOT), CHAMFER_FOOT))
  const trimmed = unwrap(B.intersect(skirt, baseD.clone().sketchOnPlane('XY').extrude(HEIGHT)))
  const slab = baseD.clone().sketchOnPlane('XY').extrude(BASE)
  const post = postD.clone().sketchOnPlane('XY').extrude(HEIGHT)
  const body = unwrap(fuse(unwrap(fuse(slab, post)), trimmed))
  return unwrap(chamfer(body, topOf(HEIGHT), CHAMFER_TOP))
}

console.log('— полное построение —')
for (const [name, params] of [
  ['одна плитка', { width: 19.6, depth: 37, nx: 1, ny: 1 }],
  ['эталон 3 × 3', { width: 19.6, depth: 37, nx: 3, ny: 3 }],
  ['полный стол 8 × 4', { width: 19.6, depth: 37, nx: 8, ny: 4 }],
]) {
  try {
    const [body, t] = ms(() => build(params))
    const b = getBounds(body)
    const size = [b.xMax - b.xMin, b.yMax - b.yMin, b.zMax - b.zMin].map((v) => Math.round(v * 1000) / 1000).join(' × ')
    const zs = [...new Set(getFaces(body).flatMap((f) => { const g = getBounds(f); return [g.zMin, g.zMax] }).map((v) => Math.round(v * 100) / 100))].sort((a, b) => a - b)
    console.log(`${name}: ${t} мс, ${size} мм, уровни Z ${zs.join(' / ')}`)
  } catch (e) {
    console.log(`${name}: ${e.message.replace(/^Called unwrap\(\) on an Err: /, '').slice(0, 90)}`)
  }
}

console.log('\n— по операциям —')
for (const [nx, ny] of [[1, 1], [3, 3], [8, 4]]) {
  const { base, posts } = profiles({ width: 19.6, depth: 37, nx, ny })
  const [baseC, t0] = ms(() => clean(base))
  const [postC, t1] = ms(() => clean(posts))
  const [baseD, t2] = ms(() => round2D(drawingOf(baseC)))
  const [postD] = ms(() => round2D(drawingOf(postC)))
  const [slab, t3] = ms(() => baseD.clone().sketchOnPlane('XY').extrude(BASE))
  const [post] = ms(() => postD.clone().sketchOnPlane('XY').extrude(HEIGHT))
  const [body, t4] = ms(() => unwrap(fuse(slab, post)))
  const [top, t5] = ms(() => chamfer(body, topOf(HEIGHT), CHAMFER_TOP))
  console.log(`${nx}×${ny}: контуры ${t0 + t1} мс | скругления ${t2} мс | выдавливание ${t3} мс | fuse ${t4} мс | фаска ${t5} мс (${top.ok ? 'ок' : 'падает'}) | граней ${getFaces(top.ok ? top.value : body).length}`)
}

// --- выгрузка одной плитки --------------------------------------------

if (process.argv.includes('--export')) {
  const { exportSTEP, exportSTL } = await import('brepjs/io')
  const { writeFileSync, mkdirSync } = await import('node:fs')
  mkdirSync(new URL('./out/', import.meta.url), { recursive: true })
  const body = build({ width: 19.6, depth: 37, nx: 1, ny: 1 })
  for (const [name, fn] of [['brep_1x1.step', exportSTEP], ['brep_1x1.stl', (s) => exportSTL(s, { binary: true, tolerance: 0.01, angularTolerance: 0.2 })]]) {
    const blob = unwrap(fn(body))
    writeFileSync(new URL(`./out/${name}`, import.meta.url), Buffer.from(await blob.arrayBuffer()))
    console.log('записан', name)
  }
}
