// Плоские контуры гексагональной ячейки. Геометрия сверена с
// reference/hex/hexStand1.step, разбор — в reference/hex/README.md.
//
// Ячейка — правильный шестиугольник плоской стороной вверх. Стоек три, у
// вершин 0°, 120° и 240°; каждая занимает сектор от середины одной грани,
// через вершину, до середины соседней. Вершины 60°, 180°, 300° остаются
// открытыми: там при стыковке получается сквозной просвет.
//
// Контуры строятся сразу со скруглениями и в трёх вариантах — подошва,
// стойка, верх, — потому что у всех трёх должно совпадать число вершин:
// по ним строятся боковины фасок (см. build.js). Отсюда постоянное число
// точек на дугу.
//
// Зависимостей нет: контуры считаются и проверяются без WASM.

import { CHAMFER_FOOT, CHAMFER_TOP, FILLET_CONVEX } from '../constants.js'

/** Толщина стенки. В прямоугольной модели 1,5, здесь своя. */
export const HEX_WALL = 2.0

/** Отступ проёма в основании от шестиугольника. Постоянная, innerOffset1. */
export const HEX_LEDGE = 6.0

/** Доля диаметра: на столько проём уходит внутрь под стойками. innerOffset2. */
const INNER_SHARE = 1 / 7

/**
 * Сдвиг лучей от осей. В эталоне (Ø 50) он равен 2, то есть совпал со
 * стенкой, но постоянным он быть не может: вершина клина удалена от центра
 * на два сдвига, и уже на Ø 20 она выходит за внутренний радиус проёма —
 * построение вырождается. Значит сдвиг зависит от диаметра, а как именно,
 * по одному образцу не установить. Нужен второй эталон.
 *
 * Решение: сдвиг оставлен постоянным, а минимальный диаметр поднят до 30
 * (DIAMETER_MIN). Предел построения — 22,4, запас втрое больше толщины
 * сопла, и второй эталон не понадобился.
 */
const RAY = HEX_WALL

const ARC = 7 // точек на скругление
const CAV = 32 // точек на дугу полости
const HOLE_ARC = 24 // точек на дугу проёма

const rad = (deg) => (deg * Math.PI) / 180
const pol = (r, a) => [r * Math.cos(a), r * Math.sin(a)]
const add = (p, q) => [p[0] + q[0], p[1] + q[1]]
const mul = (p, k) => [p[0] * k, p[1] * k]
const angleOf = (p) => Math.atan2(p[1], p[0])

/** Конечный угол ближней дуги против часовой стрелки. */
function ccwEnd(from, to) {
  let end = to
  while (end <= from) end += 2 * Math.PI
  while (end - from > Math.PI) end -= 2 * Math.PI
  return end
}

/** То же по часовой. */
function cwEnd(from, to) {
  let sweep = from - to
  while (sweep <= 0) sweep += 2 * Math.PI
  while (sweep > Math.PI) sweep -= 2 * Math.PI
  return from - sweep
}

function arcPoints(center, radius, from, to, count) {
  return Array.from({ length: count }, (_, i) => {
    const a = from + ((to - from) * i) / (count - 1)
    return add(center, pol(radius, a))
  })
}

/**
 * Размеры, выведенные из диаметра баночки.
 *
 * @param {number} diameter диаметр баночки, мм
 */
export function hexMetrics(diameter) {
  const cavity = diameter / 2
  const apothem = cavity + HEX_WALL
  return {
    cavity,
    apothem,
    side: (2 * apothem) / Math.sqrt(3),
    holeOuter: apothem - HEX_LEDGE,
    holeInner: apothem - HEX_LEDGE - diameter * INNER_SHARE,
  }
}

/**
 * Центры ячеек сетки. Нечётные колонки сдвинуты на апофему — это и есть
 * гексагональная упаковка. Пара ячеек, через которую сетка строится в
 * Fusion, здесь не нужна: там прямоугольный паттерн не умеет сдвигать через
 * колонку, а тут ячейки ставятся поштучно.
 */
export function hexLayout(diameter, nx, ny) {
  const { x, y, offset } = hexPitch(diameter)
  const cells = []
  for (let i = 0; i < nx; i += 1) {
    for (let j = 0; j < ny; j += 1) cells.push([x * i, y * j + offset * (i % 2)])
  }
  return cells
}

/** Габарит сетки: у нечётных колонок ряды сдвинуты, поэтому считается отдельно. */
export function hexSize(diameter, nx, ny) {
  const { apothem, side } = hexMetrics(diameter)
  const { x, y, offset } = hexPitch(diameter)
  return {
    x: x * (nx - 1) + 2 * side,
    y: y * (ny - 1) + 2 * apothem + (nx > 1 ? offset : 0),
  }
}

/** Шаг сетки и сдвиг нечётных колонок. */
export function hexPitch(diameter) {
  const { apothem, side } = hexMetrics(diameter)
  return { x: 1.5 * side, y: 2 * apothem, offset: apothem }
}

/**
 * Контур одной стойки на заданном сдвиге.
 *
 * Сдвиг d — это фаска: 0,5 на подошве, 0 на стойке, −0,5 наверху. Грани
 * шестиугольника не двигаются (внешние грани детали плоские), полость
 * сужается на d, торцы расходятся на d, скругление растёт на d. Центр
 * скругления при этом стоит на месте — это следует из того, что он
 * удалён на `полость + R` от центра ячейки и на `R` от торца.
 */
export function postContour(diameter, d, phiDeg) {
  const { cavity, apothem, side } = hexMetrics(diameter)
  const cav = cavity - d
  const fillet = FILLET_CONVEX + d
  const reach = Math.sqrt((cavity + FILLET_CONVEX) ** 2 - FILLET_CONVEX ** 2)

  const dir = (deg) => pol(1, rad(phiDeg + deg))
  const uP = dir(30)
  const nP = dir(120)
  const uM = dir(-30)
  const nM = dir(-120)

  const cP = add(mul(uP, reach), mul(nP, -FILLET_CONVEX))
  const cM = add(mul(uM, reach), mul(nM, -FILLET_CONVEX))
  const aP = angleOf(cP)
  const aM = angleOf(cM)

  const corner = (u, n) => add(mul(u, apothem), mul(n, d))

  return [
    corner(uM, nM),
    pol(side, rad(phiDeg)),
    corner(uP, nP),
    ...arcPoints(cP, fillet, rad(phiDeg + 120), ccwEnd(rad(phiDeg + 120), aP + Math.PI), ARC),
    ...arcPoints([0, 0], cav, aP, cwEnd(aP, aM), CAV),
    ...arcPoints(cM, fillet, aM + Math.PI, ccwEnd(aM + Math.PI, rad(phiDeg - 120)), ARC),
  ]
}

/** Три стойки ячейки. */
export const postContours = (diameter, d) =>
  [0, 120, 240].map((phi) => postContour(diameter, d, phi))

/** Шестиугольник ячейки, против часовой. */
export const hexOutline = (diameter) => {
  const { side } = hexMetrics(diameter)
  return [0, 60, 120, 180, 240, 300].map((a) => pol(side, rad(a)))
}

/** Пересечение луча с окружностью радиуса R в заданном секторе. */
function crossing(normalDeg, R, loDeg, hiDeg) {
  const n = pol(1, rad(normalDeg))
  const t = [-n[1], n[0]]
  const base = mul(n, -RAY)
  const half = Math.sqrt(R * R - RAY * RAY)
  for (const s of [1, -1]) {
    const p = add(base, mul(t, s * half))
    const deg = ((((angleOf(p) * 180) / Math.PI - loDeg) % 360) + 360) % 360
    if (deg > 0 && deg < hiDeg - loDeg) return p
  }
  throw new Error(`hexCell: луч ${normalDeg}° не пересекает R${R} в секторе ${loDeg}…${hiDeg}`)
}

/**
 * Проём в основании, по часовой — это отверстие.
 *
 * Кольцо между holeInner и holeOuter, разрезанное тремя лучами. Под стойкой
 * проём ограничен внутренним радиусом и основание держит стойку, между
 * стойками остаётся полка шириной `HEX_LEDGE − HEX_WALL`.
 */
export function baseHole(diameter) {
  const { holeOuter, holeInner } = hexMetrics(diameter)

  const steps = []
  for (const phi of [0, 120, 240]) {
    steps.push([crossing(phi + 120, holeInner, phi, phi + 60), crossing(phi + 120, holeOuter, phi, phi + 60)])
    steps.push([crossing(phi, holeOuter, phi + 60, phi + 120), crossing(phi, holeInner, phi + 60, phi + 120)])
  }

  const out = []
  for (let i = 0; i < steps.length; i += 1) {
    const prev = steps[(i + steps.length - 1) % steps.length][1]
    const [from, to] = steps[i]
    const radius = Math.hypot(from[0], from[1])
    const a0 = angleOf(prev)
    out.push(...arcPoints([0, 0], radius, a0, ccwEnd(a0, angleOf(from)), HOLE_ARC))
    out.push(to)
  }
  return out.reverse()
}
