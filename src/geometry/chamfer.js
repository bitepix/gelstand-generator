// Фаски 45° по горизонтальным рёбрам. ТЗ v3, таблица 12.2.
//
// Фаска — переход между контуром и его смещением на разных Z, то есть loft.
// В manifold-3d его нет: extrude умеет только scaleTop, пропорциональный
// масштаб, который на составном контуре даёт неравномерный скос.
//
// Поэтому фаска строится мешем напрямую. Смещённый контур считается здесь же,
// вершина в вершину, поэтому боковые поверхности — ленты с соответствием 1:1
// и триангуляция многоугольника не нужна. Тело получается замкнутым без
// крышек: три ленты образуют кольцо.
//
//        Ct ─────┐  z1        1 — наклонная лента, сама фаска
//         │╲  1  │            2 — нижнее кольцо
//       3 │ ╲    │            3 — внутренняя вертикальная стенка
//         │  ╲   │
//        Ct ── Cb   z0        Cb шире Ct на величину фаски
//            2

/**
 * Контур, смещённый внутрь материала на delta. Отрицательный delta расширяет.
 *
 * Каждая вершина едет по биссектрисе: у выпуклого угла внутрь угла, у
 * вогнутого наружу. Число вершин сохраняется — на этом и держится соответствие
 * 1:1 между контуром и смещённым.
 */
export function offsetContour(points, delta) {
  const n = points.length
  const out = []

  for (let i = 0; i < n; i += 1) {
    const a = points[(i - 1 + n) % n]
    const b = points[i]
    const c = points[(i + 1) % n]

    const ux = a[0] - b[0]
    const uy = a[1] - b[1]
    const vx = c[0] - b[0]
    const vy = c[1] - b[1]
    const lu = Math.hypot(ux, uy)
    const lv = Math.hypot(vx, vy)
    if (lu === 0 || lv === 0) {
      out.push([b[0], b[1]])
      continue
    }

    const un = [ux / lu, uy / lu]
    const vn = [vx / lv, vy / lv]
    const bx = un[0] + vn[0]
    const by = un[1] + vn[1]
    const lb = Math.hypot(bx, by)

    // Развёрнутый угол: биссектриса вырождается, берём нормаль к ребру.
    if (lb < 1e-9) {
      out.push([b[0] - un[1] * delta, b[1] + un[0] * delta])
      continue
    }

    const cross = un[0] * vn[1] - un[1] * vn[0]
    const dot = un[0] * vn[0] + un[1] * vn[1]
    const theta = Math.atan2(Math.abs(cross), dot)
    const turn = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])

    // Вдоль биссектрисы у выпуклого угла, против — у вогнутого.
    const step = (delta / Math.sin(theta / 2)) * (turn >= 0 ? 1 : -1)
    out.push([b[0] + (bx / lb) * step, b[1] + (by / lb) * step])
  }

  return out
}

/**
 * Меш кольца фаски для набора контуров.
 *
 * @param {number[][][]} polygons  контуры на нижнем уровне
 * @param {number} z0  нижний уровень
 * @param {number} z1  верхний уровень
 * @param {number} delta  насколько верхний контур уже нижнего
 * @returns {{ numProp: 3, vertProperties: Float32Array, triVerts: Uint32Array }}
 */
export function chamferRing(polygons, z0, z1, delta) {
  const verts = []
  const tris = []

  for (const outer of polygons) {
    const n = outer.length
    if (n < 3) continue
    const inner = offsetContour(outer, delta)

    // Три ряда вершин: нижний широкий, нижний узкий, верхний узкий.
    const base = verts.length / 3
    for (const [x, y] of outer) verts.push(x, y, z0)
    for (const [x, y] of inner) verts.push(x, y, z0)
    for (const [x, y] of inner) verts.push(x, y, z1)

    const lowOuter = base
    const lowInner = base + n
    const topInner = base + 2 * n

    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n

      // Наклонная лента снаружи: от широкого низа к узкому верху.
      tris.push(lowOuter + i, lowOuter + j, topInner + j)
      tris.push(lowOuter + i, topInner + j, topInner + i)

      // Нижнее кольцо, нормалью вниз.
      tris.push(lowOuter + i, lowInner + j, lowOuter + j)
      tris.push(lowOuter + i, lowInner + i, lowInner + j)

      // Внутренняя стенка, нормалью внутрь кольца.
      tris.push(lowInner + i, topInner + i, topInner + j)
      tris.push(lowInner + i, topInner + j, lowInner + j)
    }
  }

  return {
    numProp: 3,
    vertProperties: new Float32Array(verts),
    triVerts: new Uint32Array(tris),
  }
}
