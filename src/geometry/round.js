// Скругление вертикальных рёбер. ТЗ v3, таблица 12.2.
//
// Рёбра вертикальные, поэтому скругление целиком живёт в плоском контуре:
// каждый угол заменяется дугой. R 1,0 на выпуклых, R 0,5 на вогнутых.
//
// Морфологический offset (сжать и разжать) для этого не годится: он удаляет
// всё, куда не влезает круг радиуса R, а стенка плитки 1,5 мм — тоньше двух
// радиусов, и стойки бы просто исчезли. Поэтому углы скругляются поимённо.
//
// Зависимостей нет: контуры считаются и проверяются без WASM.

import { FILLET_CONVEX, FILLET_CONCAVE } from '../constants.js'

/** Сегментов на четверть дуги. Больше не нужно: радиусы не превышают 1 мм. */
const ARC_STEPS = 4

/**
 * Скругляет углы всех контуров.
 *
 * Ориентация значащая и соответствует соглашению Clipper: внешние контуры
 * против часовой, отверстия по часовой. Тогда левый поворот — выпуклый угол
 * материала, правый — вогнутый, одинаково для контуров обоих видов.
 *
 * @param {number[][][]} polygons
 * @returns {number[][][]}
 */
export function roundCorners(polygons, rConvex = FILLET_CONVEX, rConcave = FILLET_CONCAVE) {
  return polygons.map((contour) => roundContour(contour, rConvex, rConcave))
}

function roundContour(points, rConvex, rConcave) {
  const n = points.length
  if (n < 3) return points

  const out = []
  for (let i = 0; i < n; i += 1) {
    const a = points[(i - 1 + n) % n]
    const b = points[i]
    const c = points[(i + 1) % n]
    out.push(...corner(a, b, c, rConvex, rConcave))
  }
  return dedupe(out)
}

/**
 * Убирает совпадающие соседние точки, включая пару «последняя — первая».
 * Они появляются там, где дуги двух углов сходятся в одной точке: на торце
 * шириной ровно в два радиуса дуги стыкуются без прямого участка между ними.
 */
function dedupe(points) {
  const out = []
  for (const p of points) {
    const last = out[out.length - 1]
    if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 1e-9) continue
    out.push(p)
  }
  while (out.length > 1) {
    const first = out[0]
    const last = out[out.length - 1]
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) >= 1e-9) break
    out.pop()
  }
  return out
}

/**
 * Дуга вместо одной вершины. Радиус урезается до половины кратчайшего
 * примыкающего ребра — иначе дуги соседних углов налезли бы друг на друга.
 * На торце стойки шириной 1,5 мм это даёт R 0,75, то есть полукруг.
 */
function corner(a, b, c, rConvex, rConcave) {
  const ux = a[0] - b[0]
  const uy = a[1] - b[1]
  const vx = c[0] - b[0]
  const vy = c[1] - b[1]

  const lu = Math.hypot(ux, uy)
  const lv = Math.hypot(vx, vy)
  if (lu === 0 || lv === 0) return [b]

  const un = [ux / lu, uy / lu]
  const vn = [vx / lv, vy / lv]

  // Направление поворота на обходе: левый — выпуклый угол, правый — вогнутый.
  const turn = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
  if (turn === 0) return [b]

  const cross = un[0] * vn[1] - un[1] * vn[0]
  const dot = un[0] * vn[0] + un[1] * vn[1]
  const theta = Math.atan2(Math.abs(cross), dot) // угол между рёбрами, (0, π)
  if (theta < 1e-9 || Math.PI - theta < 1e-9) return [b]

  const half = Math.tan(theta / 2)
  let r = turn > 0 ? rConvex : rConcave
  let t = r / half
  const limit = Math.min(lu, lv) / 2
  if (t > limit) {
    t = limit
    r = t * half
  }
  if (r < 1e-9) return [b]

  const p1 = [b[0] + un[0] * t, b[1] + un[1] * t]
  const p2 = [b[0] + vn[0] * t, b[1] + vn[1] * t]

  // Центр дуги на биссектрисе, на расстоянии r / sin(θ/2) от вершины.
  const bx = un[0] + vn[0]
  const by = un[1] + vn[1]
  const lb = Math.hypot(bx, by)
  const d = r / Math.sin(theta / 2)
  const center = [b[0] + (bx / lb) * d, b[1] + (by / lb) * d]

  const from = Math.atan2(p1[1] - center[1], p1[0] - center[0])
  const to = Math.atan2(p2[1] - center[1], p2[0] - center[0])

  // Кратчайшая дуга в сторону обхода.
  let sweep = to - from
  while (sweep <= -Math.PI) sweep += 2 * Math.PI
  while (sweep > Math.PI) sweep -= 2 * Math.PI

  const steps = Math.max(1, Math.ceil((ARC_STEPS * Math.abs(sweep)) / (Math.PI / 2)))
  const arc = [p1]
  for (let s = 1; s < steps; s += 1) {
    const angle = from + (sweep * s) / steps
    arc.push([center[0] + r * Math.cos(angle), center[1] + r * Math.sin(angle)])
  }
  arc.push(p2)
  return arc
}
