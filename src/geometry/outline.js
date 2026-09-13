// Плоские контуры модели. Геометрия сверена с reference/ta2-1.step, разбор —
// в reference/README.md.
//
// Вся деталь — это четыре горизонтальных сечения и два скоса между ними:
//
//   0 … 1,2     основание: габаритный прямоугольник с проёмами
//   1,2 … 1,7   фаска подошвы: контур стоек, раздвинутый на 0,5, сходится к своему
//   1,7 … 14,5  стойки
//   14,5 … 15   фаска верха: контур стоек сжимается на 0,5
//
// Поэтому три контура стоек — подошва, стойка, верх — должны иметь одинаковое
// число вершин и совпадать по порядку: по ним напрямую строятся боковины
// скосов. Отсюда постоянное число точек на угол, даже когда радиус нулевой.
//
// Зависимостей нет: контуры считаются и проверяются без WASM.

import {
  FILLET_CONVEX,
  FILLET_CONCAVE,
  FILLET_HOLE,
  CHAMFER_FOOT,
  CHAMFER_TOP,
} from '../constants.js'

/** Точек на дугу. Радиусы не больше 1,5 мм, больше не нужно. */
const ARC_POINTS = 7

/** Вырожденная дуга всё равно должна быть дугой: иначе вершины не сойдутся. */
const MIN_RADIUS = 1e-3

// Контуры приходят из manifold, а он считает во float32: 67,8 возвращается
// как 67,800003. Поэтому допуски здесь микронные, а не машинные.
const EPS = 1e-3

const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < EPS
const onLine = (v, hi) => Math.abs(v) < EPS || Math.abs(v - hi) < EPS

/** Точка лежит на габаритном прямоугольнике сетки. */
export const onBorder = (p, size) => onLine(p[0], size.x) || onLine(p[1], size.y)

/**
 * Дубли и точки на прямой. Объединение контуров их оставляет, а углу нужен
 * настоящий поворот: на развёрнутом угле скругление даёт мусор.
 */
export function tidy(contour) {
  const out = contour.filter((p, i) => i === 0 || !near(p, contour[i - 1]))
  while (out.length > 1 && near(out[0], out[out.length - 1])) out.pop()
  const n = out.length
  return out.filter((p, i) => {
    const a = out[(i + n - 1) % n]
    const b = out[(i + 1) % n]
    const cross = (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])
    // Синус угла, а не векторное произведение: длины рёбер тут разные,
    // а порог должен быть один.
    return Math.abs(cross) / (Math.hypot(p[0] - a[0], p[1] - a[1]) * Math.hypot(b[0] - p[0], b[1] - p[1])) > 1e-4
  })
}

/** Ребро лежит на габаритном прямоугольнике сетки и потому не двигается. */
function onGrid(p, q, size) {
  return (
    (Math.abs(p[0] - q[0]) < EPS && onLine(p[0], size.x))
    || (Math.abs(p[1] - q[1]) < EPS && onLine(p[1], size.y))
  )
}

/**
 * Контур, раздвинутый на d наружу от материала.
 *
 * Каждое ребро отодвигается по своей нормали, вершина — пересечение двух
 * соседних отодвинутых прямых. Число вершин сохраняется, а на этом держится
 * соответствие контуров: по ним строятся боковины фасок.
 *
 * Рёбра на габарите не двигаются: внешние грани детали плоские, фаска на них
 * не заходит.
 *
 * Наклон рёбер значения не имеет — формула общая. Для прямоугольных контуров
 * она даёт ровно то же, что давал прежний осевой вариант, это проверено
 * тестом.
 */
export function widen(contour, d, size) {
  const n = contour.length
  const lines = contour.map((p, i) => {
    const q = contour[(i + 1) % n]
    const len = Math.hypot(q[0] - p[0], q[1] - p[1])
    // Нормаль наружу от материала: обход против часовой — материал слева.
    // Для отверстий обход по часовой, и знак получается верным сам собой.
    const nx = (q[1] - p[1]) / len
    const ny = -(q[0] - p[0]) / len
    const k = onGrid(p, q, size) ? 0 : d
    return { nx, ny, c: nx * p[0] + ny * p[1] + k }
  })

  return lines.map((l, i) => {
    const k = lines[(i + n - 1) % n]
    const det = k.nx * l.ny - k.ny * l.nx
    // Соседние рёбра параллельны: вершины между ними нет. tidy такие точки
    // убирает, но контур может прийти и снаружи.
    if (Math.abs(det) < 1e-12) return contour[i]
    return [(k.c * l.ny - l.c * k.ny) / det, (k.nx * l.c - l.nx * k.c) / det]
  })
}

/** Знак поворота в вершине: больше нуля — выпуклый угол материала. */
export function turnAt(points, i) {
  const n = points.length
  const a = points[(i + n - 1) % n]
  const b = points[i]
  const c = points[(i + 1) % n]
  return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
}

/** Дуга вместо вершины. Всегда ARC_POINTS точек, даже у острого угла. */
function arc(points, i, radius) {
  const n = points.length
  const a = points[(i + n - 1) % n]
  const b = points[i]
  const c = points[(i + 1) % n]

  if (radius <= 0) return Array.from({ length: ARC_POINTS }, () => [b[0], b[1]])

  const u = [a[0] - b[0], a[1] - b[1]]
  const v = [c[0] - b[0], c[1] - b[1]]
  const lu = Math.hypot(u[0], u[1])
  const lv = Math.hypot(v[0], v[1])
  const un = [u[0] / lu, u[1] / lu]
  const vn = [v[0] / lv, v[1] / lv]

  const cross = un[0] * vn[1] - un[1] * vn[0]
  const dot = un[0] * vn[0] + un[1] * vn[1]
  const theta = Math.atan2(Math.abs(cross), dot)

  const t = radius / Math.tan(theta / 2)
  const p1 = [b[0] + un[0] * t, b[1] + un[1] * t]
  const p2 = [b[0] + vn[0] * t, b[1] + vn[1] * t]

  const bis = [un[0] + vn[0], un[1] + vn[1]]
  const lb = Math.hypot(bis[0], bis[1])
  const d = radius / Math.sin(theta / 2)
  const center = [b[0] + (bis[0] / lb) * d, b[1] + (bis[1] / lb) * d]

  const from = Math.atan2(p1[1] - center[1], p1[0] - center[0])
  let sweep = Math.atan2(p2[1] - center[1], p2[0] - center[0]) - from
  while (sweep <= -Math.PI) sweep += 2 * Math.PI
  while (sweep > Math.PI) sweep -= 2 * Math.PI

  return Array.from({ length: ARC_POINTS }, (_, k) => {
    const angle = from + (sweep * k) / (ARC_POINTS - 1)
    return [center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)]
  })
}

/**
 * Контур со скруглёнными углами.
 *
 * @param {number[][]} contour острый контур
 * @param {(i: number, turn: number) => number} radiusAt радиус для вершины
 */
export function round(contour, radiusAt) {
  const out = []
  for (let i = 0; i < contour.length; i += 1) {
    out.push(...arc(contour, i, radiusAt(i, turnAt(contour, i))))
  }
  return out
}

/**
 * Радиус угла стойки на заданном уровне. Скос меняет радиус вместе с
 * контуром: выпуклый на подошве шире на 0,5, наверху уже на 0,5, вогнутый
 * наоборот. Углы на габарите острые на всех уровнях.
 */
const postRadius = (contour, size, delta) => (i, turn) => {
  if (onBorder(contour[i], size)) return 0
  const base = turn > 0 ? FILLET_CONVEX : FILLET_CONCAVE
  return Math.max(base + (turn > 0 ? delta : -delta), MIN_RADIUS)
}

/**
 * Контуры всех четырёх сечений.
 *
 * @param {{ base: number[][][], posts: number[][][] }} sharp объединённые острые контуры
 * @param {{ x: number, y: number }} size габарит сетки
 */
export function outlines({ base, posts }, size) {
  const sharp = posts.map(tidy)

  const at = (delta) =>
    sharp.map((c) => {
      const moved = delta === 0 ? c : widen(c, delta, size)
      return round(moved, postRadius(moved, size, delta))
    })

  return {
    // Проём в основании скруглён одинаково на всех углах, внешний контур острый.
    slab: base.map(tidy).map((c) => round(c, (i) => (onBorder(c[i], size) ? 0 : FILLET_HOLE))),
    foot: at(CHAMFER_FOOT),
    post: at(0),
    top: at(-CHAMFER_TOP),
  }
}
