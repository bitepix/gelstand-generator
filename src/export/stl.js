// Бинарный STL. ТЗ v3, раздел 13 — «20 строк собственного кода».
//
// Формат: 80 байт заголовка, uint32 с числом треугольников, дальше по
// 50 байт на треугольник — нормаль и три вершины по три float32,
// плюс двухбайтовое поле атрибутов. Всё little-endian.
// Единиц измерения в STL нет: слайсер считает числа миллиметрами.

const HEADER = 80
const TRIANGLE = 50

/** Заголовок не должен начинаться со слова solid — иначе файл примут за текстовый. */
const SIGNATURE = 'Nail Modernism Gelstand'

/**
 * @param {{ positions: Float32Array, indices: Uint32Array }} mesh
 * @returns {Blob}
 */
export function exportSTL(mesh) {
  const { positions, indices } = mesh
  const count = indices.length / 3

  const buffer = new ArrayBuffer(HEADER + 4 + count * TRIANGLE)
  const view = new DataView(buffer)

  new Uint8Array(buffer, 0, HEADER).set(new TextEncoder().encode(SIGNATURE))
  view.setUint32(HEADER, count, true)

  let offset = HEADER + 4
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3
    const b = indices[i + 1] * 3
    const c = indices[i + 2] * 3

    const n = normal(positions, a, b, c)
    view.setFloat32(offset, n[0], true)
    view.setFloat32(offset + 4, n[1], true)
    view.setFloat32(offset + 8, n[2], true)
    offset += 12

    for (const v of [a, b, c]) {
      view.setFloat32(offset, positions[v], true)
      view.setFloat32(offset + 4, positions[v + 1], true)
      view.setFloat32(offset + 8, positions[v + 2], true)
      offset += 12
    }

    view.setUint16(offset, 0, true)
    offset += 2
  }

  return new Blob([buffer], { type: 'model/stl' })
}

/** Единичная нормаль треугольника по правилу правой руки. */
function normal(p, a, b, c) {
  const ux = p[b] - p[a]
  const uy = p[b + 1] - p[a + 1]
  const uz = p[b + 2] - p[a + 2]
  const vx = p[c] - p[a]
  const vy = p[c + 1] - p[a + 1]
  const vz = p[c + 2] - p[a + 2]

  const x = uy * vz - uz * vy
  const y = uz * vx - ux * vz
  const z = ux * vy - uy * vx

  const len = Math.hypot(x, y, z)
  return len === 0 ? [0, 0, 0] : [x / len, y / len, z / len]
}
